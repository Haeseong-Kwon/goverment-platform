import { FounderFeaturePage } from "@/features/startup-workspace/components";

export const metadata = {
  title: "무료 자료실",
  description: "출처가 표기된 창업 표준 양식을 받습니다.",
  // 워크스페이스 안쪽 화면입니다. 검색 유입은 공개 라우트(/library)가 받습니다.
  robots: { index: false, follow: false },
};

export default function FounderLibraryPage() {
  return <FounderFeaturePage feature="library" />;
}
