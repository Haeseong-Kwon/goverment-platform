import type { Metadata } from "next";
import { CourseLoginPage } from "@/features/course/CourseAuth";

export const metadata: Metadata = {
  title: "수강생 로그인",
  robots: { index: false, follow: false },
};

export default CourseLoginPage;
