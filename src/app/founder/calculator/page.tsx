import { redirect } from "next/navigation";

/**
 * 계산기는 로그인 없이 쓰는 공개 도구로 옮겼습니다(/calculator).
 * 사이드바 링크와 기존 북마크가 끊기지 않도록 여기서 넘겨 줍니다.
 */
export default function FounderCalculatorPage() {
  redirect("/calculator");
}
