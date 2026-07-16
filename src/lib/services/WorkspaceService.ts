import { supabase } from "../supabase";
import type { StartupRole } from "@/features/startup-workspace/domain";
import type { TaskStatus } from "@/features/startup-workspace/domain";
import { createMilestones, evaluateEligibility } from "../../features/startup-workspace/rules";

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

const requireClient = () => {
  if (!supabase) throw new Error("Supabase 연결 정보가 없습니다. .env.local을 확인하세요.");
  return supabase;
};

export function resolveWorkspaceDestination(profile: Pick<StartupProfile, "role" | "onboardingComplete">) {
  if (profile.role === "manager") return "/manager";
  if (profile.role === "founder") return "/workspace";
  return profile.onboardingComplete ? "/founder" : "/onboarding";
}

export async function getStartupProfile(): Promise<StartupProfile | null> {
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

async function getCurrentPrepTeamId() {
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const { data, error } = await client.from("prep_team_members").select("prep_team_id").eq("user_id", auth.user.id).limit(1).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("준비 팀을 먼저 설정해 주세요.");
  return data.prep_team_id as string;
}

export async function getWorkspaceTasks() {
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("workspace_tasks").select("id,title,due_date,status,task_type,is_hidden").eq("prep_team_id", teamId).eq("is_hidden", false).order("due_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as PersistedTask[];
}

export async function createWorkspaceTask(title: string, dueDate?: string) {
  if (!title.trim()) throw new Error("할 일 제목을 입력해 주세요.");
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("workspace_tasks").insert({ prep_team_id: teamId, title: title.trim(), due_date: dueDate || null, task_type: "custom" }).select("id,title,due_date,status,task_type,is_hidden").single();
  if (error) throw error;
  return data as PersistedTask;
}

export async function updateWorkspaceTask(taskId: string, changes: Partial<Pick<PersistedTask, "status" | "is_hidden">>) {
  const client = requireClient();
  const update: Record<string, unknown> = { ...changes, updated_at: new Date().toISOString() };
  if (changes.status === "done") update.completed_at = new Date().toISOString();
  const { data, error } = await client.from("workspace_tasks").update(update).eq("id", taskId).select("id,title,due_date,status,task_type,is_hidden").single();
  if (error) throw error;
  if (changes.status === "done") await trackWorkspaceEvent("todo_complete", undefined, { taskId });
  return data as PersistedTask;
}
