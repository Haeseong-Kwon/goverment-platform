import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "계산기",
  description: "4대보험 실부담액, 인건비 총부담액, 법인 vs 개인 세금을 비교합니다.",
  // 워크스페이스 안쪽 화면입니다. 검색 유입은 공개 라우트(/calculator)가 받습니다.
  robots: { index: false, follow: false },
};

export default function WorkspaceCalculatorPage() {
  return <FounderFeaturePage feature="calculator" founder />;
}
