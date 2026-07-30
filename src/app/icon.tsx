import { ImageResponse } from "next/og";

/**
 * 브라우저 탭 아이콘. 기존 favicon.ico는 create-next-app이 넣어 둔 Next.js 로고였습니다.
 * 라틴 문자만 쓰므로 별도 폰트가 필요 없습니다.
 */
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
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
          fontSize: 19,
          fontWeight: 700,
          letterSpacing: "-0.04em",
          borderRadius: 7,
        }}
      >
        SP
      </div>
    ),
    size,
  );
}
