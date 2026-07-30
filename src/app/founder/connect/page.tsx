import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "커넥트",
  description: "팀빌딩·멘토·투자 연결 대기 신청을 접수합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderConnectPage() {
  return <FounderFeaturePage feature="connect" />;
}
