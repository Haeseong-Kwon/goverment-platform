import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from "@/lib/og";

/** 기관 담당자에게 공유될 때는 창업자용 문구가 맞지 않아 카드를 따로 둡니다. */
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "StartUp Pilot — 주관기관 정산 검토 대시보드";

export default async function Image() {
  return renderOgImage({
    eyebrow: "주관기관 대시보드",
    title: "검증 통과 건만 도착하는\n정산 검토 큐",
    description: "반려 사유코드와 근거 조항을 인용한 안내문을 자동으로 작성합니다",
    bullets: ["검토 큐", "반려 사유 분포", "준비 데이터 비공개"],
  });
}
