import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "마감 캘린더",
  description: "K-Startup 공고 마감과 팀 일정을 한 달력에서 보고, 일정마다 팀원과 코멘트를 주고받습니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderCalendarPage() {
  return <FounderFeaturePage feature="calendar" />;
}
