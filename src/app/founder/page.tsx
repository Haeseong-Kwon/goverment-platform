import { FounderCore } from "@/features/startup-workspace/components";

export const metadata = {
  title: "창업자 준비 워크스페이스",
  description: "팀 TODO와 다음 마감, 진단 결과를 한 화면에서 확인합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderWorkspacePage() {
  return <FounderCore />;
}
