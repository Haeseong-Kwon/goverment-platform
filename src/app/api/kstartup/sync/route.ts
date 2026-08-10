import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";
import { normalizeAnnouncement, toIsoDate, type Announcement } from "@/lib/kstartup/announcements";
import { toKstDateKey } from "@/features/startup-workspace/logic";

/**
 * 페이지를 순차로 받아 오는 작업이라 기본 함수 타임아웃(초 단위)에 걸릴 수 있습니다.
 * 로컬 실측은 31페이지에 6.9초였고, 배포 리전에서 data.go.kr까지의 지연이 더해집니다.
 * 잘리면 "일부만 동기화"가 아니라 502로 끝나 이전 데이터가 그대로 남습니다(무해하지만 갱신 정지).
 */
export const maxDuration = 60;

const BASE_URL = "https://apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01";
const PER_PAGE = 100;

/**
 * 목록은 최신 등록순입니다(1페이지 = 가장 최근 등록 공고).
 * 접수 중인 공고는 앞쪽 몇 페이지에 몰려 있어 전체 3만 건을 매일 긁을 이유가 없습니다.
 * 다만 마감일이 페이지마다 섞여 있어 "0건인 페이지 하나"로 끊으면 뒤쪽 공고를 놓칩니다.
 * 빈 페이지가 연속 3장 나올 때까지만 더 봅니다.
 */
/**
 * 상한은 폭주 방지용이지 정상 종료 수단이 아닙니다. 실측(2026-08) 기준 유효 공고는
 * 26페이지까지 드문드문 남아 있고 40페이지부터 완전히 사라집니다. 25로 두었더니
 * 상한에서 잘려 뒤쪽 공고를 조용히 놓쳤습니다. 빈 페이지 연속 규칙이 먼저 걸리도록
 * 넉넉히 잡습니다(60요청/일은 개발계정 10,000 한도에 영향 없음).
 */
const MAX_PAGES = 60;
const EMPTY_PAGE_STREAK_LIMIT = 3;

/** 지난 공고를 언제까지 남길지. 마감 직후 "그 공고 어디 갔냐"를 막는 최소한의 여유입니다. */
const KEEP_CLOSED_DAYS = 14;

/**
 * 공공데이터포털은 같은 인증키를 Encoding·Decoding 두 형태로 나란히 보여 줍니다.
 * 아래에서 URLSearchParams가 한 번 더 인코딩하므로, Encoding 값을 그대로 넣으면
 * `%2B`가 `%252B`가 되어 "등록되지 않은 서비스키(30)"로 거절당합니다.
 * 어느 쪽을 붙여 넣어도 되게 여기서 한 번 되돌립니다.
 */
export function normalizeServiceKey(rawKey: string): string {
  if (!rawKey.includes("%")) return rawKey;
  try {
    return decodeURIComponent(rawKey);
  } catch {
    // 퍼센트가 인코딩이 아닌 일반 문자인 키. 그대로 씁니다.
    return rawKey;
  }
}

async function fetchPage(serviceKey: string, page: number): Promise<Record<string, unknown>[]> {
  const url = new URL(BASE_URL);
  url.searchParams.set("serviceKey", serviceKey);
  url.searchParams.set("page", String(page));
  url.searchParams.set("perPage", String(PER_PAGE));
  url.searchParams.set("returnType", "json");

  const response = await fetch(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`K-Startup ${page}페이지 응답 실패 (HTTP ${response.status}): ${body.slice(0, 200)}`);

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    // 인증키 오류·점검 중에는 JSON 대신 XML/HTML이 옵니다. 그대로 두면 "0건 동기화 성공"으로 보입니다.
    throw new Error(`K-Startup이 JSON이 아닌 응답을 보냈습니다: ${body.slice(0, 200)}`);
  }

  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) throw new Error(`K-Startup 응답에 data 배열이 없습니다: ${body.slice(0, 200)}`);
  return data as Record<string, unknown>[];
}

function shiftDateKey(dateKey: string, days: number): string {
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * K-Startup 공고를 내려받아 캐시 테이블에 반영합니다.
 *
 * Vercel Cron이 `Authorization: Bearer $CRON_SECRET`으로 호출합니다.
 * upstream 갱신이 일 1회라 그보다 자주 돌 이유가 없습니다.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const rawServiceKey = process.env.DATA_GO_KR_API_KEY?.trim();
  const serviceKey = rawServiceKey ? normalizeServiceKey(rawServiceKey) : rawServiceKey;

  if (!cronSecret) return NextResponse.json({ error: "CRON_SECRET이 설정되지 않아 동기화가 꺼져 있습니다." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "인증되지 않은 요청입니다." }, { status: 401 });
  }
  if (!serviceKey) return NextResponse.json({ error: "DATA_GO_KR_API_KEY가 설정되지 않았습니다." }, { status: 503 });

  const today = toKstDateKey();
  const cutoff = shiftDateKey(today, -KEEP_CLOSED_DAYS);
  const collected = new Map<number, Announcement>();
  let emptyStreak = 0;
  let pagesRead = 0;
  // 상한에서 끊긴 것과 다 읽고 끝난 것을 구분해 응답에 남깁니다.
  // 구분이 없으면 "동기화 성공"이 곧 "빠짐없이 받았다"로 읽혀 누락을 못 알아챕니다.
  let reachedPageLimit = false;

  try {
    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const rows = await fetchPage(serviceKey, page);
      pagesRead = page;
      if (rows.length === 0) break;

      // 보관 기준을 만족하는 행만 담습니다. 지난 공고까지 넣으면 3만 건이 통째로 들어옵니다.
      const kept = rows
        .filter((row) => (toIsoDate(row.pbanc_rcpt_end_dt) ?? cutoff) >= cutoff)
        .flatMap((row) => {
          const announcement = normalizeAnnouncement(row);
          return announcement ? [announcement] : [];
        });

      kept.forEach((announcement) => collected.set(announcement.pbanc_sn, announcement));
      emptyStreak = kept.length === 0 ? emptyStreak + 1 : 0;
      if (emptyStreak >= EMPTY_PAGE_STREAK_LIMIT) break;
      reachedPageLimit = page === MAX_PAGES;
    }
  } catch (error) {
    // 부분 실패로 테이블을 반쯤 비우지 않습니다. 이전 동기화 결과를 그대로 두는 편이
    // "공고가 사라진 화면"보다 정확합니다.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "K-Startup 공고를 내려받지 못했습니다." },
      { status: 502 },
    );
  }

  const announcements = [...collected.values()];
  if (announcements.length === 0) {
    return NextResponse.json({ error: "내려받은 공고가 0건이라 반영하지 않았습니다.", pagesRead }, { status: 502 });
  }

  const client = createAdminClient();
  const syncedAt = new Date().toISOString();
  const { error: upsertError } = await client
    .from("kstartup_announcements")
    .upsert(announcements.map((announcement) => ({ ...announcement, synced_at: syncedAt })), { onConflict: "pbanc_sn" });
  if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 });

  // 보관 기간이 지난 공고를 정리합니다. upsert만 하면 테이블이 단조 증가합니다.
  const { error: deleteError, count: removed } = await client
    .from("kstartup_announcements")
    .delete({ count: "exact" })
    .lt("end_date", cutoff);
  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 500 });

  return NextResponse.json({
    synced: announcements.length,
    removed: removed ?? 0,
    pagesRead,
    syncedAt,
    reachedPageLimit,
    ...(reachedPageLimit
      ? { warning: `${MAX_PAGES}페이지 상한에서 멈췄습니다. 뒤쪽 공고가 빠졌을 수 있으니 MAX_PAGES를 올리세요.` }
      : {}),
  });
}
