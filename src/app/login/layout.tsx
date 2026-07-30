import type { Metadata } from "next";

// 이 화면은 클라이언트 컴포넌트라 metadata를 직접 내보낼 수 없어 레이아웃에서 지정합니다.
export const metadata: Metadata = {
  title: "로그인",
  description: "팀 계정으로 로그인합니다.",
  // 인증 화면은 색인 대상이 아닙니다.
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
