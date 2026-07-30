import type { MetadataRoute } from "next";
import { IS_INDEXABLE_DEPLOYMENT, PRIVATE_PATH_PREFIXES, absoluteUrl } from "@/lib/seo";

/**
 * 생성형 검색 노출(GEO)을 원하므로 AI 크롤러를 막지 않습니다.
 * 학습 이용을 원치 않으면 이 목록을 disallow로 바꾸면 됩니다.
 * (Google-Extended는 검색 순위와 무관하게 Gemini 학습만 통제합니다.)
 */
const AI_CRAWLERS = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "PerplexityBot", "Google-Extended"];

/** 국내 검색 점유율상 네이버(Yeti)·다음(Daumoa)을 명시해 둡니다. */
const KOREAN_CRAWLERS = ["Yeti", "Daumoa"];

export default function robots(): MetadataRoute.Robots {
  // 프리뷰 배포는 본문이 같아 중복 색인이 됩니다. 프로덕션 외에는 전부 닫습니다.
  if (!IS_INDEXABLE_DEPLOYMENT) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  const disallow = PRIVATE_PATH_PREFIXES.map((prefix) => `${prefix}/`);

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow },
      ...KOREAN_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: "/", disallow })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/").replace(/\/$/, ""),
  };
}
