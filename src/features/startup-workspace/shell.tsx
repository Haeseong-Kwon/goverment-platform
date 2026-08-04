"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  BarChart3,
  Building2,
  Calculator,
  CalendarDays,
  ClipboardCheck,
  FlaskConical,
  FileSpreadsheet,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  Menu,
  Settings,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { DEV_BYPASS, DEV_WORLDS } from "@/lib/dev/devMode";
import { signOut } from "@/lib/services/AuthService";
import { getInstitutionName } from "@/lib/services/FounderWorkspaceService";
import { getSidebarLinks, isSidebarLinkActive } from "./logic";
import { useSession } from "./session";
import type { StartupRole } from "./types";
import { Button, IconButton, LinkButton, StatusBadge, focusRing } from "./ui";
import { cn } from "@/lib/utils";

const NAV_ICONS: Record<string, typeof LayoutDashboard> = {
  "/founder": LayoutDashboard,
  "/founder/todo": ListChecks,
  "/founder/calendar": CalendarDays,
  "/founder/diagnostics": Sparkles,
  "/founder/calculator": Calculator,
  "/founder/incorporation": Building2,
  "/founder/connect": Users,
  "/founder/vault": Archive,
  "/founder/settings": Settings,
  "/workspace": LayoutDashboard,
  "/workspace/precheck": ShieldCheck,
  "/workspace/predeliberation": ClipboardCheck,
  "/workspace/tracker": Activity,
  "/workspace/vault": Archive,
  "/workspace/settings": Settings,
  "/manager": LayoutDashboard,
  "/manager/review": ClipboardCheck,
  "/manager/plan-review": FileSpreadsheet,
  "/manager/teams": Users,
  "/manager/reports": BarChart3,
  "/manager/settings": Settings,
};

const ROLE_LABEL: Record<StartupRole, string> = {
  pre_founder: "창업자 준비",
  founder: "선정 팀",
  manager: "주관기관 매니저",
};

function NavList({ role, onNavigate }: { role: StartupRole; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {getSidebarLinks(role).map((item) => {
        const active = isSidebarLinkActive(item.href, pathname);
        const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold transition-colors",
              focusRing,
              active ? "bg-[#EFF6FF] text-[#2563EB]" : "text-[#475569] hover:bg-[#F8FAFC] hover:text-[#0F172A]",
            )}
          >
            <Icon size={17} className="shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

/** 개발용 진입 모드 전용. 로그인 없이 세 역할의 화면을 곧바로 오갑니다. */
function DevWorldSwitcher({ role }: { role: StartupRole }) {
  return (
    <div className="rounded-xl border border-dashed border-[#F59E0B] bg-[#FFFBEB] p-3">
      <p className="flex items-center gap-1.5 text-xs font-bold text-[#B45309]">
        <FlaskConical size={13} />개발용 진입 모드
      </p>
      <div className="mt-2 grid gap-1">
        {DEV_WORLDS.map((world) => (
          <Link
            key={world.role}
            href={world.href}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors",
              focusRing,
              world.role === role ? "bg-[#B45309] text-white" : "text-[#B45309] hover:bg-[#FEF3C7]",
            )}
          >
            {world.label}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-4 text-[#B45309]/80">예시 데이터이며 브라우저에만 저장됩니다.</p>
    </div>
  );
}

function AccountBlock({ role, email, loading }: { role: StartupRole; email: string | null; loading: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const leave = async () => {
    setBusy(true);
    try {
      await signOut();
      router.replace("/login");
    } finally {
      setBusy(false);
    }
  };

  // 개발용 진입 모드에서는 로그아웃 대신 세 세계를 오가는 전환기를 둡니다.
  if (DEV_BYPASS) return <DevWorldSwitcher role={role} />;

  // 세션을 읽는 동안 "로그인" 버튼이 잠깐 스쳐 지나가지 않게 자리만 잡아 둡니다.
  if (loading) return <div className="h-[92px] animate-pulse rounded-xl bg-[#F1F5F9]" />;

  if (!email) {
    return (
      <LinkButton href="/login" variant="secondary" block className="border-[#2563EB] text-[#2563EB]">로그인</LinkButton>
    );
  }

  return (
    <div className="rounded-xl border border-[#E2E8F0] p-3">
      <p className="truncate text-sm font-bold text-[#0F172A]" title={email}>{email}</p>
      <p className="mt-0.5 text-xs font-semibold text-[#94A3B8]">{ROLE_LABEL[role]}</p>
      <Button variant="secondary" size="sm" block loading={busy} onClick={() => void leave()} icon={<LogOut size={13} />} className="mt-3">
        로그아웃
      </Button>
    </div>
  );
}

/** 워크스페이스 공통 뼈대. 데스크톱은 고정 사이드바, 모바일은 상단바 + 드로어입니다. */
export function WorkspaceShell({ role, children }: { role: StartupRole; children: React.ReactNode }) {
  const pathname = usePathname();
  const session = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [institution, setInstitution] = useState<string | null>(null);
  const email = session.status === "signed_in" ? session.email : null;

  useEffect(() => setDrawerOpen(false), [pathname]);

  useEffect(() => {
    if (role === "pre_founder" || session.status !== "signed_in") return;
    let mounted = true;
    getInstitutionName().then((name) => { if (mounted) setInstitution(name); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [role, session.status]);

  const brand = (
    <div className="shrink-0">
      <Link href="/" className="text-xl font-bold text-[#0F172A]">StartUp Pilot</Link>
      {institution && <p className="mt-1 truncate text-xs font-semibold text-[#2563EB]">{institution} 연결됨</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white px-4 py-3 lg:hidden">
        {brand}
        <IconButton
          label="메뉴 열기"
          aria-expanded={drawerOpen}
          onClick={() => setDrawerOpen(true)}
          icon={<Menu size={19} />}
          className="h-10 w-10 border border-[#E2E8F0]"
        />
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" aria-label="메뉴 닫기" onClick={() => setDrawerOpen(false)} className="animate-in absolute inset-0 bg-black/40" />
          <div className="animate-in absolute inset-y-0 left-0 flex w-[276px] max-w-[85vw] flex-col overflow-y-auto bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              {brand}
              <IconButton label="메뉴 닫기" onClick={() => setDrawerOpen(false)} icon={<X size={18} />} />
            </div>
            <div className="mt-6 flex-1"><NavList role={role} onNavigate={() => setDrawerOpen(false)} /></div>
            <div className="mt-6"><AccountBlock role={role} email={email} loading={session.status === "loading"} /></div>
          </div>
        </div>
      )}

      <div className="flex">
        <aside className="sticky top-0 hidden h-screen w-[240px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-[#E2E8F0] bg-white p-5 lg:flex">
          {brand}
          <div className="flex-1"><NavList role={role} /></div>
          {role === "pre_founder" && (
            <Link href="/founder/convert" className={cn("block shrink-0 rounded-xl bg-[#EFF6FF] px-3 py-2.5 text-sm font-bold text-[#2563EB]", focusRing, "transition-colors hover:bg-[#DBEAFE]")}>
              합격하셨나요?
            </Link>
          )}
          <div className="shrink-0"><AccountBlock role={role} email={email} loading={session.status === "loading"} /></div>
        </aside>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}

function Gate({ role, children }: { role: StartupRole; children: React.ReactNode }) {
  return (
    <WorkspaceShell role={role}>
      <div className="mx-auto max-w-xl rounded-2xl border border-[#E2E8F0] bg-white p-8">{children}</div>
    </WorkspaceShell>
  );
}

/**
 * 창업자 워크스페이스 진입 조건을 한곳에서 판단합니다.
 * 미로그인 상태에서 0으로 채워진 대시보드를 보여주는 대신 다음 행동을 제시합니다.
 */
export function RequireFounderSession({
  role,
  children,
}: {
  role: Extract<StartupRole, "pre_founder" | "founder">;
  children: React.ReactNode;
}) {
  const session = useSession();

  if (session.status === "loading") {
    return (
      <Gate role={role}>
        <p className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <Loader2 size={16} className="animate-spin" />워크스페이스를 준비하는 중입니다.
        </p>
      </Gate>
    );
  }

  if (session.status === "signed_out") {
    return (
      <Gate role={role}>
        <StatusBadge tone="amber">로그인 필요</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">워크스페이스는 로그인 후 이용할 수 있습니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          팀 TODO·진단 결과·서류 보관함은 팀 계정에 저장됩니다. 로그인하거나 새 계정을 만들어 주세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/login" size="lg">로그인</LinkButton>
          <LinkButton href="/signup" variant="secondary" size="lg" className="border-[#2563EB] text-[#2563EB]">회원가입</LinkButton>
        </div>
      </Gate>
    );
  }

  const profile = session.profile;

  if (!profile || !profile.onboardingComplete) {
    return (
      <Gate role={role}>
        <StatusBadge tone="blue">설정 미완료</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">먼저 팀 정보를 설정해 주세요</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          팀 이름과 준비 중인 지원사업을 입력하면 마감 일정과 자동 TODO가 생성됩니다. 1분이면 끝납니다.
        </p>
        <LinkButton href="/onboarding" size="lg" className="mt-6">팀 설정 시작</LinkButton>
      </Gate>
    );
  }

  if (role === "founder" && profile.role === "pre_founder") {
    return (
      <Gate role="pre_founder">
        <StatusBadge tone="amber">협약 전</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">협약 수행 화면은 선정 이후에 열립니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          정산 사전검증과 사전심의 합본은 주관기관과 협약한 팀만 사용합니다. 선정되셨다면 기관에서 받은 전환 코드를 입력해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/founder/convert" size="lg">전환 코드 입력</LinkButton>
          <LinkButton href="/founder" variant="secondary" size="lg">준비 워크스페이스로</LinkButton>
        </div>
      </Gate>
    );
  }

  return <>{children}</>;
}

/**
 * 기관 화면 진입 조건.
 *
 * 창업자 쪽과 같은 규칙을 매니저 쪽에도 적용합니다. 이 게이트가 없을 때는
 * 로그아웃 방문자와 일반 창업자에게도 검토 큐가 그대로 열려, 자기 제출 건이
 * 목록에 뜨고 승인·반려 버튼까지 눌리는 상태였습니다(서버는 막지만 화면은 허용).
 */
export function RequireManagerSession({ children, deniedFallback }: { children: React.ReactNode; deniedFallback?: React.ReactNode }) {
  const session = useSession();

  if (session.status === "loading") {
    return (
      <Gate role="manager">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
          <Loader2 size={16} className="animate-spin" />기관 화면을 준비하는 중입니다.
        </p>
      </Gate>
    );
  }

  if (session.status === "signed_out") {
    return (
      <Gate role="manager">
        <StatusBadge tone="amber">로그인 필요</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">기관 화면은 로그인 후 이용할 수 있습니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          검토 큐와 팀 관리는 주관기관 매니저 계정에만 열립니다.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/login" size="lg">로그인</LinkButton>
          <LinkButton href="/" variant="secondary" size="lg">창업자 화면으로</LinkButton>
        </div>
      </Gate>
    );
  }

  // 기관 소속이 없으면 매니저가 아닙니다. 부트스트랩 카드는 이 안쪽에서만 보여야 합니다.
  if (session.profile?.role !== "manager" || !session.profile.institutionId) {
    return (
      <Gate role="manager">
        <StatusBadge tone="blue">권한 없음</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">기관 매니저 계정이 아닙니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          이 화면은 주관기관이 정산 검토를 처리하는 곳입니다. 창업자 계정이라면 준비 워크스페이스를 이용해 주세요.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/founder" size="lg">준비 워크스페이스로</LinkButton>
          <LinkButton href="/manager/landing" variant="secondary" size="lg">기관 도입 안내</LinkButton>
        </div>
        {/* 기관 계정 활성화는 로그인한 사용자에게만, 그것도 이 안쪽에서만 노출합니다. */}
        {deniedFallback && <div className="mt-8 border-t border-[#E2E8F0] pt-6">{deniedFallback}</div>}
      </Gate>
    );
  }

  return <>{children}</>;
}
