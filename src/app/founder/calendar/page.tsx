import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "마감 캘린더",
  description: "선택한 지원사업 공고 마감과 팀 할 일 마감을 한 달력에서 봅니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderCalendarPage() {
  return <FounderFeaturePage feature="calendar" />;
}
