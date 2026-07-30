import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "법인 설립",
  description: "사업별 설립 타이밍과 절차를 확인합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderIncorporationPage() {
  return <FounderFeaturePage feature="incorporation" />;
}
