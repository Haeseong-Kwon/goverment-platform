import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardListPage } from "@/features/course/BoardListPage";
import { BOARDS, BOARD_ORDER, COURSE, isBoardId } from "@/features/course/course";
import { IS_INDEXABLE_DEPLOYMENT, absoluteUrl } from "@/lib/seo";

/** 게시판은 네 개로 고정입니다. 미리 알려 두면 빌드 시점에 정적으로 준비됩니다. */
export function generateStaticParams() {
  return BOARD_ORDER.map((board) => ({ board }));
}

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }): Promise<Metadata> {
  const { board } = await params;
  if (!isBoardId(board)) return {};
  const config = BOARDS[board];
  const title = `${config.label} — ${COURSE.label}`;
  return {
    title,
    description: config.description,
    alternates: { canonical: absoluteUrl(`/course/${board}`) },
    openGraph: { title, description: config.description, url: absoluteUrl(`/course/${board}`) },
    robots: IS_INDEXABLE_DEPLOYMENT ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function CourseBoardRoute({ params }: { params: Promise<{ board: string }> }) {
  const { board } = await params;
  if (!isBoardId(board)) notFound();
  return <BoardListPage board={board} />;
}
