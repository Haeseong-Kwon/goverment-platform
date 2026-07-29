"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";

/**
 * 워크스페이스와 인증 화면은 자체 헤더를 갖습니다.
 * 공용 푸터는 공개 소개 화면에만 붙여 워크스페이스 안에서 내비게이션이 겹치지 않게 합니다.
 */
const PUBLIC_PAGES = ["/", "/manager/landing", "/workspace-entry"];

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <main className="min-h-screen overflow-x-clip" data-scroll-root>
        {children}
      </main>
      {pathname !== null && PUBLIC_PAGES.includes(pathname) && <Footer />}
    </>
  );
}
