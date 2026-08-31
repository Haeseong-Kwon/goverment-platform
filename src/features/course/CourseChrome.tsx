"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { GraduationCap, LogIn, LogOut, ShieldAlert } from "lucide-react";
import { getViewerAccount, isCourseMember, signOutViewer } from "@/lib/services/CourseService";
import { onAuthStateChange } from "@/lib/services/AuthService";
import {
  BOARDS,
  BOARD_ORDER,
  COURSE,
  COURSE_EMAIL_DOMAIN,
  COURSE_LOGIN_HREF,
  COURSE_SIGNUP_HREF,
  COURSE_WORKSPACE_HREF,
  courseHref,
  type CourseTab,
} from "./course";
import { focusRing } from "@/features/startup-workspace/ui";
import { cn } from "@/lib/utils";

/**
 * 지금 보고 있는 사람.
 *
 * 과목 게시판은 로그인 없이 읽히고, 쓰기에는 두 가지가 필요합니다 —
 * 로그인(`id`)과 과목 자격(`member`: 한양대 메일 인증 완료). 둘을 따로 두는 이유는
 * 화면이 "로그인하세요"와 "학교 메일로 인증해 주세요"를 구분해 말해야 하기 때문입니다.
 *
 * 권한의 실제 경계는 RLS입니다(016). 이 값은 버튼과 안내 문구를 고르는 용도입니다.
 */
export interface Viewer {
  id: string | null;
  email: string | null;
  member: boolean;
  loading: boolean;
}

export function useViewer(): Viewer {
  const [state, setState] = useState<Viewer>({ id: null, email: null, member: false, loading: true });

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      const account = await getViewerAccount().catch(() => null);
      if (!mounted) return;
      if (!account) {
        setState({ id: null, email: null, member: false, loading: false });
        return;
      }
      const member = await isCourseMember().catch(() => false);
      if (mounted) setState({ id: account.id, email: account.email, member, loading: false });
    };

    void resolve();
    const unsubscribe = onAuthStateChange(() => { void resolve(); });
    return () => { mounted = false; unsubscribe(); };
  }, []);

  return state;
}

/** 로그인 후 보던 화면으로 되돌아오게 합니다. 게시판에서 로그인했는데 워크스페이스로 떨어지면 길을 잃습니다. */
export const loginHref = (returnTo: string) => `${COURSE_LOGIN_HREF}?next=${encodeURIComponent(returnTo)}`;

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

            {/*
              세션을 아직 모를 때는 로그아웃 상태로 그립니다. `!viewer.loading &&`로
              감싸 두면 첫 화면에서 로그인·가입 버튼 자리가 통째로 비어, 처음 온 학생에게는
              들어갈 길이 없는 페이지로 보입니다.
            */}
            {(
              viewer.id ? (
                <div className="flex min-w-0 shrink-0 items-center gap-1.5">
                  {/* 어느 계정으로 보고 있는지. 잘못된 메일로 들어온 학생이 가장 먼저 확인할 값입니다. */}
                  {viewer.email && (
                    <span className="hidden max-w-[14rem] truncate text-xs font-semibold text-[#94A3B8] sm:block" title={viewer.email}>
                      {viewer.email}
                    </span>
                  )}
                  <Link
                    href={COURSE_WORKSPACE_HREF}
                    className={cn("rounded-lg px-3 py-2 text-sm font-bold text-[#475569] hover:bg-[#F1F5F9]", focusRing)}
                  >
                    내 워크스페이스
                  </Link>
                  <SignOutButton />
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5">
                  <Link
                    href={loginHref(pathname ?? courseHref())}
                    className={cn("rounded-lg px-3 py-2 text-sm font-bold text-[#475569] hover:bg-[#F1F5F9]", focusRing)}
                  >
                    로그인
                  </Link>
                  <Link
                    href={COURSE_SIGNUP_HREF}
                    className={cn("inline-flex items-center gap-1.5 rounded-lg bg-[#2563EB] px-3.5 py-2 text-sm font-bold text-white hover:bg-[#1D4ED8]", focusRing)}
                  >
                    <LogIn size={15} />수강생 가입
                  </Link>
                </div>
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
            {COURSE.school} {COURSE.label} 수업 운영 게시판입니다. 게시글과 댓글은 작성자 본인만 수정·삭제할 수 있습니다.
          </p>
          <p className="mt-1">
            글쓰기와 댓글은 @{COURSE_EMAIL_DOMAIN} 메일로 인증한 수강생만 가능합니다.
          </p>
        </div>
      </footer>
    </main>
  );
}

/**
 * 로그아웃.
 *
 * 없으면 다른 메일로 들어온 학생이 계정을 바꿀 길이 없습니다 — 지금까지
 * 과목 화면에는 로그아웃이 아예 없었습니다.
 */
function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    setBusy(true);
    try {
      await signOutViewer();
      router.replace(courseHref());
      // 세션이 바뀐 것을 화면 전체가 다시 읽게 합니다.
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void leave()}
      disabled={busy}
      aria-label="로그아웃"
      title="로그아웃"
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-lg text-[#94A3B8] transition-colors",
        focusRing,
        "hover:bg-[#F1F5F9] hover:text-[#475569] disabled:opacity-40",
      )}
    >
      <LogOut size={16} />
    </button>
  );
}

/** 로그인해야 쓸 수 있는 자리에 버튼 대신 놓는 안내. 눌렀다가 튕기는 것보다 먼저 알려 줍니다. */
export function SignInPrompt({ action }: { action: string }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap items-center gap-2">
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
      {/* 처음 오는 학생에게는 가입이 먼저입니다. 로그인만 보여 주면 들어올 길이 없습니다. */}
      <Link
        href={COURSE_SIGNUP_HREF}
        className={cn("rounded-xl px-3 py-2.5 text-sm font-bold text-[#2563EB] hover:underline", focusRing)}
      >
        수강생 가입
      </Link>
    </div>
  );
}

/**
 * 로그인은 했지만 과목 자격이 없을 때.
 *
 * 저장 단계에서 RLS가 거절하면 사용자는 "권한이 없습니다"만 보고 이유를 모릅니다.
 * 다른 메일로 가입한 것인지, 인증 링크를 아직 안 누른 것인지 두 경우를 함께 짚어
 * 다음 행동을 정할 수 있게 합니다.
 */
export function MembershipNotice({ action }: { action: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
      <ShieldAlert size={17} className="mt-0.5 shrink-0 text-[#B45309]" />
      <div className="min-w-0 text-sm leading-6 text-[#B45309]">
        <p className="font-bold">학교 메일 인증이 끝나야 {action} 수 있습니다</p>
        <p className="mt-1 font-medium">
          @{COURSE_EMAIL_DOMAIN} 주소로 가입한 뒤 받은 인증 메일의 링크를 눌러 주세요.
          다른 메일로 가입하셨다면 학교 메일로 새로 가입해야 합니다.
        </p>
        <Link href={COURSE_SIGNUP_HREF} className={cn("mt-2 inline-block font-bold underline", focusRing)}>
          학교 메일로 가입하기
        </Link>
      </div>
    </div>
  );
}

/**
 * 글쓰기 자리 하나를 통째로 맡습니다.
 *
 * 비로그인 → 로그인 안내, 로그인했지만 자격 없음 → 인증 안내, 자격 있음 → 실제 버튼.
 * 게시판 넷과 워크스페이스가 각자 이 분기를 쓰면 문구가 제각각이 됩니다.
 */
export function WriteGate({
  viewer,
  action,
  children,
}: {
  viewer: Viewer;
  action: string;
  children: React.ReactNode;
}) {
  if (viewer.loading) return <div className="h-11 w-40 animate-pulse rounded-xl bg-[#E2E8F0]" />;
  if (!viewer.id) return <SignInPrompt action={action} />;
  if (!viewer.member) return <MembershipNotice action={`${action}할`} />;
  return <>{children}</>;
}
