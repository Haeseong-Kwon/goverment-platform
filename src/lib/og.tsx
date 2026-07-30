import { ImageResponse } from "next/og";
import { SITE_NAME } from "./seo";

/** OG 이미지 표준 크기. 이보다 작으면 카카오톡·슬랙에서 잘리거나 축소됩니다. */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * 한글 폰트 없이는 satori가 한글을 네모(tofu)로 그립니다.
 * 빌드 시 한 번 받아 오고, 실패하면 라틴 문자만으로 그려 배포가 멈추지 않게 합니다.
 * 버전을 고정해 두어 업스트림 변경이 빌드 결과를 바꾸지 못하게 합니다.
 */
const FONT_URL =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/Pretendard-Bold.otf";

let cachedFont: ArrayBuffer | null | undefined;

async function loadKoreanFont(): Promise<ArrayBuffer | null> {
  if (cachedFont !== undefined) return cachedFont;
  try {
    const response = await fetch(FONT_URL, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`font ${response.status}`);
    cachedFont = await response.arrayBuffer();
  } catch (reason) {
    console.warn("OG 한글 폰트를 불러오지 못해 라틴 문자로만 렌더링합니다:", reason);
    cachedFont = null;
  }
  return cachedFont;
}

const COLORS = {
  ink: "#0F172A",
  muted: "#475569",
  brand: "#2563EB",
  border: "#E2E8F0",
  surface: "#F8FAFC",
};

/**
 * 공유 카드 한 장.
 *
 * 이미지·아이콘 폰트를 쓰지 않고 도형과 글자만 씁니다. 외부 자산이 하나라도 있으면
 * 카카오톡·슬랙 미리보기에서 깨진 채 캐시됩니다.
 */
export async function renderOgImage({
  eyebrow,
  title,
  description,
  bullets,
}: {
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
}) {
  const font = await loadKoreanFont();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#ffffff",
          padding: "68px 72px",
          // 왼쪽 브랜드 바. 도형만으로 만든 유일한 장식입니다.
          borderLeft: `20px solid ${COLORS.brand}`,
          fontFamily: font ? "Pretendard" : "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 10,
                backgroundColor: "#EFF6FF",
                color: COLORS.brand,
                padding: "8px 16px",
                fontSize: 26,
                fontWeight: 700,
              }}
            >
              {eyebrow}
            </div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 700, color: COLORS.muted }}>{SITE_NAME}</div>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 34,
              fontSize: 68,
              fontWeight: 700,
              lineHeight: 1.22,
              letterSpacing: "-0.02em",
              color: COLORS.ink,
              // satori는 \n을 무시하고 알아서 줄을 나눕니다. 그대로 두면 "워크스/페이스"처럼
              // 단어 중간이 끊깁니다. 줄바꿈 위치를 직접 정합니다.
              whiteSpace: "pre-line",
            }}
          >
            {title}
          </div>

          <div style={{ display: "flex", marginTop: 26, fontSize: 30, lineHeight: 1.5, color: COLORS.muted }}>
            {description}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {bullets.map((bullet) => (
            <div
              key={bullet}
              style={{
                display: "flex",
                alignItems: "center",
                borderRadius: 999,
                border: `2px solid ${COLORS.border}`,
                backgroundColor: COLORS.surface,
                padding: "12px 22px",
                fontSize: 25,
                fontWeight: 700,
                color: COLORS.muted,
              }}
            >
              {bullet}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: font ? [{ name: "Pretendard", data: font, style: "normal", weight: 700 }] : undefined,
    },
  );
}
