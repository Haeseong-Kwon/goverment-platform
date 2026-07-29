"use client";

import Link from "next/link";
import {
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Lock,
  MessageCircle,
  ShieldCheck,
  Users,
} from "lucide-react";
import { getLandingNavigation, getStartupMilestones } from "./logic";
import type { StartupMilestone } from "./types";
import { LinkButton, StatusBadge, focusRing } from "./ui";
import { cn } from "@/lib/utils";

function LandingNav({ role }: { role: "founder" | "manager" }) {
  const nav = getLandingNavigation(role);
  return (
    <header className="sticky top-0 z-40 border-b border-[#E2E8F0] bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
        <Link href={nav.homeHref} className="text-xl font-bold text-[#0F172A]">StartUp Pilot</Link>
        <nav className="hidden gap-6 text-sm font-semibold text-[#475569] md:flex">
          <Link href="/" className={cn("hover:text-[#0F172A]", role === "founder" && "text-[#2563EB]")}>창업자</Link>
          <Link href="/manager/landing" className={cn("hover:text-[#0F172A]", role === "manager" && "text-[#2563EB]")}>주관기관</Link>
          <a href="#features" className="hover:text-[#0F172A]">기능</a>
        </nav>
        <div className="flex items-center gap-2">
          <LinkButton href="/login" variant="ghost" size="sm" className="hidden sm:inline-flex">로그인</LinkButton>
          <LinkButton href={nav.workspaceEntryHref} size="sm">워크스페이스 진입</LinkButton>
        </div>
      </div>
    </header>
  );
}

/** 랜딩의 예시 화면입니다. 조작 가능한 컨트롤을 두면 눌러도 반응하지 않아 신뢰를 잃습니다. */
function MilestonePreview({ milestone }: { milestone: StartupMilestone }) {
  return (
    <article className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-4", milestone.dday <= 1 && "border-l-4 border-l-[#DC2626]")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <span aria-hidden className="mt-0.5 h-4 w-4 shrink-0 rounded border border-[#CBD5E1]" />
          <span className="font-semibold text-[#0F172A]">{milestone.title}</span>
        </div>
        <StatusBadge tone={milestone.dday <= 3 ? "red" : milestone.dday <= 7 ? "amber" : "slate"}>D-{milestone.dday}</StatusBadge>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">{milestone.owner.slice(0, 1)}</span>
        <span className="text-sm text-[#475569]">{milestone.owner}</span>
        <StatusBadge tone="blue">자동 생성</StatusBadge>
        <span className="ml-auto flex items-center gap-1 text-sm text-[#94A3B8]"><MessageCircle size={14} />{milestone.comments}</span>
      </div>
    </article>
  );
}

const FOUNDER_FEATURES = [
  { title: "AI 자격 진단", desc: "사업별 자격 룰셋에 답변을 대조해 신청 가능성과 확인이 필요한 데이터를 구분합니다." },
  { title: "사업계획서 진단", desc: "PSST 구조로 점수와 근거를 나누고 SWOT 보완점을 제안합니다. 매달 2회 무료." },
  { title: "정산 사전검증", desc: "「사업비 비목 해설」 룰셋으로 집행 건을 미리 판정해 반려될 항목을 먼저 찾습니다." },
  { title: "마감 캘린더", desc: "선택한 지원사업 공고 마감과 팀 TODO 마감을 한 달력에서 봅니다." },
  { title: "서류 보관함", desc: "같은 이름으로 올리면 버전이 쌓이고, 선정 후 협약 팀으로 이관됩니다." },
  { title: "팀 TODO", desc: "공고 마감일을 기준으로 준비 마일스톤이 자동 생성됩니다." },
];

const FLOW = [
  { step: "01", title: "준비", desc: "자격을 진단하고 마감 기준 TODO를 받습니다." },
  { step: "02", title: "선정", desc: "기관 전환 코드를 입력해 협약 워크스페이스로 이동합니다." },
  { step: "03", title: "수행·정산", desc: "집행 건을 사전검증한 뒤 검토를 요청합니다." },
];

export function FounderLanding() {
  const nav = getLandingNavigation("founder");
  const milestones = getStartupMilestones("예창패").slice(0, 3);

  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <LandingNav role="founder" />

      <section className="mx-auto grid max-w-7xl items-start gap-10 px-5 py-14 md:py-20 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <StatusBadge tone="blue">창업자 전용</StatusBadge>
          <h1 className="mt-5 text-[34px] font-bold leading-tight tracking-tight md:text-[44px]">
            지원사업 준비를 팀 TODO와 AI 진단으로 정리하세요
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#475569] md:text-lg">
            예창패·초창패·모두의창업을 준비하는 팀이 마감, 자격, 사업계획서, 보관함을 한 흐름으로 관리하는 창업자 워크스페이스입니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href={nav.workspaceEntryHref} size="lg">워크스페이스 진입</LinkButton>
            <LinkButton href={nav.counterpartHref} variant="secondary" size="lg" className="border-[#2563EB] text-[#2563EB]">주관기관 화면 보기</LinkButton>
          </div>

          <dl className="mt-10 grid max-w-lg gap-4 sm:grid-cols-3">
            {FLOW.map((item) => (
              <div key={item.step} className="rounded-2xl border border-[#E2E8F0] p-4">
                <dt className="text-xs font-bold tracking-widest text-[#2563EB]">{item.step} {item.title}</dt>
                <dd className="mt-2 text-sm leading-6 text-[#475569]">{item.desc}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
          <div className="rounded-2xl bg-white p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-bold md:text-xl">예창패 서류 마감 D-12</h2>
              <StatusBadge tone="slate">예시 화면</StatusBadge>
            </div>
            <div className="mt-4 grid gap-3">
              {milestones.map((milestone) => <MilestonePreview key={milestone.id} milestone={milestone} />)}
            </div>
            <p className="mt-4 text-xs font-medium text-[#94A3B8]">
              실제 화면에서는 선택한 공고 마감일을 기준으로 팀의 TODO가 생성됩니다.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
          <h2 className="text-[26px] font-bold md:text-[32px]">준비부터 정산까지 한 워크스페이스에서</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#475569] md:text-base">
            모든 판정에는 근거 조항이 함께 표시됩니다. AI 결과는 참고용이며 최종 기준은 각 사업 공고문과 관리지침입니다.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {FOUNDER_FEATURES.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
                <h3 className="text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

const MANAGER_FEATURES = [
  { title: "검증 통과 건만 도착", desc: "창업자가 사전검증을 통과한 건만 큐에 올라옵니다. 형식 오류를 다시 짚을 필요가 없습니다." },
  { title: "반려 안내문 자동 작성", desc: "사유코드를 고르면 지침 조항을 인용한 안내문이 만들어집니다." },
  { title: "사업비 계획 일괄 검토", desc: "선정 팀의 집행 계획을 붙여 넣어 건별 판정과 조정 요청 코멘트를 받습니다." },
  { title: "준비 데이터 비공개", desc: "연습 진단·초안·팀 TODO는 기관 화면에 표시되지 않습니다." },
];

export function ManagerLanding() {
  const nav = getLandingNavigation("manager");
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <LandingNav role="manager" />

      <section className="mx-auto grid max-w-7xl items-start gap-10 px-5 py-14 md:py-20 lg:grid-cols-2">
        <div>
          <StatusBadge tone="blue">주관기관 매니저</StatusBadge>
          <h1 className="mt-5 text-[34px] font-bold leading-tight tracking-tight md:text-[44px]">
            검증 통과 건만 빠르게 검토하는 기관 대시보드
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-[#475569] md:text-lg">
            선정 팀의 검토 요청, 반려 사유, 지연 팀을 고밀도 테이블로 확인합니다. 창업자 준비 데이터와 진단 점수는 매니저 화면에 노출되지 않습니다.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/manager" size="lg">대시보드 열기</LinkButton>
            <LinkButton href={nav.counterpartHref} variant="secondary" size="lg" className="border-[#2563EB] text-[#2563EB]">창업자 화면 보기</LinkButton>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {MANAGER_FEATURES.map((item) => (
            <article key={item.title} className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
              <h2 className="text-base font-bold">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-[#475569]">{item.desc}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

const ENTRY_HIGHLIGHTS = [
  { Icon: ShieldCheck, label: "역할별 권한 분리" },
  { Icon: ClipboardCheck, label: "자동 마일스톤" },
  { Icon: CalendarDays, label: "마감 캘린더" },
  { Icon: Lock, label: "준비 데이터 비공개" },
];

export function WorkspaceEntry() {
  return (
    <main className="min-h-screen bg-white text-[#0F172A]">
      <header className="border-b border-[#E2E8F0]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="text-xl font-bold">StartUp Pilot</Link>
          <LinkButton href="/login" variant="secondary" size="sm">로그인</LinkButton>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-14 md:py-20">
        <h1 className="text-[28px] font-bold md:text-[36px]">어느 쪽으로 들어가시나요?</h1>
        <p className="mt-3 text-sm leading-7 text-[#475569] md:text-base">역할에 따라 보이는 데이터와 기능이 완전히 분리됩니다.</p>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Link href="/founder" className={cn("group rounded-2xl bg-[#EFF6FF] p-7 md:p-8", focusRing, "transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(37,99,235,0.16)]")}>
            <Users className="text-[#2563EB]" />
            <h2 className="mt-6 text-[28px] font-bold leading-tight md:text-[38px]">창업자 워크스페이스</h2>
            <p className="mt-4 text-base leading-8 text-[#475569] md:text-lg">지원사업 준비, AI 진단, 팀 TODO, 서류 보관함을 한곳에서 관리합니다.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-bold text-[#2563EB]">준비 시작 <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>

          <Link href="/manager" className={cn("group rounded-2xl border border-[#E2E8F0] bg-white p-7 md:p-8", focusRing, "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-1 hover:border-[#CBD5E1] hover:shadow-[0_16px_40px_rgba(15,23,42,0.1)]")}>
            <Building2 className="text-[#2563EB]" />
            <h2 className="mt-6 text-[28px] font-bold leading-tight md:text-[38px]">매니저 대시보드</h2>
            <p className="mt-4 text-base leading-8 text-[#475569] md:text-lg">검증 통과 후 검토 요청된 선정 팀만 고밀도 테이블로 관리합니다.</p>
            <span className="mt-6 inline-flex items-center gap-2 font-bold text-[#2563EB]">기관 화면 열기 <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" /></span>
          </Link>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {ENTRY_HIGHLIGHTS.map(({ Icon, label }) => (
            <div key={label} className="rounded-2xl border border-[#E2E8F0] p-5">
              <Icon className="text-[#2563EB]" />
              <strong className="mt-4 block text-sm">{label}</strong>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
