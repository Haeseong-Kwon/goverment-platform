import { FounderCore } from "@/features/startup-workspace/components";

export const metadata = {
  title: "협약 수행 홈",
  description: "집행 건을 사전검증하고 검토 상태를 추적합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderAgreementWorkspacePage() {
  return <FounderCore founder />;
}
