import type { Metadata } from "next";
import { ManagerLanding } from "@/features/startup-workspace/Landing";
import { SiteStructuredData } from "@/components/seo/StructuredData";

const title = "주관기관 정산 검토 대시보드";
const description =
  "사전검증을 통과한 정산 건만 검토 큐에 도착합니다. 반려 사유코드와 관리지침 조항을 인용한 안내문을 자동으로 작성하고, 창업자의 준비 데이터는 기관 화면에 노출되지 않습니다.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/manager/landing" },
  openGraph: { type: "website", locale: "ko_KR", url: "/manager/landing", title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default function ManagerLandingPage() {
  return (
    <>
      <SiteStructuredData />
      <ManagerLanding />
    </>
  );
}
