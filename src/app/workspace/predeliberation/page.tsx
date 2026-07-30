import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "사전심의 합본",
  description: "사전심의 대상 여부를 판정하고 합본 구비 서류를 점검합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function WorkspacePreDeliberationPage() {
  return <FounderFeaturePage feature="predeliberation" founder />;
}
