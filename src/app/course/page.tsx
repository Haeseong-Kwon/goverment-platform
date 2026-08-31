import type { Metadata } from "next";
import { CourseHome } from "@/features/course/CourseHome";
import { COURSE } from "@/features/course/course";
import { IS_INDEXABLE_DEPLOYMENT, absoluteUrl } from "@/lib/seo";

const TITLE = `${COURSE.school} ${COURSE.label} — 팀빌딩·기업제안·결과물 게시판`;
const DESCRIPTION =
  `${COURSE.school} ${COURSE.label} 수강생 게시판입니다. 팀원 모집글, 기업이 제안한 프로젝트, 확정 팀 명단, 중간·기말 결과물을 한 곳에서 보고 댓글로 이야기합니다.`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: absoluteUrl("/course") },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/course") },
  robots: IS_INDEXABLE_DEPLOYMENT ? { index: true, follow: true } : { index: false, follow: false },
};

export default function CoursePage() {
  return <CourseHome />;
}
