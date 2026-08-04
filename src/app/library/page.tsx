import type { Metadata } from "next";
import { LibraryPanel } from "@/features/startup-workspace/LibraryPanel";
import { PublicToolPage } from "@/features/startup-workspace/PublicToolPage";
import { IS_INDEXABLE_DEPLOYMENT, absoluteUrl } from "@/lib/seo";

const TITLE = "창업 무료 자료실 — 동업계약서·NDA·KVCA 표준투자계약서·IR 템플릿";
const DESCRIPTION =
  "출처가 표기된 창업 표준 양식을 무료로 받으세요. 동업계약서, 비밀유지계약서(NDA), KVCA 표준투자계약서, 외주용역 계약서, IR 피치덱 템플릿, 근로계약서, 사업비 증빙 체크리스트를 모았습니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/library") },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/library") },
  robots: IS_INDEXABLE_DEPLOYMENT ? { index: true, follow: true } : { index: false, follow: false },
};

export default function LibraryPage() {
  return (
    <PublicToolPage
      title="무료 자료실"
      description="감수·출처가 표기된 표준 양식만 모았습니다. 로그인 없이 받을 수 있습니다."
    >
      <LibraryPanel />
    </PublicToolPage>
  );
}
