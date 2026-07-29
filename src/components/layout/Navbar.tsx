"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Moon, Sun } from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { getCurrentUser, onAuthStateChange, signOut } from "@/lib/services/AuthService";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/", label: "창업자" },
  { href: "/manager/landing", label: "주관기관" },
  { href: "/workspace-entry", label: "워크스페이스" },
];

/** StartUp Pilot 공개 화면(로그인·가입 등)용 헤더. 워크스페이스는 자체 사이드바를 씁니다. */
export function Navbar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCurrentUser().then((user) => { if (mounted) setSignedIn(Boolean(user)); });
    const unsubscribe = onAuthStateChange((user) => setSignedIn(Boolean(user)));
    return () => { mounted = false; unsubscribe(); };
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="text-xl font-bold text-slate-900 dark:text-white">StartUp Pilot</Link>

        <nav className="hidden gap-6 text-sm font-semibold md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "transition-colors",
                pathname === link.href ? "text-primary" : "text-slate-500 hover:text-slate-900 dark:hover:text-white",
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "light" ? "다크 모드로 전환" : "라이트 모드로 전환"}
            className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
          </button>

          {signedIn ? (
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300"
            >
              <LogOut size={15} />로그아웃
            </button>
          ) : (
            <Link href="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white">로그인</Link>
          )}
        </div>
      </div>
    </header>
  );
}
