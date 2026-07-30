import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "정산 사전검증",
  description: "집행 건을 「사업비 비목 해설」 룰셋으로 판정한 뒤 검토를 요청합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function WorkspacePrecheckPage() {
  return <FounderFeaturePage feature="precheck" founder />;
}
