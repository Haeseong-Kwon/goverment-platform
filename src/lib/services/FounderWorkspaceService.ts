import { supabase } from "../supabase";
import { getCurrentPrepTeamId, requireClient } from "./WorkspaceService";
import { DEV_BYPASS } from "../dev/devMode";

export type VaultFolder = "bizplan" | "evidence" | "submission_archive";

export const VAULT_FOLDERS: Array<{ id: VaultFolder; label: string; hint: string }> = [
  { id: "bizplan", label: "사업계획서", hint: "버전별로 쌓이며 합격 시 협약 팀으로 이관됩니다." },
  { id: "evidence", label: "증빙서류", hint: "세금계산서·이체확인증 등 정산 증빙." },
  { id: "submission_archive", label: "검토본 아카이브", hint: "제출한 검토 요청의 사본." },
];

export interface VaultDocument {
  id: string;
  folder: VaultFolder;
  fileName: string;
  storagePath: string;
  version: number;
  createdAt: string;
}

const BUCKET = "vault";

/** 같은 파일명은 버전을 올려 쌓습니다. 스키마의 (팀, 폴더, 파일명, 버전) 유니크 제약과 맞춥니다. */
async function getNextVersion(teamId: string, folder: VaultFolder, fileName: string) {
  const client = requireClient();
  const { data, error } = await client
    .from("vault_documents")
    .select("version")
    .eq("prep_team_id", teamId)
    .eq("folder", folder)
    .eq("file_name", fileName)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.version ?? 0) + 1;
}

export async function listVaultDocuments(): Promise<VaultDocument[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devVaultDocuments();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client
    .from("vault_documents")
    .select("id, folder, file_name, storage_path, version, created_at")
    .eq("prep_team_id", teamId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id as string,
    folder: row.folder as VaultFolder,
    fileName: row.file_name as string,
    storagePath: row.storage_path as string,
    version: row.version as number,
    createdAt: row.created_at as string,
  }));
}

export async function uploadVaultDocument(folder: VaultFolder, file: File): Promise<VaultDocument> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devUploadVaultDocument(folder, file);
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const teamId = await getCurrentPrepTeamId();
  const version = await getNextVersion(teamId, folder, file.name);
  const storagePath = `${teamId}/${folder}/v${version}-${file.name}`;

  const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: false });
  if (uploadError) throw new Error(`파일 업로드에 실패했습니다. ${uploadError.message}`);

  const { data, error } = await client
    .from("vault_documents")
    .insert({ prep_team_id: teamId, folder, file_name: file.name, storage_path: storagePath, version, created_by: auth.user.id })
    .select("id, folder, file_name, storage_path, version, created_at")
    .single();
  if (error) {
    // 메타데이터 저장이 실패하면 고아 파일이 남으므로 되돌립니다.
    await client.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return {
    id: data.id as string,
    folder: data.folder as VaultFolder,
    fileName: data.file_name as string,
    storagePath: data.storage_path as string,
    version: data.version as number,
    createdAt: data.created_at as string,
  };
}

/** 만료형 보안 링크. 기본 5분 후 무효화됩니다. */
export async function getVaultDownloadUrl(storagePath: string, expiresInSeconds = 300) {
  if (DEV_BYPASS) throw new Error("개발용 진입 모드에서는 실제 파일이 없어 다운로드 링크를 만들 수 없습니다.");
  const client = requireClient();
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(storagePath, expiresInSeconds);
  if (error) throw new Error(`다운로드 링크를 만들지 못했습니다. ${error.message}`);
  return data.signedUrl;
}

export interface TeamMember {
  userId: string;
  role: "leader" | "member";
  fullName: string;
  joinedAt: string;
}

export async function getTeamMembers(): Promise<TeamMember[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devMembers();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client
    .from("prep_team_members")
    .select("user_id, member_role, joined_at, profiles(full_name)")
    .eq("prep_team_id", teamId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
    return {
      userId: row.user_id as string,
      role: row.member_role as "leader" | "member",
      fullName: (profile as { full_name?: string } | null)?.full_name ?? "이름 미등록",
      joinedAt: row.joined_at as string,
    };
  });
}

export interface TeamInvite {
  code: string;
  expiresAt: string;
  useCount: number;
  maxUses: number;
}

export async function getActiveTeamInvite(): Promise<TeamInvite | null> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devInvite();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client
    .from("prep_team_invites")
    .select("code, expires_at, use_count, max_uses")
    .eq("prep_team_id", teamId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { code: data.code as string, expiresAt: data.expires_at as string, useCount: data.use_count as number, maxUses: data.max_uses as number };
}

export async function createTeamInvite(): Promise<TeamInvite> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devInvite();
  const client = requireClient();
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth.user) throw new Error("로그인이 필요합니다.");
  const teamId = await getCurrentPrepTeamId();
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();
  const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { data, error } = await client
    .from("prep_team_invites")
    .insert({ prep_team_id: teamId, code, expires_at: expiresAt, created_by: auth.user.id })
    .select("code, expires_at, use_count, max_uses")
    .single();
  if (error) throw error;
  return { code: data.code as string, expiresAt: data.expires_at as string, useCount: data.use_count as number, maxUses: data.max_uses as number };
}

export async function joinTeamByInvite(code: string) {
  if (DEV_BYPASS) return code.trim().toUpperCase();
  const client = requireClient();
  const { data, error } = await client.rpc("join_prep_team", { input_code: code.trim() });
  if (error) {
    throw new Error(error.message.includes("INVITE_CODE_INVALID") ? "초대 코드가 유효하지 않거나 만료되었습니다." : error.message);
  }
  return data as string;
}

export interface CalendarItem {
  id: string;
  title: string;
  date: string;
  kind: "task" | "program";
  status?: "todo" | "in_progress" | "done";
}

/** 마감 캘린더 원본: 팀 TODO 마감일 + 선택한 지원사업 공고 마감일. */
export async function getCalendarItems(): Promise<CalendarItem[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devCalendarItems();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();

  const { data: tasks, error: taskError } = await client
    .from("workspace_tasks")
    .select("id, title, due_date, status")
    .eq("prep_team_id", teamId)
    .eq("is_hidden", false)
    .not("due_date", "is", null);
  if (taskError) throw taskError;

  const { data: projects, error: projectError } = await client
    .from("prep_projects")
    .select("id, programs(id, name, deadline)")
    .eq("prep_team_id", teamId);
  if (projectError) throw projectError;

  const taskItems: CalendarItem[] = (tasks ?? []).map((row) => ({
    id: row.id as string,
    title: row.title as string,
    date: row.due_date as string,
    kind: "task",
    status: row.status as "todo" | "in_progress" | "done",
  }));

  const programItems: CalendarItem[] = (projects ?? []).flatMap((row) => {
    const program = (Array.isArray(row.programs) ? row.programs[0] : row.programs) as { id?: string; name?: string; deadline?: string } | null;
    if (!program?.deadline) return [];
    return [{ id: `program-${program.id}`, title: `${program.name} 마감`, date: program.deadline, kind: "program" as const }];
  });

  return [...taskItems, ...programItems].sort((a, b) => a.date.localeCompare(b.date));
}

export interface TrackedSubmission {
  id: string;
  title: string;
  amount: number;
  status: "draft" | "validated" | "in_review" | "approved" | "rejected";
  validation: "pending" | "passed" | "failed";
  createdAt: string;
  decision?: { decision: "approved" | "rejected"; reasonCode: string | null; feedback: string | null; createdAt: string };
}

/** 상태 트래커 원본: 내 팀의 정산 제출 건과 매니저 판정. */
export async function getTrackedSubmissions(): Promise<TrackedSubmission[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devTrackedSubmissions();
  const client = requireClient();
  const { data, error } = await client
    .from("settlement_submissions")
    .select("id, title, requested_amount, status, validation_status, created_at, submission_reviews(decision, reason_code, feedback, created_at)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => {
    const reviews = (Array.isArray(row.submission_reviews) ? row.submission_reviews : []) as Array<{ decision: string; reason_code: string | null; feedback: string | null; created_at: string }>;
    const latest = [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    return {
      id: row.id as string,
      title: row.title as string,
      amount: Number(row.requested_amount),
      status: row.status as TrackedSubmission["status"],
      validation: row.validation_status as TrackedSubmission["validation"],
      createdAt: row.created_at as string,
      decision: latest ? { decision: latest.decision as "approved" | "rejected", reasonCode: latest.reason_code, feedback: latest.feedback, createdAt: latest.created_at } : undefined,
    };
  });
}

export const isSupabaseReady = () => Boolean(supabase);

/** 로그인 사용자가 소속된(또는 협약한) 기관명. 없으면 null. */
export async function getInstitutionName(): Promise<string | null> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devInstitutionName();
  const client = requireClient();
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await client
    .from("startup_profiles")
    .select("institution_id, institutions(name)")
    .eq("id", auth.user.id)
    .maybeSingle();
  const own = Array.isArray(profile?.institutions) ? profile?.institutions[0] : profile?.institutions;
  if ((own as { name?: string } | null)?.name) return (own as { name: string }).name;

  const { data: founderTeam } = await client
    .from("founder_teams")
    .select("institutions(name)")
    .limit(1)
    .maybeSingle();
  const linked = Array.isArray(founderTeam?.institutions) ? founderTeam?.institutions[0] : founderTeam?.institutions;
  return (linked as { name?: string } | null)?.name ?? null;
}

export interface ConversionCode {
  code: string;
  programId: string | null;
  expiresAt: string;
  useCount: number;
  maxUses: number;
}

/** 기관이 발급한 합격 전환 코드 목록. 매니저 설정 화면에서 보여줍니다. */
export async function getConversionCodes(): Promise<ConversionCode[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devConversionCodes();
  const client = requireClient();
  const { data, error } = await client
    .from("conversion_codes")
    .select("code, program_id, expires_at, use_count, max_uses")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    code: row.code as string,
    programId: row.program_id as string | null,
    expiresAt: row.expires_at as string,
    useCount: row.use_count as number,
    maxUses: row.max_uses as number,
  }));
}
