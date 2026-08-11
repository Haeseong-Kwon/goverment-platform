"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertCircle, ChevronRight, CircleHelp, CreditCard, FileText, Info, Landmark, Monitor, Plus, Search } from "lucide-react";
import {
  CASE_CATEGORIES,
  SOLUTION_CASES,
  filterCases,
  formatCheckedAt,
  getCaseCategoryLabel,
  isCaseStale,
  type CaseCategoryId,
  type CaseStatus,
  type SolutionCase,
} from "./cases";
import { REPORT_SUBMITTED_MESSAGE, ReportCaseModal } from "./ReportCaseModal";
import { Button, ChoiceChip, StatusBadge, focusRing, inputClass, liftCard, useToast, type StatusTone } from "./ui";
import { cn } from "@/lib/utils";

const CATEGORY_ICONS: Record<CaseCategoryId, typeof Landmark> = {
  account: Landmark,
  kstartup: Monitor,
  document: FileText,
  spending: CreditCard,
  etc: CircleHelp,
};

export const CASE_STATUS_TONES: Record<CaseStatus, StatusTone> = {
  해결: "green",
  부분해결: "amber",
  미해결: "red",
};

/** 카테고리 칩은 목록 상단에서만 씁니다. 활성은 blue-600 solid, 기본은 흰 배경 + slate-200 보더. */
const chipClass = "rounded-full px-4 py-2";
const chipSelected = "border-[#2563EB] bg-[#2563EB] text-white hover:bg-[#1D4ED8]";

/**
 * 문제 해결 사례 목록.
 *
 * 검수를 거친 실무 사례만 원문 카드로 보여줍니다.
 * 검색 결과가 없을 때 AI가 답을 지어내지 않는다는 점을 명시합니다.
 */
export function CaseListPanel({ listHref }: { listHref: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<CaseCategoryId | "all">("all");
  const [reporting, setReporting] = useState(false);
  const toast = useToast();

  const visible = useMemo(() => filterCases(SOLUTION_CASES, { category, query }), [category, query]);
  const onReport = () => setReporting(true);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="max-w-xl text-sm leading-6 text-[#475569]">
          다른 팀이 실제로 겪은 행정 문제와 해결 경로입니다. 같은 증상을 검색해 보세요.
        </p>
        <Button variant="secondary" icon={<Plus size={15} />} onClick={onReport} className="border-[#2563EB] text-[#2563EB]">
          내 사례 제보하기
        </Button>
      </div>

      <div className="space-y-3.5">
        <div className="relative flex items-center">
          <Search size={18} className="pointer-events-none absolute left-4 text-[#94A3B8]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="증상으로 검색해보세요 — 예: 계좌 개설 실사"
            aria-label="사례 검색"
            className={cn(inputClass, "mt-0 h-[52px] rounded-xl pl-12 text-base")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip
            selected={category === "all"}
            onClick={() => setCategory("all")}
            className={cn(chipClass, category === "all" && chipSelected)}
          >
            전체
          </ChoiceChip>
          {CASE_CATEGORIES.map((item) => (
            <ChoiceChip
              key={item.id}
              selected={category === item.id}
              onClick={() => setCategory(item.id)}
              className={cn(chipClass, category === item.id && chipSelected)}
            >
              {item.label}
            </ChoiceChip>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <CaseEmptyState onReport={onReport} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-sm text-[#475569]">
              사례 <strong className="font-bold tabular-nums text-[#0F172A]">{visible.length}</strong>건 · 최종 확인일 최신순
            </p>
            <p className="text-[13px] text-[#94A3B8]">모두 실무 경험 기반 원문 사례입니다</p>
          </div>
          <div className="animate-in-stagger space-y-3">
            {visible.map((item) => <CaseCard key={item.id} item={item} href={`${listHref}/${item.id}`} />)}
          </div>
        </div>
      )}

      <CaseDisclaimer />

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

function CaseCard({ item, href }: { item: SolutionCase; href: string }) {
  const Icon = CATEGORY_ICONS[item.category];
  const stale = isCaseStale(item);

  return (
    <Link href={href} className={cn("flex gap-4 rounded-2xl border border-[#E2E8F0] bg-white p-5", liftCard, focusRing)}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]">
        <Icon size={19} />
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 font-mono text-xs font-bold tracking-wide text-[#2563EB]">
            {item.id}
          </span>
          <StatusBadge tone={CASE_STATUS_TONES[item.status]}>{item.status}</StatusBadge>
          {stale && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#FCD34D] bg-white px-2.5 py-1 text-xs font-semibold text-[#B45309]">
              <AlertCircle size={12} />재확인 필요 · 확인 1년 경과
            </span>
          )}
        </div>
        <h3 className="line-clamp-2 text-base font-semibold leading-6 text-[#0F172A]">{item.title}</h3>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[13px] text-[#94A3B8]">
          <span>{getCaseCategoryLabel(item.category)}</span>
          <span aria-hidden className="h-2.5 w-px bg-[#E2E8F0]" />
          <span className="tabular-nums">최종 확인 {formatCheckedAt(item.lastCheckedAt)}</span>
          <span aria-hidden className="h-2.5 w-px bg-[#E2E8F0]" />
          <span className="tabular-nums">조회 {item.views.toLocaleString("ko-KR")}</span>
        </div>
      </div>
      <ChevronRight size={18} className="self-center text-[#CBD5E1]" />
    </Link>
  );
}

/** 검색 결과가 없을 때. AI가 답을 만들어 주지 않는다는 점을 여기서 분명히 밝힙니다. */
function CaseEmptyState({ onReport }: { onReport?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-white px-8 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#F8FAFC] text-[#94A3B8]">
        <Search size={26} />
      </span>
      <h3 className="text-xl font-semibold text-[#0F172A]">등록된 사례가 없어요</h3>
      <p className="max-w-md text-base leading-6 text-[#475569]">
        겪으신 문제를 제보해주시면 정리해서 올릴게요. 검수한 실무 사례만 사례 카드로 등록합니다.
      </p>
      <p className="flex max-w-lg items-start gap-2 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2.5 text-left text-[13px] leading-5 text-[#475569]">
        <Info size={15} className="mt-0.5 shrink-0 text-[#94A3B8]" />
        이 화면은 AI가 답을 만들어 보여주지 않습니다. 검수를 거친 사람의 경험 기록만 올라갑니다.
      </p>
      <Button size="lg" onClick={onReport} className={cn("mt-1", focusRing)}>제보하기</Button>
    </div>
  );
}

/** 목록·상세 양쪽 하단에 같은 문구로 붙습니다. */
export function CaseDisclaimer() {
  return (
    <div className="flex gap-3 rounded-xl bg-[#EFF6FF] px-4 py-4">
      <Info size={17} className="mt-0.5 shrink-0 text-[#2563EB]" />
      <p className="text-[13px] leading-6 text-[#475569]">
        공식 안내가 아닌 실무 경험 공유이며, 은행·기관별로 절차가 다를 수 있습니다.
        최신 절차는 해당 은행·주관기관·K-Startup 안내를 따르세요.
      </p>
    </div>
  );
}
