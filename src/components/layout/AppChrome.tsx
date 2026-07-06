"use client";

import { usePathname } from "next/navigation";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

function isStandaloneAppPath(pathname: string | null) {
  if (!pathname) return false;
  return (
    pathname === "/" ||
    pathname === "/onboarding" ||
    pathname === "/settlements" ||
    pathname.startsWith("/settlements/") ||
    pathname === "/manager" ||
    pathname.startsWith("/manager/") ||
    pathname === "/founder" ||
    pathname.startsWith("/founder/") ||
    pathname === "/workspace" ||
    pathname.startsWith("/workspace/") ||
    pathname === "/accountant"
  );
}

export function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const standalone = isStandaloneAppPath(pathname);

  return (
    <>
      <Navbar />
      <main className="min-h-screen overflow-x-clip" data-scroll-root>
        {children}
      </main>
      {!standalone && <Footer />}
    </>
  );
}
