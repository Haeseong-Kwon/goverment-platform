import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

/** 하위 경로가 자기 이미지를 두지 않으면 이 카드를 물려받습니다. */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StartUp Pilot — 정부 창업지원사업 준비부터 정산까지";

export default async function Image() {
  return renderOgImage({
    eyebrow: "창업자 워크스페이스",
    title: "지원사업 준비부터 정산까지,\n한 워크스페이스에서",
    description: "자격 진단 · 마감 캘린더 · 사업비 사전검증을 규정 룰 엔진으로",
    bullets: ["예비창업패키지", "초기창업패키지", "사업비 정산"],
  });
}
