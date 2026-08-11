"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { trackWorkspaceEvent } from "@/lib/services/WorkspaceService";
import {
  CASE_DETAILS,
  formatCheckedAt,
  getCase,
  getCaseCategoryLabel,
  isCaseStale,
  type CaseAttempt,
  type CaseDetail,
  type SolutionCase,
} from "./cases";
import { CaseDisclaimer, CASE_STATUS_TONES } from "./CasePanel";
import { REPORT_SUBMITTED_MESSAGE, ReportCaseModal } from "./ReportCaseModal";
import { RequireFounderSession, WorkspaceShell } from "./shell";
import { Button, EmptyState, LinkButton, StatusBadge, focusRing, interactive, liftCard, useToast } from "./ui";
import { cn } from "@/lib/utils";

// Tailwind는 소스에 그대로 적힌 클래스만 생성합니다. 색을 조합해 만들면 스타일이 통째로 빠집니다.
const ATTEMPT_STYLES: Record<CaseAttempt["outcome"], { label: string; dot: string; ring: string; tag: string }> = {
  fail: { label: "실패", dot: "bg-[#DC2626]", ring: "ring-[#FEF2F2]", tag: "bg-[#FEF2F2] text-[#DC2626]" },
  pending: { label: "준비", dot: "bg-[#94A3B8]", ring: "ring-[#F8FAFC]", tag: "bg-[#F8FAFC] text-[#475569]" },
  done: { label: "완료", dot: "bg-[#16A34A]", ring: "ring-[#F0FDF4]", tag: "bg-[#F0FDF4] text-[#16A34A]" },
};

/** 보관함 하위 화면. 라우트가 /vault/cases/... 아래라 사이드바는 [서류 보관함]에 머뭅니다. */
export function CaseDetailPage({ caseId, founder = false }: { caseId: string; founder?: boolean }) {
  const role = founder ? "founder" : "pre_founder";
  const listHref = founder ? "/workspace/vault/cases" : "/founder/vault/cases";

  return (
    <RequireFounderSession role={role}>
      <WorkspaceShell role={role}>
        <div className="mx-auto max-w-3xl space-y-6">
          <Link
            href={listHref}
            className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-[#475569]", interactive, focusRing, "hover:text-[#2563EB]")}
          >
            <ArrowLeft size={15} />문제 해결 사례
          </Link>
          <CaseDetailBody caseId={caseId} listHref={listHref} />
        </div>
      </WorkspaceShell>
    </RequireFounderSession>
  );
}

function CaseDetailBody({ caseId, listHref }: { caseId: string; listHref: string }) {
  const summary = getCase(caseId);
  const detail = CASE_DETAILS[caseId];
  const toast = useToast();
  const [reporting, setReporting] = useState(false);

  if (!summary) {
    return (
      <EmptyState
        title="사례를 찾을 수 없습니다"
        description="주소가 바뀌었거나 내려간 사례일 수 있습니다."
        action={<LinkButton href={listHref} variant="secondary">목록으로</LinkButton>}
      />
    );
  }

  if (!detail) {
    return (
      <div className="space-y-6">
        <CaseDisclaimer />
        <CaseMetaHeader item={summary} detail={null} />
        <EmptyState
          title="본문을 정리하는 중입니다"
          description="검수를 마친 원문만 공개합니다. 정리되면 이 자리에 증상·원인·해결 경로가 올라옵니다."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CaseDisclaimer />
      <CaseMetaHeader item={summary} detail={detail} />

      <CaseSection index={1} title="증상">
        <p className="text-base leading-7 text-[#0F172A]">{detail.symptom}</p>
      </CaseSection>

      <CaseSection index={2} title="원인">
        <div className="space-y-3">
          <div className="flex gap-3">
            <StatusBadge tone="green">확인됨</StatusBadge>
            <p className="min-w-0 flex-1 text-base leading-7 text-[#0F172A]">{detail.causeConfirmed}</p>
          </div>
          <div className="h-px bg-[#E2E8F0]" />
          <div className="flex gap-3">
            <StatusBadge tone="slate">추정</StatusBadge>
            <p className="min-w-0 flex-1 text-base italic leading-7 text-[#475569]">{detail.causeGuess}</p>
          </div>
        </div>
      </CaseSection>

      <CaseSection index={3} title="시도한 것들">
        <ol className="space-y-0">
          {detail.attempts.map((attempt, index) => (
            <AttemptRow key={attempt.text} attempt={attempt} step={index + 1} last={index === detail.attempts.length - 1} />
          ))}
        </ol>
      </CaseSection>

      <section className="rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-lg bg-white text-xs font-bold text-[#2563EB]">4</span>
          <h2 className="text-xl font-semibold text-[#1D4ED8]">해결 경로</h2>
        </div>
        <p className="mt-3.5 text-lg font-semibold leading-7 text-[#0F172A]">{detail.solution}</p>
        {detail.caution && (
          <p className="mt-3.5 flex gap-2.5 rounded-[10px] border border-[#FCD34D] bg-[#FFFBEB] px-4 py-3.5 text-sm leading-6 text-[#92400E]">
            <TriangleAlert size={16} className="mt-0.5 shrink-0 text-[#B45309]" />
            {detail.caution}
          </p>
        )}
      </section>

      <section className="flex flex-wrap items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-6 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-[22px] w-[22px] place-items-center rounded-lg bg-[#F8FAFC] text-xs font-bold text-[#94A3B8]">5</span>
          <h2 className="text-xl font-semibold text-[#0F172A]">소요 시간</h2>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EFF6FF] px-4 py-2 text-sm font-semibold text-[#2563EB]">
          <Clock size={14} />{detail.duration}
        </span>
      </section>

      <CaseFeedback caseId={caseId} onReport={() => setReporting(true)} />

      {detail.relatedIds.length > 0 && (
        <section className="space-y-3.5">
          <h2 className="text-xl font-semibold text-[#0F172A]">연관 사례</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {detail.relatedIds.map((id) => <RelatedCaseCard key={id} caseId={id} listHref={listHref} />)}
          </div>
        </section>
      )}

      {reporting && (
        <ReportCaseModal
          onClose={() => setReporting(false)}
          onSubmitted={() => { setReporting(false); toast.show(REPORT_SUBMITTED_MESSAGE); }}
        />
      )}
      {toast.node}
    </div>
  );
}

function CaseMetaHeader({ item, detail }: { item: SolutionCase; detail: CaseDetail | null }) {
  const stale = isCaseStale(item);
  return (
    <header className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-[#2563EB]">{item.id}</span>
        <StatusBadge tone={CASE_STATUS_TONES[item.status]}>{item.status}</StatusBadge>
        {stale && <StatusBadge tone="amber">재확인 필요 · 확인 1년 경과</StatusBadge>}
      </div>
      <h1 className="text-[26px] font-bold leading-tight tracking-tight text-[#0F172A] md:text-[32px]">{item.title}</h1>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-[#94A3B8]">
        <span className="tabular-nums">최종 확인 {formatCheckedAt(item.lastCheckedAt)}</span>
        <span aria-hidden className="h-2.5 w-px bg-[#E2E8F0]" />
        <span>카테고리 · {getCaseCategoryLabel(item.category)}</span>
        {detail && (
          <>
            <span aria-hidden className="h-2.5 w-px bg-[#E2E8F0]" />
            <span>관련 사업 · {detail.program}</span>
            <span aria-hidden className="h-2.5 w-px bg-[#E2E8F0]" />
            <span>출처 · {detail.source}</span>
          </>
        )}
      </div>
    </header>
  );
}

function CaseSection({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[#E2E8F0] bg-white p-6">
      <div className="mb-3.5 flex items-center gap-2.5">
        <span className="grid h-[22px] w-[22px] place-items-center rounded-lg bg-[#F8FAFC] text-xs font-bold text-[#94A3B8]">{index}</span>
        <h2 className="text-xl font-semibold text-[#0F172A]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/** 세로 타임라인 한 줄. 도트 색이 그 단계의 결과이고, 연결선은 마지막 줄에서 끊깁니다. */
function AttemptRow({ attempt, step, last }: { attempt: CaseAttempt; step: number; last: boolean }) {
  const style = ATTEMPT_STYLES[attempt.outcome];
  return (
    <li className="flex gap-4">
      <div className="flex w-5 shrink-0 flex-col items-center">
        <span className={cn("mt-1.5 h-3 w-3 rounded-full ring-[3px]", style.dot, style.ring)} />
        {!last && <span className="w-0.5 flex-1 bg-[#E2E8F0]" />}
      </div>
      <div className={cn("flex-1", !last && "pb-5")}>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-bold tabular-nums text-[#94A3B8]">{step}</span>
          <span className={cn("rounded-lg px-2 py-0.5 text-xs font-bold", style.tag)}>{style.label}</span>
        </div>
        <p className="text-base leading-7 text-[#0F172A]">{attempt.text}</p>
      </div>
    </li>
  );
}

function CaseFeedback({ caseId, onReport }: { caseId: string; onReport: () => void }) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  const cast = (next: "up" | "down") => {
    const value = vote === next ? null : next;
    setVote(value);
    // 투표 기록 실패가 화면을 막지 않아야 합니다.
    if (value) void trackWorkspaceEvent("case_vote", undefined, { caseId, vote: value }).catch(() => undefined);
  };

  return (
    <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-6 py-5">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-base font-semibold text-[#0F172A]">이 사례가 도움이 됐나요?</span>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            aria-pressed={vote === "up"}
            icon={<ThumbsUp size={15} />}
            onClick={() => cast("up")}
            className={cn(vote === "up" && "border-[#16A34A] bg-[#F0FDF4] text-[#16A34A]")}
          >
            도움 됐어요
          </Button>
          <Button
            variant="secondary"
            aria-pressed={vote === "down"}
            icon={<ThumbsDown size={15} />}
            onClick={() => cast("down")}
            className={cn(vote === "down" && "border-[#94A3B8] bg-[#F8FAFC]")}
          >
            아니에요
          </Button>
        </div>
      </div>
      <Button variant="secondary" onClick={onReport} className="border-[#2563EB] text-[#2563EB]">
        비슷한 문제를 겪고 계신가요? 제보하기
      </Button>
    </section>
  );
}

function RelatedCaseCard({ caseId, listHref }: { caseId: string; listHref: string }) {
  const item = getCase(caseId);
  if (!item) return null;
  return (
    <Link
      href={`${listHref}/${item.id}`}
      className={cn("flex flex-col gap-2.5 rounded-2xl border border-[#E2E8F0] bg-white p-5", liftCard, focusRing)}
    >
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-[#2563EB]">{item.id}</span>
        <StatusBadge tone={CASE_STATUS_TONES[item.status]}>{item.status}</StatusBadge>
      </div>
      <p className="text-[15px] font-semibold leading-6 text-[#0F172A]">{item.title}</p>
      <p className="text-[13px] tabular-nums text-[#94A3B8]">최종 확인 {formatCheckedAt(item.lastCheckedAt)}</p>
    </Link>
  );
}
