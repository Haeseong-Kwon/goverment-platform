import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "상태 트래커",
  description: "제출한 정산 건의 검토 단계와 매니저 판정을 확인합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function WorkspaceTrackerPage() {
  return <FounderFeaturePage feature="tracker" founder />;
}
