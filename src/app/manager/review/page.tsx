import { ManagerReviewQueuePage } from "@/features/startup-workspace/ManagerScreens";

export const metadata = {
  title: "검토 큐",
  description: "사전검증을 통과한 정산 건을 승인하거나 반려합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default ManagerReviewQueuePage;
