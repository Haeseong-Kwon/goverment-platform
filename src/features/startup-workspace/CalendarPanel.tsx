"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, MessageSquare, Plus, RefreshCw } from "lucide-react";
import {
  getCalendarItems,
  type CalendarItem,
  type CalendarKind,
} from "@/lib/services/FounderWorkspaceService";
import { getAnnouncementDeadlines, type AnnouncementDeadline } from "@/lib/services/AnnouncementService";
import { createWorkspaceTask } from "@/lib/services/WorkspaceService";
import { getDday, toKstDateKey } from "./logic";
import { TaskCommentThread } from "./TaskCommentThread";
import { Button, ChoiceChip, EmptyState, LinkButton, Notice, Panel, Skeleton, StatusBadge, inputClass, focusRing, type StatusTone } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

const MS_DAY = 86_400_000;
// 달력 격자는 UTC 자정으로 만든 날짜라 그대로, "오늘"과 D-day만 한국 날짜로 판단합니다.
const toKey = (date: Date) => date.toISOString().slice(0, 10);

/**
 * 종류별 색.
 *
 * 한 캘린더에 성격이 다른 세 가지가 섞입니다. 색이 같으면 "이건 내가 지운 수 있는 일정인가,
 * 공고 마감인가"를 매번 열어 봐야 합니다. 계열을 갈라 둡니다.
 *   공고(주황) — K-Startup에서 담은 접수 마감. 우리가 날짜를 못 바꿉니다.
 *   지원사업(빨강) — 온보딩에서 고른 사업의 마감. 자동 마일스톤의 기준점입니다.
 *   팀 일정(파랑) — 팀이 직접 만든 것. 완료하면 초록으로 빠집니다.
 */
const KIND_META: Record<CalendarKind, { label: string; dot: string; chip: string; tone: StatusTone }> = {
  announcement: { label: "공고 마감", dot: "bg-[#EA580C]", chip: "bg-[#FFF7ED] text-[#C2410C] ring-1 ring-inset ring-[#FED7AA]", tone: "amber" },
  program: { label: "지원사업 마감", dot: "bg-[#DC2626]", chip: "bg-[#FEF2F2] text-[#DC2626] ring-1 ring-inset ring-[#FECACA]", tone: "red" },
  task: { label: "팀 일정", dot: "bg-[#2563EB]", chip: "bg-[#EFF6FF] text-[#2563EB] ring-1 ring-inset ring-[#BFDBFE]", tone: "blue" },
};

const DONE_META = { label: "완료", dot: "bg-[#16A34A]", chip: "bg-[#F0FDF4] text-[#16A34A] ring-1 ring-inset ring-[#BBF7D0]", tone: "green" as StatusTone };

const metaOf = (item: CalendarItem) => (item.status === "done" ? DONE_META : KIND_META[item.kind]);

const LEGEND = [
  { ...KIND_META.announcement, key: "announcement" },
  { ...KIND_META.program, key: "program" },
  { ...KIND_META.task, key: "task" },
  { ...DONE_META, key: "done" },
];

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[#475569]">
      {LEGEND.map((entry) => (
        <li key={entry.key} className="flex items-center gap-1.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", entry.dot)} />
          {entry.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * 달력 한 칸.
 *
 * 좁은 화면에서 제목을 넣으면 글자가 뭉개져 아무것도 못 읽습니다. 폭에 따라 정보를 늘립니다.
 *   모바일  — 날짜 + 색 점 (자세한 내용은 아래 상세 패널에서)
 *   태블릿  — 제목 2건
 *   데스크톱 — 제목 3건
 */
function DayCell({
  cell,
  items,
  feedCount,
  selected,
  onSelect,
}: {
  cell: { key: string; day: number; inMonth: boolean; isToday: boolean };
  items: CalendarItem[];
  /** 담지 않은 K-Startup 공고 마감 수. 하루 최대 40건이라 제목 대신 건수만 얹습니다. */
  feedCount: number;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${cell.key} 일정 ${items.length}건${feedCount > 0 ? `, 공고 마감 ${feedCount}건` : ""}`}
      className={cn(
        "flex min-h-[58px] flex-col gap-1 rounded-lg p-1 text-left transition-colors sm:min-h-[96px] sm:rounded-xl sm:p-1.5 lg:min-h-[116px] lg:p-2",
        focusRing,
        cell.inMonth ? "bg-[#F8FAFC] hover:bg-[#EFF6FF]" : "bg-white text-[#CBD5E1]",
        cell.isToday && "ring-2 ring-[#2563EB]",
        selected && "ring-2 ring-[#0F172A]",
      )}
    >
      <span className={cn("text-[11px] font-bold tabular-nums sm:text-xs", cell.isToday && "text-[#2563EB]")}>{cell.day}</span>

      <span className="flex flex-wrap items-center gap-0.5 sm:hidden">
        {items.slice(0, 4).map((item) => <span key={item.id} className={cn("h-1.5 w-1.5 rounded-full", metaOf(item).dot)} />)}
        {items.length > 4 && <span className="text-[9px] font-bold leading-none text-[#94A3B8]">+{items.length - 4}</span>}
        {feedCount > 0 && <span className="text-[9px] font-bold leading-none text-[#C2410C]">공{feedCount}</span>}
      </span>

      <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
        {/* 공고 마감은 팀 일정보다 먼저 눈에 들어와야 "오늘 뭘 놓치고 있나"가 보입니다. */}
        {feedCount > 0 && (
          <span className="truncate rounded border border-dashed border-[#FDBA74] px-1 py-0.5 text-[10px] font-bold leading-4 text-[#C2410C] lg:text-[11px]">
            공고 마감 {feedCount}건
          </span>
        )}
        {items.slice(0, 2).map((item) => (
          <span key={item.id} title={item.title} className={cn("truncate rounded px-1 py-0.5 text-[10px] font-semibold leading-4 lg:text-[11px]", metaOf(item).chip)}>
            {item.title}
          </span>
        ))}
        {/* 세 번째 항목은 데스크톱에서만. 태블릿에서는 "+n건"으로 접습니다. */}
        {items[2] && (
          <span title={items[2].title} className={cn("hidden truncate rounded px-1 py-0.5 text-[11px] font-semibold leading-4 lg:block", metaOf(items[2]).chip)}>
            {items[2].title}
          </span>
        )}
        {items.length > 2 && <span className="px-1 text-[10px] font-bold text-[#94A3B8] lg:hidden">+{items.length - 2}건</span>}
        {items.length > 3 && <span className="hidden px-1 text-[10px] font-bold text-[#94A3B8] lg:block">+{items.length - 3}건</span>}
      </span>
    </button>
  );
}

/** 공고에서 담은 일정에만 붙는 줄. 접수 기간과 원문으로 가는 길을 캘린더 안에서 끝냅니다. */
function AnnouncementMeta({ announcement }: { announcement: NonNullable<CalendarItem["announcement"]> }) {
  const period = [announcement.startDate, announcement.endDate].filter(Boolean).join(" ~ ").replace(/-/g, ".");
  return (
    <div className="mt-2 rounded-lg bg-[#FFF7ED] p-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {announcement.supportField && <StatusBadge tone="amber">{announcement.supportField}</StatusBadge>}
        {announcement.regions.slice(0, 3).map((region) => (
          <span key={region} className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-[#C2410C]">{region}</span>
        ))}
      </div>
      {period && <p className="mt-1.5 text-xs font-semibold tabular-nums text-[#9A3412]">접수 {period}</p>}
      {!announcement.resolved && (
        <p className="mt-1.5 text-[11px] leading-4 text-[#C2410C]">
          공고 보관 기간이 지나 요약 정보는 더 이상 갱신되지 않습니다. 원문에서 확인해 주세요.
        </p>
      )}
      <a
        href={announcement.detailUrl}
        target="_blank"
        rel="noreferrer noopener"
        className={cn("mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#C2410C] hover:underline", focusRing)}
      >
        K-Startup 원문 <ExternalLink size={12} />
      </a>
    </div>
  );
}

/** 선택한 날짜의 항목 한 줄. 펼치면 공고 정보와 팀 코멘트가 함께 열립니다. */
function DayItemRow({ item, onCommentAdded }: { item: CalendarItem; onCommentAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const meta = metaOf(item);
  const expandable = Boolean(item.taskId) || Boolean(item.announcement);

  return (
    <li className="rounded-xl border border-[#E2E8F0] p-3">
      <div className="flex items-start gap-2">
        <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dot)} />
        <div className="min-w-0 flex-1">
          <p className="break-keep text-sm font-semibold text-[#0F172A]">{item.title}</p>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
            {item.commentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#94A3B8]">
                <MessageSquare size={12} />{item.commentCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {expandable && (
        <Button variant="ghost" size="sm" onClick={() => setOpen((value) => !value)} className="mt-1 -ml-3 text-[#2563EB] hover:text-[#1D4ED8]">
          {open ? "접기" : item.taskId ? "상세·코멘트" : "상세"}
        </Button>
      )}

      {open && (
        <>
          {item.announcement && <AnnouncementMeta announcement={item.announcement} />}
          {/* 지원사업 마감은 팀 일정 행이 아니라 코멘트를 붙일 대상이 없습니다. */}
          {item.taskId && <TaskCommentThread taskId={item.taskId} onAdded={onCommentAdded} />}
        </>
      )}
    </li>
  );
}

/** 한 날짜에 마감이 수십 건일 수 있어 상세 패널에서도 잘라 보여 줍니다. */
const FEED_VISIBLE = 6;

/**
 * 그날 마감인데 아직 담지 않은 공고들.
 *
 * 캘린더가 공고 실데이터를 보여 주는 지점입니다. 여기서 바로 담으면 코멘트를 달 수 있는
 * 팀 일정이 되고, 그때부터 위쪽 목록으로 올라갑니다.
 */
function DayAnnouncementFeed({ deadlines, onAdded }: { deadlines: AnnouncementDeadline[]; onAdded: () => void }) {
  const [addingSn, setAddingSn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const add = async (deadline: AnnouncementDeadline) => {
    setAddingSn(deadline.sn);
    setError(null);
    try {
      await createWorkspaceTask(`[공고] ${deadline.title} 접수 마감`, deadline.endDate, deadline.sn);
      onAdded();
    } catch (reason) {
      setError(toMessage(reason, "공고를 담지 못했습니다."));
    } finally {
      setAddingSn(null);
    }
  };

  if (deadlines.length === 0) return null;
  const visible = expanded ? deadlines : deadlines.slice(0, FEED_VISIBLE);

  return (
    <div className="mt-4 rounded-xl border border-[#FED7AA] bg-[#FFF7ED] p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#9A3412]">이날 마감하는 K-Startup 공고 {deadlines.length}건</p>
        <LinkButton href="/founder/announcements" variant="ghost" size="sm" className="-mr-3 text-[#C2410C]">조건으로 찾기</LinkButton>
      </div>
      <ul className="mt-2 space-y-1.5">
        {visible.map((deadline) => (
          <li key={deadline.sn} className="rounded-lg bg-white p-2.5">
            <p className="break-keep text-xs font-semibold leading-5 text-[#0F172A]">{deadline.title}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {deadline.supportField && <span className="rounded bg-[#FFF7ED] px-1.5 py-0.5 text-[11px] font-semibold text-[#C2410C]">{deadline.supportField}</span>}
              {deadline.regions.slice(0, 2).map((region) => (
                <span key={region} className="rounded bg-[#F1F5F9] px-1.5 py-0.5 text-[11px] font-semibold text-[#475569]">{region}</span>
              ))}
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={12} />}
                loading={addingSn === deadline.sn}
                onClick={() => void add(deadline)}
                className="ml-auto text-[#C2410C] hover:text-[#9A3412]"
              >
                캘린더에 담기
              </Button>
              {deadline.detailUrl && (
                <a href={deadline.detailUrl} target="_blank" rel="noreferrer noopener" aria-label={`${deadline.title} 원문 열기`} className={cn("text-[#C2410C]", focusRing)}>
                  <ExternalLink size={13} />
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
      {deadlines.length > FEED_VISIBLE && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((value) => !value)} className="mt-1 -ml-3 text-[#C2410C]">
          {expanded ? "접기" : `나머지 ${deadlines.length - FEED_VISIBLE}건 더 보기`}
        </Button>
      )}
      {error && <p className="mt-2 text-xs font-semibold text-[#DC2626]">{error}</p>}
    </div>
  );
}

function AddScheduleForm({ date, onAdded }: { date: string; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving || !title.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await createWorkspaceTask(title, date);
      setTitle("");
      onAdded();
    } catch (reason) {
      setError(toMessage(reason, "일정을 추가하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-dashed border-[#CBD5E1] p-3">
      <label className="block text-xs font-bold text-[#475569]" htmlFor="calendar-new-schedule">
        {date.replace(/-/g, ".")}에 팀 일정 추가
      </label>
      <div className="mt-1.5 flex gap-1.5">
        <input
          id="calendar-new-schedule"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
          placeholder="예) 멘토 미팅, 서류 제출"
          className={cn(inputClass, "!mt-0 h-9 text-sm")}
        />
        <Button size="sm" icon={<Plus size={14} />} loading={saving} disabled={!title.trim()} onClick={() => void submit()}>추가</Button>
      </div>
      {error && <p className="mt-2 text-xs font-semibold text-[#DC2626]">{error}</p>}
    </div>
  );
}

export function CalendarPanel() {
  const [items, setItems] = useState<CalendarItem[] | null>(null);
  const [deadlines, setDeadlines] = useState<AnnouncementDeadline[]>([]);
  const [showFeed, setShowFeed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthOffset, setMonthOffset] = useState(0);
  // 선택 날짜를 항상 유지합니다. 비워 두면 상세·추가 영역이 통째로 사라져 화면이 출렁입니다.
  const [selected, setSelected] = useState<string>(() => toKstDateKey());

  const load = useCallback(async () => {
    try {
      setItems(await getCalendarItems());
      setError(null);
    } catch (reason) {
      setItems([]);
      setError(toMessage(reason, "캘린더를 불러오지 못했습니다."));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const { cells, label } = useMemo(() => {
    const base = new Date();
    const view = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + monthOffset, 1));
    const firstWeekday = view.getUTCDay();
    const daysInMonth = new Date(Date.UTC(view.getUTCFullYear(), view.getUTCMonth() + 1, 0)).getUTCDate();
    const start = new Date(view.getTime() - firstWeekday * MS_DAY);
    return {
      label: `${view.getUTCFullYear()}년 ${view.getUTCMonth() + 1}월`,
      cells: Array.from({ length: 42 }, (_, index) => {
        const date = new Date(start.getTime() + index * MS_DAY);
        return { key: toKey(date), day: date.getUTCDate(), inMonth: date.getUTCMonth() === view.getUTCMonth(), isToday: toKey(date) === toKstDateKey(base) };
      }).slice(0, firstWeekday + daysInMonth > 35 ? 42 : 35),
    };
  }, [monthOffset]);

  // 보이는 격자만큼만 받아 옵니다. 달을 넘길 때마다 그 범위로 다시 조회합니다.
  const range = useMemo(() => ({ from: cells[0].key, to: cells[cells.length - 1].key }), [cells]);

  useEffect(() => {
    if (!showFeed) { setDeadlines([]); return; }
    let mounted = true;
    getAnnouncementDeadlines(range.from, range.to)
      .then((rows) => { if (mounted) setDeadlines(rows); })
      .catch(() => { if (mounted) setDeadlines([]); });
    return () => { mounted = false; };
  }, [range, showFeed]);

  const list = useMemo(() => items ?? [], [items]);
  const byDate = useMemo(
    () => list.reduce<Record<string, CalendarItem[]>>((acc, item) => ({ ...acc, [item.date]: [...(acc[item.date] ?? []), item] }), {}),
    [list],
  );

  // 이미 담은 공고는 팀 일정 줄로 이미 보입니다. 피드에 또 띄우면 같은 마감이 두 번 나옵니다.
  const addedSns = useMemo(
    () => new Set(list.flatMap((item) => (item.announcement ? [item.announcement.sn] : []))),
    [list],
  );
  const feedByDate = useMemo(
    () =>
      deadlines
        .filter((deadline) => !addedSns.has(deadline.sn))
        .reduce<Record<string, AnnouncementDeadline[]>>((acc, deadline) => ({ ...acc, [deadline.endDate]: [...(acc[deadline.endDate] ?? []), deadline] }), {}),
    [deadlines, addedSns],
  );

  const selectedItems = byDate[selected] ?? [];
  const upcoming = list.filter((item) => item.date >= toKstDateKey()).slice(0, 6);
  const loading = items === null;

  const detail = (
    <Panel title={selected.replace(/-/g, ".")} action={<StatusBadge tone={selectedItems.length ? "blue" : "slate"}>{selectedItems.length}건</StatusBadge>}>
      {selectedItems.length === 0 ? (
        <p className="text-sm text-[#94A3B8]">이 날짜에 등록된 일정이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {selectedItems.map((item) => <DayItemRow key={item.id} item={item} onCommentAdded={() => void load()} />)}
        </ul>
      )}
      <AddScheduleForm date={selected} onAdded={() => void load()} />
      <DayAnnouncementFeed deadlines={feedByDate[selected] ?? []} onAdded={() => void load()} />
    </Panel>
  );

  return (
    <div className="space-y-5">
      {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}

      {/* 넓은 화면에서는 달력과 상세를 나란히 둡니다. 좁으면 아래로 쌓입니다. */}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(300px,380px)] xl:items-start">
        <Panel
          title={label}
          action={
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={() => setMonthOffset((value) => value - 1)} aria-label="이전 달" icon={<ChevronLeft size={14} />} />
              <Button variant="secondary" size="sm" onClick={() => setMonthOffset(0)} disabled={monthOffset === 0}>오늘</Button>
              <Button variant="secondary" size="sm" onClick={() => setMonthOffset((value) => value + 1)} aria-label="다음 달" icon={<ChevronRight size={14} />} />
              <Button variant="ghost" size="sm" onClick={() => void load()} aria-label="새로고침" icon={<RefreshCw size={13} />} />
            </div>
          }
        >
          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-bold text-[#94A3B8] sm:gap-1 sm:text-xs">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => <div key={day} className="py-1.5">{day}</div>)}
          </div>

          {loading ? (
            <Skeleton className="h-[320px] sm:h-[480px]" />
          ) : (
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {cells.map((cell) => (
                <DayCell
                  key={cell.key}
                  cell={cell}
                  items={byDate[cell.key] ?? []}
                  feedCount={(feedByDate[cell.key] ?? []).length}
                  selected={selected === cell.key}
                  onSelect={() => setSelected(cell.key)}
                />
              ))}
            </div>
          )}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] pt-3">
            <Legend />
            <ChoiceChip
              selected={showFeed}
              onClick={() => setShowFeed((value) => !value)}
              className="px-2.5 py-1.5 text-[13px]"
            >
              K-Startup 공고 마감 함께 보기
            </ChoiceChip>
          </div>
        </Panel>

        {detail}
      </div>

      <Panel title="다가오는 마감">
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-14" />)}</div>
        ) : upcoming.length === 0 ? (
          <EmptyState
            title="다가오는 마감이 없습니다"
            description="지원사업 공고를 캘린더에 담거나, 위 달력에서 날짜를 골라 팀 일정을 추가해 보세요."
            action={<LinkButton href="/founder/announcements">지원사업 공고 보기</LinkButton>}
          />
        ) : (
          <div className="space-y-2">
            {upcoming.map((item) => {
              // 다른 화면과 같은 규칙으로 셉니다. 실시간 밀리초로 빼면 "오늘"이 화면마다 달라집니다.
              const dday = getDday(item.date) ?? 0;
              const meta = metaOf(item);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setSelected(item.date); setMonthOffset(0); }}
                  className={cn("flex w-full items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] p-3 text-left hover:bg-[#F8FAFC]", focusRing)}
                >
                  <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm font-bold text-[#0F172A]">{item.title}</strong>
                    <span className="text-xs text-[#94A3B8]">{item.date} · {meta.label}</span>
                  </span>
                  <StatusBadge tone={dday <= 3 ? "red" : dday <= 7 ? "amber" : "slate"}>D-{Math.max(0, dday)}</StatusBadge>
                </button>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
