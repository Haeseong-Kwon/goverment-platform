import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "사업비 점검",
  description: "사업계획서에 적을 사업비를 「사업비 비목 해설」 룰셋으로 미리 판정합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderPlanCheckPage() {
  return <FounderFeaturePage feature="plancheck" />;
}
