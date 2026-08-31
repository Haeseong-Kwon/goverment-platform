"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { GraduationCap, LogIn } from "lucide-react";
import { getViewerId } from "@/lib/services/CourseService";
import { onAuthStateChange } from "@/lib/services/AuthService";
import { BOARDS, BOARD_ORDER, COURSE, COURSE_WORKSPACE_HREF, courseHref, type CourseTab } from "./course";
import { focusRing } from "@/features/startup-workspace/ui";
import { cn } from "@/lib/utils";

/**
 * 지금 보고 있는 사람.
 *
 * 과목 게시판은 로그인 없이 읽히고, 쓰기와 "내 글 수정·삭제"에만 로그인이 필요합니다.
 * 그래서 화면이 물어보는 것은 프로필 전체가 아니라 "누구인가" 하나뿐입니다.
 * (권한의 실제 경계는 RLS입니다. 이 값은 버튼을 보여줄지 정하는 용도입니다.)
 */
export function useViewer() {
  const [state, setState] = useState<{ id: string | null; loading: boolean }>({ id: null, loading: true });

  useEffect(() => {
    let mounted = true;
    getViewerId()
      .then((id) => { if (mounted) setState({ id, loading: false }); })
      .catch(() => { if (mounted) setState({ id: null, loading: false }); });
    const unsubscribe = onAuthStateChange((user) => {
      if (mounted) setState({ id: user?.id ?? null, loading: false });
    });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  return state;
}

/** 로그인 후 보던 화면으로 되돌아오게 합니다. 게시판에서 로그인했는데 워크스페이스로 떨어지면 길을 잃습니다. */
export const loginHref = (returnTo: string) => `/login?next=${encodeURIComponent(returnTo)}`;

function BoardTabs({ active, signedIn }: { active: CourseTab; signedIn: boolean }) {
  const tabs: Array<{ key: CourseTab; label: string; href: string }> = [
    { key: "home", label: "과목 홈", href: courseHref() },
    ...BOARD_ORDER.map((id) => ({ key: id, label: BOARDS[id].label, href: courseHref(id) })),
    // 내 활동만 모이는 곳이라 로그인해야 의미가 있습니다. 비로그인 방문자에게는
    // 누르면 로그인 화면으로 튕기는 탭을 보여 주지 않습니다.
    ...(signedIn ? [{ key: "me" as const, label: "내 워크스페이스", href: COURSE_WORKSPACE_HREF }] : []),
  ];

  return (
    // 모바일에서는 탭이 줄바꿈되지 않고 옆으로 흐릅니다. 다섯 개를 두 줄로 접으면 헤더가 화면 절반을 먹습니다.
    <nav aria-label="과목 게시판" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-t-lg border-b-2 px-3.5 py-3 text-sm font-bold transition-colors",
              focusRing,
              selected
                ? "border-[#2563EB] text-[#2563EB]"
                : "border-transparent text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * 과목 화면의 공통 껍데기.
 *
 * 워크스페이스 사이드바를 쓰지 않습니다. 이 게시판은 로그인 이전에도 열리는
 * 공개 화면이고, 학생이 오가는 곳은 게시판 넷뿐이라 상단 탭이면 충분합니다.
 */
export function CourseShell({ active, children }: { active: CourseTab; children: React.ReactNode }) {
  const viewer = useViewer();
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="flex items-center justify-between gap-4 pt-4">
            <Link href={courseHref()} className={cn("flex min-w-0 items-center gap-2.5", focusRing)}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
                <GraduationCap size={19} />
              </span>
              <span className="min-w-0">
                <strong className="block truncate text-[15px] font-bold leading-tight">{COURSE.track}</strong>
                <span className="block truncate text-xs font-semibold text-[#94A3B8]">
                  {COURSE.school} · {COURSE.year}년 {COURSE.term}학기
                </span>
              </span>
            </Link>

            {!viewer.loading && (
              viewer.id ? (
                <Link
                  href={COURSE_WORKSPACE_HREF}
                  className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-bold text-[#475569] hover:bg-[#F1F5F9]", focusRing)}
                >
                  내 워크스페이스
                </Link>
              ) : (
                <Link
                  href={loginHref(pathname ?? courseHref())}
                  className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-sm font-bold text-white hover:bg-[#1D4ED8]", focusRing)}
                >
                  <LogIn size={15} />로그인
                </Link>
              )
            )}
          </div>
          <BoardTabs active={active} signedIn={Boolean(viewer.id)} />
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">{children}</div>

      <footer className="border-t border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-8 text-xs leading-6 text-[#94A3B8] md:px-6">
          <p>
            {COURSE.label} 수업 운영 게시판입니다. 게시글과 댓글은 과목 수강생에게 공개되며, 작성자 본인만 수정·삭제할 수 있습니다.
          </p>
          <p className="mt-1">
            <Link href="/" className={cn("font-semibold text-[#2563EB] hover:underline", focusRing)}>StartUp Pilot</Link>
            에서 운영합니다.
          </p>
        </div>
      </footer>
    </main>
  );
}

/** 로그인해야 쓸 수 있는 자리에 버튼 대신 놓는 안내. 눌렀다가 튕기는 것보다 먼저 알려 줍니다. */
export function SignInPrompt({ action }: { action: string }) {
  const pathname = usePathname();
  return (
    <Link
      href={loginHref(pathname ?? courseHref())}
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-bold text-[#475569]",
        focusRing,
        "transition-colors hover:border-[#2563EB] hover:text-[#2563EB]",
      )}
    >
      <LogIn size={15} />로그인하고 {action}
    </Link>
  );
}
