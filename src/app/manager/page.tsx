import { ManagerDashboard } from "@/features/startup-workspace/ManagerScreens";

export const metadata = {
  title: "통합 관리 대시보드",
  description: "검토 요청 현황과 처리 지연 건을 한눈에 봅니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default ManagerDashboard;
