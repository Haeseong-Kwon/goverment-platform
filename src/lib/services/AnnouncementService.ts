import { supabase } from "../supabase";
import { DEV_BYPASS } from "../dev/devMode";
import type { Announcement } from "../kstartup/announcements";
import { toKstDateKey } from "@/features/startup-workspace/logic";

export const ANNOUNCEMENTS_PAGE_SIZE = 20;

export type AnnouncementSort = "deadline" | "recent";

export interface AnnouncementFilters {
  keyword: string;
  supportFields: string[];
  regions: string[];
  bizAges: string[];
  applicantTypes: string[];
  targetAges: string[];
  /** 마감이 지난 공고까지 볼지. 기본은 접수 중·예정만 봅니다. */
  includeClosed: boolean;
  sort: AnnouncementSort;
}

export const EMPTY_FILTERS: AnnouncementFilters = {
  keyword: "",
  supportFields: [],
  regions: [],
  bizAges: [],
  applicantTypes: [],
  targetAges: [],
  includeClosed: false,
  sort: "deadline",
};

export interface AnnouncementPage {
  rows: Announcement[];
  total: number;
}

/**
 * PostgREST의 `or=` 문법은 쉼표·괄호·마침표가 전부 구분자입니다.
 * 검색어를 그대로 끼워 넣으면 사용자가 입력한 쉼표 하나로 조건이 갈라져
 * 엉뚱한 결과가 나오거나 요청이 깨집니다. 한글·영숫자·공백·하이픈만 남깁니다.
 */
export function sanitizeKeyword(keyword: string): string {
  return keyword.replace(/[^0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ\s-]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

/**
 * Postgres 배열 리터럴. supabase-js의 `overlaps(column, string[])`는 값을 그대로
 * 쉼표로 이어 붙여 `{a,b}`를 만들기 때문에, 값 안에 쉼표·중괄호·따옴표가 들어오면
 * 원소 경계가 어긋납니다. 문자열을 직접 넘겨 각 원소를 큰따옴표로 감쌉니다.
 */
export function toArrayLiteral(values: string[]): string {
  return `{${values.map((value) => `"${value.replace(/(["\\])/g, "\\$1")}"`).join(",")}}`;
}

export async function searchAnnouncements(
  filters: AnnouncementFilters,
  page = 0,
  pageSize = ANNOUNCEMENTS_PAGE_SIZE,
): Promise<AnnouncementPage> {
  if (DEV_BYPASS || !supabase) {
    return (await import("../dev/devServices")).devSearchAnnouncements(filters, page, pageSize);
  }

  const today = toKstDateKey();
  let query = supabase.from("kstartup_announcements").select("*", { count: "exact" });

  if (!filters.includeClosed) {
    // 마감일이 비어 있는 공고를 조건에서 떨어뜨리면 상시 접수 건이 통째로 사라집니다.
    query = query.or(`end_date.gte.${today},end_date.is.null`);
  }
  if (filters.supportFields.length > 0) query = query.in("support_field", filters.supportFields);
  if (filters.regions.length > 0) {
    // 지역을 고른 사람도 전국 공고는 신청할 수 있습니다. 빼면 대부분의 공고가 사라집니다.
    query = query.overlaps("regions", toArrayLiteral([...filters.regions, "전국"]));
  }
  if (filters.bizAges.length > 0) query = query.overlaps("biz_ages", toArrayLiteral(filters.bizAges));
  if (filters.applicantTypes.length > 0) query = query.overlaps("applicant_types", toArrayLiteral(filters.applicantTypes));
  if (filters.targetAges.length > 0) query = query.overlaps("target_ages", toArrayLiteral(filters.targetAges));

  const keyword = sanitizeKeyword(filters.keyword);
  // ponytail: ILIKE 순차 스캔입니다. 접수 중 공고가 수백 건이라 지금은 즉시 응답합니다.
  // 보관 범위를 넓혀 느려지면 pg_trgm 인덱스나 tsvector 컬럼을 추가하세요.
  if (keyword) query = query.or(`title.ilike.*${keyword}*,summary.ilike.*${keyword}*`);

  query =
    filters.sort === "recent"
      ? query.order("pbanc_sn", { ascending: false })
      : query.order("end_date", { ascending: true, nullsFirst: false });

  const from = page * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throw error;
  return { rows: (data ?? []) as Announcement[], total: count ?? 0 };
}

/** 캘린더 격자에 겹쳐 그리는 공고 마감 한 건. 목록 화면보다 가벼운 필드만 씁니다. */
export interface AnnouncementDeadline {
  sn: number;
  title: string;
  endDate: string;
  supportField: string | null;
  regions: string[];
  detailUrl: string;
}

/**
 * 달력에 보이는 기간의 공고 마감을 가져옵니다.
 *
 * 캘린더가 "담은 공고"만 그리면 아무것도 담지 않은 팀에게는 빈 달력이 나옵니다.
 * 마감이 하루 최대 40건이라 셀에 전부 그릴 수는 없어, 셀에는 건수만 얹고
 * 목록은 날짜를 골랐을 때 상세 패널에서 보여 줍니다.
 */
export async function getAnnouncementDeadlines(from: string, to: string): Promise<AnnouncementDeadline[]> {
  if (DEV_BYPASS || !supabase) return (await import("../dev/devServices")).devAnnouncementDeadlines(from, to);
  const { data, error } = await supabase
    .from("kstartup_announcements")
    .select("pbanc_sn, title, end_date, support_field, regions, detail_url")
    .gte("end_date", from)
    .lte("end_date", to)
    .order("end_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    sn: row.pbanc_sn as number,
    title: row.title as string,
    endDate: row.end_date as string,
    supportField: (row.support_field as string | null) ?? null,
    regions: (row.regions as string[] | null) ?? [],
    detailUrl: (row.detail_url as string | null) ?? "",
  }));
}

/** 화면에 "언제 기준 정보인지"를 표시하기 위한 값. 없으면 아직 한 번도 동기화되지 않은 상태입니다. */
export async function getAnnouncementsSyncedAt(): Promise<string | null> {
  if (DEV_BYPASS || !supabase) return (await import("../dev/devServices")).devAnnouncementsSyncedAt();
  const { data, error } = await supabase
    .from("kstartup_announcements")
    .select("synced_at")
    .order("synced_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return null;
  return (data?.synced_at as string | undefined) ?? null;
}
