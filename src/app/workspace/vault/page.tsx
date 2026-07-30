import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "서류 보관함",
  description: "증빙과 검토본을 버전으로 관리합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function WorkspaceVaultPage() {
  return <FounderFeaturePage feature="vault" founder />;
}
