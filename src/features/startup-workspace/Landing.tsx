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
import { FAQ_ITEMS } from "@/lib/seo";
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

      {/* scroll-mt: 상단 고정 헤더가 제목을 덮지 않도록 앵커 이동 지점을 헤더 높이만큼 내립니다. */}
      <section id="features" className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#F8FAFC]">
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

      <FaqSection />
    </main>
  );
}

/**
 * 자주 묻는 질문.
 *
 * JSON-LD FAQPage와 같은 상수(FAQ_ITEMS)를 씁니다. 구조화 데이터에만 있고 화면에 없는
 * FAQ는 검색엔진 정책 위반이며, 생성형 검색이 인용할 근거도 되지 못합니다.
 * details/summary를 쓰면 접힌 내용도 크롤러와 스크린리더가 그대로 읽습니다.
 */
function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-t border-[#E2E8F0]">
      <div className="mx-auto max-w-3xl px-5 py-14 md:py-20">
        <h2 className="text-[26px] font-bold md:text-[32px]">자주 묻는 질문</h2>
        <div className="mt-8 divide-y divide-[#E2E8F0] border-y border-[#E2E8F0]">
          {FAQ_ITEMS.map((item) => (
            <details key={item.question} className="group py-4">
              <summary
                className={cn(
                  "flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold text-[#0F172A]",
                  focusRing,
                )}
              >
                {item.question}
                <ChevronRight size={18} className="shrink-0 text-[#94A3B8] transition-transform group-open:rotate-90" />
              </summary>
              <p className="mt-3 text-sm leading-7 text-[#475569]">{item.answer}</p>
            </details>
          ))}
        </div>
        <p className="mt-8 text-xs leading-6 text-[#94A3B8]">
          자격 진단·사업비 판정·계산기 결과는 참고용입니다. 최종 기준은 각 사업 공고문과 관리지침이며,
          승인·반려의 최종 결정 권한은 주관기관 담당자에게 있습니다.
        </p>
      </div>
    </section>
  );
}

/** 랜딩의 예시 화면입니다. 실제 큐와 같은 열 구성을 보여 주되 조작은 두지 않습니다. */
const MANAGER_QUEUE_PREVIEW = [
  { team: "성장하는 팀", title: "시제품 외관 목업 제작", amount: "24,200,000원", files: 3, waiting: 1 },
  { team: "오르카랩스", title: "국내 전시회 부스 임차", amount: "5,500,000원", files: 1, waiting: 6 },
  { team: "오르카랩스", title: "특허 출원 대리인 수수료", amount: "1,650,000원", files: 2, waiting: 2 },
];

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
            <LinkButton href="/manager/login" size="lg">주관기관 로그인</LinkButton>
            <LinkButton href={nav.counterpartHref} variant="secondary" size="lg" className="border-[#2563EB] text-[#2563EB]">창업자 화면 보기</LinkButton>
          </div>
        </div>

        <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-bold md:text-xl">검토 큐 · 처리 대기 4건</h2>
            <StatusBadge tone="slate">예시 화면</StatusBadge>
          </div>
          <div className="mt-4 space-y-2">
            {MANAGER_QUEUE_PREVIEW.map((item) => (
              <article key={item.title} className="flex items-center gap-3 rounded-xl bg-white p-3">
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-sm font-bold text-[#0F172A]">{item.team} · {item.title}</strong>
                  <span className="text-xs text-[#94A3B8]">{item.amount} · 증빙 파일 {item.files}건</span>
                </div>
                <StatusBadge tone={item.waiting >= 3 ? "red" : "slate"}>대기 {item.waiting}일</StatusBadge>
              </article>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium text-[#94A3B8]">
            사전검증을 통과해 검토 요청된 건만 큐에 올라옵니다.
          </p>
        </div>
      </section>

      {/* 공용 헤더의 [기능] 링크가 가리키는 지점. 이 절이 없으면 링크가 아무 반응도 하지 않습니다. */}
      <section id="features" className="scroll-mt-20 border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-7xl px-5 py-14 md:py-20">
          <h2 className="text-[26px] font-bold md:text-[32px]">검토에 필요한 것만 남긴 기관 화면</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#475569] md:text-base">
            창업자의 준비 데이터는 기관 화면에 표시되지 않습니다. 검토 요청된 정산 건과 팀이 첨부한 증빙만 열람합니다.
          </p>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {MANAGER_FEATURES.map((item) => (
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
