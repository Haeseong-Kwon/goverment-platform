import type { Metadata } from "next";
import "./globals.css";
import "@/features/administration-simulator/simulator.css";
import { AppChrome } from "@/components/layout/AppChrome";

import { ThemeProvider } from "@/context/ThemeContext";

export const metadata: Metadata = {
  title: "AOP | All-in-One Platform",
  description: "한양대학교 ERICA SW창업캡스톤디자인 통합 플랫폼",
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
