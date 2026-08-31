/**
 * 과목 게시판 데이터 접근.
 *
 * 네 게시판(팀빌딩 모집·기업 제안·확정 팀·결과물)과 공용 댓글이 여기를 지납니다.
 * 화면은 Supabase 이름을 모르고, 이 파일이 도메인 타입으로 바꿔서 넘깁니다.
 *
 * 접근 통제의 실제 경계는 RLS입니다(014-capstone-course.sql). 여기서 하는 검사는
 * 저장 버튼을 누르기 전에 사용자에게 이유를 알려 주기 위한 것이지 보안 경계가 아닙니다.
 */

import { requireClient, getProfileNames } from "./WorkspaceService";
import { requireAuthUserId, getAuthUserId } from "./sessionCache";
import {
  COURSE,
  parseRecruitRoles,
  parseStringArray,
  parseTeamMembers,
  semesterColumns,
  type BoardId,
  type CourseComment,
  type CourseTeam,
  type Deliverable,
  type DeliverablePhase,
  type ProjectPhase,
  type Proposal,
  type RecruitPost,
  type RecruitRole,
  type RecruitStatus,
  type SemesterProfile,
  type StudentStatus,
  type TeamMember,
  type TeamStatus,
} from "@/features/course/course";

/** 이름이 없는 계정. 이름 때문에 목록이 통째로 비면 손해가 더 큽니다. */
const UNKNOWN_AUTHOR = "이름 미등록";

/**
 * 게시판별 댓글 수.
 *
 * PostgREST에는 group by가 없어 대상 id만 받아 와 세어 둡니다. 한 학기 댓글은
 * 많아야 수천 건이라 목록마다 카운트 조회를 거는 것보다 왕복이 적습니다.
 */
async function getCommentCounts(board: BoardId): Promise<Map<string, number>> {
  const { data } = await requireClient().from("course_comments").select("target_id").eq("board", board);
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const id = row.target_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

// ---------------------------------------------------------------- 팀빌딩 모집

const RECRUIT_COLUMNS = "id, author_id, title, content, tags, project_phase, recruiting_roles, status, created_at";

type RecruitRow = Record<string, unknown>;

const toRecruitPost = (row: RecruitRow, names: Map<string, string>, counts: Map<string, number>): RecruitPost => {
  const authorId = (row.author_id as string | null) ?? null;
  return {
    id: row.id as string,
    authorId,
    authorName: (authorId && names.get(authorId)) || UNKNOWN_AUTHOR,
    title: row.title as string,
    content: row.content as string,
    tags: parseStringArray(row.tags),
    projectPhase: ((row.project_phase as string) || "IDEA") as ProjectPhase,
    recruitingRoles: parseRecruitRoles(row.recruiting_roles),
    status: ((row.status as string) === "Closed" ? "Closed" : "Recruiting") as RecruitStatus,
    createdAt: row.created_at as string,
    commentCount: counts.get(row.id as string) ?? 0,
  };
};

export async function getRecruitPosts(): Promise<RecruitPost[]> {
  const { data, error } = await requireClient()
    .from("recruitment_posts")
    .select(RECRUIT_COLUMNS)
    .eq("semester_key", COURSE.key)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as RecruitRow[];
  const [names, counts] = await Promise.all([
    getProfileNames(rows.map((row) => row.author_id as string)),
    getCommentCounts("recruit"),
  ]);
  return rows.map((row) => toRecruitPost(row, names, counts));
}

export async function getRecruitPost(id: string): Promise<RecruitPost | null> {
  const { data, error } = await requireClient().from("recruitment_posts").select(RECRUIT_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as RecruitRow;
  const [names, counts] = await Promise.all([
    getProfileNames([row.author_id as string]),
    getCommentCounts("recruit"),
  ]);
  return toRecruitPost(row, names, counts);
}

export interface RecruitPostInput {
  title: string;
  content: string;
  tags: string[];
  projectPhase: ProjectPhase;
  recruitingRoles: RecruitRole[];
}

export async function createRecruitPost(input: RecruitPostInput): Promise<string> {
  const userId = await requireAuthUserId();
  const { data, error } = await requireClient()
    .from("recruitment_posts")
    .insert({
      ...semesterColumns(),
      author_id: userId,
      title: input.title.trim(),
      content: input.content.trim(),
      tags: input.tags,
      project_phase: input.projectPhase,
      recruiting_roles: input.recruitingRoles,
      status: "Recruiting",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** 모집 마감·재개. 글을 지우는 대신 상태만 바꿔 지원자가 지난 글도 볼 수 있게 둡니다. */
export async function setRecruitStatus(id: string, status: RecruitStatus) {
  const { error } = await requireClient()
    .from("recruitment_posts")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteRecruitPost(id: string) {
  const { error } = await requireClient().from("recruitment_posts").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------- 기업 제안

const PROPOSAL_COLUMNS = "id, created_by, company_name, title, content, category, deadline, contact, created_at";

const toProposal = (row: RecruitRow, counts: Map<string, number>): Proposal => ({
  id: row.id as string,
  createdBy: (row.created_by as string | null) ?? null,
  companyName: row.company_name as string,
  title: row.title as string,
  content: row.content as string,
  categories: parseStringArray(row.category),
  deadline: (row.deadline as string | null) ?? null,
  contact: (row.contact as string | null) ?? "",
  createdAt: row.created_at as string,
  commentCount: counts.get(row.id as string) ?? 0,
});

export async function getProposals(): Promise<Proposal[]> {
  const { data, error } = await requireClient()
    .from("corporate_proposals")
    .select(PROPOSAL_COLUMNS)
    .eq("semester_key", COURSE.key)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const counts = await getCommentCounts("proposal");
  return ((data ?? []) as RecruitRow[]).map((row) => toProposal(row, counts));
}

export async function getProposal(id: string): Promise<Proposal | null> {
  const { data, error } = await requireClient().from("corporate_proposals").select(PROPOSAL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return toProposal(data as RecruitRow, await getCommentCounts("proposal"));
}

export interface ProposalInput {
  companyName: string;
  title: string;
  content: string;
  categories: string[];
  deadline: string | null;
  contact: string | null;
}

export async function createProposal(input: ProposalInput): Promise<string> {
  const userId = await requireAuthUserId();
  const { data, error } = await requireClient()
    .from("corporate_proposals")
    .insert({
      ...semesterColumns(),
      created_by: userId,
      company_name: input.companyName.trim(),
      title: input.title.trim(),
      content: input.content.trim(),
      category: input.categories,
      deadline: input.deadline,
      contact: input.contact,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteProposal(id: string) {
  const { error } = await requireClient().from("corporate_proposals").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------- 확정 팀

const TEAM_COLUMNS = "id, leader_id, team_name, project_item, members, status, created_at";

const toTeam = (row: RecruitRow, names: Map<string, string>, counts: Map<string, number>): CourseTeam => {
  const leaderId = (row.leader_id as string | null) ?? null;
  return {
    id: row.id as string,
    leaderId,
    leaderName: (leaderId && names.get(leaderId)) || UNKNOWN_AUTHOR,
    teamName: row.team_name as string,
    projectItem: row.project_item as string,
    members: parseTeamMembers(row.members),
    status: ((row.status as string) === "Completed" ? "Completed" : "Activities") as TeamStatus,
    createdAt: row.created_at as string,
    commentCount: counts.get(row.id as string) ?? 0,
  };
};

export async function getTeams(): Promise<CourseTeam[]> {
  const { data, error } = await requireClient()
    .from("team_registrations")
    .select(TEAM_COLUMNS)
    .eq("semester_key", COURSE.key)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as RecruitRow[];
  const [names, counts] = await Promise.all([
    getProfileNames(rows.map((row) => row.leader_id as string)),
    getCommentCounts("team"),
  ]);
  return rows.map((row) => toTeam(row, names, counts));
}

export async function getTeam(id: string): Promise<CourseTeam | null> {
  const { data, error } = await requireClient().from("team_registrations").select(TEAM_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as RecruitRow;
  const [names, counts] = await Promise.all([
    getProfileNames([row.leader_id as string]),
    getCommentCounts("team"),
  ]);
  return toTeam(row, names, counts);
}

/**
 * 내가 팀장인 팀. 결과물 등록 폼이 "어느 팀 것인지"를 고르게 하려면 필요합니다.
 * 로그인하지 않았으면 빈 배열입니다(폼 자체가 열리지 않습니다).
 */
export async function getMyLedTeams(): Promise<CourseTeam[]> {
  const userId = await getAuthUserId();
  if (!userId) return [];
  const { data, error } = await requireClient()
    .from("team_registrations")
    .select(TEAM_COLUMNS)
    .eq("semester_key", COURSE.key)
    .eq("leader_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const names = await getProfileNames([userId]);
  return ((data ?? []) as RecruitRow[]).map((row) => toTeam(row, names, new Map()));
}

export interface TeamInput {
  teamName: string;
  projectItem: string;
  members: TeamMember[];
}

export async function createTeam(input: TeamInput): Promise<string> {
  const userId = await requireAuthUserId();
  const { data, error } = await requireClient()
    .from("team_registrations")
    .insert({
      ...semesterColumns(),
      leader_id: userId,
      team_name: input.teamName.trim(),
      project_item: input.projectItem.trim(),
      members: input.members,
      status: "Activities",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function setTeamStatus(id: string, status: TeamStatus) {
  const { error } = await requireClient()
    .from("team_registrations")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTeam(id: string) {
  const { error } = await requireClient().from("team_registrations").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------- 결과물

const DELIVERABLE_COLUMNS =
  "id, team_id, phase, title, summary, tech_stack, demo_url, repo_url, deck_url, video_url, created_by, created_at, updated_at";

const toDeliverable = (row: RecruitRow, teamNames: Map<string, string>, counts: Map<string, number>): Deliverable => ({
  id: row.id as string,
  teamId: row.team_id as string,
  teamName: teamNames.get(row.team_id as string) ?? "삭제된 팀",
  phase: ((row.phase as string) === "final" ? "final" : "midterm") as DeliverablePhase,
  title: row.title as string,
  summary: (row.summary as string) ?? "",
  techStack: parseStringArray(row.tech_stack),
  demoUrl: (row.demo_url as string | null) ?? null,
  repoUrl: (row.repo_url as string | null) ?? null,
  deckUrl: (row.deck_url as string | null) ?? null,
  videoUrl: (row.video_url as string | null) ?? null,
  createdBy: row.created_by as string,
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string,
  commentCount: counts.get(row.id as string) ?? 0,
});

/** 결과물 카드에는 팀 이름이 함께 나옵니다. 팀 이름은 team_registrations에만 있어 따로 모읍니다. */
async function getTeamNames(teamIds: string[]): Promise<Map<string, string>> {
  const unique = Array.from(new Set(teamIds.filter(Boolean)));
  if (unique.length === 0) return new Map();
  const { data } = await requireClient().from("team_registrations").select("id, team_name").in("id", unique);
  return new Map((data ?? []).map((row) => [row.id as string, row.team_name as string]));
}

export async function getDeliverables(): Promise<Deliverable[]> {
  const { data, error } = await requireClient()
    .from("team_deliverables")
    .select(DELIVERABLE_COLUMNS)
    .eq("semester_key", COURSE.key)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as RecruitRow[];
  const [teamNames, counts] = await Promise.all([
    getTeamNames(rows.map((row) => row.team_id as string)),
    getCommentCounts("showcase"),
  ]);
  return rows.map((row) => toDeliverable(row, teamNames, counts));
}

export async function getDeliverable(id: string): Promise<Deliverable | null> {
  const { data, error } = await requireClient().from("team_deliverables").select(DELIVERABLE_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as RecruitRow;
  const [teamNames, counts] = await Promise.all([
    getTeamNames([row.team_id as string]),
    getCommentCounts("showcase"),
  ]);
  return toDeliverable(row, teamNames, counts);
}

export interface DeliverableInput {
  teamId: string;
  phase: DeliverablePhase;
  title: string;
  summary: string;
  techStack: string[];
  demoUrl: string | null;
  repoUrl: string | null;
  deckUrl: string | null;
  videoUrl: string | null;
}

/**
 * 등록과 수정이 같은 경로입니다. 팀당 단계별 한 건(UNIQUE team_id, phase)이라
 * 두 번째 등록은 새 글이 아니라 앞선 글의 갱신이어야 합니다. 새 행이 쌓이면
 * 보는 사람이 어느 것이 최종본인지 알 수 없습니다.
 */
export async function saveDeliverable(input: DeliverableInput): Promise<string> {
  const userId = await requireAuthUserId();
  const { data, error } = await requireClient()
    .from("team_deliverables")
    .upsert(
      {
        team_id: input.teamId,
        semester_key: COURSE.key,
        phase: input.phase,
        title: input.title.trim(),
        summary: input.summary.trim(),
        tech_stack: input.techStack,
        demo_url: input.demoUrl,
        repo_url: input.repoUrl,
        deck_url: input.deckUrl,
        video_url: input.videoUrl,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "team_id,phase" },
    )
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteDeliverable(id: string) {
  const { error } = await requireClient().from("team_deliverables").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------- 댓글

export async function getComments(board: BoardId, targetId: string): Promise<CourseComment[]> {
  const { data, error } = await requireClient()
    .from("course_comments")
    .select("id, board, target_id, author_id, content, created_at")
    .eq("board", board)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as RecruitRow[];
  const names = await getProfileNames(rows.map((row) => row.author_id as string));
  return rows.map((row) => ({
    id: row.id as string,
    board: row.board as BoardId,
    targetId: row.target_id as string,
    authorId: row.author_id as string,
    authorName: names.get(row.author_id as string) ?? UNKNOWN_AUTHOR,
    content: row.content as string,
    createdAt: row.created_at as string,
  }));
}

export async function addComment(board: BoardId, targetId: string, content: string): Promise<CourseComment> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("댓글 내용을 입력해 주세요.");
  const userId = await requireAuthUserId();
  const { data, error } = await requireClient()
    .from("course_comments")
    .insert({ board, target_id: targetId, author_id: userId, content: trimmed })
    .select("id, board, target_id, author_id, content, created_at")
    .single();
  if (error) throw error;
  // "나"로 두면 새로고침한 순간 실제 이름으로 바뀌어, 방금 쓴 댓글이 남의 것처럼 보입니다.
  const names = await getProfileNames([userId]);
  return {
    id: data.id as string,
    board: data.board as BoardId,
    targetId: data.target_id as string,
    authorId: data.author_id as string,
    authorName: names.get(userId) ?? UNKNOWN_AUTHOR,
    content: data.content as string,
    createdAt: data.created_at as string,
  };
}

export async function deleteComment(id: string) {
  const { error } = await requireClient().from("course_comments").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------- 수강생 프로필

const SEMESTER_PROFILE_COLUMNS =
  "id, user_id, full_name, role, major, bio, tech_stack, github_url, portfolio_url, status, created_at";

const toSemesterProfile = (row: RecruitRow): SemesterProfile => ({
  id: row.id as string,
  userId: row.user_id as string,
  fullName: row.full_name as string,
  major: (row.major as string | null) ?? "",
  role: (row.role as string | null) ?? "",
  bio: (row.bio as string | null) ?? "",
  techStack: parseStringArray(row.tech_stack),
  githubUrl: (row.github_url as string | null) ?? null,
  portfolioUrl: (row.portfolio_url as string | null) ?? null,
  status: (["LOOKING", "TEAMED", "DONE"].includes(row.status as string) ? row.status : "LOOKING") as StudentStatus,
  createdAt: row.created_at as string,
});

/** 내 이번 학기 프로필. 아직 안 썼으면 null이고, 워크스페이스가 작성부터 안내합니다. */
export async function getMySemesterProfile(): Promise<SemesterProfile | null> {
  const userId = await getAuthUserId();
  if (!userId) return null;
  const { data, error } = await requireClient()
    .from("semester_profiles")
    .select(SEMESTER_PROFILE_COLUMNS)
    .eq("semester_key", COURSE.key)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? toSemesterProfile(data as RecruitRow) : null;
}

export interface SemesterProfileInput {
  fullName: string;
  major: string;
  role: string;
  bio: string;
  techStack: string[];
  githubUrl: string | null;
  portfolioUrl: string | null;
  status: StudentStatus;
}

/**
 * 등록과 수정이 같은 경로입니다. `UNIQUE (user_id, semester_key)`라 학기당 한 장이며,
 * 학기가 바뀌면 새 행이 생기고 지난 학기 프로필은 그대로 남습니다.
 */
export async function saveSemesterProfile(input: SemesterProfileInput): Promise<SemesterProfile> {
  const userId = await requireAuthUserId();
  const { data, error } = await requireClient()
    .from("semester_profiles")
    .upsert(
      {
        ...semesterColumns(),
        user_id: userId,
        full_name: input.fullName.trim(),
        major: input.major.trim(),
        role: input.role.trim(),
        bio: input.bio.trim(),
        tech_stack: input.techStack,
        github_url: input.githubUrl,
        portfolio_url: input.portfolioUrl,
        status: input.status,
      },
      { onConflict: "user_id,semester_key" },
    )
    .select(SEMESTER_PROFILE_COLUMNS)
    .single();
  if (error) throw error;
  return toSemesterProfile(data as RecruitRow);
}

// ---------------------------------------------------------------- 내 활동

export interface StudentActivity {
  profile: SemesterProfile | null;
  posts: RecruitPost[];
  teams: CourseTeam[];
  deliverables: Deliverable[];
}

/**
 * 내가 팀원으로 들어가 있는 팀.
 *
 * team_registrations.members는 이름 문자열만 담습니다(등록 폼이 이름을 받으므로).
 * 사용자 id로 이을 길이 없어 이름으로 맞춥니다 — 팀장인 팀은 leader_id로 확실하게
 * 잡고, 팀원으로 참여한 팀만 이 경로로 찾습니다.
 *
 * ponytail: 동명이인이면 남의 팀이 섞입니다. 팀 등록에서 팀원을 계정으로 고르게
 * 바꾸면 member_ids로 정확해집니다 — 지금은 등록 폼이 이름을 받으므로 여기까지입니다.
 */
async function getTeamsByMemberName(name: string): Promise<RecruitRow[]> {
  if (!name.trim()) return [];
  const { data } = await requireClient()
    .from("team_registrations")
    .select(TEAM_COLUMNS)
    .eq("semester_key", COURSE.key)
    .contains("members", [{ name: name.trim() }]);
  return (data ?? []) as RecruitRow[];
}

/**
 * 수강생 워크스페이스가 한 번에 필요로 하는 것 전부.
 *
 * 화면이 조회를 네 번 따로 걸면 카드마다 로딩이 어긋나 화면이 계속 출렁입니다.
 * 서로 의존하지 않는 조회라 한꺼번에 보냅니다.
 */
export async function getMyCourseActivity(): Promise<StudentActivity> {
  const userId = await getAuthUserId();
  if (!userId) return { profile: null, posts: [], teams: [], deliverables: [] };
  const client = requireClient();

  const [profile, postRows, ledRows] = await Promise.all([
    getMySemesterProfile(),
    client
      .from("recruitment_posts")
      .select(RECRUIT_COLUMNS)
      .eq("semester_key", COURSE.key)
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => (data ?? []) as RecruitRow[]),
    client
      .from("team_registrations")
      .select(TEAM_COLUMNS)
      .eq("semester_key", COURSE.key)
      .eq("leader_id", userId)
      .then(({ data }) => (data ?? []) as RecruitRow[]),
  ]);

  // 이름은 학기 프로필을 먼저 봅니다. 계정 이름과 다르게 적었다면 팀 명단에 적힌 쪽도 그쪽입니다.
  const names = await getProfileNames([userId]);
  const myName = profile?.fullName || names.get(userId) || "";
  const memberRows = await getTeamsByMemberName(myName).catch(() => [] as RecruitRow[]);

  // 팀장이면서 명단에도 이름이 있으면 두 경로에 같은 팀이 잡힙니다.
  const teamRows = Array.from(
    new Map([...ledRows, ...memberRows].map((row) => [row.id as string, row])).values(),
  );

  const teamIds = teamRows.map((row) => row.id as string);
  const { data: deliverableRows } = teamIds.length
    ? await client.from("team_deliverables").select(DELIVERABLE_COLUMNS).in("team_id", teamIds)
    : { data: [] };

  const teamNames = new Map(teamRows.map((row) => [row.id as string, row.team_name as string]));
  const empty = new Map<string, number>();

  return {
    profile,
    posts: postRows.map((row) => toRecruitPost(row, names, empty)),
    teams: teamRows.map((row) => toTeam(row, names, empty)),
    deliverables: ((deliverableRows ?? []) as RecruitRow[]).map((row) => toDeliverable(row, teamNames, empty)),
  };
}

// ---------------------------------------------------------------- 과목 홈

export interface CourseStats {
  recruitOpen: number;
  proposalCount: number;
  teamCount: number;
  deliverableCount: number;
}

/**
 * 과목 홈의 숫자 네 개.
 *
 * 목록 전체를 받지 않고 head 카운트만 씁니다. 홈은 첫 화면이라 가장 빨라야 하고,
 * 여기서 필요한 것은 "몇 건인가"뿐입니다.
 */
export async function getCourseStats(): Promise<CourseStats> {
  const client = requireClient();
  const count = async (table: string, filters: Record<string, string> = {}) => {
    let query = client.from(table).select("id", { count: "exact", head: true }).eq("semester_key", COURSE.key);
    for (const [column, value] of Object.entries(filters)) query = query.eq(column, value);
    const { count: total, error } = await query;
    if (error) throw error;
    return total ?? 0;
  };

  const [recruitOpen, proposalCount, teamCount, deliverableCount] = await Promise.all([
    count("recruitment_posts", { status: "Recruiting" }),
    count("corporate_proposals"),
    count("team_registrations"),
    count("team_deliverables"),
  ]);
  return { recruitOpen, proposalCount, teamCount, deliverableCount };
}

/** 현재 로그인한 사용자 id. 화면이 "내 글인가"를 판단해 수정·삭제를 보여 줍니다. */
export const getViewerId = getAuthUserId;

/**
 * 이 계정이 과목 구성원인가 — 한양대 메일로 인증까지 마쳤는가.
 *
 * 판정은 DB 함수 하나(`is_course_member()`, 016)가 합니다. 화면에서 이메일을 다시
 * 뜯어보지 않는 이유는, 두 곳이 각자 판단하면 언젠가 어긋나고 그때 화면은 "쓸 수
 * 있다"고 하는데 저장은 거부되는 상태가 되기 때문입니다. 정책이 보는 그 함수에게
 * 그대로 물어봅니다.
 *
 * 실패하면 false입니다. 못 물어봤을 때 열어 주는 쪽으로 기울면, 016을 적용하지 않은
 * 환경에서 글쓰기 버튼이 열렸다가 저장에서 떨어집니다.
 */
export async function isCourseMember(): Promise<boolean> {
  const userId = await getAuthUserId();
  if (!userId) return false;
  const { data, error } = await requireClient().rpc("is_course_member");
  if (error) return false;
  return data === true;
}
