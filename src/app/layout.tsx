import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "@/components/layout/AppChrome";

export const metadata: Metadata = {
  title: "StartUp Pilot | 정부 창업지원사업 행정 SaaS",
  description: "창업자 전용 워크스페이스와 주관기관 매니저 대시보드를 하나의 규정 룰 엔진으로 연결하는 창업 행정 SaaS",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
      </head>
      <body className="bg-background text-foreground antialiased">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
