import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BoardDetailPage } from "@/features/course/BoardDetailPage";
import { BOARDS, COURSE, isBoardId } from "@/features/course/course";

export async function generateMetadata({ params }: { params: Promise<{ board: string }> }): Promise<Metadata> {
  const { board } = await params;
  return {
    title: isBoardId(board) ? `${BOARDS[board].label} — ${COURSE.label}` : COURSE.label,
    // 학생이 쓴 글에는 이름과 연락처가 들어갑니다. 목록까지만 색인하고 글 본문은 열지 않습니다.
    robots: { index: false, follow: false },
  };
}

export default async function CourseEntryRoute({ params }: { params: Promise<{ board: string; id: string }> }) {
  const { board, id } = await params;
  if (!isBoardId(board)) notFound();
  return <BoardDetailPage board={board} id={decodeURIComponent(id)} />;
}
