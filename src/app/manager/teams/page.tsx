import { ManagerFeaturePage } from "@/features/startup-workspace/ManagerScreens";

export const metadata = {
  title: "팀 관리",
  description: "검토를 요청한 이력이 있는 선정 팀을 확인합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function ManagerTeamsPage() {
  return <ManagerFeaturePage feature="teams" />;
}
