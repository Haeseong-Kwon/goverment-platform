"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle, Check, EyeOff, FileText, Loader2, MessageSquare, Plus, Rocket, ScanSearch,
  ShieldAlert, Sparkles, Target, TrendingUp, Upload, Users, Wrench, X, Zap,
  type LucideIcon,
} from "lucide-react";
import { getDday, getFounderDashboardSummary, getMonthlyDiagnosticUsage } from "./logic";
import { EligibilityPanel } from "./EligibilityPanel";
import { CalendarPanel, IncorporationPanel, TeamSettingsPanel, TrackerPanel, VaultPanel } from "./FounderPanels";
import { getSelectedPrograms, getTeamMembers, listVaultDocuments, type BudgetLine, type SelectedProgram, type TeamMember, type VaultDocument } from "@/lib/services/FounderWorkspaceService";
import { RequireFounderSession, WorkspaceShell } from "./shell";
import { DEV_BYPASS } from "@/lib/dev/devMode";
import {
  addTaskComment,
  assignTask,
  createWorkspaceTask,
  convertPrepTeam,
  getAcceptedInviteCount,
  getAuthHeaders,
  getBizplanDiagnosisEvents,
  getBizplanHistory,
  getTaskComments,
  getWaitlistEntries,
  getWorkspaceTasks,
  trackWorkspaceEvent,
  joinWaitlist,
  requestSettlementReview,
  updateWorkspaceTask,
  type BizplanHistoryEntry,
  type PersistedTask,
  type TaskComment,
} from "@/lib/services/WorkspaceService";
import { Button, EmptyState, Field, IconButton, LinkButton, Notice, PageHeader, Panel, ProgressBar, Skeleton, StatusBadge, focusRing, inputClass, interactive, textareaClass, useToast } from "./ui";
import { ExpenseValidator } from "@/features/expense-rules/ExpenseValidator";
import { BudgetPanel } from "@/features/expense-rules/BudgetPanel";
import { CalculatorSuite } from "./CalculatorSuite";
import { LibraryPanel } from "./LibraryPanel";
import { PreDeliberationPanel } from "@/features/expense-rules/PreDeliberation";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

export const PRODUCT_NAME = "StartUp Pilot";

/** 완료된 할 일에는 남은 일수를 표시하지 않습니다. 이미 끝난 일에 "9일 지남"은 잘못된 경고입니다. */
function DdayBadge({ dueDate, done = false }: { dueDate: string | null; done?: boolean }) {
  if (done) return <StatusBadge tone="green">완료</StatusBadge>;
  const dday = getDday(dueDate);
  if (dday === null) return <StatusBadge tone="slate">마감일 없음</StatusBadge>;
  if (dday < 0) return <StatusBadge tone="red">{Math.abs(dday)}일 지남</StatusBadge>;
  if (dday === 0) return <StatusBadge tone="red">오늘</StatusBadge>;
  return <StatusBadge tone={dday <= 3 ? "red" : dday <= 7 ? "amber" : "slate"}>D-{dday}</StatusBadge>;
}

function TaskCheckbox({ done, pending, title, onToggle }: { done: boolean; pending: boolean; title: string; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={done}
      aria-label={done ? `${title} 완료 취소` : `${title} 완료 처리`}
      className={cn(
        "grid h-6 w-6 shrink-0 place-items-center rounded-md border transition-colors disabled:opacity-50",
        done ? "border-[#16A34A] bg-[#16A34A] text-white" : "border-[#CBD5E1] hover:border-[#2563EB]",
      )}
    >
      {pending ? <Loader2 size={13} className="animate-spin" /> : done ? <Check size={14} /> : null}
    </button>
  );
}

function HideButton({ title, pending, onHide }: { title: string; pending: boolean; onHide: () => void }) {
  return (
    <button
      type="button"
      onClick={onHide}
      disabled={pending}
      aria-label={`${title} 숨기기`}
      title="목록에서 숨기기"
      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[#94A3B8] hover:bg-[#F8FAFC] hover:text-[#475569] disabled:opacity-50"
    >
      <EyeOff size={15} />
    </button>
  );
}

/** 팀 TODO 읽기·쓰기를 한 곳에 모아 홈과 TODO 보드가 같은 규칙으로 동작하게 합니다. */
function useWorkspaceTasks() {
  const [tasks, setTasks] = useState<PersistedTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setTasks(await getWorkspaceTasks());
      setError(null);
    } catch (reason) {
      setTasks([]);
      setError(toMessage(reason, "TODO를 불러오지 못했습니다."));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const mutate = useCallback(async (task: PersistedTask, changes: Partial<Pick<PersistedTask, "status" | "is_hidden">>) => {
    setPendingId(task.id);
    setError(null);
    try {
      const changed = await updateWorkspaceTask(task.id, changes);
      setTasks((current) => (current ?? []).flatMap((item) => {
        if (item.id !== changed.id) return [item];
        return changed.is_hidden ? [] : [changed];
      }));
    } catch (reason) {
      setError(toMessage(reason, "상태를 바꾸지 못했습니다."));
    } finally {
      setPendingId(null);
    }
  }, []);

  const add = useCallback(async (title: string, dueDate?: string) => {
    setError(null);
    try {
      const created = await createWorkspaceTask(title, dueDate);
      setTasks((current) => [...(current ?? []), created]);
      return true;
    } catch (reason) {
      setError(toMessage(reason, "TODO를 추가하지 못했습니다."));
      return false;
    }
  }, []);

  const assign = useCallback(async (taskId: string, assigneeId: string | null) => {
    setPendingId(taskId);
    setError(null);
    try {
      await assignTask(taskId, assigneeId);
      setTasks((current) => (current ?? []).map((item) => (item.id === taskId ? { ...item, assignee_id: assigneeId } : item)));
    } catch (reason) {
      setError(toMessage(reason, "담당자를 지정하지 못했습니다."));
    } finally {
      setPendingId(null);
    }
  }, []);

  return { tasks, loading: tasks === null, error, pendingId, reload: load, mutate, add, assign, clearError: () => setError(null) };
}

function TaskRow({
  task,
  pending,
  onToggle,
  onHide,
}: {
  task: PersistedTask;
  pending: boolean;
  onToggle: () => void;
  onHide?: () => void;
}) {
  const done = task.status === "done";
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border p-3", done ? "border-[#BBF7D0] bg-[#F0FDF4]" : "border-[#E2E8F0] bg-white")}>
      <TaskCheckbox done={done} pending={pending} title={task.title} onToggle={onToggle} />

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-semibold", done ? "text-[#16A34A] line-through" : "text-[#0F172A]")}>{task.title}</p>
        <p className="mt-0.5 text-xs text-[#94A3B8]">{task.due_date ?? "마감일 없음"} · {task.task_type === "auto" ? "자동 생성" : "직접 추가"}</p>
      </div>

      <DdayBadge dueDate={task.due_date} done={done} />
      {onHide && <HideButton title={task.title} pending={pending} onHide={onHide} />}
    </div>
  );
}

/** 칸반 열은 폭이 좁습니다. 제목을 자르는 대신 줄바꿈하고 이동 버튼을 카드 안에 둡니다. */
/**
 * 할 일 코멘트 스레드.
 *
 * 실시간 채팅 대신 업무 객체에 붙습니다. 열었을 때만 조회해 목록 로딩을 무겁게 하지 않습니다.
 */
function TaskCommentThread({ taskId, onAdded }: { taskId: string; onAdded: () => void }) {
  const [comments, setComments] = useState<TaskComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getTaskComments(taskId)
      .then((rows) => { if (mounted) setComments(rows); })
      .catch((reason) => { if (mounted) { setComments([]); setError(toMessage(reason, "코멘트를 불러오지 못했습니다.")); } });
    return () => { mounted = false; };
  }, [taskId]);

  const submit = async () => {
    if (saving || !draft.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await addTaskComment(taskId, draft);
      setComments((current) => [...(current ?? []), created]);
      setDraft("");
      onAdded();
    } catch (reason) {
      setError(toMessage(reason, "코멘트를 남기지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 space-y-2 rounded-lg bg-[#F8FAFC] p-3">
      {comments === null && <p className="text-xs text-[#94A3B8]">불러오는 중…</p>}
      {comments?.length === 0 && <p className="text-xs text-[#94A3B8]">첫 코멘트를 남겨 보세요.</p>}
      {comments?.map((comment) => (
        <div key={comment.id} className="rounded-lg bg-white p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <strong className="text-xs font-bold text-[#0F172A]">{comment.authorName}</strong>
            <span className="shrink-0 text-[11px] text-[#94A3B8]">{comment.createdAt.slice(0, 10)}</span>
          </div>
          <p className="mt-1 break-keep text-xs leading-5 text-[#475569]">{comment.content}</p>
        </div>
      ))}
      {error && <p className="text-xs font-semibold text-[#DC2626]">{error}</p>}
      <div className="flex gap-1.5">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
          placeholder="코멘트 남기기"
          aria-label="코멘트 입력"
          className={cn(inputClass, "h-9 text-xs")}
        />
        <Button size="sm" loading={saving} disabled={!draft.trim()} onClick={() => void submit()}>등록</Button>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  pending,
  moves,
  members,
  onToggle,
  onMove,
  onHide,
  onAssign,
  onCommentAdded,
}: {
  task: PersistedTask;
  pending: boolean;
  moves: ReadonlyArray<{ status: PersistedTask["status"]; label: string }>;
  members: TeamMember[];
  onToggle: () => void;
  onMove: (status: PersistedTask["status"]) => void;
  onHide: () => void;
  onAssign: (assigneeId: string | null) => void;
  onCommentAdded: () => void;
}) {
  const [threadOpen, setThreadOpen] = useState(false);
  const done = task.status === "done";

  return (
    <article className={cn("rounded-xl border p-3", done ? "border-[#BBF7D0] bg-[#F0FDF4]" : "border-[#E2E8F0] bg-white")}>
      <div className="flex items-start gap-2.5">
        <TaskCheckbox done={done} pending={pending} title={task.title} onToggle={onToggle} />
        <p className={cn("min-w-0 flex-1 break-keep text-sm font-semibold leading-6", done ? "text-[#16A34A] line-through" : "text-[#0F172A]")}>
          {task.title}
        </p>
        <HideButton title={task.title} pending={pending} onHide={onHide} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[34px]">
        <DdayBadge dueDate={task.due_date} done={done} />
        <span className="text-xs text-[#94A3B8]">{task.due_date ?? "마감일 없음"}</span>
        {task.task_type === "auto" && <span className="text-xs text-[#94A3B8]">· 자동 생성</span>}
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2 pl-[34px]">
        <select
          value={task.assignee_id ?? ""}
          onChange={(event) => onAssign(event.target.value || null)}
          disabled={pending}
          aria-label={`${task.title} 담당자`}
          className={cn(inputClass, "h-8 w-auto min-w-[7.5rem] py-0 text-xs")}
        >
          <option value="">담당자 없음</option>
          {members.map((member) => <option key={member.userId} value={member.userId}>{member.fullName}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setThreadOpen((open) => !open)}
          aria-expanded={threadOpen}
          className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold text-[#475569]", focusRing, "transition-colors hover:bg-[#F1F5F9]")}
        >
          <MessageSquare size={13} />
          코멘트 {task.comment_count > 0 ? task.comment_count : ""}
        </button>
      </div>

      <div className="mt-3 flex gap-1 pl-[34px]">
        {moves.map((move) => (
          <button
            key={move.status}
            onClick={() => onMove(move.status)}
            disabled={pending}
            className={cn("rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-bold text-[#2563EB]", focusRing, "transition-colors hover:bg-[#DBEAFE] active:scale-95 disabled:opacity-50")}
          >
            {move.label}
          </button>
        ))}
      </div>

      {threadOpen && <TaskCommentThread taskId={task.id} onAdded={onCommentAdded} />}
    </article>
  );
}

function TaskBoard() {
  const { tasks, loading, error, pendingId, mutate, add, reload, assign } = useWorkspaceTasks();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const rows = tasks ?? [];

  // 담당자 드롭다운 후보. 실패해도 보드 자체는 동작해야 하므로 조용히 비웁니다.
  useEffect(() => {
    let mounted = true;
    getTeamMembers().then((rows) => { if (mounted) setMembers(rows); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const submit = async () => {
    if (!title.trim()) return;
    if (await add(title, dueDate || undefined)) {
      setTitle("");
      setDueDate("");
    }
  };

  const columns = [
    { status: "todo", label: "할 일" },
    { status: "in_progress", label: "진행" },
    { status: "done", label: "완료" },
  ] as const;

  return (
    <section className="space-y-5">
      <Panel title="할 일 추가">
        <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
          <Field label="제목">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
              placeholder="예) 사업계획서 3장 초안"
              className={inputClass}
            />
          </Field>
          <Field label="마감일" hint="선택 항목입니다">
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
          </Field>
          <div className="flex items-end">
            <Button onClick={() => void submit()} disabled={!title.trim()} icon={<Plus size={15} />} className="w-full sm:w-auto">
              추가
            </Button>
          </div>
        </div>
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
      </Panel>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-3">{columns.map((column) => <Skeleton key={column.status} className="h-40" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState
          title="아직 할 일이 없습니다"
          description="온보딩에서 지원사업을 선택하면 공고 마감일 기준 준비 마일스톤이 자동으로 생성됩니다."
          action={<LinkButton href="/onboarding">지원사업 선택하기</LinkButton>}
        />
      ) : (
        <div className="animate-in-stagger grid gap-4 lg:grid-cols-3">
          {columns.map((column) => {
            const items = rows.filter((task) => task.status === column.status);
            return (
              <Panel key={column.status} title={column.label} action={<StatusBadge tone="slate">{items.length}</StatusBadge>}>
                <div className="space-y-2">
                  {items.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      pending={pendingId === task.id}
                      members={members}
                      moves={columns.filter((next) => next.status !== column.status).map((next) => ({ status: next.status, label: `${next.label}로` }))}
                      onToggle={() => void mutate(task, { status: task.status === "done" ? "todo" : "done" })}
                      onMove={(status) => void mutate(task, { status })}
                      onHide={() => void mutate(task, { is_hidden: true })}
                      onAssign={(assigneeId) => void assign(task.id, assigneeId)}
                      onCommentAdded={() => void reload()}
                    />
                  ))}
                  {items.length === 0 && <p className="py-6 text-center text-sm text-[#94A3B8]">항목이 없습니다.</p>}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
      <p className="text-sm text-[#475569]">{label}</p>
      <strong className="mt-2 block text-2xl font-bold tabular-nums text-[#0F172A]">{value}</strong>
      {hint && <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

function FounderHome({ founder }: { founder: boolean }) {
  const { tasks, loading, error, pendingId, mutate } = useWorkspaceTasks();
  const [programs, setPrograms] = useState<SelectedProgram[]>([]);
  const rows = tasks ?? [];
  const summary = getFounderDashboardSummary(rows);
  const nextDday = getDday(summary.nextDueDate);

  // 히어로는 "가장 임박한 공고"를 보여야 합니다. TODO 마감만 보면 정작 공고 마감일이 홈에 안 뜹니다.
  useEffect(() => {
    if (founder) return;
    let mounted = true;
    getSelectedPrograms().then((rows) => { if (mounted) setPrograms(rows); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [founder]);

  const nextProgram = programs
    .filter((program) => program.deadline && (getDday(program.deadline) ?? -1) >= 0)
    .sort((a, b) => (a.deadline ?? "").localeCompare(b.deadline ?? ""))[0] ?? null;
  const programDday = getDday(nextProgram?.deadline);
  const overdueCount = rows.filter((task) => task.status !== "done" && (getDday(task.due_date) ?? 0) < 0).length;
  const overdue = overdueCount > 0;
  const upcoming = rows
    .filter((task) => task.status !== "done")
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
    .slice(0, 4);

  return (
    <WorkspaceShell role={founder ? "founder" : "pre_founder"}>
      <PageHeader
        badge={founder ? "선정 팀" : "창업자 준비"}
        badgeTone={founder ? "green" : "blue"}
        title={founder ? "협약 수행 홈" : "창업자 준비 워크스페이스"}
        description={founder ? "집행 건을 사전검증하고 검토 상태를 추적합니다." : "지원사업 준비 흐름을 팀 TODO와 진단 리포트로 관리합니다."}
        action={
          <LinkButton href={founder ? "/workspace/precheck" : "/founder/diagnostics"} icon={<Sparkles size={15} />}>
            {founder ? "정산 사전검증" : "AI 진단 시작"}
          </LinkButton>
        }
      />

      {loading ? (
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-[132px] md:col-span-2" /><Skeleton className="h-[132px]" /><Skeleton className="h-[132px]" />
        </div>
      ) : (
        <section className="animate-in-stagger grid gap-4 md:grid-cols-4">
          <div className={cn("rounded-2xl p-5 text-white md:col-span-2", overdue ? "bg-[#DC2626]" : "bg-[#2563EB]")}>
            {overdue ? (
              <>
                <p className="text-sm font-semibold opacity-90">기한이 지난 할 일</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {summary.nextDueDate}
                  {nextDday !== null && nextDday < 0 && ` · ${Math.abs(nextDday)}일 지남`}
                </h2>
                <p className="mt-2 text-sm opacity-90">지난 마감 {overdueCount}건을 먼저 처리하거나 마감일을 조정하세요.</p>
              </>
            ) : nextProgram ? (
              <>
                <p className="text-sm font-semibold opacity-90">가장 임박한 공고 마감</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {nextProgram.name}
                  {programDday !== null && (programDday === 0 ? " · 오늘" : ` · D-${programDday}`)}
                </h2>
                <p className="mt-2 text-sm opacity-90">
                  {nextProgram.deadline} 마감
                  {summary.nextDueDate && ` · 다음 할 일 ${summary.nextDueDate}`}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold opacity-90">다음 마감</p>
                <h2 className="mt-2 text-2xl font-bold">
                  {summary.nextDueDate
                    ? `${summary.nextDueDate}${nextDday === null ? "" : nextDday === 0 ? " · 오늘" : ` · D-${nextDday}`}`
                    : "등록된 마감 없음"}
                </h2>
                <p className="mt-2 text-sm opacity-90">
                  마감일이 있는 할 일 {rows.filter((task) => task.due_date && task.status !== "done").length}건 기준 · 자동 생성 {summary.automaticTasks}건
                </p>
              </>
            )}
          </div>
          <StatTile label="남은 TODO" value={`${summary.remainingTasks}건`} hint={`전체 ${rows.length}건`} />
          <StatTile label="팀 진행률" value={`${summary.completionRate}%`} hint={`완료 ${rows.length - summary.remainingTasks}건`} />
        </section>
      )}

      {error && <p className="mt-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm font-semibold text-[#DC2626]">{error}</p>}

      <section className="mt-6">
        <Panel
          title="가까운 할 일"
          action={<LinkButton href={founder ? "/workspace/tracker" : "/founder/todo"} variant="ghost" size="sm" className="text-[#2563EB]">전체 보기</LinkButton>}
        >
          {loading ? (
            <div className="space-y-2">{[0, 1, 2].map((key) => <Skeleton key={key} className="h-14" />)}</div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              title={rows.length === 0 ? "아직 생성된 TODO가 없습니다" : "남은 할 일이 없습니다"}
              description={rows.length === 0 ? "온보딩에서 지원사업을 선택하면 마감 기준 마일스톤이 자동 생성됩니다." : "새 할 일을 추가하거나 다음 마감을 확인해 보세요."}
              action={
                <LinkButton href={founder ? "/workspace/precheck" : "/founder/todo"}>
                  {founder ? "정산 사전검증 시작" : "할 일 추가하기"}
                </LinkButton>
              }
            />
          ) : (
            <div className="space-y-2">
              {upcoming.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  pending={pendingId === task.id}
                  onToggle={() => void mutate(task, { status: "done" })}
                  onHide={() => void mutate(task, { is_hidden: true })}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {(founder
          ? [
              { href: "/workspace/precheck", title: "정산 사전검증", desc: "집행 건을 규정 룰셋으로 미리 판정합니다." },
              { href: "/workspace/tracker", title: "상태 트래커", desc: "제출한 건의 검토 단계를 확인합니다." },
              { href: "/workspace/vault", title: "서류 보관함", desc: "증빙과 검토본을 버전으로 관리합니다." },
            ]
          : [
              { href: "/founder/diagnostics", title: "AI 진단", desc: "자격 요건과 사업계획서를 함께 점검합니다." },
              { href: "/founder/calendar", title: "마감 캘린더", desc: "공고 마감과 팀 마감을 한 달력에서 봅니다." },
              { href: "/founder/vault", title: "서류 보관함", desc: "사업계획서 버전과 증빙을 보관합니다." },
            ]
        ).map((item) => (
          <Link key={item.href} href={item.href} className="rounded-2xl border border-[#E2E8F0] bg-white p-5 transition-colors hover:border-[#2563EB]">
            <h2 className="text-xl font-bold">{item.title}</h2>
            <p className="mt-2 text-sm text-[#475569]">{item.desc}</p>
          </Link>
        ))}
      </section>
    </WorkspaceShell>
  );
}

function FounderCore({ founder = false }: { founder?: boolean }) {
  return (
    <RequireFounderSession role={founder ? "founder" : "pre_founder"}>
      <FounderHome founder={founder} />
    </RequireFounderSession>
  );
}

type FounderFeature = "todo" | "calendar" | "diagnostics" | "calculator" | "library" | "incorporation" | "connect" | "vault" | "settings" | "precheck" | "predeliberation" | "tracker";

const FEATURE_META: Record<FounderFeature, { title: string; description: string }> = {
  todo: { title: "팀 TODO", description: "공고 마감 기준 자동 마일스톤과 직접 추가한 할 일을 함께 관리합니다." },
  calendar: { title: "마감 캘린더", description: "선택한 지원사업 공고 마감과 팀 할 일 마감을 한 달력에서 확인합니다." },
  diagnostics: { title: "AI 진단", description: "자격 요건을 룰셋으로 판정하고 사업계획서를 PSST 구조로 점검합니다." },
  calculator: { title: "계산기", description: "4대보험 실부담액, 인건비 총부담액, 법인 vs 개인 세금을 비교합니다. 모든 결과는 참고용 추정입니다." },
  library: { title: "무료 자료실", description: "출처가 표기된 창업 표준 양식을 받습니다. 계약서·IR·인사·정부지원 행정 서식." },
  incorporation: { title: "법인 설립", description: "사업별 설립 타이밍과 절차를 확인합니다. 순서를 잘못 밟으면 자격이 사라집니다." },
  connect: { title: "커넥트", description: "팀빌딩·멘토·투자 연결 대기 신청을 접수합니다." },
  vault: { title: "서류 보관함", description: "같은 이름으로 올리면 버전이 쌓이고, 열람은 만료형 보안 링크로만 이뤄집니다." },
  settings: { title: "팀 설정", description: "팀 구성원과 초대 코드, 데이터 공개 범위를 관리합니다." },
  precheck: { title: "정산 사전검증", description: "집행 건을 「사업비 비목 해설」 룰셋으로 판정한 뒤 검토를 요청합니다." },
  predeliberation: { title: "사전심의 합본", description: "사전심의 대상 여부를 판정하고 합본 구비 서류를 점검합니다." },
  tracker: { title: "상태 트래커", description: "제출한 정산 건의 검토 단계와 매니저 판정을 확인합니다." },
};

function FounderFeaturePage({ feature, founder = false }: { feature: FounderFeature; founder?: boolean }) {
  const meta = FEATURE_META[feature];
  return (
    <RequireFounderSession role={founder ? "founder" : "pre_founder"}>
      <WorkspaceShell role={founder ? "founder" : "pre_founder"}>
        <PageHeader badge={founder ? "선정 팀" : "창업자 준비"} badgeTone={founder ? "green" : "blue"} title={meta.title} description={meta.description} />
        {feature === "todo" && <TaskBoard />}
        {feature === "calendar" && <CalendarPanel />}
        {feature === "diagnostics" && <div className="space-y-6"><EligibilityPanel /><BizPlanCard /></div>}
        {feature === "calculator" && <CalculatorSuite />}
        {feature === "library" && <LibraryPanel />}
        {feature === "incorporation" && <IncorporationPanel />}
        {feature === "connect" && <ConnectCard />}
        {feature === "vault" && <VaultPanel />}
        {feature === "settings" && <TeamSettingsPanel founder={founder} />}
        {feature === "precheck" && <PrecheckPanel />}
        {feature === "predeliberation" && <PreDeliberationPanel />}
        {feature === "tracker" && <TrackerPanel />}
      </WorkspaceShell>
    </RequireFounderSession>
  );
}

/**
 * 검토 요청에 붙일 실제 증빙 파일을 고릅니다.
 * 증빙 '유형' 체크(룰 엔진 입력)와 달리, 여기서 고른 파일만 매니저가 열어 볼 수 있습니다.
 */
function EvidenceFilePicker({ selected, onToggle }: { selected: string[]; onToggle: (documentId: string) => void }) {
  const [documents, setDocuments] = useState<VaultDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    listVaultDocuments()
      .then((rows) => { if (mounted) setDocuments(rows.filter((row) => row.folder === "evidence")); })
      .catch((reason) => { if (mounted) { setDocuments([]); setError(toMessage(reason, "보관함을 불러오지 못했습니다.")); } });
    return () => { mounted = false; };
  }, []);

  return (
    <Panel
      title="첨부할 증빙 파일"
      action={<StatusBadge tone={selected.length ? "green" : "amber"}>{selected.length}개 선택</StatusBadge>}
    >
      <p className="mb-3 text-sm leading-6 text-[#475569]">
        여기서 고른 파일만 매니저가 만료형 보안 링크로 열어 봅니다. 고르지 않으면 매니저는 판정 근거만 보고 판단해야 합니다.
      </p>
      {error && <div className="mb-3"><Notice tone="error">{error}</Notice></div>}
      {documents === null ? (
        <div className="space-y-2">{[0, 1].map((key) => <Skeleton key={key} className="h-12" />)}</div>
      ) : documents.length === 0 ? (
        <EmptyState
          title="보관함에 증빙 파일이 없습니다"
          description="서류 보관함의 '증빙서류' 폴더에 세금계산서·이체확인증 등을 올리면 여기에서 고를 수 있습니다."
          action={<LinkButton href="/workspace/vault">서류 보관함 열기</LinkButton>}
        />
      ) : (
        <div className="space-y-2">
          {documents.map((document) => {
            const checked = selected.includes(document.id);
            return (
              <button
                key={document.id}
                type="button"
                onClick={() => onToggle(document.id)}
                aria-pressed={checked}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-3 text-left",
                  focusRing,
                  "transition-colors",
                  checked ? "border-[#16A34A] bg-[#F0FDF4]" : "border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]",
                )}
              >
                <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded border", checked ? "border-[#16A34A] bg-[#16A34A] text-white" : "border-[#CBD5E1]")}>
                  {checked && <Check size={13} />}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">{document.fileName}</span>
                <StatusBadge tone="slate">v{document.version}</StatusBadge>
                <span className="hidden shrink-0 text-xs text-[#94A3B8] sm:inline">{document.createdAt.slice(0, 10)}</span>
              </button>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function PrecheckPanel() {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  // 비목별 배정 잔액을 검증기에 넘겨 "한도 초과"를 제출 전에 잡습니다.
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([]);
  // 전송 중 재클릭 차단. 없으면 같은 집행 건이 매니저 큐에 두 번 쌓입니다.
  const [requesting, setRequesting] = useState(false);

  const request = async (expense: Record<string, unknown>, verdict: { verdict: "pass" | "review" | "fail"; findings: unknown[]; missingEvidence: string[] }) => {
    if (requesting) return;
    setRequesting(true);
    try {
      await requestSettlementReview({
        title: (expense.title as string) || "정산 건",
        amount: Number(expense.amount) || 0,
        verdict,
        expense,
        documentIds,
      });
      setSubmitted(true);
      setDocumentIds([]);
      toast.show(
        documentIds.length
          ? `검토 요청과 증빙 ${documentIds.length}개를 매니저 큐로 전달했습니다.`
          : "검토 요청이 매니저 큐로 전달되었습니다.",
      );
    } catch (reason) {
      toast.show(toMessage(reason, "검토 요청에 실패했습니다."), "error");
    } finally {
      setRequesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {toast.node}
      {submitted && (
        <Notice tone="success" onDismiss={() => setSubmitted(false)}>
          검토 요청을 접수했습니다.{" "}
          <Link href="/workspace/tracker" className="underline underline-offset-2">상태 트래커에서 진행 상황 보기</Link>
        </Notice>
      )}
      <BudgetPanel onChange={setBudgetLines} />
      <EvidenceFilePicker
        selected={documentIds}
        onToggle={(documentId) =>
          setDocumentIds((current) => (current.includes(documentId) ? current.filter((id) => id !== documentId) : [...current, documentId]))
        }
      />
      <ExpenseValidator
        budgetLines={budgetLines}
        requestPending={requesting}
        onRequestReview={(expense, verdict) =>
          void request(expense as unknown as Record<string, unknown>, { verdict: verdict.verdict, findings: verdict.findings, missingEvidence: verdict.missingEvidence })
        }
      />
    </div>
  );
}

/** 버전별 점수 추이. 개선이 눈에 보여야 다시 진단할 이유가 생깁니다. */
function BizPlanHistory({ entries }: { entries: BizplanHistoryEntry[] }) {
  if (entries.length === 0) return null;
  const best = Math.max(...entries.map((entry) => entry.score), 1);
  const latest = entries[entries.length - 1];
  const previous = entries.length > 1 ? entries[entries.length - 2] : null;
  const delta = previous ? latest.score - previous.score : null;

  return (
    <Panel
      title="진단 이력"
      action={
        delta !== null ? (
          <StatusBadge tone={delta > 0 ? "green" : delta < 0 ? "red" : "slate"}>
            {delta > 0 ? `+${delta}점` : delta < 0 ? `${delta}점` : "변화 없음"}
          </StatusBadge>
        ) : undefined
      }
    >
      <div className="flex items-end gap-2">
        {entries.map((entry, index) => (
          <div key={entry.createdAt} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            <span className="text-xs font-bold tabular-nums text-[#0F172A]">{entry.score}</span>
            <div
              className={cn("w-full rounded-t-md", index === entries.length - 1 ? "bg-[#2563EB]" : "bg-[#BFDBFE]")}
              style={{ height: `${Math.max(8, (entry.score / best) * 96)}px` }}
            />
            <span className="w-full truncate text-center text-[11px] text-[#94A3B8]">v{index + 1}</span>
            <span className="w-full truncate text-center text-[11px] text-[#94A3B8]">{entry.createdAt.slice(5, 10)}</span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-1.5 text-sm text-[#475569]">
        <TrendingUp size={14} className="text-[#2563EB]" />
        최근 진단 <strong className="tabular-nums text-[#0F172A]">{latest.score}점</strong>
        {delta !== null && delta !== 0 && <span>· 직전 대비 {delta > 0 ? "상승" : "하락"}</span>}
      </p>
    </Panel>
  );
}

function BizPlanCard() {
  const [events, setEvents] = useState<string[] | null>(null);
  const [invites, setInvites] = useState(0);
  const [history, setHistory] = useState<BizplanHistoryEntry[]>([]);

  const reload = useCallback(() => {
    getBizplanDiagnosisEvents().then(setEvents).catch(() => setEvents([]));
    getAcceptedInviteCount().then(setInvites).catch(() => setInvites(0));
    getBizplanHistory().then(setHistory).catch(() => setHistory([]));
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const usage = getMonthlyDiagnosticUsage(events ?? [], undefined, invites);
  const loading = events === null;

  return (
    <div className="space-y-5">
      <Panel
        title="사업계획서 AI 진단"
        action={
          <StatusBadge tone={loading ? "slate" : usage.isExhausted ? "amber" : "blue"}>
            {loading ? "확인 중" : usage.isExhausted ? "이번 달 무료 소진" : `잔여 ${usage.remaining}/${usage.total}회`}
          </StatusBadge>
        }
      >
        {invites > 0 && (
          <p className="mb-3 rounded-xl bg-[#F0FDF4] p-3 text-sm font-semibold text-[#16A34A]">
            팀원 {invites}명이 초대로 합류해 이번 달 진단이 {invites}회 늘었습니다.
          </p>
        )}
        {/* 소진 상태여도 실행기를 걷어내지 않습니다. 마지막 회차 결과가 그 자리에서 사라지면 안 됩니다. */}
        <AiDiagnosisRunner exhausted={!loading && usage.isExhausted} onComplete={reload} />
      </Panel>
      <BizPlanHistory entries={history} />
    </div>
  );
}

const MIN_BIZPLAN_LENGTH = 100;

/**
 * 모델이 돌려주는 키는 영문입니다. 화면에는 공고문에서 쓰는 PSST 용어로 보여 줍니다.
 *
 * 아이콘은 장식이 아니라 축을 구분하는 표식입니다. 같은 모양을 반복하면 네 칸이
 * 한 덩어리로 보여서, 축마다 성격이 드러나는 그림을 각각 붙였습니다.
 */
const PSST_META: Record<string, { label: string; short: string; Icon: LucideIcon }> = {
  problem: { label: "문제인식", short: "Problem", Icon: ScanSearch },
  solution: { label: "실현가능성", short: "Solution", Icon: Wrench },
  scale_up: { label: "성장전략", short: "Scale-up", Icon: Rocket },
  team: { label: "팀구성", short: "Team", Icon: Users },
};

const SWOT_META: Record<string, { label: string; Icon: LucideIcon; tone: string; ring: string }> = {
  strength: { label: "강점", Icon: Zap, tone: "text-[#16A34A]", ring: "border-[#BBF7D0] bg-[#F0FDF4]" },
  weakness: { label: "약점", Icon: AlertTriangle, tone: "text-[#B45309]", ring: "border-[#FDE68A] bg-[#FFFBEB]" },
  opportunity: { label: "기회", Icon: Target, tone: "text-[#2563EB]", ring: "border-[#BFDBFE] bg-[#EFF6FF]" },
  threat: { label: "위협", Icon: ShieldAlert, tone: "text-[#DC2626]", ring: "border-[#FECACA] bg-[#FEF2F2]" },
};

/** 점수 구간별 색. 숫자만 보여 주면 78점이 좋은 건지 알 수 없습니다. */
const scoreTone = (score: number, max = 100) => {
  const ratio = score / max;
  if (ratio >= 0.7) return { stroke: "#16A34A", text: "text-[#16A34A]", label: "양호" };
  if (ratio >= 0.4) return { stroke: "#B45309", text: "text-[#B45309]", label: "보완 필요" };
  return { stroke: "#DC2626", text: "text-[#DC2626]", label: "미흡" };
};

/** 합격 준비도 게이지. 원 하나로 "지금 어디쯤인지"를 먼저 보여 줍니다. */
function ScoreGauge({ score }: { score: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const tone = scoreTone(score);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[104px] w-[104px] shrink-0">
        <svg viewBox="0 0 104 104" className="h-full w-full -rotate-90" aria-hidden>
          <circle cx="52" cy="52" r={radius} fill="none" stroke="#E2E8F0" strokeWidth="8" />
          <circle
            cx="52"
            cy="52"
            r={radius}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - Math.max(0, Math.min(100, score)) / 100)}
            className="transition-[stroke-dashoffset] duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <span className={cn("text-2xl font-bold tabular-nums", tone.text)}>{score}</span>
          <span className="text-[11px] font-semibold text-[#94A3B8]">/ 100</span>
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-[#0F172A]">합격 준비도</p>
        <p className={cn("mt-1 text-sm font-semibold", tone.text)}>{tone.label}</p>
        <p className="mt-1 text-xs leading-5 text-[#94A3B8]">PSST 4축 합산 · AI 추정</p>
      </div>
    </div>
  );
}

const MAX_ATTACH_BYTES = 4 * 1024 * 1024;

/** 첨부 파일 한 줄. 무엇을 올렸고 어떻게 빼는지가 보여야 합니다. */
function AttachedFile({ file, onClear, disabled }: { file: File; onClear: () => void; disabled: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
      <FileText size={18} className="shrink-0 text-[#2563EB]" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-[#0F172A]">{file.name}</p>
        <p className="text-xs text-[#475569]">{(file.size / 1024 / 1024).toFixed(2)}MB · 이 파일로 진단합니다</p>
      </div>
      <IconButton label="첨부 취소" icon={<X size={15} />} onClick={onClear} disabled={disabled} />
    </div>
  );
}

function AiDiagnosisRunner({ exhausted, onComplete }: { exhausted: boolean; onComplete: () => void }) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    psst: Record<string, { score: number; evidence: string }>;
    actions: string[];
    swot: Record<string, string[]>;
    model: string;
    totalScore?: number;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const shortText = text.trim().length < MIN_BIZPLAN_LENGTH;
  // 파일이 있으면 파일이 이깁니다. 둘 다 보내면 무엇을 진단했는지 설명할 수 없습니다.
  const canRun = file !== null || !shortText;

  const pick = (next: File | null) => {
    setError(null);
    if (!next) { setFile(null); return; }
    if (!next.type.includes("pdf") && !next.name.toLowerCase().endsWith(".pdf")) {
      setError("PDF 파일만 첨부할 수 있습니다. 한글(HWP)·워드 문서는 PDF로 내보낸 뒤 올려 주세요.");
      return;
    }
    if (next.size > MAX_ATTACH_BYTES) {
      setError(`파일이 너무 큽니다. 최대 4MB까지 첨부할 수 있습니다. (현재 ${(next.size / 1024 / 1024).toFixed(1)}MB)`);
      return;
    }
    setFile(next);
  };

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const response = file
        ? await fetch("/api/workspace/diagnoses/bizplan", {
            method: "POST",
            headers,
            body: (() => { const form = new FormData(); form.append("file", file); return form; })(),
          })
        : await fetch("/api/workspace/diagnoses/bizplan", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...headers },
            body: JSON.stringify({ text }),
          });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "AI 진단에 실패했습니다.");
      setResult(data);
      // 사용 이력은 서버가 남깁니다. 개발용 진입 모드에만 로컬 기록이 필요합니다.
      if (DEV_BYPASS) await trackWorkspaceEvent("bizplan_diagnosis", undefined, { model: data.model });
      onComplete();
    } catch (reason) {
      setError(toMessage(reason, "AI 진단에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {exhausted && (
        <Notice tone="warning">
          이번 달 무료 진단을 모두 사용했습니다. 다음 달 1일에 초기화됩니다. 그동안은 자격 진단과 보관함을 활용해 주세요.
        </Notice>
      )}

      {file ? (
        <AttachedFile file={file} onClear={() => pick(null)} disabled={loading} />
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            disabled={exhausted || loading}
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); pick(event.dataTransfer.files?.[0] ?? null); }}
            className={cn(
              "flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed px-5 py-7 text-center",
              interactive,
              focusRing,
              "disabled:pointer-events-none disabled:opacity-40",
              dragging ? "border-[#2563EB] bg-[#EFF6FF]" : "border-[#CBD5E1] hover:border-[#2563EB] hover:bg-[#F8FAFC]",
            )}
          >
            <Upload size={20} className={cn(interactive, dragging ? "text-[#2563EB]" : "text-[#94A3B8]")} />
            <span className="text-sm font-bold text-[#0F172A]">사업계획서 PDF 첨부</span>
            <span className="text-xs leading-5 text-[#94A3B8]">
              끌어다 놓거나 눌러서 선택 · 최대 4MB
              <br />
              글자를 선택할 수 있는 PDF여야 합니다. 스캔 이미지는 내용을 읽지 못합니다.
            </span>
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[#E2E8F0]" />
            <span className="text-xs font-semibold text-[#94A3B8]">또는 본문 붙여넣기</span>
            <span className="h-px flex-1 bg-[#E2E8F0]" />
          </div>

          <textarea
            value={text}
            disabled={exhausted}
            onChange={(event) => setText(event.target.value)}
            className={cn(textareaClass, "min-h-40")}
            placeholder="사업계획서 본문을 붙여 넣으세요. 문제인식·실현가능성·성장전략·팀구성 순서로 넣으면 판정이 정확해집니다."
          />
        </>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button loading={loading} disabled={!canRun || exhausted} icon={<Sparkles size={15} />} onClick={() => void run()}>
          {loading ? "분석 중…" : "AI 진단 실행"}
        </Button>
        {file ? (
          <span className="text-xs font-semibold text-[#94A3B8]">첨부 파일로 진단합니다</span>
        ) : (
          <span className={cn("text-xs font-semibold tabular-nums", shortText ? "text-[#B45309]" : "text-[#94A3B8]")}>
            {text.trim().length.toLocaleString()}자 {shortText ? `· ${MIN_BIZPLAN_LENGTH}자 이상 필요` : "· 실행 가능"}
          </span>
        )}
      </div>

      {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}

      {result && (
        <div className="animate-in space-y-5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <ScoreGauge score={result.totalScore ?? Object.values(result.psst ?? {}).reduce((sum, item) => sum + item.score, 0)} />
            <StatusBadge tone="blue"><Sparkles size={12} className="mr-1 inline" />{result.model} · AI 추정</StatusBadge>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(result.psst ?? {}).map(([key, item]) => {
              const meta = PSST_META[key];
              const tone = scoreTone(item.score, 25);
              const Icon = meta?.Icon ?? Sparkles;
              return (
                <div key={key} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
                  <div className="flex items-center gap-2">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#F1F5F9]", tone.text)}>
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm text-[#0F172A]">{meta?.label ?? key}</strong>
                      <span className="text-[11px] font-semibold text-[#94A3B8]">{meta?.short}</span>
                    </div>
                    <strong className={cn("shrink-0 text-sm tabular-nums", tone.text)}>{item.score}/25</strong>
                  </div>
                  <ProgressBar className="mt-3" value={(item.score / 25) * 100} tone={item.score >= 17 ? "green" : item.score >= 10 ? "amber" : "red"} />
                  <p className="mt-2 text-sm leading-6 text-[#475569]">{item.evidence}</p>
                </div>
              );
            })}
          </div>

          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <strong className="flex items-center gap-1.5 text-sm text-[#0F172A]">
              <Wrench size={15} className="text-[#2563EB]" />보완 액션
            </strong>
            <ul className="mt-2 space-y-1.5">
              {(result.actions ?? []).map((action) => (
                <li key={action} className="flex gap-2 text-sm leading-6 text-[#475569]">
                  <Check size={15} className="mt-1 shrink-0 text-[#2563EB]" />
                  <span className="min-w-0">{action}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(result.swot ?? {}).map(([key, items]) => {
              const meta = SWOT_META[key];
              const Icon = meta?.Icon ?? Sparkles;
              return (
                <div key={key} className={cn("rounded-xl border p-4", meta?.ring ?? "border-[#E2E8F0] bg-white")}>
                  <strong className={cn("flex items-center gap-1.5 text-sm", meta?.tone)}>
                    <Icon size={15} />{meta?.label ?? key}
                  </strong>
                  <p className="mt-1.5 text-sm leading-6 text-[#475569]">{items.join(" · ") || "—"}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-xs font-medium text-[#94A3B8]">AI 추정·참고용이며 합격 또는 선정 결과를 보장하지 않습니다.</p>
    </div>
  );
}

const CONNECT_TABS = [
  { tab: "team_building", label: "팀빌딩", desc: "필요한 포지션을 등록하고 매칭 순번을 기다립니다." },
  { tab: "mentor", label: "멘토", desc: "분야별 멘토 연결 프로그램 개설 시 우선 안내합니다." },
  { tab: "investment", label: "투자", desc: "기관 IR 프로그램이 열리면 먼저 알려드립니다." },
] as const;

function ConnectCard() {
  const [applied, setApplied] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 이미 신청한 탭을 복원합니다. 없으면 새로고침마다 "신청 완료"가 사라져 다시 누르게 됩니다.
  useEffect(() => {
    let mounted = true;
    getWaitlistEntries().then((rows) => { if (mounted) setApplied(rows); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const apply = async (tab: (typeof CONNECT_TABS)[number]["tab"]) => {
    setPending(tab);
    setError(null);
    try {
      await joinWaitlist(tab);
      setApplied((current) => (current.includes(tab) ? current : [...current, tab]));
    } catch (reason) {
      setError(toMessage(reason, "대기 신청을 저장하지 못했습니다."));
    } finally {
      setPending(null);
    }
  };

  return (
    <Panel title="연결 대기 신청" action={<StatusBadge tone="slate">준비 중인 기능</StatusBadge>}>
      <p className="mb-4 text-sm leading-6 text-[#475569]">
        실제 대기 신청만 집계합니다. 매칭 서비스는 기관 프로그램과 연동되기 전까지 제공하지 않습니다.
      </p>
      <div className="grid gap-3">
        {CONNECT_TABS.map((item) => {
          const done = applied.includes(item.tab);
          return (
            <div key={item.tab} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] p-4">
              <div className="min-w-0">
                <strong className="block text-sm font-bold text-[#0F172A]">{item.label}</strong>
                <span className="text-xs leading-5 text-[#475569]">{item.desc}</span>
              </div>
              <Button
                variant={done ? "secondary" : "secondary"}
                size="sm"
                loading={pending === item.tab}
                disabled={done}
                onClick={() => void apply(item.tab)}
                className={cn(done && "border-[#BBF7D0] bg-[#F0FDF4] text-[#16A34A] disabled:opacity-100")}
              >
                {done ? "신청 완료" : "대기 신청"}
              </Button>
            </div>
          );
        })}
      </div>
      {error && <div className="mt-4"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}
    </Panel>
  );
}

function ConvertPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const convert = async () => {
    setBusy(true);
    setError(null);
    try {
      await convertPrepTeam(code);
      setDone(true);
    } catch (reason) {
      setError(toMessage(reason, "기관 코드 확인에 실패했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <RequireFounderSession role="pre_founder">
      <WorkspaceShell role="pre_founder">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-6 md:p-8">
          <StatusBadge tone="green">합격 전환</StatusBadge>
          <h1 className="mt-4 text-[26px] font-bold md:text-[32px]">축하합니다. 기관 연결을 시작합니다</h1>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            기관 코드를 확인하면 준비 팀에서 협약 팀으로 <strong>단방향</strong> 전환됩니다. 되돌릴 수 없습니다.
          </p>

          <div className="mt-6">
            <Field label="기관 전환 코드" hint="주관기관 담당자에게 받은 8자리 코드입니다.">
              <input
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => { if (event.key === "Enter" && code.trim()) void convert(); }}
                className={cn(inputClass, "font-mono text-lg tracking-widest")}
                placeholder="ABCD1234"
                disabled={done}
              />
            </Field>
          </div>

          <div className="mt-5 rounded-xl bg-[#EFF6FF] p-4 text-sm leading-6 text-[#2563EB]">
            이관 항목: 서류 보관함 파일, 팀원. TODO·진단 점수·초안은 준비 팀 내부에 남아 기관에 공개되지 않습니다.
          </div>

          {error && <div className="mt-4"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}

          {done ? (
            <LinkButton href="/workspace" size="lg" className="mt-6 bg-[#16A34A] hover:bg-[#15803D] active:bg-[#166534]">
              선정 팀 워크스페이스로 이동
            </LinkButton>
          ) : (
            <Button size="lg" className="mt-6" loading={busy} disabled={!code.trim()} onClick={() => void convert()}>
              연결 확인
            </Button>
          )}
        </div>
      </WorkspaceShell>
    </RequireFounderSession>
  );
}

export { FounderCore, FounderFeaturePage, ConvertPage };
