import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, absoluteUrl } from "@/lib/seo";

/**
 * 공개 화면만 넣습니다. 로그인 이후 화면을 sitemap에 넣으면
 * 크롤러가 인증 벽을 긁고, 검색 결과에는 빈 화면이 남습니다.
 *
 * lastModified는 빌드 시점입니다. 배포할 때마다 갱신됩니다.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return PUBLIC_ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
