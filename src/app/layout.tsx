import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppChrome } from "@/components/layout/AppChrome";
import { Analytics } from "@/components/analytics/Analytics";
import { SiteStructuredData } from "@/components/seo/StructuredData";
import {
  IS_INDEXABLE_DEPLOYMENT,
  SITE_DESCRIPTION,
  SITE_KEYWORDS,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/seo";

export const metadata: Metadata = {
  // OG 이미지·canonical은 상대 경로를 쓸 수 없습니다. 이 값이 없으면 Next가 경고와 함께
  // localhost를 절대 주소로 박아 배포본의 공유 카드가 깨집니다.
  metadataBase: new URL(SITE_URL),

  // 각 화면이 자기 제목을 붙입니다. 탭을 여러 개 열어 두는 매니저가 어느 화면인지 구분할 수 있어야 합니다.
  title: {
    default: `${SITE_NAME} | ${SITE_TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "business",

  // 배포 주소가 vercel.app이어도 검색엔진에는 최종 도메인 하나만 알립니다(중복 색인 방지).
  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: "/",
    siteName: SITE_NAME,
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    // 이미지는 app/opengraph-image.tsx 가 자동으로 붙입니다.
  },

  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
  },

  robots: IS_INDEXABLE_DEPLOYMENT
    ? {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
          "max-video-preview": -1,
        },
      }
    : { index: false, follow: false },

  // 값이 비면 Next가 태그 자체를 생략합니다. 콘솔에서 발급받은 값을 환경변수로 넣으세요.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: {
      ...(process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION
        ? { "naver-site-verification": process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION }
        : {}),
    },
  },

  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: "#2563EB",
  colorScheme: "light",
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
        <SiteStructuredData />
      </head>
      <body className="bg-background text-foreground antialiased">
        <AppChrome>{children}</AppChrome>
        <Analytics />
      </body>
    </html>
  );
}
