"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, ExternalLink, RotateCcw, Search } from "lucide-react";
import {
  APPLICANT_TYPES,
  BIZ_AGES,
  REGIONS,
  SUPPORT_FIELDS,
  TARGET_AGES,
  getAnnouncementStatus,
  type Announcement,
  type AnnouncementStatus,
} from "@/lib/kstartup/announcements";
import {
  EMPTY_FILTERS,
  getAnnouncementsSyncedAt,
  searchAnnouncements,
  type AnnouncementFilters,
} from "@/lib/services/AnnouncementService";
import { createWorkspaceTask } from "@/lib/services/WorkspaceService";
import { toMessage } from "@/lib/errors";
import { getDday, toKstDateKey } from "./logic";
import { Button, ChoiceChip, EmptyState, Notice, Panel, Skeleton, StatusBadge, inputClass, selectClass, type StatusTone } from "./ui";

const STATUS_LABEL: Record<AnnouncementStatus, string> = { open: "접수 중", upcoming: "접수 예정", closed: "마감" };
const STATUS_TONE: Record<AnnouncementStatus, StatusTone> = { open: "green", upcoming: "blue", closed: "slate" };

/** 다중 선택 필터 정의. 항목은 전부 K-Startup 응답의 실측값이라 표기를 바꾸지 않습니다. */
const FILTER_GROUPS = [
  { key: "supportFields", label: "지원 분야", hint: "공고의 지원 유형입니다.", options: SUPPORT_FIELDS },
  { key: "regions", label: "지역", hint: "고른 지역에 전국 공고를 함께 보여 줍니다.", options: REGIONS },
  { key: "bizAges", label: "창업 업력", hint: "신청 자격이 되는 업력 구간입니다.", options: BIZ_AGES },
  { key: "applicantTypes", label: "신청 대상", hint: "대표자·기업의 유형입니다.", options: APPLICANT_TYPES },
  { key: "targetAges", label: "대상 연령", hint: "공고가 정한 대표자 연령 구간입니다.", options: TARGET_AGES },
] as const satisfies ReadonlyArray<{
  key: keyof Pick<AnnouncementFilters, "supportFields" | "regions" | "bizAges" | "applicantTypes" | "targetAges">;
  label: string;
  hint: string;
  options: readonly string[];
}>;

const formatDate = (value: string | null) => (value ? value.replace(/-/g, ".") : null);

function formatPeriod(announcement: Announcement) {
  const start = formatDate(announcement.start_date);
  const end = formatDate(announcement.end_date);
  if (start && end) return `${start} ~ ${end}`;
  if (end) return `~ ${end}`;
  if (start) return `${start} ~ (종료일 미정)`;
  return "접수 기간 미정";
}

function formatSyncedAt(value: string | null) {
  if (!value) return "아직 동기화되지 않았습니다";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "동기화 시각 확인 불가";
  return `${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Seoul" }).format(parsed)} 기준`;
}

function DdayBadge({ announcement, status }: { announcement: Announcement; status: AnnouncementStatus }) {
  const dday = getDday(status === "upcoming" ? announcement.start_date : announcement.end_date);
  if (dday === null) return null;
  const prefix = status === "upcoming" ? "접수 시작" : "마감";
  if (status === "closed") return <StatusBadge tone="slate">{`${prefix} ${-dday}일 지남`}</StatusBadge>;
  const tone: StatusTone = status === "upcoming" ? "blue" : dday <= 3 ? "red" : dday <= 7 ? "amber" : "slate";
  return <StatusBadge tone={tone}>{dday === 0 ? `오늘 ${prefix}` : `${prefix} D-${dday}`}</StatusBadge>;
}

/** 상세는 접힌 채로 둡니다. 목록에서 스무 건을 훑는 것이 먼저이고, 근거는 펼쳐서 봅니다. */
function AnnouncementDetail({ announcement }: { announcement: Announcement }) {
  const rows: Array<[string, string | null]> = [
    ["신청 대상", announcement.apply_target],
    ["신청 제외 대상", announcement.exclude_target],
    ["유의 사항", announcement.notes],
    ["공고 기관", [announcement.organizer, announcement.supervising_institution].filter(Boolean).join(" · ") || null],
    ["문의처", [announcement.department, announcement.contact].filter(Boolean).join(" · ") || null],
  ];
  const methods = Object.entries(announcement.apply_methods);

  return (
    <div className="mt-4 space-y-3 border-t border-[#F1F5F9] pt-4">
      {rows.map(([label, value]) =>
        value ? (
          <div key={label}>
            <p className="text-xs font-bold text-[#94A3B8]">{label}</p>
            <p className="mt-1 whitespace-pre-line text-sm leading-6 text-[#334155]">{value}</p>
          </div>
        ) : null,
      )}
      {methods.length > 0 && (
        <div>
          <p className="text-xs font-bold text-[#94A3B8]">접수 방법</p>
          <ul className="mt-1 space-y-1">
            {methods.map(([label, value]) => (
              <li key={label} className="text-sm leading-6 text-[#334155]">
                <span className="font-semibold text-[#0F172A]">{label}</span> · <span className="break-all">{value}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({
  announcement,
  todayKey,
  onAddToCalendar,
  adding,
  added,
}: {
  announcement: Announcement;
  todayKey: string;
  onAddToCalendar: (announcement: Announcement) => void;
  adding: boolean;
  added: boolean;
}) {
  const [open, setOpen] = useState(false);
  const status = getAnnouncementStatus(announcement, todayKey);
  const tags = [announcement.support_field, ...announcement.regions].filter(Boolean) as string[];

  return (
    <article className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={STATUS_TONE[status]} dot>{STATUS_LABEL[status]}</StatusBadge>
        <DdayBadge announcement={announcement} status={status} />
        {announcement.is_integrated && <StatusBadge tone="blue">통합공고</StatusBadge>}
      </div>

      <h3 className="mt-3 text-base font-bold leading-6 text-[#0F172A] md:text-lg">{announcement.title}</h3>
      <p className="mt-1.5 text-sm font-semibold tabular-nums text-[#475569]">접수 {formatPeriod(announcement)}</p>

      {tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <li key={tag} className="rounded-lg bg-[#F1F5F9] px-2 py-1 text-xs font-semibold text-[#475569]">{tag}</li>
          ))}
        </ul>
      )}

      {announcement.summary && <p className="mt-3 line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#64748B]">{announcement.summary}</p>}

      {open && <AnnouncementDetail announcement={announcement} />}

      <div className="mt-4 flex flex-wrap items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => setOpen((current) => !current)} className="-ml-3 text-[#2563EB] hover:text-[#1D4ED8]">
          {open ? "간단히 보기" : "자세히 보기"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<CalendarPlus size={14} />}
          disabled={added || adding || !announcement.end_date}
          loading={adding}
          onClick={() => onAddToCalendar(announcement)}
          className="text-[#475569] hover:text-[#0F172A]"
        >
          {added ? "캘린더에 있음" : "마감일 캘린더 추가"}
        </Button>
        {announcement.detail_url && (
          <a
            href={announcement.detail_url}
            target="_blank"
            rel="noreferrer noopener"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#2563EB] hover:bg-[#EFF6FF]"
          >
            K-Startup 원문 <ExternalLink size={13} />
          </a>
        )}
      </div>
    </article>
  );
}

export function AnnouncementsPanel() {
  const [filters, setFilters] = useState<AnnouncementFilters>(EMPTY_FILTERS);
  const [keywordInput, setKeywordInput] = useState("");
  const [rows, setRows] = useState<Announcement[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  // 오늘 날짜는 렌더마다 다시 만들지 않습니다. 카드 수십 장이 같은 기준으로 상태를 계산해야 합니다.
  const todayKey = useMemo(() => toKstDateKey(), []);

  // 타이핑 중 여러 요청이 겹치면 늦게 도착한 옛 응답이 최신 결과를 덮습니다. 마지막 요청만 반영합니다.
  const requestId = useRef(0);

  useEffect(() => {
    const timer = setTimeout(() => setFilters((current) => ({ ...current, keyword: keywordInput })), 300);
    return () => clearTimeout(timer);
  }, [keywordInput]);

  useEffect(() => {
    let mounted = true;
    getAnnouncementsSyncedAt().then((value) => { if (mounted) setSyncedAt(value); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const id = requestId.current + 1;
    requestId.current = id;
    setPage(0);
    setLoading(true);
    setError(null);
    searchAnnouncements(filters, 0)
      .then((result) => {
        if (requestId.current !== id) return;
        setRows(result.rows);
        setTotal(result.total);
      })
      .catch((reason) => {
        if (requestId.current !== id) return;
        setRows([]);
        setTotal(0);
        setError(toMessage(reason, "공고를 불러오지 못했습니다."));
      })
      .finally(() => { if (requestId.current === id) setLoading(false); });
  }, [filters]);

  const loadMore = useCallback(async () => {
    const id = requestId.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    try {
      const result = await searchAnnouncements(filters, nextPage);
      if (requestId.current !== id) return;
      setRows((current) => [...current, ...result.rows]);
      setTotal(result.total);
      setPage(nextPage);
    } catch (reason) {
      if (requestId.current === id) setError(toMessage(reason, "다음 공고를 불러오지 못했습니다."));
    } finally {
      setLoadingMore(false);
    }
  }, [filters, page]);

  const toggleOption = useCallback((key: (typeof FILTER_GROUPS)[number]["key"], option: string) => {
    setFilters((current) => {
      const selected = current[key];
      return { ...current, [key]: selected.includes(option) ? selected.filter((item) => item !== option) : [...selected, option] };
    });
  }, []);

  const reset = useCallback(() => {
    setKeywordInput("");
    setFilters(EMPTY_FILTERS);
  }, []);

  /** 기존 팀 TODO·마감 캘린더로 그대로 흘려보냅니다. 공고 화면이 별도 일정 저장소를 갖지 않게 합니다. */
  const addToCalendar = useCallback(async (announcement: Announcement) => {
    if (!announcement.end_date) return;
    setAddingId(announcement.pbanc_sn);
    setNotice(null);
    try {
      await createWorkspaceTask(`[공고] ${announcement.title} 접수 마감`, announcement.end_date);
      setAddedIds((current) => [...current, announcement.pbanc_sn]);
      setNotice({ tone: "success", text: `마감일(${formatDate(announcement.end_date)})을 팀 TODO와 마감 캘린더에 추가했습니다.` });
    } catch (reason) {
      setNotice({ tone: "error", text: toMessage(reason, "캘린더에 추가하지 못했습니다.") });
    } finally {
      setAddingId(null);
    }
  }, []);

  const selectedCount = FILTER_GROUPS.reduce((sum, group) => sum + filters[group.key].length, 0);

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <div className="xl:sticky xl:top-6 xl:self-start">
        <Panel
          title="내 조건"
          action={
            <Button variant="ghost" size="sm" icon={<RotateCcw size={13} />} onClick={reset} className="-mr-3 text-[#475569]">
              초기화
            </Button>
          }
        >
          <label className="relative block">
            <span className="sr-only">공고 검색</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="search"
              value={keywordInput}
              onChange={(event) => setKeywordInput(event.target.value)}
              placeholder="공고명·내용 검색"
              className={`${inputClass} !mt-0 pl-9`}
            />
          </label>

          <div className="mt-4 space-y-4">
            {FILTER_GROUPS.map((group) => (
              <fieldset key={group.key}>
                <legend className="text-sm font-bold text-[#0F172A]">{group.label}</legend>
                <p className="mt-0.5 text-xs leading-5 text-[#94A3B8]">{group.hint}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.options.map((option) => (
                    <ChoiceChip
                      key={option}
                      selected={filters[group.key].includes(option)}
                      onClick={() => toggleOption(group.key, option)}
                      className="px-2.5 py-1.5 text-[13px]"
                    >
                      {option}
                    </ChoiceChip>
                  ))}
                </div>
              </fieldset>
            ))}

            <fieldset>
              <legend className="text-sm font-bold text-[#0F172A]">마감된 공고</legend>
              <div className="mt-2">
                <ChoiceChip
                  selected={filters.includeClosed}
                  onClick={() => setFilters((current) => ({ ...current, includeClosed: !current.includeClosed }))}
                  className="px-2.5 py-1.5 text-[13px]"
                >
                  최근 마감 공고도 함께 보기
                </ChoiceChip>
              </div>
            </fieldset>
          </div>

          <p className="mt-4 rounded-xl bg-[#F8FAFC] p-3 text-xs leading-5 text-[#64748B]">
            선택한 조건 {selectedCount}개. 같은 항목 안에서는 하나라도 맞으면(OR), 다른 항목끼리는 모두 맞아야(AND) 보입니다.
          </p>
        </Panel>
      </div>

      <div className="space-y-4">
        <Panel>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0F172A]">
                {loading ? "공고를 불러오는 중" : `조건에 맞는 공고 ${total.toLocaleString("ko-KR")}건`}
              </p>
              <p className="mt-0.5 text-xs font-medium text-[#94A3B8]">K-Startup 공식 오픈API · {formatSyncedAt(syncedAt)}</p>
            </div>
            <label className="text-sm font-bold text-[#0F172A]">
              <span className="sr-only">정렬</span>
              <select
                value={filters.sort}
                onChange={(event) => setFilters((current) => ({ ...current, sort: event.target.value as AnnouncementFilters["sort"] }))}
                className={`${selectClass} !mt-0 w-auto pr-8`}
              >
                <option value="deadline">마감 임박순</option>
                <option value="recent">최근 등록순</option>
              </select>
            </label>
          </div>
        </Panel>

        {notice && <Notice tone={notice.tone} onDismiss={() => setNotice(null)}>{notice.text}</Notice>}
        {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}

        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((index) => <Skeleton key={index} className="h-44" />)}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="조건에 맞는 공고가 없습니다"
            description="조건을 하나씩 풀어 보세요. 지역과 업력을 함께 좁히면 결과가 빠르게 줄어듭니다."
            action={<Button variant="secondary" size="sm" onClick={reset}>조건 초기화</Button>}
          />
        ) : (
          <>
            <div className="space-y-4">
              {rows.map((announcement) => (
                <AnnouncementCard
                  key={announcement.pbanc_sn}
                  announcement={announcement}
                  todayKey={todayKey}
                  onAddToCalendar={(item) => void addToCalendar(item)}
                  adding={addingId === announcement.pbanc_sn}
                  added={addedIds.includes(announcement.pbanc_sn)}
                />
              ))}
            </div>
            {rows.length < total && (
              <Button variant="secondary" block loading={loadingMore} onClick={() => void loadMore()}>
                {`더 보기 (${rows.length.toLocaleString("ko-KR")}/${total.toLocaleString("ko-KR")})`}
              </Button>
            )}
          </>
        )}

        <p className="text-[13px] leading-6 text-[#94A3B8]">
          공고 정보는 창업진흥원 K-Startup 공식 오픈API를 하루 한 번 내려받아 보여 줍니다. 접수 마감일과 자격 요건의 최종 기준은 각 공고
          원문이므로, 신청 전에는 반드시 원문 페이지에서 확인해 주세요.
        </p>
      </div>
    </div>
  );
}
