import type { Metadata } from "next";
import { CourseMembers } from "@/features/course/CourseMembers";
import { COURSE } from "@/features/course/course";

export const metadata: Metadata = {
  title: `수강생 명단 — ${COURSE.label}`,
  // 운영진 전용 화면이고 메일 주소가 담깁니다. 색인 대상이 아닙니다.
  robots: { index: false, follow: false },
};

export default function CourseMembersPage() {
  return <CourseMembers />;
}
