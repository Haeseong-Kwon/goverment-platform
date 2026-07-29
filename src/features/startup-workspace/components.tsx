"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, EyeOff, Loader2, Mail, Plus, Sparkles } from "lucide-react";
import { getDday, getFounderDashboardSummary, getMonthlyDiagnosticUsage } from "./logic";
import { EligibilityPanel } from "./EligibilityPanel";
import { CalendarPanel, IncorporationPanel, TeamSettingsPanel, TrackerPanel, VaultPanel } from "./FounderPanels";
import { RequireFounderSession, WorkspaceShell } from "./shell";
import { calculateInsurance } from "./rules";
import {
  captureLead,
  createWorkspaceTask,
  convertPrepTeam,
  getBizplanDiagnosisEvents,
  getWorkspaceTasks,
  joinWaitlist,
  requestSettlementReview,
  trackWorkspaceEvent,
  updateWorkspaceTask,
  type PersistedTask,
} from "@/lib/services/WorkspaceService";
import { Button, EmptyState, Field, LinkButton, Notice, PageHeader, Panel, Skeleton, StatusBadge, focusRing, inputClass, textareaClass, useToast } from "./ui";
import { ExpenseValidator } from "@/features/expense-rules/ExpenseValidator";
import { PreDeliberationPanel } from "@/features/expense-rules/PreDeliberation";
import { cn } from "@/lib/utils";

export const PRODUCT_NAME = "StartUp Pilot";

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

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
      setError(reason instanceof Error ? reason.message : "TODO를 불러오지 못했습니다.");
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
      setError(reason instanceof Error ? reason.message : "상태를 바꾸지 못했습니다.");
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
      setError(reason instanceof Error ? reason.message : "TODO를 추가하지 못했습니다.");
      return false;
    }
  }, []);

  return { tasks, loading: tasks === null, error, pendingId, reload: load, mutate, add, clearError: () => setError(null) };
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
function TaskCard({
  task,
  pending,
  moves,
  onToggle,
  onMove,
  onHide,
}: {
  task: PersistedTask;
  pending: boolean;
  moves: ReadonlyArray<{ status: PersistedTask["status"]; label: string }>;
  onToggle: () => void;
  onMove: (status: PersistedTask["status"]) => void;
  onHide: () => void;
}) {
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
    </article>
  );
}

function TaskBoard() {
  const { tasks, loading, error, pendingId, mutate, add } = useWorkspaceTasks();
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const rows = tasks ?? [];

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
        <div className="grid gap-4 lg:grid-cols-3">
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
                      moves={columns.filter((next) => next.status !== column.status).map((next) => ({ status: next.status, label: `${next.label}로` }))}
                      onToggle={() => void mutate(task, { status: task.status === "done" ? "todo" : "done" })}
                      onMove={(status) => void mutate(task, { status })}
                      onHide={() => void mutate(task, { is_hidden: true })}
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
  const rows = tasks ?? [];
  const summary = getFounderDashboardSummary(rows);
  const nextDday = getDday(summary.nextDueDate);
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
        <section className="grid gap-4 md:grid-cols-4">
          <div className={cn("rounded-2xl p-5 text-white md:col-span-2", overdue ? "bg-[#DC2626]" : "bg-[#2563EB]")}>
            <p className="text-sm font-semibold opacity-90">{overdue ? "기한이 지난 할 일" : "다음 마감"}</p>
            <h2 className="mt-2 text-2xl font-bold">
              {summary.nextDueDate
                ? `${summary.nextDueDate}${nextDday === null ? "" : nextDday < 0 ? ` · ${Math.abs(nextDday)}일 지남` : nextDday === 0 ? " · 오늘" : ` · D-${nextDday}`}`
                : "등록된 마감 없음"}
            </h2>
            <p className="mt-2 text-sm opacity-90">
              {overdue
                ? `지난 마감 ${overdueCount}건을 먼저 처리하거나 마감일을 조정하세요.`
                : `마감일이 있는 할 일 ${rows.filter((task) => task.due_date && task.status !== "done").length}건 기준 · 자동 생성 ${summary.automaticTasks}건`}
            </p>
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

type FounderFeature = "todo" | "calendar" | "diagnostics" | "calculator" | "incorporation" | "connect" | "vault" | "settings" | "precheck" | "predeliberation" | "tracker";

const FEATURE_META: Record<FounderFeature, { title: string; description: string }> = {
  todo: { title: "팀 TODO", description: "공고 마감 기준 자동 마일스톤과 직접 추가한 할 일을 함께 관리합니다." },
  calendar: { title: "마감 캘린더", description: "선택한 지원사업 공고 마감과 팀 할 일 마감을 한 달력에서 확인합니다." },
  diagnostics: { title: "AI 진단", description: "자격 요건을 룰셋으로 판정하고 사업계획서를 PSST 구조로 점검합니다." },
  calculator: { title: "4대보험 계산기", description: "인건비 집행 전 사업주 부담액을 미리 확인합니다." },
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
        {feature === "calculator" && <CalculatorCard />}
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

function PrecheckPanel() {
  const toast = useToast();
  const [submitted, setSubmitted] = useState(false);

  const request = async (expense: Record<string, unknown>, verdict: { verdict: "pass" | "review" | "fail"; findings: unknown[]; missingEvidence: string[] }) => {
    try {
      await requestSettlementReview({
        title: (expense.title as string) || "정산 건",
        amount: Number(expense.amount) || 0,
        verdict,
        expense,
      });
      setSubmitted(true);
      toast.show("검토 요청이 매니저 큐로 전달되었습니다.");
    } catch (reason) {
      toast.show(reason instanceof Error ? reason.message : "검토 요청에 실패했습니다.", "error");
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
      <ExpenseValidator
        onRequestReview={(expense, verdict) =>
          void request(expense as unknown as Record<string, unknown>, { verdict: verdict.verdict, findings: verdict.findings, missingEvidence: verdict.missingEvidence })
        }
      />
    </div>
  );
}

function ContributionBars({ items }: { items: Array<{ label: string; value: number; max: number }> }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-[#0F172A]">{item.label}</span>
            <span className="shrink-0 tabular-nums text-[#475569]">{won(item.value)}원</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#EFF6FF]">
            <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(100, (item.value / Math.max(1, item.max)) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const INSURANCE_LABELS: Record<string, string> = {
  nationalPension: "국민연금",
  healthInsurance: "건강보험",
  longTermCare: "장기요양",
  employmentInsurance: "고용보험",
  accidentInsurance: "산재보험",
};

function CalculatorCard() {
  const [emailOpen, setEmailOpen] = useState(false);
  const [salary, setSalary] = useState(3_000_000);
  const [people, setPeople] = useState(1);
  const result = calculateInsurance({ monthlySalary: salary, people, accidentRate: 0.007 });

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <Panel title="입력">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="월 급여 (1인)">
            <input type="number" min={0} step={100_000} value={salary || ""} onChange={(event) => setSalary(Math.max(0, Number(event.target.value)))} className={inputClass} />
          </Field>
          <Field label="인원">
            <input type="number" min={1} value={people} onChange={(event) => setPeople(Math.max(1, Number(event.target.value)))} className={inputClass} />
          </Field>
        </div>
        <p className="mt-3 text-sm text-[#475569]">과세 대상 급여 총액 <strong className="tabular-nums text-[#0F172A]">{won(salary * people)}원</strong></p>
        <p className="mt-4 rounded-xl bg-[#FEF2F2] p-3 text-[13px] font-semibold leading-6 text-[#DC2626]">
          산재보험료율은 업종별로 달라 0.7%를 가정했습니다. 실제 신고 전 전문가 확인이 필요합니다.
        </p>
      </Panel>

      <div className="space-y-5">
        <Panel title="사업주 월 부담" action={<StatusBadge tone="blue">참고용 추정</StatusBadge>}>
          <strong className="block text-3xl font-bold tabular-nums text-[#0F172A]">{won(result.employerTotal)}원</strong>
          <div className="mt-5">
            <ContributionBars
              items={Object.entries(result.employer).map(([key, value]) => ({
                label: INSURANCE_LABELS[key] ?? key,
                value,
                max: result.employerTotal,
              }))}
            />
          </div>
        </Panel>

        <Panel title="근로자 월 공제">
          <strong className="block text-2xl font-bold tabular-nums text-[#0F172A]">{won(result.workerTotal)}원</strong>
          <p className="mt-2 text-sm text-[#475569]">실수령액 추정 <strong className="tabular-nums text-[#0F172A]">{won(Math.max(0, salary * people - result.workerTotal))}원</strong></p>
          <Button className="mt-5" onClick={() => setEmailOpen(true)} icon={<Mail size={14} />}>계산 결과 이메일로 받기</Button>
        </Panel>
      </div>

      {emailOpen && <EmailCaptureModal onClose={() => setEmailOpen(false)} />}
    </div>
  );
}

function EmailCaptureModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await captureLead(email, "calc_insurance");
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-4">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0" />
      <div role="dialog" aria-modal="true" className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <Mail className="text-[#2563EB]" />
        <h2 className="mt-3 text-2xl font-bold">이메일로 자료 받기</h2>
        <p className="mt-2 text-sm leading-6 text-[#475569]">계산 결과와 자료실 다운로드 이력을 기록합니다. 수신 동의 후 저장됩니다.</p>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") void submit(); }}
          className={inputClass}
          placeholder="founder@example.com"
        />
        {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>닫기</Button>
          <Button loading={saving} disabled={!email.trim()} onClick={() => void submit()}>받기</Button>
        </div>
      </div>
    </div>
  );
}

function BizPlanCard() {
  const [events, setEvents] = useState<string[] | null>(null);
  const reload = useCallback(() => { getBizplanDiagnosisEvents().then(setEvents).catch(() => setEvents([])); }, []);
  useEffect(() => { reload(); }, [reload]);

  const usage = getMonthlyDiagnosticUsage(events ?? []);
  const loading = events === null;

  return (
    <Panel
      title="사업계획서 AI 진단"
      action={<StatusBadge tone={loading ? "slate" : usage.isExhausted ? "amber" : "blue"}>{loading ? "확인 중" : usage.isExhausted ? "이번 달 무료 소진" : `잔여 ${usage.remaining}/2회`}</StatusBadge>}
    >
      {!loading && usage.isExhausted ? (
        <EmptyState title="이번 달 무료 진단을 모두 사용했습니다" description="다음 달 1일에 2회로 초기화됩니다. 그동안은 자격 진단과 보관함을 활용해 주세요." />
      ) : (
        <AiDiagnosisRunner onComplete={reload} />
      )}
    </Panel>
  );
}

const MIN_BIZPLAN_LENGTH = 100;

function AiDiagnosisRunner({ onComplete }: { onComplete: () => void }) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ psst: Record<string, { score: number; evidence: string }>; actions: string[]; swot: Record<string, string[]>; model: string } | null>(null);
  const short = text.trim().length < MIN_BIZPLAN_LENGTH;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace/diagnoses/bizplan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setResult(data);
      await trackWorkspaceEvent("bizplan_diagnosis", undefined, { model: data.model });
      onComplete();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "AI 진단에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        className={cn(textareaClass, "min-h-40")}
        placeholder="사업계획서 본문을 붙여 넣으세요. 문제인식·실현가능성·성장전략·팀구성 순서로 넣으면 판정이 정확해집니다."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button loading={loading} disabled={short} onClick={() => void run()}>
          {loading ? "분석 중…" : "AI 진단 실행"}
        </Button>
        <span className={cn("text-xs font-semibold tabular-nums", short ? "text-[#B45309]" : "text-[#94A3B8]")}>
          {text.trim().length.toLocaleString()}자 {short ? `· ${MIN_BIZPLAN_LENGTH}자 이상 필요` : "· 실행 가능"}
        </span>
      </div>

      {error && <Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice>}

      {result && (
        <div className="space-y-4 rounded-xl bg-[#F8FAFC] p-4">
          <StatusBadge tone="blue">{result.model} · AI 추정</StatusBadge>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(result.psst).map(([key, item]) => (
              <div key={key} className="rounded-lg bg-white p-3">
                <strong className="text-sm">{key} {item.score}/25</strong>
                <div className="mt-2 h-2 rounded-full bg-[#EFF6FF]">
                  <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(100, (item.score / 25) * 100)}%` }} />
                </div>
                <p className="mt-2 text-sm leading-6 text-[#475569]">{item.evidence}</p>
              </div>
            ))}
          </div>
          <div>
            <strong className="text-sm">보완 액션</strong>
            <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-[#475569]">
              {result.actions.map((action) => <li key={action}>{action}</li>)}
            </ul>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(result.swot).map(([key, items]) => (
              <div key={key} className="rounded-lg bg-white p-3 text-sm">
                <strong>{key.toUpperCase()}</strong>
                <p className="mt-1 leading-6 text-[#475569]">{items.join(" · ")}</p>
              </div>
            ))}
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

  const apply = async (tab: (typeof CONNECT_TABS)[number]["tab"]) => {
    setPending(tab);
    setError(null);
    try {
      await joinWaitlist(tab);
      setApplied((current) => (current.includes(tab) ? current : [...current, tab]));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "대기 신청을 저장하지 못했습니다.");
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
      setError(reason instanceof Error ? reason.message : "기관 코드 확인에 실패했습니다.");
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
