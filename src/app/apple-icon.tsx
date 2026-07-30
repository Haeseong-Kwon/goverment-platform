import { ImageResponse } from "next/og";

/** iOS 홈 화면 추가용. 애플은 투명 배경을 검게 채우므로 배경을 직접 칠합니다. */
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2563EB",
          color: "#ffffff",
          fontSize: 104,
          fontWeight: 700,
          letterSpacing: "-0.04em",
        }}
      >
        SP
      </div>
    ),
    size,
  );
}
