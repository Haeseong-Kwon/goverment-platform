/**
 * 문제 해결 사례(서류 보관함 3번째 탭).
 *
 * 검수를 거친 사람의 경험 기록만 담습니다. AI가 답을 생성하지 않습니다.
 * 현재는 코드 내 시드 상수이며, 제보가 쌓이면 저장소로 옮깁니다.
 */

export type CaseCategoryId = "account" | "kstartup" | "document" | "spending" | "etc";

export type CaseStatus = "해결" | "부분해결" | "미해결";

export interface SolutionCase {
  id: string;
  category: CaseCategoryId;
  /** 증상 한 줄. 목록 카드에서 2줄로 잘립니다. */
  title: string;
  /** 다른 화면에 한 줄로 끼워 넣을 때 쓰는 짧은 이름. */
  shortLabel: string;
  status: CaseStatus;
  /** 최종 확인 연월(YYYY-MM). */
  lastCheckedAt: string;
  views: number;
}

export const CASE_CATEGORIES: Array<{ id: CaseCategoryId; label: string }> = [
  { id: "account", label: "계좌·뱅킹" },
  { id: "kstartup", label: "K-Startup" },
  { id: "document", label: "서류·증빙" },
  { id: "spending", label: "집행·카드" },
  { id: "etc", label: "기타" },
];

export const SOLUTION_CASES: SolutionCase[] = [
  {
    id: "ACC-001",
    category: "account",
    title: "공유오피스 주소지 법인은 계좌 개설 전에 실사 자료(현장 사진·입주확인서)를 준비해야 한다",
    shortLabel: "공유오피스 실사 자료",
    status: "해결",
    lastCheckedAt: "2026-08",
    views: 1284,
  },
  {
    id: "ACC-002",
    category: "account",
    title: "개인 명의 사업비 카드로 고액 집행 시 한도 상향이 거부될 수 있다",
    shortLabel: "개인 카드 한도 제약",
    status: "해결",
    lastCheckedAt: "2026-08",
    views: 842,
  },
  {
    id: "KST-001",
    category: "kstartup",
    title: "개인 카드 → 법인 카드 전환은 해지 완료 후 K-Startup 재등록해야 오류가 없다",
    shortLabel: "법인 카드 전환 재등록",
    status: "해결",
    lastCheckedAt: "2026-08",
    views: 667,
  },
  {
    id: "DOC-004",
    category: "document",
    title: "사업자등록증 상 업종 코드가 공고 지원 대상과 다르면 신청 단계에서 반려될 수 있다",
    shortLabel: "업종 코드 불일치",
    status: "부분해결",
    lastCheckedAt: "2025-07",
    views: 431,
  },
];

/** 한 단계의 결과. 도트 색과 꼬리표를 이것 하나로 정합니다. */
export type CaseAttemptOutcome = "fail" | "pending" | "done";

export interface CaseAttempt {
  outcome: CaseAttemptOutcome;
  text: string;
}

export interface CaseDetail {
  /** 관련 사업·출처는 메타 헤더에 그대로 노출됩니다. */
  program: string;
  source: string;
  symptom: string;
  /** 확인된 원인과 추정은 화면에서 시각적으로 구분됩니다. 섞어 쓰지 않습니다. */
  causeConfirmed: string;
  causeGuess: string;
  attempts: CaseAttempt[];
  solution: string;
  /** 규정과 어긋날 수 있는 경로에는 사전 협의 안내를 답니다. */
  caution?: string;
  duration: string;
  relatedIds: string[];
}

/**
 * 사례 본문. 검수를 마친 원문만 여기에 들어옵니다.
 * 본문이 아직 없는 사례는 목록에는 있어도 상세에서 "정리 중"으로 표시됩니다.
 */
export const CASE_DETAILS: Record<string, CaseDetail> = {
  "ACC-001": {
    program: "예비창업패키지",
    source: "자체 경험",
    symptom:
      "법인 설립 등기를 마치고 사업비 계좌를 만들려고 은행에 갔는데, 법인 주소지가 공유오피스라는 이유로 서류만으로는 개설이 진행되지 않았다. 실제로 그 자리에서 업무하는지 확인할 자료를 추가로 요구받고 그날 개설하지 못했다.",
    causeConfirmed:
      "주소지가 공유오피스인 법인은 대외거래 목적 계좌 개설 시 실제 사업 영위 여부를 확인하는 절차가 추가된다. 이때 현장 사진, 입주확인서 같은 실사 자료를 창구에서 요청받는다.",
    causeGuess:
      "대여 주소만 등록해 두고 실제 영업은 하지 않는 계좌 개설을 걸러내려는 내부 심사 기준으로 보인다. 요구 자료의 종류와 범위는 은행·지점별로 다르게 안내될 수 있다.",
    attempts: [
      { outcome: "fail", text: "등기부등본·사업자등록증·정관만 들고 방문 → 실사 자료 부재로 개설 불가 안내" },
      { outcome: "pending", text: "공유오피스 운영사에 요청해 입주확인서 발급, 지정 좌석·간판이 보이는 현장 사진 확보" },
      { outcome: "done", text: "동일 지점 재방문 → 실사 자료 확인 후 사업비 계좌 개설 완료" },
    ],
    solution: "사전에 ①현장 사진 ②입주확인서를 준비하면 은행 1회 방문으로 끝난다",
    duration: "반나절 (사전 준비 시 1시간 내 추정)",
    relatedIds: ["ACC-002", "KST-001"],
  },
  "ACC-002": {
    program: "예비창업패키지",
    source: "자체 경험",
    symptom:
      "법인 카드 발급 전 개인 명의 카드로 사업비를 집행하려 했는데, 단건 금액이 기존 한도를 넘어 결제가 막혔다. 한도 상향을 신청했으나 개인 신용 기준으로 심사되어 필요한 금액까지 올라가지 않았다.",
    causeConfirmed:
      "개인 명의 카드의 한도는 사업비 규모가 아니라 개인 소득·신용 기준으로 산정된다. 지원사업 집행 예정 금액을 근거로 제출해도 한도 산정에 반영되지 않는다.",
    causeGuess:
      "한도 상향 심사가 개인 여신 정책을 그대로 따르기 때문으로 보인다. 카드사·상품별로 결과가 다를 수 있어 동일한 조건에서도 승인 여부가 갈릴 수 있다.",
    attempts: [
      { outcome: "fail", text: "개인 카드로 고액 단건 결제 시도 → 한도 초과로 승인 거절" },
      { outcome: "pending", text: "집행 예정 내역을 정리해 한도 상향 신청 → 개인 신용 기준 심사로 필요 금액 미달" },
      { outcome: "done", text: "담당 매니저와 협의해 집행 시점을 법인 카드 발급 이후로 조정, 분할 집행 계획으로 변경" },
    ],
    solution:
      "고액 집행은 법인 카드 발급 이후로 미루거나, 집행 시점·분할 방식을 사전에 조정해 두면 결제 실패를 피할 수 있다",
    caution:
      "집행 시점 변경, 분할 집행, 결제 수단 변경은 사업비 집행 계획과 어긋날 수 있습니다. 실행 전에 반드시 주관기관 담당 매니저와 사전 협의하세요. 규정을 우회하는 방식은 정산 단계에서 인정되지 않을 수 있습니다.",
    duration: "2~3일 (한도 심사 회신 대기 포함)",
    relatedIds: ["ACC-001", "KST-001"],
  },
};

export function getCase(id: string): SolutionCase | undefined {
  return SOLUTION_CASES.find((item) => item.id === id);
}

/**
 * 다른 화면(할 일 카드·정산 판정)에서 사례를 꺼내 보일 조건.
 *
 * 한 단어짜리 열쇠말은 쓰지 않습니다 — "카드"만으로 걸면 거의 모든 문장에 사례가 붙습니다.
 */
const CASE_TRIGGERS: Array<{ caseId: string; keywords: string[] }> = [
  { caseId: "ACC-001", keywords: ["계좌 개설", "사업비 계좌", "공유오피스", "법인 설립", "실사"] },
  { caseId: "ACC-002", keywords: ["개인 카드", "개인 명의", "카드 한도", "한도 상향", "고액 집행"] },
  { caseId: "KST-001", keywords: ["법인 카드", "카드 전환", "K-Startup 등록", "카드 등록"] },
  { caseId: "DOC-004", keywords: ["사업자등록증", "업종 코드", "지원 대상"] },
];

/** 본문이 아직 없는 사례는 눌러도 볼 것이 없으므로 꺼내지 않습니다. */
export function findRelatedCaseIds(text: string): string[] {
  const haystack = text.toLowerCase();
  return CASE_TRIGGERS
    .filter((trigger) => trigger.keywords.some((keyword) => haystack.includes(keyword.toLowerCase())))
    .map((trigger) => trigger.caseId)
    .filter((caseId) => caseId in CASE_DETAILS);
}

/** 확인 후 이만큼 지나면 카드에 "재확인 필요"를 붙입니다. 절차는 기관별로 자주 바뀝니다. */
export const STALE_AFTER_MONTHS = 12;

export function getCaseCategoryLabel(id: CaseCategoryId): string {
  return CASE_CATEGORIES.find((item) => item.id === id)?.label ?? "기타";
}

/** "2025-07" 형태를 화면 표기용 "2025.07"로. */
export function formatCheckedAt(lastCheckedAt: string): string {
  return lastCheckedAt.replace("-", ".");
}

/**
 * 최종 확인 후 12개월이 지났는지.
 * 날짜 문자열끼리 비교하지 않고 연·월을 숫자로 환산해 셉니다(연말·연초에서 어긋나지 않게).
 */
export function isCaseStale(item: SolutionCase, now: Date = new Date()): boolean {
  const [year, month] = item.lastCheckedAt.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return false;
  const elapsed = (now.getFullYear() - year) * 12 + (now.getMonth() + 1 - month);
  return elapsed >= STALE_AFTER_MONTHS;
}

/** 최종 확인일 최신순. 같은 달이면 조회수가 많은 순. */
function byRecency(a: SolutionCase, b: SolutionCase): number {
  return a.lastCheckedAt === b.lastCheckedAt ? b.views - a.views : b.lastCheckedAt.localeCompare(a.lastCheckedAt);
}

/**
 * 증상 검색 + 카테고리 필터.
 * 사용자는 사례 번호가 아니라 겪은 증상을 적으므로 제목을 먼저 봅니다.
 */
export function filterCases(
  cases: SolutionCase[],
  { category, query }: { category: CaseCategoryId | "all"; query: string },
): SolutionCase[] {
  const keyword = query.trim().toLowerCase();
  return cases
    .filter((item) => category === "all" || item.category === category)
    .filter((item) => {
      if (!keyword) return true;
      return [item.title, item.id, getCaseCategoryLabel(item.category)]
        .some((field) => field.toLowerCase().includes(keyword));
    })
    .sort(byRecency);
}
