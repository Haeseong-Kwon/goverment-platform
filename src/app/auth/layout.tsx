import type { Metadata } from "next";

// 인증 메일에서 돌아오는 경유 화면입니다. 색인되면 만료된 토큰 주소가 검색 결과에 남습니다.
export const metadata: Metadata = {
  title: "인증 처리",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
