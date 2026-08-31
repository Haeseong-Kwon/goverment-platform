import type { Metadata } from "next";
import { WorkspaceEntry } from "@/features/startup-workspace/Landing";

const title = "워크스페이스 진입";
const description =
  "창업자 워크스페이스, 주관기관 대시보드, 과목 수강생 게시판 중에서 선택합니다. 역할에 따라 보이는 데이터와 기능이 완전히 분리됩니다.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "/workspace-entry" },
  openGraph: { type: "website", locale: "ko_KR", url: "/workspace-entry", title, description },
  twitter: { card: "summary_large_image", title, description },
};

export default WorkspaceEntry;
