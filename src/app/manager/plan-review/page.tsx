import { ManagerFeaturePage } from "@/features/startup-workspace/ManagerScreens";

export const metadata = {
  title: "사업비 계획 검토",
  description: "선정 팀의 집행 계획을 붙여 넣어 일괄 판정합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function ManagerPlanReviewPage() {
  return <ManagerFeaturePage feature="plan-review" />;
}
