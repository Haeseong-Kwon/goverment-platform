/**
 * 사이트 메타데이터의 단일 출처.
 *
 * 제목·설명·OG·sitemap·robots·JSON-LD가 모두 이 파일을 봅니다.
 * 도메인이나 문구가 바뀔 때 고칠 곳이 한 군데여야 합니다.
 */

/** 최종 서비스 도메인. 배포 주소가 아직 vercel.app이어도 canonical은 항상 이 주소를 가리킵니다. */
const CANONICAL_ORIGIN = "https://startuppilot.co.kr";

const normalize = (value: string) => value.trim().replace(/\/+$/, "");

/**
 * 표준 주소. `NEXT_PUBLIC_SITE_URL`로 덮어쓸 수 있고(로컬·스테이징),
 * 값이 없으면 최종 도메인을 씁니다.
 */
export const SITE_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    const withProtocol = /^https?:\/\//.test(configured) ? configured : `https://${configured}`;
    return normalize(withProtocol);
  }
  return CANONICAL_ORIGIN;
})();

/**
 * 색인을 허용할 배포인지.
 *
 * Vercel 프리뷰 배포는 본문이 같아 중복 색인이 됩니다. 프로덕션에서만 색인을 엽니다.
 * (로컬 개발에서도 닫혀 있는 편이 안전합니다.)
 */
export const IS_INDEXABLE_DEPLOYMENT =
  process.env.VERCEL_ENV === "production" || process.env.NEXT_PUBLIC_ALLOW_INDEXING === "1";

export const SITE_NAME = "StartUp Pilot";

export const SITE_TAGLINE = "정부 창업지원사업 행정 SaaS";

/** 검색 결과에 그대로 노출되는 문장입니다. 155자 안에서 무엇을 하는 도구인지 끝냅니다. */
export const SITE_DESCRIPTION =
  "예비창업패키지·초기창업패키지 준비부터 정산까지. 자격 진단, 마감 캘린더, 사업비 사전검증을 규정 룰 엔진으로 처리하고 주관기관 검토까지 한 흐름으로 잇는 창업 행정 워크스페이스입니다.";

/** 검색 엔진용 키워드는 순위에 영향이 없지만, 일부 국내 도구가 아직 참조합니다. */
export const SITE_KEYWORDS = [
  "예비창업패키지",
  "초기창업패키지",
  "창업지원사업",
  "사업비 정산",
  "사업비 비목",
  "창업 사업계획서",
  "PSST",
  "주관기관 정산 검토",
  "창업 행정",
  "정부지원사업 관리",
];

export const ORGANIZATION_NAME = "StartUp Pilot";

/** 절대 URL. OG·JSON-LD·sitemap은 상대 경로를 쓸 수 없습니다. */
export const absoluteUrl = (path = "/") => `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;

/** 공개 화면만 색인 대상입니다. 로그인 이후 화면은 sitemap에 넣지 않습니다. */
export const PUBLIC_ROUTES = [
  { path: "/", changeFrequency: "weekly" as const, priority: 1 },
  { path: "/manager/landing", changeFrequency: "monthly" as const, priority: 0.8 },
  // 계산기·자료실은 로그인 없이 쓰는 검색 착지 페이지입니다. 색인되어야 유입이 생깁니다.
  { path: "/calculator", changeFrequency: "monthly" as const, priority: 0.9 },
  { path: "/library", changeFrequency: "weekly" as const, priority: 0.8 },
  { path: "/workspace-entry", changeFrequency: "monthly" as const, priority: 0.6 },
  // 과목 게시판. 목록까지만 색인합니다 — 개별 글에는 학생 이름과 연락처가 들어가
  // 각 상세 화면이 스스로 noindex를 답합니다(app/course/[board]/[id]).
  { path: "/course", changeFrequency: "daily" as const, priority: 0.9 },
  { path: "/course/recruit", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/course/proposal", changeFrequency: "daily" as const, priority: 0.7 },
  { path: "/course/team", changeFrequency: "weekly" as const, priority: 0.6 },
  { path: "/course/showcase", changeFrequency: "weekly" as const, priority: 0.7 },
];

/**
 * 로그인 이후 화면과 인증 경로. 색인되면 사용자에게 빈 화면이 검색 결과로 노출되고,
 * 크롤러가 인증 흐름을 건드립니다.
 */
export const PRIVATE_PATH_PREFIXES = [
  "/founder",
  "/workspace",
  "/manager/review",
  "/manager/teams",
  "/manager/reports",
  "/manager/settings",
  "/manager/plan-review",
  "/onboarding",
  "/login",
  "/signup",
  "/auth",
  "/api",
];

/**
 * 생성형 검색(GEO/AEO)에 인용되려면 사실 관계가 짧고 명확해야 합니다.
 * 이 목록은 화면에 보이는 FAQ와 JSON-LD FAQPage가 함께 씁니다.
 * (Google은 화면에 없는 FAQ 구조화 데이터를 위반으로 봅니다.)
 */
export const FAQ_ITEMS = [
  {
    question: "StartUp Pilot은 무엇을 해주는 서비스인가요?",
    answer:
      "정부 창업지원사업의 행정 절차를 처리합니다. 창업자는 자격 진단, 공고 마감 기준 자동 TODO, 사업계획서 AI 진단, 사업비 집행 사전검증, 서류 보관함을 쓰고, 주관기관 담당자는 사전검증을 통과한 정산 건만 검토 큐에서 처리합니다. 양쪽이 같은 규정 룰 엔진을 공유합니다.",
  },
  {
    question: "사업비 사전검증은 어떤 기준으로 판정하나요?",
    answer:
      "「사업비 비목 해설」과 관리지침을 룰셋으로 옮겨 비목 적합성, 증빙 구비, 한도, 사전승인 필요 여부, 집행 기간을 판정합니다. 모든 판정에는 근거 조항과 수정 방법을 함께 표시하며, 결과는 참고용입니다. 승인·반려의 최종 결정 권한은 주관기관 담당자에게 있습니다.",
  },
  {
    question: "예비창업패키지는 사업자등록이 있으면 신청할 수 없나요?",
    answer:
      "예비창업패키지는 신청일 기준 사업자등록이 없어야 합니다. 그래서 법인 설립은 선정 통보 이후에 진행해야 하며, 순서를 잘못 밟으면 신청 자격이 사라집니다. StartUp Pilot은 선택한 사업별로 설립 타이밍을 먼저 확인시켜 줍니다. 최종 기준은 각 사업 공고문입니다.",
  },
  {
    question: "주관기관이 창업자의 준비 데이터를 볼 수 있나요?",
    answer:
      "볼 수 없습니다. 연습 진단, 사업계획서 초안, 팀 TODO는 주관기관 화면에 표시되지 않습니다. 담당자는 팀이 검토 요청한 정산 건과 그 건에 팀이 직접 첨부한 증빙만 열람하며, 증빙 파일은 5분 후 만료되는 보안 링크로만 열립니다. 접근 경계는 데이터베이스 권한(RLS)으로 강제됩니다.",
  },
  {
    question: "AI 진단 결과로 선정 여부를 알 수 있나요?",
    answer:
      "알 수 없습니다. 사업계획서 진단은 PSST 항목별 점수와 근거 문장, 보완 액션을 제시하는 참고 자료이며 합격이나 선정 결과를 보장하지 않습니다. 자격 진단도 공고문의 요건을 룰셋으로 대조한 결과이므로, 최종 적격 여부는 각 사업 공고문과 관리지침을 따릅니다.",
  },
  {
    question: "요금은 어떻게 되나요?",
    answer:
      "창업자 워크스페이스의 준비 기능은 무료로 사용할 수 있고, 사업계획서 AI 진단은 매달 2회 무료로 제공합니다. 주관기관 대시보드는 기관 단위로 연결해 제공합니다.",
  },
];
