import { FounderLanding } from "@/features/startup-workspace/Landing";
import { SiteStructuredData } from "@/components/seo/StructuredData";

/**
 * 구조화 데이터는 StartUp Pilot 공개 화면에서만 선언합니다.
 * 루트 레이아웃에 두면 과목 게시판(/course)까지 "이 페이지는 StartUp Pilot"이라고
 * 검색엔진에 말하게 되어, 분리해 둔 두 제품이 색인에서 다시 붙습니다.
 */
export default function HomePage() {
  return (
    <>
      <SiteStructuredData />
      <FounderLanding />
    </>
  );
}
