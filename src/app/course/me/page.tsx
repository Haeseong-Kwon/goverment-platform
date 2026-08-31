import type { Metadata } from "next";
import { CourseWorkspace } from "@/features/course/CourseWorkspace";
import { COURSE } from "@/features/course/course";

export const metadata: Metadata = {
  title: `내 워크스페이스 — ${COURSE.label}`,
  // 로그인 이후 개인 화면입니다. 색인되면 검색 결과에 빈 화면이 남습니다.
  robots: { index: false, follow: false },
};

export default function CourseWorkspacePage() {
  return <CourseWorkspace />;
}
