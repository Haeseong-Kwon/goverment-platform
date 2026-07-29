"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

const STANDALONE_PREFIXES = ["/manager", "/founder", "/workspace"];
const STANDALONE_EXACT = ["/", "/onboarding", "/workspace-entry"];

/**
 * StartUp Pilot 워크스페이스 화면은 자체 사이드바와 헤더를 갖습니다.
 * 이전 프로젝트에서 남은 상단 내비게이션이 겹쳐 보이지 않도록 여기서 제외합니다.
 */
function isStandaloneAppPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    STANDALONE_EXACT.includes(pathname) ||
    STANDALONE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const standalone = isStandaloneAppPath(pathname);

  return (
    <>
      {!standalone && <Navbar />}
      <main className="min-h-screen overflow-x-clip" data-scroll-root>
        {children}
      </main>
      {!standalone && <Footer />}
    </>
  );
}
