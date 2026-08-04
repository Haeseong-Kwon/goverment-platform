import { supabase } from "../supabase";
import { DEV_BYPASS } from "../dev/devMode";

export type LibraryCategory = "contract" | "ir" | "hr" | "gov";

export interface LibraryDocument {
  slug: string;
  category: LibraryCategory;
  title: string;
  description: string;
  sourceLabel: string;
  sourceUrl: string | null;
  storagePath: string | null;
}

export const LIBRARY_CATEGORIES: Array<{ id: LibraryCategory; label: string }> = [
  { id: "contract", label: "계약서" },
  { id: "ir", label: "IR·사업계획" },
  { id: "hr", label: "인사·노무" },
  { id: "gov", label: "정부지원 행정" },
];

/**
 * 운영자가 큐레이션한 표준 양식 목록.
 *
 * DB를 아직 올리지 않았거나 조회에 실패해도 목록은 보여야 합니다.
 * 이 페이지는 검색 유입의 착지점이라 빈 화면이 되면 유입이 그대로 이탈합니다.
 */
const FALLBACK_DOCUMENTS: LibraryDocument[] = [
  { slug: "cofounder-agreement", category: "contract", title: "동업계약서 표준안", description: "지분·역할·이탈 시 처리를 정하는 공동창업 계약서. 지분 분쟁의 대부분은 이 문서 부재에서 시작합니다.", sourceLabel: "중소벤처기업부 표준계약서", sourceUrl: "https://www.mss.go.kr", storagePath: null },
  { slug: "kvca-investment", category: "contract", title: "KVCA 표준투자계약서", description: "한국벤처캐피탈협회가 배포하는 표준 투자계약서. 상환전환우선주(RCPS) 조건의 기준선입니다.", sourceLabel: "한국벤처캐피탈협회", sourceUrl: "https://www.kvca.or.kr", storagePath: null },
  { slug: "nda", category: "contract", title: "비밀유지계약서(NDA)", description: "외주·투자 검토 전 아이디어와 데이터를 보호하는 최소 문서.", sourceLabel: "공정거래위원회 표준약관", sourceUrl: "https://www.ftc.go.kr", storagePath: null },
  { slug: "outsourcing-agreement", category: "contract", title: "외주용역 계약서 표준안", description: "과업 범위·검수 기준·대금 지급 조건. 사업비 외주용역 사전심의 합본의 필수 서류입니다.", sourceLabel: "중소벤처기업부 표준계약서", sourceUrl: "https://www.mss.go.kr", storagePath: null },
  { slug: "ir-deck", category: "ir", title: "IR 피치덱 템플릿", description: "PSST 구조에 맞춘 10장 구성. 사업계획서 AI 진단의 4축과 같은 순서입니다.", sourceLabel: "자체 제작 · 창업진흥원 양식 참고", sourceUrl: null, storagePath: null },
  { slug: "employment-contract", category: "hr", title: "근로계약서 표준양식", description: "4대보험·수습·근로시간 기재. 인건비 정산 증빙의 기초 서류입니다.", sourceLabel: "고용노동부 표준근로계약서", sourceUrl: "https://www.moel.go.kr", storagePath: null },
  { slug: "expense-checklist", category: "gov", title: "사업비 집행 증빙 체크리스트", description: "비목별 필수 증빙을 한 장으로 정리. 정산 사전검증의 \"증빙 누락\" 항목과 같은 기준입니다.", sourceLabel: "자체 제작 · 사업비 관리기준 기반", sourceUrl: null, storagePath: null },
];

export async function listLibraryDocuments(): Promise<LibraryDocument[]> {
  if (DEV_BYPASS || !supabase) return FALLBACK_DOCUMENTS;

  const { data, error } = await supabase
    .from("library_documents")
    .select("slug, category, title, description, source_label, source_url, storage_path")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data?.length) return FALLBACK_DOCUMENTS;

  return data.map((row) => ({
    slug: row.slug as string,
    category: row.category as LibraryCategory,
    title: row.title as string,
    description: (row.description as string) ?? "",
    sourceLabel: row.source_label as string,
    sourceUrl: (row.source_url as string | null) ?? null,
    storagePath: (row.storage_path as string | null) ?? null,
  }));
}

/**
 * 자료 파일 링크. 아직 파일을 올리지 않은 항목은 출처 사이트로 보냅니다.
 * 없는 파일을 받으라고 하는 것보다, 원본 출처를 알려 주는 편이 정직합니다.
 */
export async function getLibraryDownloadUrl(document: LibraryDocument): Promise<string | null> {
  if (!document.storagePath) return document.sourceUrl;
  if (DEV_BYPASS || !supabase) return document.sourceUrl;
  const { data, error } = await supabase.storage.from("library").createSignedUrl(document.storagePath, 300);
  if (error) return document.sourceUrl;
  return data.signedUrl;
}
