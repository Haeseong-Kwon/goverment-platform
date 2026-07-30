// 이 화면은 클라이언트 컴포넌트라 metadata를 직접 내보낼 수 없어 레이아웃에서 제목만 지정합니다.
export const metadata = { title: "팀 설정" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
