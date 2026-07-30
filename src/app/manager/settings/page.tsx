import { ManagerFeaturePage } from "@/features/startup-workspace/ManagerScreens";

export const metadata = {
  title: "설정",
  description: "기관 정보와 합격 전환 코드를 관리합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function ManagerSettingsPage() {
  return <ManagerFeaturePage feature="settings" />;
}
