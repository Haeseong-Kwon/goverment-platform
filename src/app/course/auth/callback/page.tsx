import type { Metadata } from "next";
import { CourseAuthCallbackPage } from "@/features/course/CourseAuth";

export const metadata: Metadata = {
  title: "이메일 인증",
  robots: { index: false, follow: false },
};

export default CourseAuthCallbackPage;
