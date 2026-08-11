import { supabase } from "../supabase";
import type { EligibilityAnswers, EligibilityReport, StartupRole } from "@/features/startup-workspace/domain";
import type { TaskStatus } from "@/features/startup-workspace/domain";
import type { ManagerSubmissionInput } from "@/features/startup-workspace/types";
import type { ExpenseInput, ExpenseVerdict } from "@/features/expense-rules/types";
import { createMilestones, evaluateEligibility } from "../../features/startup-workspace/rules";
import { DEV_BYPASS } from "../dev/devMode";
import { cached, getAuthUserId, invalidateProfileCache, invalidateTeamCache, requireAuthUserId } from "./sessionCache";

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

/** 서버 라우트 호출에 붙일 인증 헤더. 개발용 진입 모드에는 세션이 없어 빈 헤더를 돌려줍니다. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  if (DEV_BYPASS) return {};
  const { data } = await requireClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인이 필요합니다.");
  return { Authorization: `Bearer ${token}` };
}

export function resolveWorkspaceDestination(profile: Pick<StartupProfile, "role" | "onboardingComplete">) {
  if (profile.role === "manager") return "/manager";
  if (profile.role === "founder") return "/workspace";
  return profile.onboardingComplete ? "/founder" : "/onboarding";
}

export async function getStartupProfile(): Promise<StartupProfile | null> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devProfile();
  // 한 화면에서 게이트와 사이드바가 각각 물어봅니다. 캐시하지 않으면 같은 조회가 2~3번 납니다.
  return cached("startupProfile", async () => {
    const client = requireClient();
    const userId = await getAuthUserId();
    if (!userId) return null;
    const { data, error } = await client
      .from("startup_profiles")
      .select("id, role, onboarding_complete, institution_id")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      role: data.role as StartupRole,
      onboardingComplete: data.onboarding_complete,
      institutionId: data.institution_id,
    };
  });
}

export async function completeOnboarding(input: OnboardingInput) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devCompleteOnboarding();
  const client = requireClient();
  const userId = await requireAuthUserId();
  /**
   * 프로필 행이 없을 수 있습니다. 가입(signUp) 직후의 프로필 INSERT는 이메일 인증이
   * 걸린 프로젝트에서 세션이 없는 상태로 실행되므로 RLS(id = auth.uid())에 막히고,
   * 그 실패는 경고만 남기고 지나갑니다. 그러면 프로필 없이 /onboarding까지 들어와
   * 마지막 단계에서 PGRST116("대상을 찾지 못했습니다")으로 끝났습니다.
   * 여기서는 로그인 상태이므로 없으면 만들어 온보딩을 이어갑니다.
   */
  const { data: profile, error: profileError } = await client
    .from("startup_profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) {
    // role은 003의 INSERT 트리거가 pre_founder로 고정합니다. 재시도 중복(23505)은 성공으로 봅니다.
    const { error: createError } = await client
      .from("startup_profiles")
      .insert({ id: userId, role: "pre_founder", onboarding_complete: false });
    if (createError && createError.code !== "23505") throw createError;
  } else if (profile.role !== "pre_founder") {
    throw new Error("창업자 준비 계정만 온보딩을 완료할 수 있습니다.");
  }

  // 온보딩은 여러 번의 쓰기로 이뤄져 중간에 끊길 수 있습니다. 다시 시도할 때
  // 빈 팀이 계속 쌓이지 않도록, 내가 리더인 팀이 이미 있으면 그 팀을 이어서 씁니다.
  const { data: existingTeam, error: existingTeamError } = await client
    .from("prep_teams")
    .select("id")
    .eq("leader_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existingTeamError) throw existingTeamError;

  let team = existingTeam;
  if (team) {
    const { error: renameError } = await client
      .from("prep_teams")
      .update({ name: input.teamName, item_summary: input.itemSummary, industry: input.industry })
      .eq("id", team.id);
    if (renameError) throw renameError;
  } else {
    const { data: created, error: teamError } = await client
      .from("prep_teams")
      .insert({ name: input.teamName, item_summary: input.itemSummary, industry: input.industry, leader_id: userId })
      .select("id")
      .single();
    if (teamError) throw teamError;
    team = created;
  }

  /**
   * 리더 멤버 행. 여기서 upsert를 쓸 수 없습니다.
   * ON CONFLICT는 충돌한 기존 행을 읽어야 하므로 SELECT 정책까지 통과해야 하는데,
   * prep_team_members의 SELECT 정책은 `is_prep_team_member`라 "아직 멤버가 아닌"
   * 이 시점에 거짓입니다. 그래서 DO NOTHING·DO UPDATE 모두 RLS에 막힙니다.
   * 평범한 INSERT는 통과하므로, 재시도로 인한 중복(23505)만 성공으로 봅니다.
   */
  const { error: memberError } = await client
    .from("prep_team_members")
    .insert({ prep_team_id: team.id, user_id: userId, member_role: "leader" });
  if (memberError && memberError.code !== "23505") throw memberError;

  if (input.programIds.length) {
    // 재시도 시 UNIQUE (prep_team_id, program_id) 충돌로 멈추지 않게 이미 있는 건만 골라 넣습니다.
    // (멤버 행이 생긴 뒤라 prep_projects는 SELECT가 열려 있어 미리 조회할 수 있습니다.)
    const { data: linkedPrograms, error: linkedError } = await client
      .from("prep_projects")
      .select("program_id")
      .eq("prep_team_id", team.id);
    if (linkedError) throw linkedError;
    const alreadyLinked = new Set((linkedPrograms ?? []).map((row) => row.program_id));
    const newProgramIds = input.programIds.filter((programId) => !alreadyLinked.has(programId));

    if (newProgramIds.length) {
      const { error: projectError } = await client
        .from("prep_projects")
        .insert(newProgramIds.map((programId) => ({ prep_team_id: team.id, program_id: programId })));
      if (projectError && projectError.code !== "23505") throw projectError;
    }

    const { data: projects, error: projectsError } = await client
      .from("prep_projects")
      .select("id, program_id")
      .eq("prep_team_id", team.id)
      .in("program_id", input.programIds);
    if (projectsError) throw projectsError;

    // 자동 마일스톤은 프로젝트당 한 번만 만듭니다. 재시도해도 같은 할 일이 두 번 생기지 않습니다.
    const { data: existingAutoTasks, error: existingTaskError } = await client
      .from("workspace_tasks")
      .select("prep_project_id")
      .eq("prep_team_id", team.id)
      .eq("task_type", "auto");
    if (existingTaskError) throw existingTaskError;
    const seeded = new Set((existingAutoTasks ?? []).map((task) => task.prep_project_id));
    const { data: programRows, error: programsError } = await client
      .from("programs")
      .select("id, deadline")
      .in("id", input.programIds);
    if (programsError) throw programsError;
    const deadlineByProgram = new Map((programRows ?? []).map((program) => [program.id, program.deadline]));
    const automaticTasks = (projects ?? []).filter((project) => !seeded.has(project.id)).flatMap((project) => {
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
    // 자동 자격 진단도 최초 1회만 남깁니다. 재시도가 진단 이력을 부풀리면 안 됩니다.
    const { count: reportCount, error: reportCountError } = await client
      .from("diagnosis_reports")
      .select("id", { count: "exact", head: true })
      .eq("prep_team_id", team.id)
      .eq("report_type", "eligibility");
    if (reportCountError) throw reportCountError;

    const reports = (reportCount ?? 0) > 0 ? [] : (projects ?? []).map((project) => {
      const answers: EligibilityAnswers = { hasBusinessRegistration: null };
      const report = evaluateEligibility(project.program_id, answers);
      // result의 형태는 getLatestEligibilityReport가 읽는 { programId, answers, report }와 같아야 합니다.
      // 리포트를 통째로 넣으면 복원 시 result.report가 없어 항상 null이 되고, 자동 진단이 화면에 뜨지 않습니다.
      return {
        prep_team_id: team.id,
        report_type: "eligibility",
        state: report.state,
        score: report.score,
        result: { programId: project.program_id, answers, report },
        created_by: userId,
      };
    });
    if (reports.length) {
      const { error: reportError } = await client.from("diagnosis_reports").insert(reports);
      if (reportError) throw reportError;
      await trackWorkspaceEvent("diagnosis_complete", team.id, { programIds: input.programIds, automatic: true });
    }
  }

  invalidateTeamCache();
  invalidateProfileCache();

  const { error: updateError } = await client
    .from("startup_profiles")
    .update({ position: input.position, team_building_intent: input.teamBuildingIntent, desired_positions: input.desiredPositions, onboarding_complete: true })
    .eq("id", userId);
  if (updateError) throw updateError;

  await trackWorkspaceEvent("onboarding_complete", team.id, { programIds: input.programIds });
  return { teamId: team.id, redirect: "/founder" };
}

export async function trackWorkspaceEvent(eventName: string, prepTeamId?: string, payload: Record<string, unknown> = {}) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devTrackEvent(eventName);
  const client = requireClient();
  const userId = await getAuthUserId();
  if (!userId) return;
  const { error } = await client.from("workspace_events").insert({
    user_id: userId,
    prep_team_id: prepTeamId ?? null,
    event_name: eventName,
    payload,
  });
  if (error) throw error;
}

export async function joinWaitlist(tab: "team_building" | "mentor" | "investment") {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devWaitlistJoin(tab);
  const client = requireClient();
  const userId = await getAuthUserId();
  if (!userId) throw new Error("대기 신청에는 로그인이 필요합니다.");
  const { error } = await client.from("waitlist_entries").upsert({ user_id: userId, tab }, { onConflict: "user_id,tab" });
  if (error) throw error;
  await trackWorkspaceEvent("waitlist_join", undefined, { tab });
}

/** 이미 신청한 대기 목록. 새로고침 후에도 "신청 완료"가 유지되어야 합니다. */
export async function getWaitlistEntries(): Promise<string[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devWaitlist();
  const client = requireClient();
  const userId = await getAuthUserId();
  if (!userId) return [];
  const { data, error } = await client.from("waitlist_entries").select("tab").eq("user_id", userId);
  if (error) return [];
  return (data ?? []).map((row) => row.tab as string);
}

export async function captureLead(email: string, source: string) {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) throw new Error("유효한 이메일 주소를 입력해 주세요.");
  if (DEV_BYPASS) return;
  const client = requireClient();
  const userId = await getAuthUserId();
  const { error } = await client.from("leads").insert({
    email: normalizedEmail,
    source,
    consented_at: new Date().toISOString(),
    user_id: userId,
  });
  if (error) throw error;
  await trackWorkspaceEvent("calc_pdf_email_submitted", undefined, { source });
}

export async function convertPrepTeam(code: string) {
  if (DEV_BYPASS) return code.trim().toUpperCase();
  const client = requireClient();
  const { data, error } = await client.rpc("convert_prep_team", { input_code: code.trim() });
  if (error) throw error;
  invalidateTeamCache();
  invalidateProfileCache();
  return data as string;
}

export interface PersistedTask {
  id: string;
  title: string;
  due_date: string | null;
  status: TaskStatus;
  task_type: "auto" | "custom";
  is_hidden: boolean;
  assignee_id: string | null;
  comment_count: number;
  /** K-Startup 공고에서 담은 일정이면 그 공고 일련번호. 직접 만든 일정은 null입니다. */
  announcement_sn?: number | null;
}

/** 제출 건에 첨부된 실제 증빙 파일. 매니저가 만료형 링크로 열 대상입니다. */
export interface SubmissionEvidenceFile {
  documentId: string;
  fileName: string;
  storagePath: string;
  version: number;
}

/** 창업자가 제출 시 저장한 사전검증 결과와 집행 내역을 매니저 화면에서 그대로 재사용합니다. */
export type ManagerReviewSubmission = ManagerSubmissionInput & {
  verdict?: ExpenseVerdict;
  expense?: ExpenseInput;
  files?: SubmissionEvidenceFile[];
};

function getStoredVerdict(payload: Record<string, unknown> | null): ExpenseVerdict | undefined {
  const verdict = payload?.verdict as Partial<ExpenseVerdict> | undefined;
  return verdict && Array.isArray(verdict.findings) ? (verdict as ExpenseVerdict) : undefined;
}

/** 매니저가 무엇을 승인하는지 보려면 판정뿐 아니라 원본 집행 내역이 필요합니다. */
function getStoredExpense(payload: Record<string, unknown> | null): ExpenseInput | undefined {
  const expense = payload?.expense as Partial<ExpenseInput> | undefined;
  return expense && typeof expense === "object" && typeof expense.category === "string" ? (expense as ExpenseInput) : undefined;
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
  submission_evidence?: unknown;
};

/** 중첩 조회 결과는 관계에 따라 배열/객체로 오므로 한 곳에서 흡수합니다. */
function getEvidenceFiles(raw: unknown): SubmissionEvidenceFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((link) => {
    const document = firstObject((link as Record<string, unknown> | null)?.vault_documents);
    if (!document || typeof document.storage_path !== "string") return [];
    return [{
      documentId: String(document.id ?? ""),
      fileName: typeof document.file_name === "string" ? document.file_name : "이름 없는 파일",
      storagePath: document.storage_path,
      version: typeof document.version === "number" ? document.version : 1,
    }];
  });
}

function firstObject(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return firstObject(value[0]);
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}

function formatWon(value: number | string) {
  const numericValue = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  return `${new Intl.NumberFormat("ko-KR").format(numericValue)}원`;
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

/**
 * 현재 준비 팀 id.
 *
 * 화면 하나가 이 값을 5번 넘게 묻습니다(할 일·보관함·캘린더·진단·팀설정이 각자 호출).
 * 매번 조회하면 같은 답을 받으려고 200ms씩 더 씁니다. 세션 동안 재사용합니다.
 */
export async function getCurrentPrepTeamId() {
  if (DEV_BYPASS) return "dev-team";
  return cached("prepTeamId", async () => {
    const client = requireClient();
    const userId = await requireAuthUserId();
    // 여러 팀에 속했다면 가장 먼저 합류한 팀으로 고정합니다.
    // order 없이 limit(1)만 쓰면 요청마다 다른 팀이 나와 TODO·보관함·캘린더가 뒤바뀝니다.
    const { data, error } = await client
      .from("prep_team_members")
      .select("prep_team_id, joined_at")
      .eq("user_id", userId)
      .order("joined_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("준비 팀을 먼저 설정해 주세요.");
    return data.prep_team_id as string;
  });
}

export async function getWorkspaceTasks() {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devTasks();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  // 코멘트 개수는 집계로 함께 받아 카드마다 따로 조회하지 않습니다.
  const { data, error } = await client
    .from("workspace_tasks")
    .select("id,title,due_date,status,task_type,is_hidden,assignee_id,task_comments(count)")
    .eq("prep_team_id", teamId)
    .eq("is_hidden", false)
    .order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const counts = row.task_comments as Array<{ count: number }> | null;
    return {
      id: row.id as string,
      title: row.title as string,
      due_date: row.due_date as string | null,
      status: row.status as TaskStatus,
      task_type: row.task_type as "auto" | "custom",
      is_hidden: row.is_hidden as boolean,
      assignee_id: (row.assignee_id as string | null) ?? null,
      comment_count: counts?.[0]?.count ?? 0,
    };
  });
}

export async function getManagerReviewSubmissions(): Promise<ManagerReviewSubmission[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devManagerSubmissions();
  const client = requireClient();
  const { data, error } = await client
    .from("settlement_submissions")
    // 한 줄 리터럴로 둡니다. 문자열을 이어 붙이면 supabase-js가 select를 타입으로 못 읽습니다.
    .select("id,title,requested_amount,validation_status,status,payload,created_at,founder_teams(prep_teams(name)),submission_evidence(vault_documents(id,file_name,storage_path,version))")
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as RawSubmission[]).map((row) => {
    const files = getEvidenceFiles(row.submission_evidence);
    return {
      id: row.id,
      title: row.title,
      team: getTeamName(row),
      amount: formatWon(row.requested_amount),
      // 열어 볼 수 있는 파일 수입니다. 창업자가 체크한 증빙 '유형'과는 다른 값입니다.
      evidenceCount: files.length,
      role: "founder" as const,
      status: row.status,
      validation: row.validation_status,
      createdAt: row.created_at,
      verdict: getStoredVerdict(row.payload),
      expense: getStoredExpense(row.payload),
      files,
    };
  });
}

async function getCurrentFounderTeamId() {
  return cached("founderTeamId", async () => {
    const client = requireClient();
    const teamId = await getCurrentPrepTeamId();
    const { data, error } = await client.from("founder_teams").select("id").eq("prep_team_id", teamId).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error("협약 팀으로 전환된 뒤에 정산 검토를 요청할 수 있습니다.");
    return data.id as string;
  });
}

/** 사전검증을 통과한 집행 건을 매니저 검토 큐로 올립니다. */
export async function requestSettlementReview(input: {
  title: string;
  amount: number;
  verdict: { verdict: "pass" | "review" | "fail"; findings: unknown[]; missingEvidence: string[] };
  expense: Record<string, unknown>;
  /** 이 집행 건을 뒷받침하는 보관함 증빙 파일. 매니저가 실제로 열어 보는 대상입니다. */
  documentIds?: string[];
}) {
  if (input.verdict.verdict === "fail") throw new Error("위반 항목이 남아 있어 검토를 요청할 수 없습니다.");
  if (DEV_BYPASS) return (await import("../dev/devServices")).devRequestReview(input);
  const client = requireClient();
  const userId = await requireAuthUserId();
  const founderTeamId = await getCurrentFounderTeamId();
  const documentIds = Array.from(new Set(input.documentIds ?? []));
  const { data, error } = await client
    .from("settlement_submissions")
    .insert({
      founder_team_id: founderTeamId,
      title: input.title,
      requested_amount: input.amount,
      validation_status: "passed",
      status: "validated",
      payload: {
        expense: input.expense,
        verdict: input.verdict,
        evidenceTypeCount: (input.expense.evidence as string[] | undefined)?.length ?? 0,
        evidenceCount: documentIds.length,
      },
      submitted_by: userId,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (documentIds.length) {
    const { error: attachError } = await client
      .from("submission_evidence")
      .insert(documentIds.map((documentId) => ({ submission_id: data.id, document_id: documentId, created_by: userId })));
    // 첨부가 실패한 채로 큐에 남으면 매니저가 증빙 없는 건을 판정하게 됩니다. 제출을 되돌립니다.
    if (attachError) {
      await client.from("settlement_submissions").delete().eq("id", data.id);
      throw new Error(`증빙 파일을 연결하지 못해 검토 요청을 취소했습니다. ${attachError.message}`);
    }
  }

  await trackWorkspaceEvent("settlement_review_requested", undefined, {
    submissionId: data.id,
    verdict: input.verdict.verdict,
    evidenceFiles: documentIds.length,
  });
  return data.id as string;
}

/**
 * 검토 큐에서 건을 열면 '검토 중'으로 올립니다.
 * 매니저는 settlement_submissions를 직접 UPDATE할 수 없어(RLS) 함수를 거칩니다.
 * 이미 검토 중이거나 판정이 끝난 건에는 아무 일도 일어나지 않습니다.
 */
export async function claimSubmissionForReview(submissionId: string) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devClaimSubmission(submissionId);
  const client = requireClient();
  const { error } = await client.rpc("claim_settlement_submission", { input_submission_id: submissionId });
  if (error) throw error;
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
  const userId = await requireAuthUserId();
  const teamId = await getCurrentPrepTeamId();
  const { error } = await client.from("diagnosis_reports").insert({
    prep_team_id: teamId,
    report_type: "eligibility",
    state: report.state,
    score: report.score,
    result: { programId, answers, report },
    created_by: userId,
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
  const userId = await getAuthUserId();
  if (!userId) return [];
  const { data, error } = await client
    .from("workspace_events")
    .select("created_at")
    .eq("user_id", userId)
    .eq("event_name", "bizplan_diagnosis")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []).map((row) => row.created_at as string);
}

/** 코멘트에 붙은 첨부 파일. 실제 파일은 vault 버킷에 있고 여기는 그 좌표만 갖습니다. */
export interface TaskCommentFile {
  id: string;
  fileName: string;
  storagePath: string;
  mimeType: string | null;
  sizeBytes: number;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
  files: TaskCommentFile[];
}

/** 중첩 조회로 함께 받은 첨부 행. 관계 결과는 배열/누락 둘 다 올 수 있어 한 곳에서 흡수합니다. */
function toCommentFiles(raw: unknown): TaskCommentFile[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    const row = entry as Record<string, unknown> | null;
    if (!row || typeof row.storage_path !== "string") return [];
    return [{
      id: String(row.id ?? ""),
      fileName: typeof row.file_name === "string" ? row.file_name : "이름 없는 파일",
      storagePath: row.storage_path,
      mimeType: typeof row.mime_type === "string" ? row.mime_type : null,
      sizeBytes: Number(row.size_bytes) || 0,
    }];
  });
}

/**
 * 사용자 id → 표시 이름.
 *
 * `profiles`를 붙여 읽을 수 없어서 따로 조회합니다. prep_team_members·task_comments는
 * auth.users를 가리키는데 profiles.id에는 외래키가 없어, PostgREST가 두 테이블 사이를
 * 이어 줄 경로를 찾지 못합니다("Could not find a relationship ... in the schema cache").
 *
 * 이름이 필요한 화면이 여럿(팀 설정·코멘트)이라 조회를 여기 한곳에 둡니다.
 * 실패해도 던지지 않습니다. 이름은 장식이고, 그 때문에 팀 명단이나 코멘트가
 * 통째로 사라지면 손해가 더 큽니다.
 */
export async function getProfileNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(userIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await requireClient().from("profiles").select("id, full_name").in("id", unique);
  return new Map(
    (data ?? []).flatMap((row) => {
      const fullName = row.full_name as string | null;
      return fullName ? [[row.id as string, fullName] as const] : [];
    }),
  );
}

/** 할 일에 달린 코멘트. 실시간 채팅 대신 업무 객체에 붙는 스레드입니다. */
export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devTaskComments(taskId);
  const client = requireClient();
  const { data, error } = await client
    .from("task_comments")
    // 첨부는 중첩으로 함께 받습니다. 코멘트마다 따로 조회하면 스레드 하나에 왕복이 그만큼 늘어납니다.
    .select("id, task_id, author_id, content, created_at, task_comment_files(id, file_name, storage_path, mime_type, size_bytes)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  // 이름은 한 번에 모아 옵니다. 코멘트마다 조회하면 스레드 하나에 왕복이 그만큼 늘어납니다.
  const nameById = await getProfileNames(rows.map((row) => row.author_id as string));
  return rows.map((row) => ({
    id: row.id as string,
    taskId: row.task_id as string,
    authorId: row.author_id as string,
    authorName: nameById.get(row.author_id as string) ?? "이름 미등록",
    content: row.content as string,
    createdAt: row.created_at as string,
    files: toCommentFiles(row.task_comment_files),
  }));
}

export async function addTaskComment(taskId: string, content: string): Promise<TaskComment> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("코멘트 내용을 입력해 주세요.");
  if (DEV_BYPASS) return (await import("../dev/devServices")).devAddTaskComment(taskId, trimmed);
  const client = requireClient();
  const userId = await requireAuthUserId();
  const { data, error } = await client
    .from("task_comments")
    .insert({ task_id: taskId, author_id: userId, content: trimmed })
    .select("id, task_id, author_id, content, created_at")
    .single();
  if (error) throw error;
  // "나"로 두면 새로고침한 순간 실제 이름으로 바뀌어, 방금 쓴 코멘트가 남의 것처럼 보입니다.
  const nameById = await getProfileNames([userId]);
  return {
    id: data.id as string,
    taskId: data.task_id as string,
    authorId: data.author_id as string,
    authorName: nameById.get(userId) ?? "이름 미등록",
    content: data.content as string,
    createdAt: data.created_at as string,
    files: [],
  };
}

/** 담당자 지정. null이면 담당자 없음으로 되돌립니다. */
export async function assignTask(taskId: string, assigneeId: string | null) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devAssignTask(taskId, assigneeId);
  const client = requireClient();
  const { error } = await client.from("workspace_tasks").update({ assignee_id: assigneeId, updated_at: new Date().toISOString() }).eq("id", taskId);
  if (error) throw error;
}

export type ConsultationTopic = "incorporation" | "contract" | "ip" | "labor";

/**
 * 제휴 법무법인 상담 신청 접수.
 *
 * 변호사법 제34조상 소개 대가를 받을 수 없으므로 중개가 아니라 신청 접수만 보관합니다.
 * 연결 여부와 조건은 제휴처가 직접 판단합니다.
 */
export async function requestConsultation(input: {
  topic: ConsultationTopic;
  contactEmail: string;
  contactName: string;
  message: string;
}) {
  const email = input.contactEmail.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("유효한 이메일 주소를 입력해 주세요.");
  if (!input.contactName.trim()) throw new Error("연락받으실 이름을 입력해 주세요.");
  if (DEV_BYPASS) return;
  const client = requireClient();
  const userId = await getAuthUserId();
  const { error } = await client.from("consultation_requests").insert({
    user_id: userId,
    topic: input.topic,
    contact_email: email,
    contact_name: input.contactName.trim(),
    message: input.message.trim(),
    consented_at: new Date().toISOString(),
  });
  if (error) throw error;
  await trackWorkspaceEvent("consultation_requested", undefined, { topic: input.topic });
}

/** 새 합격 전환 코드를 발급합니다. 기존 코드가 만료되면 이 경로로만 갱신할 수 있습니다. */
export async function issueConversionCode(programId: string, maxUses = 100): Promise<string> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devIssueConversionCode(programId);
  const client = requireClient();
  const { data, error } = await client.rpc("issue_conversion_code", { input_program_id: programId, input_max_uses: maxUses });
  if (error) {
    throw new Error(error.message.includes("MANAGER_ROLE_REQUIRED") ? "기관 매니저만 코드를 발급할 수 있습니다." : error.message);
  }
  return data as string;
}

export interface BizplanHistoryEntry {
  score: number;
  createdAt: string;
  psst: Record<string, { score: number; evidence: string }>;
  swot: Record<string, string[]>;
  actions: string[];
}

/** 사업계획서 진단 이력. 버전별 점수 추이(v1 48 → v2 62)의 원본입니다. */
export async function getBizplanHistory(): Promise<BizplanHistoryEntry[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devBizplanHistory();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client
    .from("diagnosis_reports")
    .select("score, created_at, result")
    .eq("prep_team_id", teamId)
    .eq("report_type", "bizplan")
    .order("created_at", { ascending: true })
    .limit(20);
  if (error) throw error;
  return (data ?? []).map((row) => {
    const result = (row.result ?? {}) as Partial<BizplanHistoryEntry>;
    return {
      score: (row.score as number | null) ?? 0,
      createdAt: row.created_at as string,
      psst: result.psst ?? {},
      swot: result.swot ?? {},
      actions: result.actions ?? [],
    };
  });
}

/** 팀 초대로 실제 합류한 인원 수. 진단 무료 횟수 보너스의 근거입니다. */
export async function getAcceptedInviteCount(): Promise<number> {
  if (DEV_BYPASS) return 1;
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("prep_team_invites").select("use_count").eq("prep_team_id", teamId);
  if (error) return 0;
  return (data ?? []).reduce((sum, row) => sum + (Number(row.use_count) || 0), 0);
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
  const response = await fetch("/api/admin/bootstrap-manager", { method: "POST", headers: await getAuthHeaders() });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error ?? "기관 계정 전환에 실패했습니다.");
  // 역할이 manager로 바뀌었습니다. 캐시된 프로필을 그대로 두면 게이트가 계속 막습니다.
  invalidateProfileCache();
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

/**
 * 팀 일정 한 건을 만듭니다.
 *
 * `announcementSn`을 주면 K-Startup 공고에서 담은 일정이 되어 캘린더가 팀 일정과
 * 다른 색으로 구분하고 공고 정보를 다시 붙입니다. 같은 공고를 두 번 담으면
 * 유니크 인덱스가 막고, 사용자에게는 "이미 담았다"로 알려 줍니다.
 */
export async function createWorkspaceTask(title: string, dueDate?: string, announcementSn?: number) {
  if (!title.trim()) throw new Error("일정 제목을 입력해 주세요.");
  if (DEV_BYPASS) return (await import("../dev/devServices")).devCreateTask(title, dueDate, announcementSn);
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client
    .from("workspace_tasks")
    .insert({ prep_team_id: teamId, title: title.trim(), due_date: dueDate || null, task_type: "custom", announcement_sn: announcementSn ?? null })
    .select("id,title,due_date,status,task_type,is_hidden,assignee_id,announcement_sn")
    .single();
  if (error) {
    if (error.code === "23505") throw new Error("이미 캘린더에 담은 공고입니다.");
    throw error;
  }
  return data as PersistedTask;
}

export async function updateWorkspaceTask(taskId: string, changes: Partial<Pick<PersistedTask, "status" | "is_hidden">>) {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devUpdateTask(taskId, changes);
  const client = requireClient();
  const update: Record<string, unknown> = { ...changes, updated_at: new Date().toISOString() };
  if (changes.status === "done") update.completed_at = new Date().toISOString();
  const { data, error } = await client.from("workspace_tasks").update(update).eq("id", taskId).select("id,title,due_date,status,task_type,is_hidden,assignee_id").single();
  if (error) throw error;
  if (changes.status === "done") await trackWorkspaceEvent("todo_complete", undefined, { taskId });
  return data as PersistedTask;
}
