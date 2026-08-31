/**
 * 「SW창업캡스톤디자인」과목 도메인.
 *
 * 학기 상수·게시판 구성·순수 변환만 둡니다. React도 Supabase도 부르지 않아
 * 목록 정렬, 마감 계산, JSONB 파싱을 테스트에서 그대로 검증할 수 있습니다.
 */

import { getDday } from "@/features/startup-workspace/logic";

// ---------------------------------------------------------------- 학기

export interface CourseSemester {
  /** 모든 게시글 행에 박히는 학기 식별자. 한번 정하면 바꾸지 않습니다. */
  key: string;
  year: number;
  /** 학기. 1 또는 2. */
  term: "1" | "2";
  /** 과목명. 같은 학기에 다른 과목이 생겨도 섞이지 않도록 행에 함께 저장합니다. */
  track: string;
  label: string;
  school: string;
}

/**
 * 지금 열려 있는 학기. 다음 학기를 열 때는 이 상수만 바꾸고 지난 학기 글은
 * semester_key로 남습니다(지우지 않습니다).
 */
export const COURSE: CourseSemester = {
  key: "2026-2-swcap",
  year: 2026,
  term: "2",
  track: "SW창업캡스톤디자인",
  label: "2026년 2학기 SW창업캡스톤디자인",
  school: "한양대학교 ERICA",
};

/** 행에 함께 저장하는 학기 컬럼 묶음. 등록 경로가 넷이라 한곳에서 만듭니다. */
export const semesterColumns = (semester: CourseSemester = COURSE) => ({
  semester_key: semester.key,
  academic_year: semester.year,
  academic_term: semester.term,
  course_track: semester.track,
});

// ---------------------------------------------------------------- 게시판

export type BoardId = "recruit" | "proposal" | "team" | "showcase";

export interface BoardConfig {
  id: BoardId;
  label: string;
  /** 목록 화면 상단 한 줄. 이 게시판이 무엇을 위한 곳인지. */
  description: string;
  /** 글쓰기 버튼 문구. 게시판마다 하는 일이 달라 "새 글"로 뭉뚱그리지 않습니다. */
  createLabel: string;
  /** 로그인하지 않았을 때 글쓰기 버튼 자리에 놓는 안내. */
  emptyTitle: string;
  emptyDescription: string;
}

export const BOARDS: Record<BoardId, BoardConfig> = {
  recruit: {
    id: "recruit",
    label: "팀빌딩 모집",
    description: "함께할 팀원을 찾는 글입니다. 필요한 역할과 아이디어 단계를 적어 두면 지원자가 무엇을 준비할지 알 수 있습니다.",
    createLabel: "팀원 모집글 쓰기",
    emptyTitle: "아직 모집글이 없습니다",
    emptyDescription: "가장 먼저 올려 보세요. 아이디어가 한 줄이어도 괜찮습니다 — 관심 있는 사람이 댓글로 물어봅니다.",
  },
  proposal: {
    id: "proposal",
    label: "기업 제안 프로젝트",
    description: "기업이 실제 문제를 들고 오는 곳입니다. 마감일이 있는 제안은 남은 기간이 함께 표시됩니다.",
    createLabel: "기업 제안 올리기",
    emptyTitle: "등록된 기업 제안이 없습니다",
    emptyDescription: "기업 담당자나 조교가 제안을 올리면 여기에 모입니다.",
  },
  team: {
    id: "team",
    label: "확정 팀",
    description: "팀 구성이 끝난 팀의 명단입니다. 팀장이 등록하며, 중간·기말 결과물이 이 팀에 붙습니다.",
    createLabel: "우리 팀 등록",
    emptyTitle: "등록된 팀이 없습니다",
    emptyDescription: "팀 구성이 끝났다면 팀장이 등록해 주세요. 결과물 게시판은 등록된 팀만 올릴 수 있습니다.",
  },
  showcase: {
    id: "showcase",
    label: "결과물",
    description: "중간·기말 산출물입니다. 팀당 단계별 한 건이며, 발표 전까지 같은 글을 고쳐 씁니다.",
    createLabel: "결과물 등록",
    emptyTitle: "아직 등록된 결과물이 없습니다",
    emptyDescription: "발표가 끝난 팀부터 데모 링크와 저장소를 남겨 주세요.",
  },
};

export const BOARD_ORDER: BoardId[] = ["recruit", "proposal", "team", "showcase"];

/**
 * 주소의 `[board]` 자리가 우리가 아는 게시판인지.
 *
 * `value in BOARDS`로 쓰면 안 됩니다. `in`은 프로토타입 체인까지 봐서
 * `/course/__proto__`가 통과하고, 뒤이은 `BOARDS[board]`가 게시판 설정이 아닌
 * 것을 돌려주며 화면이 깨집니다. 아는 값 네 개와만 대조합니다.
 */
export const isBoardId = (value: string): value is BoardId => (BOARD_ORDER as string[]).includes(value);

export const courseHref = (board?: BoardId, id?: string) =>
  board ? (id ? `/course/${board}/${id}` : `/course/${board}`) : "/course";

// ---------------------------------------------------------------- 값 목록

export type RecruitStatus = "Recruiting" | "Closed";

export const RECRUIT_STATUS_LABEL: Record<RecruitStatus, string> = {
  Recruiting: "모집 중",
  Closed: "모집 마감",
};

export type ProjectPhase = "IDEA" | "VALIDATION" | "PROTOTYPE" | "MVP";

export const PROJECT_PHASE_LABEL: Record<ProjectPhase, string> = {
  IDEA: "아이디어 구상",
  VALIDATION: "문제 검증",
  PROTOTYPE: "프로토타입",
  MVP: "MVP 운영",
};

export type DeliverablePhase = "midterm" | "final";

export const DELIVERABLE_PHASE_LABEL: Record<DeliverablePhase, string> = {
  midterm: "중간 결과물",
  final: "기말 결과물",
};

export type TeamStatus = "Activities" | "Completed";

export const TEAM_STATUS_LABEL: Record<TeamStatus, string> = {
  Activities: "활동 중",
  Completed: "수행 완료",
};

/** 모집글에서 자주 쓰는 역할. 직접 입력도 되지만 매번 타이핑하지 않게 미리 둡니다. */
export const ROLE_PRESETS = [
  "기획 · PM",
  "프론트엔드",
  "백엔드",
  "AI · 데이터",
  "디자인 · UX",
  "마케팅 · 영업",
  "하드웨어 · 임베디드",
];

export const PROPOSAL_CATEGORIES = [
  "AI · 데이터",
  "웹 · 앱 서비스",
  "제조 · 하드웨어",
  "커머스 · 물류",
  "헬스케어",
  "교육",
  "ESG · 사회문제",
];

// ---------------------------------------------------------------- 타입

export interface RecruitRole {
  role: string;
  count: number;
}

export interface TeamMember {
  name: string;
  role: string;
}

export interface RecruitPost {
  id: string;
  authorId: string | null;
  authorName: string;
  title: string;
  content: string;
  tags: string[];
  projectPhase: ProjectPhase;
  recruitingRoles: RecruitRole[];
  status: RecruitStatus;
  createdAt: string;
  commentCount: number;
}

export interface Proposal {
  id: string;
  createdBy: string | null;
  companyName: string;
  title: string;
  content: string;
  categories: string[];
  deadline: string | null;
  contact: string;
  createdAt: string;
  commentCount: number;
}

export interface CourseTeam {
  id: string;
  leaderId: string | null;
  leaderName: string;
  teamName: string;
  projectItem: string;
  members: TeamMember[];
  status: TeamStatus;
  createdAt: string;
  commentCount: number;
}

export interface Deliverable {
  id: string;
  teamId: string;
  teamName: string;
  phase: DeliverablePhase;
  title: string;
  summary: string;
  techStack: string[];
  demoUrl: string | null;
  repoUrl: string | null;
  deckUrl: string | null;
  videoUrl: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  commentCount: number;
}

export interface CourseComment {
  id: string;
  board: BoardId;
  targetId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

/** 목록에 실리는 어떤 글이든 갖는 최소 공통분모. 검색·정렬이 이것만 봅니다. */
export type BoardEntry = RecruitPost | Proposal | CourseTeam | Deliverable;

// ---------------------------------------------------------------- JSONB 파싱

/**
 * recruiting_roles·members는 JSONB라 어떤 모양이든 들어올 수 있습니다.
 * (예전 버전이 TEXT[]로 저장한 행도 남아 있습니다.)
 * 화면에서 `.map`을 부르기 전에 여기서 한 번 걸러 냅니다.
 */
export function parseRecruitRoles(value: unknown): RecruitRole[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [{ role: item.trim(), count: 1 }] : [];
    if (!item || typeof item !== "object") return [];
    const role = String((item as { role?: unknown }).role ?? "").trim();
    if (!role) return [];
    const count = Number((item as { count?: unknown }).count);
    return [{ role, count: Number.isFinite(count) && count > 0 ? Math.floor(count) : 1 }];
  });
}

export function parseTeamMembers(value: unknown): TeamMember[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") return item.trim() ? [{ name: item.trim(), role: "" }] : [];
    if (!item || typeof item !== "object") return [];
    const name = String((item as { name?: unknown }).name ?? "").trim();
    if (!name) return [];
    return [{ name, role: String((item as { role?: unknown }).role ?? "").trim() }];
  });
}

export const parseStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];

/** 쉼표로 구분해 입력한 태그를 배열로. 빈 값과 중복은 버립니다. */
export const splitTags = (value: string): string[] =>
  Array.from(new Set(value.split(",").map((item) => item.trim()).filter(Boolean)));

// ---------------------------------------------------------------- 화면 계산

/** 모집 중인 글이 위로. 같은 상태면 최신순. 마감된 글도 목록에서 지우지는 않습니다. */
export function sortRecruitPosts(posts: RecruitPost[]): RecruitPost[] {
  return [...posts].sort((a, b) => {
    if (a.status !== b.status) return a.status === "Recruiting" ? -1 : 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** 모집 인원 합계. "3명 모집"처럼 한 줄로 보여 주기 위한 값입니다. */
export const countOpenRoles = (roles: RecruitRole[]) => roles.reduce((sum, item) => sum + item.count, 0);

/**
 * 기업 제안 마감까지 남은 일수와 그에 맞는 색.
 * 마감이 없으면 null이며, 지난 마감은 목록 아래로 내려갑니다.
 */
export function getProposalDeadline(deadline: string | null, now = new Date()) {
  const dday = getDday(deadline, now);
  if (dday === null) return null;
  const tone = dday < 0 ? "slate" : dday <= 3 ? "red" : dday <= 7 ? "amber" : "blue";
  const label = dday < 0 ? "마감" : dday === 0 ? "오늘 마감" : `D-${dday}`;
  return { dday, tone, label, expired: dday < 0 } as const;
}

/** 마감이 임박한 제안이 위로, 마감된 제안은 맨 아래로. 마감일이 없는 글은 최신순으로 그 사이에. */
export function sortProposals(proposals: Proposal[], now = new Date()): Proposal[] {
  const rank = (item: Proposal) => {
    const deadline = getProposalDeadline(item.deadline, now);
    if (!deadline) return 1;
    return deadline.expired ? 2 : 0;
  };
  return [...proposals].sort((a, b) => {
    const gap = rank(a) - rank(b);
    if (gap !== 0) return gap;
    if (a.deadline && b.deadline && a.deadline !== b.deadline) return a.deadline.localeCompare(b.deadline);
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** 결과물 게시판은 항상 중간/기말로 나눠 봅니다. 한 배열에 섞으면 무엇의 최종본인지 흐려집니다. */
export function groupDeliverables(deliverables: Deliverable[]): Record<DeliverablePhase, Deliverable[]> {
  const byPhase: Record<DeliverablePhase, Deliverable[]> = { midterm: [], final: [] };
  for (const item of deliverables) byPhase[item.phase].push(item);
  for (const phase of Object.keys(byPhase) as DeliverablePhase[]) {
    byPhase[phase].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }
  return byPhase;
}

/**
 * 검색. 제목·본문뿐 아니라 역할·태그·팀원 이름까지 한 문자열로 훑습니다.
 * "백엔드"로 찾는 사람은 제목에 그 단어가 없어도 모집 역할에서 걸리길 기대합니다.
 */
export function matchesQuery(haystack: Array<string | null | undefined>, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return haystack.filter(Boolean).join(" ").toLowerCase().includes(needle);
}

/**
 * 목록·상세에 찍는 날짜. DB는 UTC로 저장하지만 읽는 사람은 전부 한국에 있어
 * 한국 시간으로 보여 줍니다(UTC 그대로 찍으면 밤에 쓴 글이 전날짜가 됩니다).
 */
export function formatDateTime(iso: string, withTime = false): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// ---------------------------------------------------------------- 입력 검증

const MIN_TITLE = 2;
const MIN_CONTENT = 10;

/**
 * 저장 직전 검증. DB의 CHECK 제약이 진짜 경계이고, 이 함수는 그 거절을
 * 사용자가 읽을 수 있는 문장으로 앞당기는 역할입니다.
 * 통과하면 null, 막히면 보여 줄 문구를 돌려줍니다.
 */
export function validateTitleAndBody(title: string, content: string): string | null {
  if (title.trim().length < MIN_TITLE) return `제목은 ${MIN_TITLE}자 이상 입력해 주세요.`;
  if (content.trim().length < MIN_CONTENT) return `내용은 ${MIN_CONTENT}자 이상 입력해 주세요.`;
  return null;
}

/** 링크 칸은 비워 둘 수 있지만, 적었다면 열리는 주소여야 합니다. */
export function validateOptionalUrl(value: string, label: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return `${label}은(는) http/https 주소여야 합니다.`;
    return null;
  } catch {
    return `${label} 주소 형식을 확인해 주세요. (예: https://github.com/team/repo)`;
  }
}

/** 빈 문자열을 null로. 링크 칸을 비웠을 때 DB에 ""가 쌓이면 "링크 있음"으로 오인됩니다. */
export const emptyToNull = (value: string) => (value.trim() ? value.trim() : null);
