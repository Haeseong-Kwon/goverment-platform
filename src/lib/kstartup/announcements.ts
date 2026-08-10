/**
 * K-Startup 공고 정규화.
 *
 * 출처: 공공데이터포털 `창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)_조회서비스`
 * (dataset 15125364) 의 `getAnnouncementInformation01`.
 *
 * 이 파일은 순수 함수만 둡니다. 네트워크 호출은 동기화 라우트가,
 * 조회는 AnnouncementService가 담당합니다.
 */

/** 지원 분야 — upstream `supt_biz_clsfc` 실측값. HTML 엔티티 디코딩 후 기준입니다. */
export const SUPPORT_FIELDS = [
  "사업화",
  "창업교육",
  "시설ㆍ공간ㆍ보육",
  "멘토링ㆍ컨설팅ㆍ교육",
  "행사ㆍ네트워크",
  "기술개발(R&D)",
  "판로ㆍ해외진출",
  "글로벌",
  "정책자금",
  "융자ㆍ보증",
  "인력",
] as const;

/**
 * 지역 — upstream `supt_regin` 실측값(축약형)입니다.
 * `전국`은 선택지에 두지 않습니다. 어느 지역을 골라도 항상 함께 보여야 하는 값이라
 * 체크박스로 만들면 사용자가 끄는 순간 전국 공고가 사라집니다(대부분의 공고가 전국입니다).
 */
export const REGIONS = [
  "서울", "경기", "인천", "강원", "충북", "충남", "대전", "세종",
  "전북", "전남", "광주", "전남광주", "경북", "경남", "대구", "울산", "부산", "제주",
] as const;

/** 창업 업력 — upstream `biz_enyy` 실측값. */
export const BIZ_AGES = ["예비창업자", "1년미만", "2년미만", "3년미만", "5년미만", "7년미만", "10년미만"] as const;

/** 신청 대상 — upstream `aply_trgt` 실측값. */
export const APPLICANT_TYPES = ["예비창업자", "일반인", "일반기업", "1인 창조기업", "대학생", "대학", "연구기관", "청소년"] as const;

/** 대상 연령 — upstream `biz_trgt_age` 실측값. */
export const TARGET_AGES = ["만 20세 미만", "만 20세 이상 ~ 만 39세 이하", "만 40세 이상"] as const;

/** 접수 방법 라벨 — upstream 컬럼명이 접수처 문자열을 그대로 담고 있습니다. */
export const APPLY_METHOD_FIELDS: ReadonlyArray<[label: string, field: string]> = [
  ["온라인", "aply_mthd_onli_rcpt_istc"],
  ["방문", "aply_mthd_vst_rcpt_istc"],
  ["이메일", "aply_mthd_eml_rcpt_istc"],
  ["우편", "aply_mthd_pssr_rcpt_istc"],
  ["팩스", "aply_mthd_fax_rcpt_istc"],
  ["기타", "aply_mthd_etc_istc"],
];

export type AnnouncementStatus = "upcoming" | "open" | "closed";

/** DB `kstartup_announcements` 한 행. 컬럼명과 1:1로 맞춥니다. */
export interface Announcement {
  pbanc_sn: number;
  title: string;
  summary: string | null;
  start_date: string | null;
  end_date: string | null;
  support_field: string | null;
  regions: string[];
  biz_ages: string[];
  applicant_types: string[];
  target_ages: string[];
  organizer: string | null;
  supervising_institution: string | null;
  department: string | null;
  contact: string | null;
  apply_target: string | null;
  exclude_target: string | null;
  apply_methods: Record<string, string>;
  notes: string | null;
  detail_url: string | null;
  guide_url: string | null;
  is_integrated: boolean;
}

/**
 * upstream 텍스트에는 `기술개발(R&amp;D)`처럼 HTML 엔티티가 그대로 들어옵니다.
 * 디코딩하지 않으면 화면에 `R&amp;D`가 노출되고, 분야 필터가 영원히 0건이 됩니다.
 */
export function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function text(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = decodeEntities(raw).trim();
  return value ? value : null;
}

/** 쉼표로 이어 붙인 다중값 컬럼(`서울,경기`)을 토큰 배열로 나눕니다. */
export function splitTokens(raw: unknown): string[] {
  const value = text(raw);
  if (!value) return [];
  return Array.from(new Set(value.split(",").map((token) => token.trim()).filter(Boolean)));
}

/** upstream `YYYYMMDD` → DATE 컬럼용 `YYYY-MM-DD`. 형식이 어긋나면 null입니다(잘못된 날짜를 지어내지 않습니다). */
export function toIsoDate(raw: unknown): string | null {
  const value = text(raw)?.replace(/[^0-9]/g, "") ?? "";
  if (!/^\d{8}$/.test(value)) return null;
  const [year, month, day] = [value.slice(0, 4), value.slice(4, 6), value.slice(6, 8)];
  const parsed = new Date(`${year}-${month}-${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

/**
 * upstream 한 행 → DB 한 행.
 *
 * 공고 일련번호(`pbanc_sn`)와 공고명이 없으면 버립니다. 이 둘이 없는 행은
 * 화면에 띄워도 사용자가 원문을 찾아갈 수 없어 "정확한 정보"가 되지 못합니다.
 */
export function normalizeAnnouncement(raw: Record<string, unknown>): Announcement | null {
  const pbancSn = Number(raw.pbanc_sn);
  const title = text(raw.biz_pbanc_nm) ?? text(raw.intg_pbanc_biz_nm);
  if (!Number.isInteger(pbancSn) || pbancSn <= 0 || !title) return null;

  const applyMethods = Object.fromEntries(
    APPLY_METHOD_FIELDS.flatMap(([label, field]) => {
      const value = text(raw[field]);
      return value ? [[label, value] as const] : [];
    }),
  );

  return {
    pbanc_sn: pbancSn,
    title,
    summary: text(raw.pbanc_ctnt),
    start_date: toIsoDate(raw.pbanc_rcpt_bgng_dt),
    end_date: toIsoDate(raw.pbanc_rcpt_end_dt),
    support_field: text(raw.supt_biz_clsfc),
    regions: splitTokens(raw.supt_regin),
    biz_ages: splitTokens(raw.biz_enyy),
    applicant_types: splitTokens(raw.aply_trgt),
    target_ages: splitTokens(raw.biz_trgt_age),
    organizer: text(raw.pbanc_ntrp_nm),
    supervising_institution: text(raw.sprv_inst),
    department: text(raw.biz_prch_dprt_nm),
    contact: text(raw.prch_cnpl_no),
    apply_target: text(raw.aply_trgt_ctnt),
    exclude_target: text(raw.aply_excl_trgt_ctnt),
    apply_methods: applyMethods,
    notes: text(raw.prfn_matr),
    // 원문 페이지는 최종 근거입니다. upstream이 비워 보내면 공고 일련번호로 직접 조립합니다.
    detail_url:
      text(raw.detl_pg_url) ??
      `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=${pbancSn}`,
    guide_url: text(raw.biz_gdnc_url) ?? text(raw.biz_aply_url),
    is_integrated: text(raw.intg_pbanc_yn) === "Y",
  };
}

/**
 * 접수 상태.
 *
 * upstream의 `rcrt_prgs_yn`을 쓰지 않습니다. 그 값은 갱신 시점(일 1회) 기준이라
 * 어제 마감된 공고가 오늘도 "모집중"으로 남습니다. 날짜로 매번 다시 계산해야
 * 화면에 뜬 상태가 실제와 어긋나지 않습니다.
 */
export function getAnnouncementStatus(
  announcement: Pick<Announcement, "start_date" | "end_date">,
  todayKey: string,
): AnnouncementStatus {
  const { start_date: start, end_date: end } = announcement;
  if (end && end < todayKey) return "closed";
  if (start && start > todayKey) return "upcoming";
  return "open";
}

/**
 * DB 질의와 같은 조건을 메모리에서 적용합니다.
 *
 * 개발용 진입 모드(Supabase 없이 도는 경로)가 이 함수를 씁니다. 조건을 여기 한 번만
 * 적어 두면 dev 화면과 실제 화면이 서로 다른 결과를 보여 주는 일이 없습니다.
 */
export function matchesAnnouncementFilters(
  announcement: Announcement,
  filters: {
    keyword: string;
    supportFields: string[];
    regions: string[];
    bizAges: string[];
    applicantTypes: string[];
    targetAges: string[];
    includeClosed: boolean;
  },
  todayKey: string,
): boolean {
  const overlaps = (values: string[], selected: string[]) =>
    selected.length === 0 || selected.some((choice) => values.includes(choice));

  if (!filters.includeClosed && getAnnouncementStatus(announcement, todayKey) === "closed") return false;
  if (filters.supportFields.length > 0 && !filters.supportFields.includes(announcement.support_field ?? "")) return false;
  // 지역을 골라도 전국 공고는 항상 포함합니다(DB 질의와 같은 규칙).
  if (!overlaps(announcement.regions, filters.regions.length ? [...filters.regions, "전국"] : [])) return false;
  if (!overlaps(announcement.biz_ages, filters.bizAges)) return false;
  if (!overlaps(announcement.applicant_types, filters.applicantTypes)) return false;
  if (!overlaps(announcement.target_ages, filters.targetAges)) return false;

  const keyword = filters.keyword.trim().toLowerCase();
  if (!keyword) return true;
  return `${announcement.title} ${announcement.summary ?? ""}`.toLowerCase().includes(keyword);
}
