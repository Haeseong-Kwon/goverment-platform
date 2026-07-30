import { ConvertPage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "합격 전환",
  description: "기관 전환 코드를 입력해 협약 수행 워크스페이스로 이동합니다.",
  // 로그인 이후 화면입니다. 색인되면 검색 결과에 빈 화면이 남고 크롤러가 인증 흐름을 건드립니다.
  robots: { index: false, follow: false },
};

export default ConvertPage;
