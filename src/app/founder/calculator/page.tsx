import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "4대보험 계산기",
  description: "인건비 집행 전 사업주 부담액을 미리 확인합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderCalculatorPage() {
  return <FounderFeaturePage feature="calculator" />;
}
