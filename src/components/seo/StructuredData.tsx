import {
  FAQ_ITEMS,
  ORGANIZATION_NAME,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  absoluteUrl,
} from "@/lib/seo";

/**
 * 구조화 데이터(JSON-LD).
 *
 * 검색 결과의 리치 스니펫뿐 아니라, 생성형 검색(ChatGPT·Perplexity·AI 개요)이
 * "이 서비스가 무엇인지"를 추측하지 않고 그대로 인용하게 만드는 근거입니다.
 * 본문에 없는 사실을 여기에만 적으면 안 됩니다. 정책 위반이고, 인용도 어긋납니다.
 */

/** dangerouslySetInnerHTML로 넣는 값이라 `<`를 이스케이프해 스크립트 조기 종료를 막습니다. */
function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}

const organization = {
  "@type": "Organization",
  "@id": absoluteUrl("/#organization"),
  name: ORGANIZATION_NAME,
  url: absoluteUrl("/"),
  description: SITE_DESCRIPTION,
  areaServed: { "@type": "Country", name: "대한민국" },
  knowsLanguage: ["ko"],
};

const website = {
  "@type": "WebSite",
  "@id": absoluteUrl("/#website"),
  url: absoluteUrl("/"),
  name: `${SITE_NAME} | ${SITE_TAGLINE}`,
  description: SITE_DESCRIPTION,
  inLanguage: "ko-KR",
  publisher: { "@id": absoluteUrl("/#organization") },
};

/**
 * 웹 애플리케이션. 무료 사용 범위를 offers로 명시해야 생성형 검색이
 * "유료인가?"에 임의로 답하지 않습니다.
 */
const application = {
  "@type": "SoftwareApplication",
  "@id": absoluteUrl("/#software"),
  name: SITE_NAME,
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "정부지원사업 행정 관리",
  operatingSystem: "Web",
  url: absoluteUrl("/"),
  description: SITE_DESCRIPTION,
  inLanguage: "ko-KR",
  publisher: { "@id": absoluteUrl("/#organization") },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "KRW",
    description: "창업자 준비 기능 무료. 사업계획서 AI 진단 매월 2회 무료.",
  },
  featureList: [
    "사업별 자격 요건 룰셋 진단",
    "공고 마감일 기준 준비 TODO 자동 생성",
    "사업계획서 PSST 구조 AI 진단",
    "사업비 집행 사전검증 및 근거 조항 표시",
    "증빙 서류 버전 보관함",
    "주관기관 정산 검토 큐 및 반려 안내문 작성",
  ],
};

/** 화면에 보이는 FAQ와 같은 문장이어야 합니다(같은 상수를 씁니다). */
const faq = {
  "@type": "FAQPage",
  "@id": absoluteUrl("/#faq"),
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

export function SiteStructuredData() {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@graph": [organization, website, application, faq],
      }}
    />
  );
}
