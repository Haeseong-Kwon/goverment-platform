import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "문제 해결 사례",
  description: "다른 팀이 실제로 겪은 행정 문제와 해결 경로입니다.",
  // 서류 보관함 하위 화면입니다. 로그인 이후에만 열립니다.
  robots: { index: false, follow: false },
};

export default function WorkspaceVaultCasesPage() {
  return <FounderFeaturePage feature="vault" founder vaultTab="cases" />;
}
