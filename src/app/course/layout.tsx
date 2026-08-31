import type { Metadata } from "next";
import { COURSE } from "@/features/course/course";

/**
 * 과목 영역의 메타데이터를 StartUp Pilot과 분리합니다.
 *
 * 루트 레이아웃은 제목 뒤에 "| StartUp Pilot"을 붙이고 저자·발행자를 그 제품으로
 * 적습니다. 수업 때문에 들어온 학생에게는 다른 서비스의 화면처럼 보이므로
 * 여기서 과목 이름으로 덮어씁니다.
 */
export const metadata: Metadata = {
  title: {
    default: `${COURSE.label} — ${COURSE.school}`,
    template: `%s | ${COURSE.track}`,
  },
  applicationName: COURSE.track,
  authors: [{ name: COURSE.school }],
  creator: COURSE.school,
  publisher: COURSE.school,
  category: "education",
  openGraph: { type: "website", locale: "ko_KR", siteName: COURSE.track },
};

export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
