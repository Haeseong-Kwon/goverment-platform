import { ManagerFeaturePage } from "@/features/startup-workspace/ManagerScreens";

export const metadata = {
  title: "기관 리포트",
  description: "실제 검토 요청과 반려 기록으로 집계합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function ManagerReportsPage() {
  return <ManagerFeaturePage feature="reports" />;
}
