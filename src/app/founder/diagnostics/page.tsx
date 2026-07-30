import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "AI 진단",
  description: "자격 요건을 룰셋으로 판정하고 사업계획서를 PSST 구조로 점검합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderDiagnosticsPage() {
  return <FounderFeaturePage feature="diagnostics" />;
}
