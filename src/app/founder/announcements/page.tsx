import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "지원사업 공고",
  description: "K-Startup 정부지원사업 공고를 내 조건으로 걸러 보고 마감일을 캘린더에 담습니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default function FounderAnnouncementsPage() {
  return <FounderFeaturePage feature="announcements" />;
}
