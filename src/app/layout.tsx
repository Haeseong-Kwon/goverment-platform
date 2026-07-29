import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "@/components/layout/AppChrome";

import { ThemeProvider } from "@/context/ThemeContext";

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
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const savedTheme = localStorage.getItem("theme");
                const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                const resolvedTheme = savedTheme === "dark" || (!savedTheme && prefersDark) ? "dark" : "light";
                document.documentElement.classList.toggle("dark", resolvedTheme === "dark");
              } catch {}
            })();`,
          }}
        />
      </head>
      <body className="antialiased bg-background text-foreground transition-colors duration-300">
        <ThemeProvider>
          <AppChrome>
            {children}
          </AppChrome>
        </ThemeProvider>
      </body>
    </html>
  );
}
