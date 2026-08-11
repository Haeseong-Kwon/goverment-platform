import { CaseDetailPage } from "@/features/startup-workspace/CaseDetail";

export const metadata = {
  title: "문제 해결 사례",
  robots: { index: false, follow: false },
};

export default async function FounderCaseDetailRoute({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseDetailPage caseId={decodeURIComponent(caseId)} />;
}
