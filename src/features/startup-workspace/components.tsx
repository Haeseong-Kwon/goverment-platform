"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Lock,
  Mail,
  MessageCircle,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";
import { canManagerSeeReviewItem, getDdayTone, getLandingNavigation, getMonthlyDiagnosticUsage, getSidebarLinks, getStartupMilestones } from "./logic";
import type { DdayTone, StartupRole } from "./types";
import { cn } from "@/lib/utils";

const statusClasses = {
  green: "bg-[#F0FDF4] text-[#16A34A] border-[#BBF7D0]",
  amber: "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]",
  red: "bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]",
  slate: "bg-[#F8FAFC] text-[#475569] border-[#E2E8F0]",
  blue: "bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]",
};

function StatusBadge({ tone = "slate", children }: { tone?: keyof typeof statusClasses; children: React.ReactNode }) {
  return <span className={cn("inline-flex shrink-0 whitespace-nowrap rounded-lg border px-2.5 py-1 text-[13px] font-semibold", statusClasses[tone])}>{children}</span>;
}

function DdayPill({ dday }: { dday: number }) {
  const tone = getDdayTone(dday) as DdayTone;
  return <StatusBadge tone={tone}>D-{dday}</StatusBadge>;
}

function ScoreRing({ score, tone, label }: { score: number; tone: "green" | "amber" | "red"; label: string }) {
  return (
    <div className="flex items-center gap-5">
      <div className="grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(#2563EB ${score * 3.6}deg, #E2E8F0 0deg)` }}>
        <div className="grid h-20 w-20 place-items-center rounded-full bg-white">
          <strong className="text-2xl font-bold tabular-nums text-[#0F172A]">{score}</strong>
        </div>
      </div>
      <div>
        <div className="flex flex-wrap gap-2"><StatusBadge tone={tone}>{label}</StatusBadge><StatusBadge tone="blue">AI 추정</StatusBadge></div>
        <p className="mt-3 text-sm leading-6 text-[#475569]">입력하신 정보와 보관함 자료를 기준으로 추정했습니다.</p>
      </div>
    </div>
  );
}

function ContributionBars({ items }: { items: Array<{ label: string; value: number; max?: number; unknown?: boolean }> }) {
  return <div className="space-y-3">{items.map((item) => <div key={item.label}><div className="mb-1 flex items-center justify-between text-sm"><span className="font-semibold text-[#0F172A]">{item.label}</span><span className="tabular-nums text-[#475569]">{item.unknown ? "확인 필요" : `${item.value}/${item.max ?? 25}`}</span></div><div className={cn("h-2.5 rounded-full bg-[#EFF6FF]", item.unknown && "border border-dashed border-[#94A3B8] bg-white")}><div className="h-full rounded-full bg-[#2563EB]" style={{ width: item.unknown ? "36%" : `${Math.min(100, (item.value / (item.max ?? 25)) * 100)}%` }} /></div></div>)}</div>;
}

function ReasonList({ items }: { items: Array<{ tone: "green" | "amber" | "red"; text: string }> }) {
  return <ul className="space-y-2">{items.map((item) => <li key={item.text} className="flex gap-2 text-sm text-[#475569]"><span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold", item.tone === "green" ? "bg-[#F0FDF4] text-[#16A34A]" : item.tone === "amber" ? "bg-[#FFFBEB] text-[#B45309]" : "bg-[#FEF2F2] text-[#DC2626]")}>{item.tone === "green" ? "✓" : "!"}</span>{item.text}</li>)}</ul>;
}

function NextActions({ items }: { items: string[] }) {
  return <div className="space-y-2">{items.map((item) => <div key={item} className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] p-3"><span className="text-sm font-medium text-[#0F172A]">{item}</span><button className="shrink-0 rounded-[10px] border border-[#2563EB] bg-white px-3 py-1.5 text-xs font-bold text-[#2563EB]">TODO에 추가</button></div>)}</div>;
}

function A1Report({ kind }: { kind: "eligibility" | "bizplan" }) {
  const isBiz = kind === "bizplan";
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.06)]">
      <ScoreRing score={isBiz ? 62 : 88} tone={isBiz ? "amber" : "green"} label={isBiz ? "보완 권장" : "신청 가능"} />
      <div className="mt-6"><h3 className="mb-3 text-xl font-semibold text-[#0F172A]">{isBiz ? "PSST 항목 분해" : "자격 판단 기여도"}</h3><ContributionBars items={isBiz ? [{ label: "Problem", value: 18 }, { label: "Solution", value: 12 }, { label: "Scale-up", value: 20 }, { label: "Team", value: 12 }] : [{ label: "업력", value: 25 }, { label: "기수혜 이력", value: 22 }, { label: "대표자 요건", value: 21 }, { label: "사업 분야", value: 20 }]} /></div>
      <div className="mt-6"><h3 className="mb-3 text-xl font-semibold text-[#0F172A]">왜 이렇게 판단했나요</h3><ReasonList items={isBiz ? [{ tone: "green", text: "문제 정의와 고객군은 명확합니다." }, { tone: "amber", text: "시장 진입 전략의 근거 수치가 부족합니다." }] : [{ tone: "green", text: "대표자 업력과 사업자등록 상태가 신청 조건에 맞습니다." }, { tone: "amber", text: "기수혜 이력은 추가 확인이 필요합니다." }]} /></div>
      <div className="mt-6 rounded-xl bg-[#F8FAFC] p-4"><h3 className="text-sm font-bold text-[#0F172A]">아직 확인하지 못한 데이터</h3><p className="mt-2 text-sm text-[#475569]">○ 사업자등록 사실증명 최신본, ○ 팀원 4대보험 가입 여부</p></div>
      <div className="mt-6"><h3 className="mb-3 text-xl font-semibold text-[#0F172A]">다음 액션</h3><NextActions items={isBiz ? ["시장 규모 근거 표를 1장 추가", "수익 모델의 월별 가정을 보강"] : ["사실증명 최신본 업로드", "지원사업 공고문 자격 조항 확인"]} /></div>
      {isBiz && <SwotQuadrant />}
      {!isBiz && <RecommendationCards />}
      <p className="mt-5 text-[13px] font-medium text-[#94A3B8]">본 진단은 참고용 AI 추정이며 최종 선정 또는 적격 여부를 보장하지 않습니다.</p>
    </section>
  );
}

function RecommendationCards() {
  return <div className="mt-6 grid gap-3 md:grid-cols-3">{["예비창업패키지", "모두의창업", "초기창업패키지"].map((name, index) => <article key={name} className="rounded-2xl border border-[#E2E8F0] p-4"><StatusBadge tone={index === 2 ? "amber" : "green"}>{index === 2 ? "확인 필요" : "적합"}</StatusBadge><h4 className="mt-3 font-bold text-[#0F172A]">{name}</h4><p className="mt-1 text-sm text-[#475569]">2026년 2분기 공고 예상</p><button className="mt-3 text-sm font-bold text-[#2563EB]">캘린더에 추가</button></article>)}</div>;
}

function SwotQuadrant() {
  const items = [["S", "기술 검증 근거가 선명합니다.", "green"], ["W", "유통 채널 가설이 약합니다.", "amber"], ["O", "공공 조달 연계성이 있습니다.", "blue"], ["T", "대기업 진입 가능성이 있습니다.", "red"]] as const;
  return <div className="mt-6 grid gap-3 md:grid-cols-2">{items.map(([k, text, tone]) => <div key={k} className="rounded-xl border border-[#E2E8F0] p-4"><StatusBadge tone={tone}>{k}</StatusBadge><p className="mt-2 text-sm text-[#475569]">{text}</p></div>)}</div>;
}

function Sidebar({ role }: { role: StartupRole }) {
  return <aside className="hidden w-[240px] shrink-0 border-r border-[#E2E8F0] bg-white p-5 lg:block"><Link href="/" className="text-xl font-bold text-[#0F172A]">StartupOS</Link>{role === "founder" && <p className="mt-1 text-xs font-semibold text-[#2563EB]">인하대학교 창업지원단 연결됨</p>}<nav className="mt-8 space-y-1">{getSidebarLinks(role).map((item, index) => <Link key={item.label} href={item.href} className={cn("flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-semibold", index === 0 ? "bg-[#EFF6FF] text-[#2563EB]" : "text-[#475569] hover:bg-[#F8FAFC]")}><LayoutDashboard size={17} />{item.label}</Link>)}</nav>{role === "pre_founder" && <Link href="/founder/convert" className="mt-8 block rounded-2xl bg-[#EFF6FF] p-4 text-sm font-bold text-[#2563EB]">합격하셨나요?</Link>}</aside>;
}

function WorkspaceShell({ role, children }: { role: StartupRole; children: React.ReactNode }) {
  return <div className="min-h-screen bg-[#F8FAFC] text-[#0F172A]"><div className="flex"><Sidebar role={role} /><main className="min-w-0 flex-1 px-4 py-6 md:px-8 lg:px-10">{children}</main></div></div>;
}

function HeroHeader({ role }: { role: StartupRole }) {
  return <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"><div><StatusBadge tone={role === "manager" ? "blue" : "green"}>{role === "manager" ? "주관기관 매니저" : role === "founder" ? "선정 팀" : "창업자 준비 워크스페이스"}</StatusBadge><h1 className="mt-3 text-[32px] font-bold tracking-normal text-[#0F172A]">{role === "manager" ? "통합 관리 대시보드" : role === "founder" ? "협약 수행 홈" : "예창패 서류 마감 D-12"}</h1><p className="mt-2 text-base text-[#475569]">{role === "manager" ? "검증 통과 후 검토 요청된 건만 표시됩니다." : "지원사업 준비 흐름을 팀 TODO와 진단 리포트로 관리합니다."}</p></div><button className="rounded-[10px] bg-[#2563EB] px-4 py-3 text-sm font-bold text-white hover:bg-[#1D4ED8]">{role === "manager" ? "리포트 내보내기" : "AI 진단 시작"}</button></div>;
}

function TodoCard({ title, dday, owner, comments }: { title: string; dday: number; owner: string; comments: number }) {
  return <article className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-4", dday <= 1 && "border-l-4 border-l-[#DC2626]")}><div className="flex items-start justify-between gap-3"><label className="flex gap-3"><input type="checkbox" className="mt-1 h-4 w-4" /><span className="font-semibold text-[#0F172A]">{title}</span></label><DdayPill dday={dday} /></div><div className="mt-4 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-full bg-[#EFF6FF] text-xs font-bold text-[#2563EB]">{owner.slice(0, 1)}</span><span className="text-sm text-[#475569]">{owner}</span><StatusBadge tone="blue">자동 생성</StatusBadge><span className="ml-auto flex items-center gap-1 text-sm text-[#94A3B8]"><MessageCircle size={14} />{comments}</span></div><button className="mt-3 text-xs font-bold text-[#475569]">숨기기</button></article>;
}

function FounderCore({ founder = false }: { founder?: boolean }) {
  const todos = getStartupMilestones("예창패");
  const usage = getMonthlyDiagnosticUsage(["2026-07-01T09:00:00.000Z"], new Date("2026-07-06T00:00:00.000Z"));
  return <WorkspaceShell role={founder ? "founder" : "pre_founder"}><div id="home" className="scroll-mt-6"><HeroHeader role={founder ? "founder" : "pre_founder"} /></div><section className="grid gap-4 md:grid-cols-4"><div className="rounded-2xl bg-[#2563EB] p-5 text-white md:col-span-2"><p className="text-sm font-semibold opacity-90">D-day 히어로</p><h2 className="mt-2 text-2xl font-bold">예창패 서류 마감 D-12</h2><p className="mt-2 text-sm opacity-90">자동 TODO 4개가 생성되었습니다.</p></div>{[["남은 TODO", "7"], ["진단 요약", "88점"], ["팀 진행률", "64%"], ["빠른 계산기", "641,400원"]].map(([label, value]) => <div key={label} className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><p className="text-sm text-[#475569]">{label}</p><strong className="mt-2 block text-2xl tabular-nums">{value}</strong></div>)}</section><section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_.9fr]"><div className="space-y-6"><div id={founder ? "precheck" : "todo"} className="scroll-mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-5"><div className="mb-4 flex items-center justify-between"><h2 className="text-2xl font-bold">{founder ? "정산 사전검증" : "팀 TODO"}</h2><StatusBadge tone="blue">예창패</StatusBadge></div><div className="grid gap-3 md:grid-cols-2">{todos.map((todo) => <TodoCard key={todo.id} {...todo} />)}</div></div><div id={founder ? "tracker" : "calendar"} className="scroll-mt-6"><CalendarPreview /></div></div><div className="space-y-6"><div id="diagnostics" className="scroll-mt-6"><A1Report kind="eligibility" /></div><div id="calculator" className="scroll-mt-6"><CalculatorCard /></div><div id="vault" className="scroll-mt-6"><VaultCard /></div><BizPlanCard exhausted={usage.isExhausted} /><div id="incorporation" className="scroll-mt-6"><IncorporationCard /></div><div id="connect" className="scroll-mt-6"><ConnectCard /></div><div id="settings" className="rounded-2xl border border-[#E2E8F0] bg-white p-5 scroll-mt-6"><h2 className="text-xl font-bold">팀 설정</h2><p className="mt-2 text-sm text-[#475569]">팀원 초대 링크와 역할 권한을 관리합니다.</p></div></div></section></WorkspaceShell>;
}

function CalendarPreview() {
  return <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-2xl font-bold">마감 캘린더</h2><div className="mt-4 grid grid-cols-7 gap-2 text-center text-sm">{Array.from({ length: 35 }, (_, i) => <div key={i} className="rounded-xl bg-[#F8FAFC] p-2 tabular-nums">{i + 1}{[12, 15, 22].includes(i + 1) && <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-[#DC2626]" />}</div>)}</div></div>;
}

function CalculatorCard() {
  const [emailOpen, setEmailOpen] = useState(false);
  return <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">4대보험 계산기</h2><p className="mt-2 text-sm text-[#475569]">사업주 월 부담 총액</p><strong className="mt-2 block text-3xl tabular-nums">641,400원</strong><ContributionBars items={[{ label: "국민연금", value: 220, max: 641 }, { label: "건강보험", value: 188, max: 641 }, { label: "고용보험", value: 109, max: 641 }, { label: "산재보험", value: 74, max: 641 }, { label: "장기요양", value: 50, max: 641 }]} /><p className="mt-4 text-[13px] font-medium text-[#DC2626]">⚠️ 세무 계산은 참고용이며 실제 신고 전 전문가 확인이 필요합니다.</p><button onClick={() => setEmailOpen(true)} className="mt-4 rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white">PDF로 저장</button>{emailOpen && <EmailCaptureModal onClose={() => setEmailOpen(false)} />}</div>;
}

function EmailCaptureModal({ onClose }: { onClose: () => void }) {
  return <div className="fixed inset-0 z-[80] grid place-items-center bg-black/30 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><Mail className="text-[#2563EB]" /><h2 className="mt-3 text-2xl font-bold">이메일로 자료 받기</h2><p className="mt-2 text-sm text-[#475569]">PDF 저장과 자료실 다운로드 이력을 리드 KPI로 기록합니다.</p><input className="mt-4 w-full rounded-[10px] border border-[#E2E8F0] px-3 py-3" placeholder="founder@example.com" /><div className="mt-4 flex justify-end gap-2"><button onClick={onClose} className="rounded-[10px] px-4 py-2 text-sm font-bold text-[#475569]">닫기</button><button onClick={onClose} className="rounded-[10px] bg-[#2563EB] px-4 py-2 text-sm font-bold text-white">받기</button></div></div></div>;
}

function VaultCard() {
  return <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">서류 보관함</h2><p className="mt-2 rounded-xl bg-[#EFF6FF] p-3 text-sm text-[#2563EB]">선정 후 파일과 팀원만 기관 Team으로 이관됩니다.</p>{["사업계획서", "증빙서류", "검토본 아카이브"].map((folder) => <div key={folder} className="mt-3 flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3"><Archive size={17} /><span className="font-semibold">{folder}</span><StatusBadge>v2</StatusBadge><span className="ml-auto text-sm text-[#94A3B8]">댓글 2</span></div>)}</div>;
}

function BizPlanCard({ exhausted }: { exhausted: boolean }) {
  return <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">사업계획서 진단</h2><StatusBadge tone={exhausted ? "amber" : "blue"}>{exhausted ? "무료 소진" : "잔여 1/2회"}</StatusBadge></div><div className={cn("mt-4 rounded-2xl border border-dashed border-[#94A3B8] p-5 text-center", exhausted && "opacity-60")}><Upload className="mx-auto text-[#94A3B8]" /><p className="mt-2 text-sm text-[#475569]">hwp/pdf 업로드 또는 지난 버전 불러오기</p></div>{exhausted ? <p className="mt-3 text-sm font-semibold text-[#B45309]">팀원 초대 시 1회 추가</p> : <A1Report kind="bizplan" />}</div>;
}

function IncorporationCard() {
  return <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">법인 설립</h2><p className="mt-3 rounded-xl bg-[#FEF2F2] p-3 text-sm font-semibold text-[#DC2626]">예창패 신청 시 사업자등록이 없어야 하는 조건을 먼저 확인하세요.</p>{["상호 확인", "정관 작성", "주금 납입", "등기 신청", "사업자등록"].map((step, i) => <div key={step} className="mt-3 flex items-center gap-3"><span className={cn("grid h-7 w-7 place-items-center rounded-full text-xs font-bold", i === 0 ? "bg-[#2563EB] text-white" : "bg-[#F8FAFC] text-[#94A3B8]")}>{i + 1}</span><span className="text-sm font-semibold">{step}</span></div>)}</div>;
}

function ConnectCard() {
  return <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">커넥트</h2><div className="mt-4 grid gap-3">{["팀빌딩", "멘토", "투자"].map((tab) => <div key={tab} className="relative overflow-hidden rounded-xl border border-[#E2E8F0] p-4"><div className="flex -space-x-2 blur-sm">{["A", "B", "C"].map((v) => <span key={v} className="grid h-8 w-8 place-items-center rounded-full bg-[#EFF6FF] text-sm font-bold text-[#2563EB]">{v}</span>)}</div><div className="absolute inset-0 grid place-items-center bg-white/70 text-sm font-bold text-[#0F172A]">{tab} 대기 명단 등록</div></div>)}</div><button className="mt-4 rounded-[10px] border border-[#2563EB] px-4 py-2 text-sm font-bold text-[#2563EB]">알림 신청</button></div>;
}

function ManagerDashboard() {
  const queue = useMemo(() => [
    { team: "인벤티", status: "requested", validation: "passed", role: "founder", wait: "52시간", amount: "400만원", evidence: 3 },
    { team: "그린루프", status: "requested", validation: "passed", role: "founder", wait: "8시간", amount: "180만원", evidence: 4 },
    { team: "프리팀 초안", status: "draft", validation: "passed", role: "pre_founder", wait: "0시간", amount: "비공개", evidence: 0 },
  ] as const, []);
  const visibleQueue = queue.filter(canManagerSeeReviewItem);
  return <WorkspaceShell role="manager"><div id="dashboard" className="scroll-mt-6"><HeroHeader role="manager" /></div><section className="grid gap-4 md:grid-cols-4">{[["검토 요청률", "85%"], ["반려율", "23%"], ["평균 검토", "2.4일"], ["지연", "3팀"]].map(([label, value], i) => <div key={label} className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-5", i === 3 && "border-l-4 border-l-[#DC2626]")}><p className="text-sm text-[#475569]">{label}</p><strong className="mt-2 block text-2xl tabular-nums">{value}</strong></div>)}</section><section id="review-queue" className="mt-6 grid scroll-mt-6 gap-6 xl:grid-cols-[1fr_420px]"><div className="rounded-2xl border border-[#E2E8F0] bg-white"><div className="grid grid-cols-[1.4fr_.8fr_.8fr_.8fr] border-b border-[#E2E8F0] px-5 py-3 text-xs font-bold text-[#475569]"><span>팀</span><span>상태</span><span>대기</span><span className="text-right">증빙</span></div>{visibleQueue.map((row, i) => <div key={row.team} className={cn("grid min-h-14 grid-cols-[1.4fr_.8fr_.8fr_.8fr] items-center border-b border-[#F1F5F9] px-5 py-3 text-sm", i === 0 && "border-l-4 border-l-[#DC2626]")}><strong>{row.team}</strong><span>검토 요청</span><span className={i === 0 ? "font-bold text-[#DC2626]" : ""}>{row.wait}</span><span className="text-right tabular-nums">{row.evidence}건</span></div>)}</div><ReviewPanel /></section><section id="teams" className="mt-6 scroll-mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">팀 관리</h2><p className="mt-2 text-sm text-[#475569]">선정 팀의 협약 상태와 담당자만 표시합니다. 준비 데이터는 표시하지 않습니다.</p></section><section id="reports" className="mt-6 scroll-mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">리포트</h2><p className="mt-2 text-sm text-[#475569]">반려 사유와 평균 검토 시간을 집계합니다.</p></section><section id="settings" className="mt-6 scroll-mt-6 rounded-2xl border border-[#E2E8F0] bg-white p-5"><h2 className="text-xl font-bold">설정</h2><p className="mt-2 text-sm text-[#475569]">기관 코드와 매니저 권한을 관리합니다.</p></section></WorkspaceShell>;
}

function ReviewPanel() {
  const [reason, setReason] = useState("");
  return <aside className="rounded-2xl border border-[#E2E8F0] bg-white p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-bold">인벤티 · #2026-0417</h2><StatusBadge tone="green">검증 통과 🟢</StatusBadge></div><div className="mt-4 rounded-xl bg-[#F8FAFC] p-5 text-center text-sm text-[#94A3B8]"><FileText className="mx-auto mb-2" />세금계산서_인벤티_3월.pdf</div><p className="mt-4 text-sm font-bold text-[#475569]">반려 사유코드 <span className="text-[#DC2626]">*</span></p><select value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 w-full rounded-[10px] border border-[#E2E8F0] px-3 py-3 text-sm"><option value="">선택하세요</option><option>E-101 비목 부적합</option><option>E-102 증빙 누락</option><option>E-103 한도 초과</option><option>E-104 서명·날인 누락</option></select><textarea className="mt-3 min-h-20 w-full rounded-[10px] border border-[#E2E8F0] p-3 text-sm" placeholder="코멘트 입력 (반려 시 필수)" /><div className="mt-4 flex gap-2"><button disabled={!reason} className="flex-1 rounded-[10px] border border-[#DC2626] px-4 py-3 text-sm font-bold text-[#DC2626] disabled:cursor-not-allowed disabled:opacity-40">반려</button><button className="flex-1 rounded-[10px] bg-[#2563EB] px-4 py-3 text-sm font-bold text-white">승인</button></div></aside>;
}

function LandingNav({ role }: { role: "founder" | "manager" }) {
  const nav = getLandingNavigation(role);
  return <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5"><Link href={nav.homeHref} className="text-xl font-bold text-[#0F172A]">StartupOS</Link><nav className="hidden gap-6 text-sm font-semibold text-[#475569] md:flex"><Link href="/">창업자</Link><Link href="/manager/landing">매니저</Link><a href="#library">자료실</a></nav><Link href={nav.workspaceEntryHref} className="rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white">워크스페이스 진입</Link></header>;
}

function FounderLanding() {
  const nav = getLandingNavigation("founder");
  return <main className="min-h-screen bg-white text-[#0F172A]"><LandingNav role="founder" /><section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-[1.05fr_.95fr]"><div><StatusBadge tone="blue">창업자 전용</StatusBadge><h1 className="mt-5 text-[44px] font-bold leading-tight tracking-normal">지원사업 준비를 팀 TODO와 AI 진단으로 정리하세요</h1><p className="mt-5 max-w-xl text-lg leading-8 text-[#475569]">예창패·초창패·모두의창업을 준비하는 팀이 마감, 자격, 사업계획서, 보관함을 한 흐름으로 관리하는 창업자 워크스페이스입니다.</p><div className="mt-8 flex flex-wrap gap-3"><Link href={nav.workspaceEntryHref} className="rounded-[10px] bg-[#2563EB] px-5 py-3 font-bold text-white">워크스페이스 진입</Link><Link href={nav.counterpartHref} className="rounded-[10px] border border-[#2563EB] px-5 py-3 font-bold text-[#2563EB]">매니저 랜딩 보기</Link></div></div><div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.06)]"><div className="rounded-2xl bg-white p-5"><h2 className="text-xl font-bold">예창패 서류 마감 D-12</h2><div className="mt-4 grid gap-3">{getStartupMilestones("예창패").map((todo) => <TodoCard key={todo.id} {...todo} />)}</div></div></div></section><section id="library" className="mx-auto grid max-w-7xl gap-4 px-5 pb-16 md:grid-cols-3">{[["AI 자격 진단", "신청 가능성과 확인 필요 데이터를 구분합니다."], ["사업계획서 진단", "PSST 구조와 SWOT 보완점을 제안합니다."], ["서류 보관함", "선정 후 이관 가능한 파일을 버전으로 관리합니다."]].map(([title, desc]) => <article key={title} className="rounded-2xl border border-[#E2E8F0] p-5"><h3 className="text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-6 text-[#475569]">{desc}</p></article>)}</section></main>;
}

function ManagerLanding() {
  const nav = getLandingNavigation("manager");
  return <main className="min-h-screen bg-white text-[#0F172A]"><LandingNav role="manager" /><section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-16 md:grid-cols-[1fr_1fr]"><div><StatusBadge tone="blue">주관기관 매니저</StatusBadge><h1 className="mt-5 text-[44px] font-bold leading-tight tracking-normal">검증 통과 건만 빠르게 검토하는 기관 대시보드</h1><p className="mt-5 max-w-xl text-lg leading-8 text-[#475569]">선정 팀의 검토 요청, 반려 사유, 지연 팀을 고밀도 테이블로 확인합니다. 창업자 준비 데이터와 진단 점수는 매니저 화면에 노출되지 않습니다.</p><div className="mt-8 flex flex-wrap gap-3"><Link href={nav.workspaceEntryHref} className="rounded-[10px] bg-[#2563EB] px-5 py-3 font-bold text-white">워크스페이스 진입</Link><Link href={nav.counterpartHref} className="rounded-[10px] border border-[#2563EB] px-5 py-3 font-bold text-[#2563EB]">창업자 랜딩 보기</Link></div></div><div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.06)]"><div className="grid gap-3">{[["검토 요청률", "85%"], ["반려율", "23%"], ["평균 검토", "2.4일"], ["지연", "3팀"]].map(([label, value]) => <div key={label} className="flex min-h-14 items-center justify-between rounded-xl border border-[#E2E8F0] px-4"><span className="text-sm font-semibold text-[#475569]">{label}</span><strong className="text-xl tabular-nums">{value}</strong></div>)}</div><div className="mt-5 rounded-xl bg-[#F8FAFC] p-4 text-sm font-semibold text-[#475569]">AI 검증 표시는 “검증 통과 🟢” 뱃지만 사용합니다.</div></div></section></main>;
}

function WorkspaceEntry() {
  return <main className="min-h-screen bg-white text-[#0F172A]"><header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5"><Link href="/" className="text-xl font-bold">StartupOS</Link><nav className="hidden gap-6 text-sm font-semibold text-[#475569] md:flex"><a>창업자</a><a>매니저</a><a>자료실</a></nav><Link href="/founder" className="rounded-[10px] bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white">창업자로 시작</Link></header><section className="mx-auto grid max-w-7xl gap-6 px-5 py-16 md:grid-cols-2"><Link href="/founder" className="rounded-2xl bg-[#EFF6FF] p-8 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.06)]"><Users className="text-[#2563EB]" /><h1 className="mt-6 text-[44px] font-bold leading-tight tracking-normal">창업자 워크스페이스</h1><p className="mt-4 text-lg leading-8 text-[#475569]">지원사업 준비, AI 진단, 팀 TODO, 서류 보관함을 한곳에서 관리합니다.</p><span className="mt-6 inline-flex items-center gap-2 font-bold text-[#2563EB]">준비 시작 <ChevronRight size={18} /></span></Link><Link href="/manager" className="rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-[0_1px_2px_rgba(15,23,42,.04),0_8px_24px_rgba(15,23,42,.06)]"><Building2 className="text-[#2563EB]" /><h2 className="mt-6 text-[44px] font-bold leading-tight tracking-normal">매니저 대시보드</h2><p className="mt-4 text-lg leading-8 text-[#475569]">검증 통과 후 검토 요청된 선정 팀만 고밀도 테이블로 관리합니다.</p><span className="mt-6 inline-flex items-center gap-2 font-bold text-[#2563EB]">기관 인증 <ChevronRight size={18} /></span></Link></section><section className="mx-auto max-w-7xl px-5 pb-16"><div className="grid gap-4 md:grid-cols-4">{[[ShieldCheck, "RBAC 분리"], [ClipboardCheck, "자동 마일스톤"], [CalendarDays, "마감 캘린더"], [Lock, "준비 데이터 비공개"]].map(([Icon, label]) => { const TypedIcon = Icon as typeof ShieldCheck; return <div key={String(label)} className="rounded-2xl border border-[#E2E8F0] p-5"><TypedIcon className="text-[#2563EB]" /><strong className="mt-4 block">{String(label)}</strong></div>; })}</div></section></main>;
}

function ConvertPage() {
  return <WorkspaceShell role="pre_founder"><div className="mx-auto max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-8"><StatusBadge tone="green">합격 전환</StatusBadge><h1 className="mt-4 text-[32px] font-bold">축하합니다. 기관 연결을 시작합니다.</h1><p className="mt-2 text-[#475569]">기관 코드를 확인하면 role이 pre_founder에서 founder로 단방향 전환됩니다.</p><input className="mt-6 w-full rounded-[10px] border border-[#E2E8F0] px-4 py-3" defaultValue="INHA-2026-YEP" /><div className="mt-5 rounded-xl bg-[#EFF6FF] p-4 text-sm text-[#2563EB]">이관 항목: 서류 보관함 파일, 팀원. TODO, 진단 점수, 초안은 준비 팀 내부에 남습니다.</div><Link href="/workspace?role=founder" className="mt-6 inline-flex rounded-[10px] bg-[#2563EB] px-5 py-3 font-bold text-white">연결 확인</Link></div></WorkspaceShell>;
}

export { FounderCore, FounderLanding, ManagerDashboard, ManagerLanding, ConvertPage, WorkspaceEntry };
