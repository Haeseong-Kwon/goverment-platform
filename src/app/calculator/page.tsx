import type { Metadata } from "next";
import { CalculatorSuite } from "@/features/startup-workspace/CalculatorSuite";
import { PublicToolPage } from "@/features/startup-workspace/PublicToolPage";
import { IS_INDEXABLE_DEPLOYMENT, absoluteUrl } from "@/lib/seo";
import { SiteStructuredData } from "@/components/seo/StructuredData";

const TITLE = "창업 세금 계산기 3종 — 4대보험·인건비 총부담·법인 vs 개인";
const DESCRIPTION =
  "직원 1명을 뽑으면 매달 얼마가 나가는지 30초 만에 확인하세요. 사업주 4대보험 실부담액, 퇴직급여까지 포함한 인건비 총부담액, 같은 이익에서 법인과 개인사업자 중 어느 쪽 세금이 적은지를 로그인 없이 계산합니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/calculator") },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/calculator") },
  robots: IS_INDEXABLE_DEPLOYMENT ? { index: true, follow: true } : { index: false, follow: false },
};

export default function CalculatorPage() {
  return (
    <PublicToolPage
      title="창업 세금 계산기"
      description="4대보험 실부담액, 인건비 총부담액, 법인 vs 개인 세금 비교. 로그인 없이 바로 쓰세요. 모든 결과는 참고용 추정이며 실제 신고 전 세무 전문가 확인이 필요합니다."
    >
      <SiteStructuredData />
      <CalculatorSuite />
    </PublicToolPage>
  );
}
