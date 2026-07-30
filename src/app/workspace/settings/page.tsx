import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "팀 설정",
  description: "협약 팀 구성원과 데이터 공개 범위를 관리합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function WorkspaceSettingsPage() {
  return <FounderFeaturePage feature="settings" founder />;
}
