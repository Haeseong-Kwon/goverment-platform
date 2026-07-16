import { supabase } from "../supabase";
import type { StartupRole } from "@/features/startup-workspace/domain";

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
