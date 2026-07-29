import { supabase } from "../supabase";
import type { EligibilityAnswers, EligibilityReport, StartupRole } from "@/features/startup-workspace/domain";
import type { TaskStatus } from "@/features/startup-workspace/domain";
import type { ManagerSubmissionInput } from "@/features/startup-workspace/types";
import type { ExpenseVerdict } from "@/features/expense-rules/types";
import { createMilestones, evaluateEligibility } from "../../features/startup-workspace/rules";
import { DEV_BYPASS } from "../dev/devMode";

export interface StartupProfile {
  id: string;
  role: StartupRole;
  onboardingComplete: boolean;
  institutionId: string | null;
}

export interface OnboardingInput {
  fullName: string;
  position: string;
  teamName: string;
  itemSummary: string;
  industry: string;
  programIds: string[];
  teamBuildingIntent: boolean;
  desiredPositions: string[];
}

export const requireClient = () => {
  if (!supabase) throw new Error("Supabase 연결 정보가 없습니다. .env.local을 확인하세요.");
  return supabase;
};

export function resolveWorkspaceDestination(profile: Pick<StartupProfile, "role" | "onboardingComplete">) {
  if (profile.role === "manager") return "/manager";
  if (profile.role === "founder") return "/workspace";
  return profile.onboardingComplete ? "/founder" : "/onboarding";
}

export async function getStartupProfile(): Promise<StartupProfile | null> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devProfile();
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) return null;
  const { data, error } = await client
    .from("startup_profiles")
    .select("id, role, onboarding_complete, institution_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    role: data.role as StartupRole,
    onboardingComplete: data.onboarding_complete,
    institutionId: data.institution_id,
  };
}

export async function completeOnboarding(input: OnboardingInput) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devCompleteOnboarding();
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const { data: profile, error: profileError } = await client
    .from("startup_profiles")
    .select("role")
    .eq("id", auth.user.id)
    .single();
  if (profileError) throw profileError;
  if (profile.role !== "pre_founder") throw new Error("창업자 준비 계정만 온보딩을 완료할 수 있습니다.");

  const { data: team, error: teamError } = await client
    .from("prep_teams")
    .insert({ name: input.teamName, item_summary: input.itemSummary, industry: input.industry, leader_id: auth.user.id })
    .select("id")
    .single();
  if (teamError) throw teamError;

  const { error: memberError } = await client
    .from("prep_team_members")
    .insert({ prep_team_id: team.id, user_id: auth.user.id, member_role: "leader" });
  if (memberError) throw memberError;

  if (input.programIds.length) {
    const { error: projectError } = await client
      .from("prep_projects")
      .insert(input.programIds.map((programId) => ({ prep_team_id: team.id, program_id: programId })));
    if (projectError) throw projectError;

    const { data: projects, error: projectsError } = await client
      .from("prep_projects")
      .select("id, program_id")
      .eq("prep_team_id", team.id)
      .in("program_id", input.programIds);
    if (projectsError) throw projectsError;
    const { data: programRows, error: programsError } = await client
      .from("programs")
      .select("id, deadline")
      .in("id", input.programIds);
    if (programsError) throw programsError;
    const deadlineByProgram = new Map((programRows ?? []).map((program) => [program.id, program.deadline]));
    const automaticTasks = (projects ?? []).flatMap((project) => {
      const deadline = deadlineByProgram.get(project.program_id);
      return deadline ? createMilestones(project.id, new Date(`${deadline}T00:00:00Z`)).map((task) => ({
        prep_team_id: team.id,
        prep_project_id: project.id,
        title: task.title,
        due_date: task.dueDate,
        task_type: task.taskType,
      })) : [];
    });
    if (automaticTasks.length) {
      const { error: taskError } = await client.from("workspace_tasks").insert(automaticTasks);
      if (taskError) throw taskError;
    }
    const reports = (projects ?? []).map((project) => {
      const report = evaluateEligibility(project.program_id, { hasBusinessRegistration: null });
      return { prep_team_id: team.id, report_type: "eligibility", state: report.state, score: report.score, result: report, created_by: auth.user.id };
    });
    if (reports.length) {
      const { error: reportError } = await client.from("diagnosis_reports").insert(reports);
      if (reportError) throw reportError;
      await trackWorkspaceEvent("diagnosis_complete", team.id, { programIds: input.programIds, automatic: true });
    }
  }

  const { error: updateError } = await client
    .from("startup_profiles")
    .update({ position: input.position, team_building_intent: input.teamBuildingIntent, desired_positions: input.desiredPositions, onboarding_complete: true })
    .eq("id", auth.user.id);
  if (updateError) throw updateError;

  await trackWorkspaceEvent("onboarding_complete", team.id, { programIds: input.programIds });
  return { teamId: team.id, redirect: "/founder" };
}

export async function trackWorkspaceEvent(eventName: string, prepTeamId?: string, payload: Record<string, unknown> = {}) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devTrackEvent(eventName);
  const client = requireClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return;
  const { error } = await client.from("workspace_events").insert({
    user_id: auth.user.id,
    prep_team_id: prepTeamId ?? null,
    event_name: eventName,
    payload,
  });
  if (error) throw error;
}

export async function joinWaitlist(tab: "team_building" | "mentor" | "investment") {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devWaitlistJoin(tab);
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("대기 신청에는 로그인이 필요합니다.");
  const { error } = await client.from("waitlist_entries").upsert({ user_id: auth.user.id, tab }, { onConflict: "user_id,tab" });
  if (error) throw error;
  await trackWorkspaceEvent("waitlist_join", undefined, { tab });
}

export async function captureLead(email: string, source: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("유효한 이메일 주소를 입력해 주세요.");
  if (DEV_BYPASS) return;
  const client = requireClient();
  const { data: auth } = await client.auth.getUser();
  const { error } = await client.from("leads").insert({
    email: normalizedEmail,
    source,
    consented_at: new Date().toISOString(),
    user_id: auth.user?.id ?? null,
  });
  if (error) throw error;
  await trackWorkspaceEvent("calc_pdf_email_submitted", undefined, { source });
}

export async function convertPrepTeam(code: string) {
  if (DEV_BYPASS) return code.trim().toUpperCase();
  const client = requireClient();
  const { data, error } = await client.rpc("convert_prep_team", { input_code: code.trim() });
  if (error) throw error;
  return data as string;
}

export interface PersistedTask {
  id: string;
  title: string;
  due_date: string | null;
  status: TaskStatus;
  task_type: "auto" | "custom";
  is_hidden: boolean;
}

/** 창업자가 제출 시 저장한 사전검증 결과를 매니저 화면에서 그대로 재사용합니다. */
export type ManagerReviewSubmission = ManagerSubmissionInput & { verdict?: ExpenseVerdict };

function getStoredVerdict(payload: Record<string, unknown> | null): ExpenseVerdict | undefined {
  const verdict = payload?.verdict as Partial<ExpenseVerdict> | undefined;
  return verdict && Array.isArray(verdict.findings) ? (verdict as ExpenseVerdict) : undefined;
}

type RawSubmission = {
  id: string;
  title: string;
  requested_amount: number | string;
  validation_status: "pending" | "passed" | "failed";
  status: "draft" | "validated" | "in_review" | "approved" | "rejected";
  payload: Record<string, unknown> | null;
  created_at: string;
  founder_teams?: unknown;
};

function firstObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return firstObject(value[0]);
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function formatWon(value: number | string) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  return `${new Intl.NumberFormat("ko-KR").format(numericValue)}원`;
}

function getEvidenceCount(payload: Record<string, unknown> | null) {
  if (!payload) return 0;
  if (typeof payload.evidenceCount === "number") return payload.evidenceCount;
  if (Array.isArray(payload.evidence)) return payload.evidence.length;
  if (Array.isArray(payload.documents)) return payload.documents.length;
  return 0;
}

function getTeamName(row: RawSubmission) {
  const founderTeam = firstObject(row.founder_teams);
  const prepTeam = firstObject(founderTeam?.prep_teams);
  const nestedName = prepTeam?.name;
  if (typeof nestedName === "string" && nestedName.trim()) return nestedName;
  const payloadTeam = row.payload?.teamName;
  if (typeof payloadTeam === "string" && payloadTeam.trim()) return payloadTeam;
  return "팀명 없음";
}

export async function getCurrentPrepTeamId() {
  if (DEV_BYPASS) return "dev-team";
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const { data, error } = await client.from("prep_team_members").select("prep_team_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("준비 팀을 먼저 설정해 주세요.");
  return data.prep_team_id as string;
}

export async function getWorkspaceTasks() {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devTasks();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("workspace_tasks").select("id,title,due_date,status,task_type,is_hidden").eq("prep_team_id", teamId).eq("is_hidden", false).order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PersistedTask[];
}

export async function getManagerReviewSubmissions(): Promise<ManagerReviewSubmission[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devManagerSubmissions();
  const client = requireClient();
  const { data, error } = await client
    .from("settlement_submissions")
    .select("id,title,requested_amount,validation_status,status,payload,created_at,founder_teams(prep_teams(name))")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as RawSubmission[]).map((row) => ({
    id: row.id,
    title: row.title,
    team: getTeamName(row),
    amount: formatWon(row.requested_amount),
    evidenceCount: getEvidenceCount(row.payload),
    role: "founder",
    status: row.status,
    validation: row.validation_status,
    createdAt: row.created_at,
    verdict: getStoredVerdict(row.payload),
  }));
}

async function getCurrentFounderTeamId() {
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("founder_teams").select("id").eq("prep_team_id", teamId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("협약 팀으로 전환된 뒤에 정산 검토를 요청할 수 있습니다.");
  return data.id as string;
}

/** 사전검증을 통과한 집행 건을 매니저 검토 큐로 올립니다. */
export async function requestSettlementReview(input: {
  title: string;
  amount: number;
  verdict: { verdict: "pass" | "review" | "fail"; findings: unknown[]; missingEvidence: string[] };
  expense: Record<string, unknown>;
}) {
  if (input.verdict.verdict === "fail") throw new Error("위반 항목이 남아 있어 검토를 요청할 수 없습니다.");
  if (DEV_BYPASS) return (await import("../dev/devServices")).devRequestReview(input);
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const founderTeamId = await getCurrentFounderTeamId();
  const { data, error } = await client
    .from("settlement_submissions")
    .insert({
      founder_team_id: founderTeamId,
      title: input.title,
      requested_amount: input.amount,
      validation_status: "passed",
      status: "validated",
      payload: { expense: input.expense, verdict: input.verdict, evidenceCount: (input.expense.evidence as string[] | undefined)?.length ?? 0 },
      submitted_by: auth.user.id,
    })
    .select("id")
    .single();
  if (error) throw error;
  await trackWorkspaceEvent("settlement_review_requested", undefined, { submissionId: data.id, verdict: input.verdict.verdict });
  return data.id as string;
}

const REVIEW_ERRORS: Record<string, string> = {
  DECISION_INVALID: "승인 또는 반려만 처리할 수 있습니다.",
  REASON_CODE_REQUIRED: "반려 사유코드를 1개 이상 선택해 주세요.",
  SUBMISSION_NOT_REVIEWABLE: "이미 처리되었거나 검토할 수 없는 건입니다.",
  MANAGER_ROLE_REQUIRED: "해당 기관의 매니저만 처리할 수 있습니다.",
};

/**
 * 매니저 승인·반려 처리. 검토 기록 저장과 상태 변경을 하나의 RPC로 묶어
 * 한쪽만 반영되는 상태를 막고, 판정 근거와 안내문을 감사 기록으로 남깁니다.
 */
export async function submitReviewDecision(
  submissionId: string,
  decision: "approved" | "rejected",
  payload: { reasonCodes: string[]; feedback: string },
) {
  if (decision === "rejected" && payload.reasonCodes.length === 0) throw new Error(REVIEW_ERRORS.REASON_CODE_REQUIRED);
  if (DEV_BYPASS) return (await import("../dev/devServices")).devReviewDecision(submissionId, decision, payload);
  const client = requireClient();
  const { data, error } = await client.rpc("review_settlement_submission", {
    input_submission_id: submissionId,
    input_decision: decision,
    input_reason_code: payload.reasonCodes.join(","),
    input_feedback: payload.feedback,
  });
  if (error) {
    const known = Object.keys(REVIEW_ERRORS).find((code) => error.message.includes(code));
    throw new Error(known ? REVIEW_ERRORS[known] : error.message);
  }
  await trackWorkspaceEvent("settlement_reviewed", undefined, { submissionId, decision, reasonCodes: payload.reasonCodes });
  return data as string;
}

export interface SavedEligibilityReport {
  programId: string;
  answers: EligibilityAnswers;
  report: EligibilityReport;
  createdAt: string;
}

/** 자격 진단 결과를 팀 단위로 저장합니다. 준비 팀이 없으면 저장만 건너뜁니다. */
export async function saveEligibilityReport(programId: string, answers: EligibilityAnswers, report: EligibilityReport) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devSaveEligibility(programId, answers, report);
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const teamId = await getCurrentPrepTeamId();
  const { error } = await client.from("diagnosis_reports").insert({
    prep_team_id: teamId,
    report_type: "eligibility",
    state: report.state,
    score: report.score,
    result: { programId, answers, report },
    created_by: auth.user.id,
  });
  if (error) throw error;
  await trackWorkspaceEvent("eligibility_diagnosis_saved", teamId, { programId, state: report.state });
}

/** 가장 최근 자격 진단을 복원합니다. 없으면 null. */
export async function getLatestEligibilityReport(): Promise<SavedEligibilityReport | null> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devLatestEligibility();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client
    .from("diagnosis_reports")
    .select("result, created_at")
    .eq("prep_team_id", teamId)
    .eq("report_type", "eligibility")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const result = data?.result as { programId?: string; answers?: EligibilityAnswers; report?: EligibilityReport } | undefined;
  if (!result?.report) return null;
  return {
    programId: result.programId ?? "",
    answers: result.answers ?? { hasBusinessRegistration: null },
    report: result.report,
    createdAt: data!.created_at as string,
  };
}

/** 이번 달 사업계획서 AI 진단 사용 이력. 무료 횟수 계산 입력입니다. */
export async function getBizplanDiagnosisEvents(): Promise<string[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devBizplanEvents();
  const client = requireClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return [];
  const { data, error } = await client
    .from("workspace_events")
    .select("created_at")
    .eq("user_id", auth.user.id)
    .eq("event_name", "bizplan_diagnosis")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => row.created_at as string);
}

export interface ManagerBootstrapResult {
  institutionId: string;
  institutionName: string;
  conversionCode: string;
}

/**
 * 허용목록에 등록된 계정을 기관 매니저로 승격합니다. 완제품 전 단계에서
 * SQL 수동 실행 없이 기관 화면을 실제 데이터로 확인하기 위한 경로입니다.
 */
export async function bootstrapManagerAccess(): Promise<ManagerBootstrapResult> {
  const client = requireClient();
  const { data } = await client.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  const response = await fetch("/api/admin/bootstrap-manager", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "기관 계정 전환에 실패했습니다.");
  return body as ManagerBootstrapResult;
}

/** 기간별 반려 사유 코드 목록 — 매니저 리포트의 사유 분포 계산 입력. */
export async function getRejectionReasonCodes(): Promise<string[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devRejectionReasonCodes();
  const client = requireClient();
  const { data, error } = await client.from("submission_reviews").select("reason_code").eq("decision", "rejected");
  if (error) throw error;
  return (data ?? []).flatMap((row) => String(row.reason_code ?? "").split(",")).filter(Boolean);
}

export async function createWorkspaceTask(title: string, dueDate?: string) {
  if (!title.trim()) throw new Error("할 일 제목을 입력해 주세요.");
  if (DEV_BYPASS) return (await import("../dev/devServices")).devCreateTask(title, dueDate);
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("workspace_tasks").insert({ prep_team_id: teamId, title: title.trim(), due_date: dueDate || null, task_type: "custom" }).select("id,title,due_date,status,task_type,is_hidden").single();
  if (error) throw error;
  return data as PersistedTask;
}

export async function updateWorkspaceTask(taskId: string, changes: Partial<Pick<PersistedTask, "status" | "is_hidden">>) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devUpdateTask(taskId, changes);
  const client = requireClient();
  const update: Record<string, unknown> = { ...changes, updated_at: new Date().toISOString() };
  if (changes.status === "done") update.completed_at = new Date().toISOString();
  const { data, error } = await client.from("workspace_tasks").update(update).eq("id", taskId).select("id,title,due_date,status,task_type,is_hidden").single();
  if (error) throw error;
  if (changes.status === "done") await trackWorkspaceEvent("todo_complete", undefined, { taskId });
  return data as PersistedTask;
}
