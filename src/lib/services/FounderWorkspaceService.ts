import { supabase } from "../supabase";
import { getCurrentPrepTeamId, getProfileNames, requireClient, type TaskCommentFile } from "./WorkspaceService";
import { DEV_BYPASS } from "../dev/devMode";
import { getAuthUserId, invalidateTeamCache, requireAuthUserId } from "./sessionCache";

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

/**
 * 팀 접근 권한을 여는 코드라 예측 가능한 난수를 쓰면 안 됩니다.
 * Math.random()은 시드 복원이 가능해 다른 팀의 초대 코드를 추측할 수 있습니다.
 * 혼동하기 쉬운 글자(0/O, 1/I)는 빼서 구두 전달 오류도 줄입니다.
 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateAccessCode(length = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join("");
}

/** 화면이 약속한 상한. 서버까지 보내고 나서 실패하면 대용량 업로드 시간이 통째로 낭비됩니다. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

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
  if (file.size === 0) throw new Error("빈 파일은 올릴 수 없습니다.");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`파일이 너무 큽니다. 최대 50MB까지 올릴 수 있습니다. (현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  }
  if (DEV_BYPASS) return (await import("../dev/devServices")).devUploadVaultDocument(folder, file);
  const client = requireClient();
  const userId = await requireAuthUserId();
  const teamId = await getCurrentPrepTeamId();
  const version = await getNextVersion(teamId, folder, file.name);
  const storagePath = `${teamId}/${folder}/v${version}-${file.name}`;

  const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: false });
  if (uploadError) throw new Error(`파일 업로드에 실패했습니다. ${uploadError.message}`);

  const { data, error } = await client
    .from("vault_documents")
    .insert({ prep_team_id: teamId, folder, file_name: file.name, storage_path: storagePath, version, created_by: userId })
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

/**
 * 코멘트에 붙일 수 있는 확장자.
 *
 * 화이트리스트입니다. 무엇이든 받으면 팀 보관함이 실행 파일 배포 경로가 됩니다.
 * 실제로 오가는 것은 사업계획서(hwp·docx·pdf)·증빙(xlsx·이미지)·압축본 정도입니다.
 */
export const ATTACHMENT_EXTENSIONS = [
  "pdf", "hwp", "hwpx", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "txt", "csv", "png", "jpg", "jpeg", "gif", "webp", "zip",
] as const;

/** 파일 선택 창에서 미리 걸러 주는 값. 실제 판정은 아래 검사가 합니다. */
export const ATTACHMENT_ACCEPT = ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",");

/**
 * 첨부 가능 여부. 문제가 없으면 null, 있으면 사용자에게 보여 줄 문장을 돌려줍니다.
 *
 * 업로드를 시작하기 전에 판단해야 합니다. 50MB를 다 올려 보내고 나서 거절하면
 * 그 시간이 통째로 버려집니다.
 */
export function checkAttachment(file: { name: string; size: number }): string | null {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!(ATTACHMENT_EXTENSIONS as readonly string[]).includes(extension)) {
    return `${file.name}: 올릴 수 없는 형식입니다. 문서·표·이미지·압축 파일만 첨부할 수 있습니다.`;
  }
  if (file.size === 0) return `${file.name}: 빈 파일은 올릴 수 없습니다.`;
  if (file.size > MAX_UPLOAD_BYTES) {
    return `${file.name}: 파일이 너무 큽니다. 최대 50MB까지 올릴 수 있습니다. (현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`;
  }
  return null;
}

/**
 * 코멘트 첨부 업로드.
 *
 * 보관함이 아니라 코멘트에 종속된 부속물이라 vault_documents가 아닌 task_comment_files에
 * 남깁니다. 다만 파일 자체는 같은 vault 버킷에 두어, 경로 첫 세그먼트가 팀 UUID인지로
 * 접근을 가르는 기존 storage 정책을 그대로 씁니다.
 */
export async function uploadCommentFile(commentId: string, file: File): Promise<TaskCommentFile> {
  const problem = checkAttachment(file);
  if (problem) throw new Error(problem);
  if (DEV_BYPASS) return (await import("../dev/devServices")).devUploadCommentFile(commentId, file);
  const client = requireClient();
  const userId = await requireAuthUserId();
  const teamId = await getCurrentPrepTeamId();
  // 같은 이름을 여러 코멘트에 올려도 부딪히지 않도록 코멘트 id로 폴더를 나눕니다.
  const storagePath = `${teamId}/comments/${commentId}/${file.name}`;

  const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, file, { upsert: true });
  if (uploadError) throw new Error(`파일 업로드에 실패했습니다. ${uploadError.message}`);

  const { data, error } = await client
    .from("task_comment_files")
    .insert({
      comment_id: commentId,
      file_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      created_by: userId,
    })
    .select("id, file_name, storage_path, mime_type, size_bytes")
    .single();
  if (error) {
    // 메타데이터가 없으면 화면에서 영영 못 찾는 고아 파일이 됩니다. 되돌립니다.
    await client.storage.from(BUCKET).remove([storagePath]);
    throw error;
  }
  return {
    id: data.id as string,
    fileName: data.file_name as string,
    storagePath: data.storage_path as string,
    mimeType: (data.mime_type as string | null) ?? null,
    sizeBytes: Number(data.size_bytes) || 0,
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
  // `profiles(full_name)`으로 붙여 읽을 수 없습니다. prep_team_members.user_id는 auth.users를
  // 가리키고 profiles.id에는 외래키가 아예 없어서, 두 테이블 사이에 PostgREST가 따라갈 경로가
  // 없습니다("Could not find a relationship ... in the schema cache"). 이름은 따로 조회합니다.
  const { data, error } = await client
    .from("prep_team_members")
    .select("user_id, member_role, joined_at")
    .eq("prep_team_id", teamId)
    .order("joined_at", { ascending: true });
  if (error) throw error;

  const rows = data ?? [];
  const nameById = await getProfileNames(rows.map((row) => row.user_id as string));
  return rows.map((row) => ({
    userId: row.user_id as string,
    role: row.member_role as "leader" | "member",
    fullName: nameById.get(row.user_id as string) ?? "이름 미등록",
    joinedAt: row.joined_at as string,
  }));
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
  const userId = await requireAuthUserId();
  const teamId = await getCurrentPrepTeamId();
  const code = generateAccessCode();
  const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const { data, error } = await client
    .from("prep_team_invites")
    .insert({ prep_team_id: teamId, code, expires_at: expiresAt, created_by: userId })
    .select("code, expires_at, use_count, max_uses")
    .single();
  if (error) throw error;
  return { code: data.code as string, expiresAt: data.expires_at as string, useCount: data.use_count as number, maxUses: data.max_uses as number };
}

export async function joinTeamByInvite(code: string) {
  if (DEV_BYPASS) return code.trim().toUpperCase();
  const client = requireClient();
  const { data, error } = await client.rpc("join_prep_team", { input_code: code.trim() });
  invalidateTeamCache();
  if (error) {
    throw new Error(error.message.includes("INVITE_CODE_INVALID") ? "초대 코드가 유효하지 않거나 만료되었습니다." : error.message);
  }
  return data as string;
}

/**
 * 캘린더 한 칸에 들어가는 항목의 종류.
 *
 * `announcement`(K-Startup 공고에서 담은 마감)와 `task`(팀이 직접 만든 일정)를 갈라 둡니다.
 * 둘 다 workspace_tasks 한 행이지만 성격이 달라 화면에서 색과 설명이 달라야 합니다.
 * `program`은 온보딩에서 고른 지원사업의 마감이라 팀이 지울 수 없는 고정 항목입니다.
 */
export type CalendarKind = "announcement" | "program" | "task";

/** 캘린더 항목에 붙는 공고 원본 정보. 공고가 캐시에서 정리되면 링크만 남습니다. */
export interface CalendarAnnouncement {
  sn: number;
  detailUrl: string;
  startDate: string | null;
  endDate: string | null;
  supportField: string | null;
  regions: string[];
  /** 공고 캐시에서 다시 찾은 값인지. false면 보관 기간이 지나 링크만 살아 있습니다. */
  resolved: boolean;
}

export interface CalendarItem {
  id: string;
  /** 코멘트를 달 수 있는 항목(=workspace_tasks 행)만 값이 있습니다. */
  taskId: string | null;
  title: string;
  date: string;
  kind: CalendarKind;
  status?: "todo" | "in_progress" | "done";
  commentCount: number;
  announcement?: CalendarAnnouncement;
}

/** 공고가 캐시에서 정리돼도 원문으로는 갈 수 있어야 합니다. 일련번호만으로 조립되는 주소입니다. */
export function buildAnnouncementUrl(sn: number) {
  return `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=${sn}`;
}

/** 마감 캘린더 원본: 팀 일정 + 공고에서 담은 마감 + 선택한 지원사업 마감. */
export async function getCalendarItems(): Promise<CalendarItem[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devCalendarItems();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();

  const { data: tasks, error: taskError } = await client
    .from("workspace_tasks")
    // 코멘트 개수는 집계로 함께 받습니다. 항목마다 따로 조회하면 한 달치가 수십 번 왕복합니다.
    .select("id, title, due_date, status, announcement_sn, task_comments(count)")
    .eq("prep_team_id", teamId)
    .eq("is_hidden", false)
    .not("due_date", "is", null);
  if (taskError) throw taskError;

  const { data: projects, error: projectError } = await client
    .from("prep_projects")
    .select("id, programs(id, name, deadline)")
    .eq("prep_team_id", teamId);
  if (projectError) throw projectError;

  // 담은 공고의 접수 기간·분야를 캘린더에서 바로 보여 주기 위해 한 번에 붙입니다.
  const announcementSns = Array.from(
    new Set((tasks ?? []).map((row) => row.announcement_sn as number | null).filter((sn): sn is number => typeof sn === "number")),
  );
  const announcementBySn = new Map<string, Record<string, unknown>>();
  if (announcementSns.length > 0) {
    const { data: announcements } = await client
      .from("kstartup_announcements")
      .select("pbanc_sn, detail_url, start_date, end_date, support_field, regions")
      .in("pbanc_sn", announcementSns);
    (announcements ?? []).forEach((row) => announcementBySn.set(String(row.pbanc_sn), row));
  }

  const taskItems: CalendarItem[] = (tasks ?? []).map((row) => {
    const counts = row.task_comments as Array<{ count: number }> | null;
    const sn = row.announcement_sn as number | null;
    const source = sn === null ? null : announcementBySn.get(String(sn));
    return {
      id: row.id as string,
      taskId: row.id as string,
      title: row.title as string,
      date: row.due_date as string,
      kind: sn === null ? "task" : "announcement",
      status: row.status as "todo" | "in_progress" | "done",
      commentCount: counts?.[0]?.count ?? 0,
      ...(sn === null
        ? {}
        : {
            announcement: {
              sn,
              detailUrl: (source?.detail_url as string | undefined) ?? buildAnnouncementUrl(sn),
              startDate: (source?.start_date as string | undefined) ?? null,
              endDate: (source?.end_date as string | undefined) ?? null,
              supportField: (source?.support_field as string | undefined) ?? null,
              regions: (source?.regions as string[] | undefined) ?? [],
              resolved: Boolean(source),
            },
          }),
    };
  });

  const programItems: CalendarItem[] = (projects ?? []).flatMap((row) => {
    const program = (Array.isArray(row.programs) ? row.programs[0] : row.programs) as { id?: string; name?: string; deadline?: string } | null;
    if (!program?.deadline) return [];
    return [{
      id: `program-${program.id}`,
      taskId: null,
      title: `${program.name} 마감`,
      date: program.deadline,
      kind: "program" as const,
      commentCount: 0,
    }];
  });

  return [...taskItems, ...programItems].sort((a, b) => a.date.localeCompare(b.date));
}

export interface BudgetLine {
  category: string;
  allocated: number;
  executed: number;
  remaining: number;
}

/**
 * 비목별 배정액과 집행 누계.
 *
 * 집행 누계는 반려되지 않은 제출 건의 합입니다. 반려 건까지 세면 고쳐서 다시 낼 여지가 사라집니다.
 */
export async function getBudgetLines(): Promise<BudgetLine[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devBudgetLines();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data: founderTeam } = await client.from("founder_teams").select("id").eq("prep_team_id", teamId).maybeSingle();
  if (!founderTeam) return [];

  const [{ data: allocations }, { data: submissions }] = await Promise.all([
    client.from("budget_allocations").select("category, allocated_amount").eq("founder_team_id", founderTeam.id),
    client.from("settlement_submissions").select("requested_amount, status, payload").eq("founder_team_id", founderTeam.id).neq("status", "rejected"),
  ]);

  const executedByCategory = (submissions ?? []).reduce<Record<string, number>>((acc, row) => {
    const payload = row.payload as { expense?: { category?: string } } | null;
    const category = payload?.expense?.category;
    if (!category) return acc;
    return { ...acc, [category]: (acc[category] ?? 0) + (Number(row.requested_amount) || 0) };
  }, {});

  return (allocations ?? []).map((row) => {
    const category = row.category as string;
    const allocated = Number(row.allocated_amount) || 0;
    const executed = executedByCategory[category] ?? 0;
    return { category, allocated, executed, remaining: allocated - executed };
  });
}

export async function saveBudgetAllocation(category: string, allocatedAmount: number) {
  if (!Number.isFinite(allocatedAmount) || allocatedAmount < 0) throw new Error("배정액을 0 이상의 숫자로 입력해 주세요.");
  if (DEV_BYPASS) return (await import("../dev/devServices")).devSaveBudget(category, allocatedAmount);
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data: founderTeam } = await client.from("founder_teams").select("id").eq("prep_team_id", teamId).maybeSingle();
  if (!founderTeam) throw new Error("협약 팀으로 전환된 뒤에 배정액을 등록할 수 있습니다.");
  const { error } = await client
    .from("budget_allocations")
    .upsert(
      { founder_team_id: founderTeam.id, category, allocated_amount: Math.round(allocatedAmount), updated_at: new Date().toISOString() },
      { onConflict: "founder_team_id,category" },
    );
  if (error) throw error;
}

/** 전체 지원사업의 공고 마감일. 추천 카드가 "언제 마감인지"를 함께 보여주기 위한 값입니다. */
export async function getProgramDeadlines(): Promise<Record<string, string | null>> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devProgramDeadlines();
  const client = requireClient();
  const { data, error } = await client.from("programs").select("id, deadline").eq("is_active", true);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [row.id as string, (row.deadline as string | null) ?? null]));
}

export interface SelectedProgram {
  id: string;
  name: string;
  deadline: string | null;
}

/**
 * 팀이 온보딩에서 실제로 고른 지원사업.
 *
 * 법인 설립 경고와 홈 히어로 카드가 이 값을 봐야 합니다.
 * 배열 첫 항목으로 고정하면 초창패만 준비하는 팀에게 예창패 경고를 띄우게 됩니다.
 */
export async function getSelectedPrograms(): Promise<SelectedProgram[]> {
  if (DEV_BYPASS) return (await import("../dev/devServices")).devSelectedPrograms();
  const client = requireClient();
  const teamId = await getCurrentPrepTeamId();
  const { data, error } = await client.from("prep_projects").select("programs(id, name, deadline)").eq("prep_team_id", teamId);
  if (error) throw error;
  return (data ?? []).flatMap((row) => {
    const program = (Array.isArray(row.programs) ? row.programs[0] : row.programs) as { id?: string; name?: string; deadline?: string } | null;
    if (!program?.id || !program.name) return [];
    return [{ id: program.id, name: program.name, deadline: program.deadline ?? null }];
  });
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
  const userId = await getAuthUserId();
  if (!userId) return null;

  const { data: profile } = await client
    .from("startup_profiles")
    .select("institution_id, institutions(name)")
    .eq("id", userId)
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
