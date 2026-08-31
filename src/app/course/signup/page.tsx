import type { Metadata } from "next";
import { CourseSignupPage } from "@/features/course/CourseAuth";

export const metadata: Metadata = {
  title: "수강생 가입",
  robots: { index: false, follow: false },
};

export default CourseSignupPage;
