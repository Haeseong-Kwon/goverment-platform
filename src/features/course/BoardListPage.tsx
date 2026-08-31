"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, MessageSquare, Plus, Search, Users } from "lucide-react";
import {
  getDeliverables,
  getProposals,
  getRecruitPosts,
  getSemesterProfiles,
  getTeams,
} from "@/lib/services/CourseService";
import {
  BOARDS,
  DELIVERABLE_PHASE_LABEL,
  PROJECT_PHASE_LABEL,
  PROPOSAL_CATEGORIES,
  RECRUIT_STATUS_LABEL,
  ROLE_PRESETS,
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
  TEAM_STATUS_LABEL,
  countOpenRoles,
  courseHref,
  formatDateTime,
  getProposalDeadline,
  groupDeliverables,
  matchesQuery,
  sortProposals,
  sortRecruitPosts,
  type BoardId,
  type CourseTeam,
  type Deliverable,
  type DeliverablePhase,
  type Proposal,
  type RecruitPost,
  type SemesterProfile,
  type StudentStatus,
} from "./course";
import { CourseShell, WriteGate, useViewer } from "./CourseChrome";
import { DeliverableForm, ProposalForm, RecruitForm, SemesterProfileForm, TeamForm } from "./forms";
import {
  Button,
  ChoiceChip,
  EmptyState,
  Notice,
  Skeleton,
  StatusBadge,
  focusRing,
  inputClass,
  liftCard,
} from "@/features/startup-workspace/ui";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

const cardClass = cn("block rounded-2xl border border-[#E2E8F0] bg-white p-5", liftCard, focusRing);

/** 카드 아래줄에 공통으로 붙는 메타(작성일 · 댓글 수). 네 게시판이 같은 자리에 같은 모양으로 둡니다. */
function CardMeta({ createdAt, commentCount, children }: { createdAt: string; commentCount: number; children?: React.ReactNode }) {
  return (
    <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[#94A3B8]">
      {children}
      <span className="tabular-nums">{formatDateTime(createdAt)}</span>
      <span className="ml-auto inline-flex items-center gap-1 font-semibold text-[#64748B]">
        <MessageSquare size={13} />
        <span className="tabular-nums">{commentCount}</span>
      </span>
    </div>
  );
}

function TagRow({ items, tone = "slate" }: { items: string[]; tone?: "slate" | "blue" }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className={cn(
            "rounded-lg px-2.5 py-1 text-xs font-semibold",
            tone === "blue" ? "bg-[#EFF6FF] text-[#2563EB]" : "bg-[#F1F5F9] text-[#475569]",
          )}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------- 카드

/**
 * 자기소개 카드.
 *
 * 이름보다 "지금 팀을 찾는가"와 "무엇을 할 수 있는가"를 먼저 보여 줍니다 —
 * 이 게시판을 훑는 사람이 찾는 것이 그 둘이기 때문입니다.
 */
function IntroCard({ profile, isMine }: { profile: SemesterProfile; isMine: boolean }) {
  return (
    <Link
      href={courseHref("intro", profile.id)}
      className={cn(cardClass, isMine && "border-[#2563EB] ring-1 ring-[#BFDBFE]")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={STUDENT_STATUS_TONE[profile.status]} dot>{STUDENT_STATUS_LABEL[profile.status]}</StatusBadge>
        {profile.role && profile.role !== "Student" && <StatusBadge tone="blue">{profile.role}</StatusBadge>}
        {isMine && <StatusBadge tone="slate">내 자기소개</StatusBadge>}
      </div>
      <h3 className="mt-3 text-lg font-bold leading-6">
        {profile.fullName}
        {profile.major && <span className="ml-2 text-sm font-semibold text-[#94A3B8]">{profile.major}</span>}
      </h3>
      {profile.bio && <p className="mt-2 line-clamp-3 break-keep text-sm leading-6 text-[#475569]">{profile.bio}</p>}
      <TagRow items={profile.techStack} tone="blue" />
      <CardMeta createdAt={profile.createdAt} commentCount={profile.commentCount} />
    </Link>
  );
}

function RecruitCard({ post }: { post: RecruitPost }) {
  return (
    <Link href={courseHref("recruit", post.id)} className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={post.status === "Recruiting" ? "green" : "slate"} dot>
          {RECRUIT_STATUS_LABEL[post.status]}
        </StatusBadge>
        <StatusBadge tone="blue">{PROJECT_PHASE_LABEL[post.projectPhase]}</StatusBadge>
        {post.recruitingRoles.length > 0 && (
          <span className="text-sm font-semibold text-[#64748B]">{countOpenRoles(post.recruitingRoles)}명 모집</span>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-6">{post.title}</h3>
      <p className="mt-2 line-clamp-2 break-keep text-sm leading-6 text-[#475569]">{post.content}</p>
      <TagRow items={post.recruitingRoles.map((role) => `${role.role} ${role.count}`)} tone="blue" />
      <TagRow items={post.tags} />
      <CardMeta createdAt={post.createdAt} commentCount={post.commentCount}>
        <span className="font-semibold text-[#475569]">{post.authorName}</span>
      </CardMeta>
    </Link>
  );
}

function ProposalCard({ proposal }: { proposal: Proposal }) {
  const deadline = getProposalDeadline(proposal.deadline);
  return (
    <Link href={courseHref("proposal", proposal.id)} className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="slate">{proposal.companyName}</StatusBadge>
        {deadline ? (
          <StatusBadge tone={deadline.tone} dot={!deadline.expired}>{deadline.label}</StatusBadge>
        ) : (
          <StatusBadge tone="blue">상시 모집</StatusBadge>
        )}
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-6">{proposal.title}</h3>
      <p className="mt-2 line-clamp-2 break-keep text-sm leading-6 text-[#475569]">{proposal.content}</p>
      <TagRow items={proposal.categories} tone="blue" />
      <CardMeta createdAt={proposal.createdAt} commentCount={proposal.commentCount}>
        {proposal.deadline && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <CalendarClock size={13} />마감 {proposal.deadline}
          </span>
        )}
      </CardMeta>
    </Link>
  );
}

function TeamCard({ team }: { team: CourseTeam }) {
  return (
    <Link href={courseHref("team", team.id)} className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={team.status === "Activities" ? "blue" : "green"} dot>
          {TEAM_STATUS_LABEL[team.status]}
        </StatusBadge>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#64748B]">
          <Users size={14} />
          <span className="tabular-nums">{team.members.length}</span>명
        </span>
      </div>
      <h3 className="mt-3 text-lg font-bold leading-6">{team.teamName}</h3>
      <p className="mt-2 line-clamp-2 break-keep text-sm leading-6 text-[#475569]">{team.projectItem}</p>
      <TagRow items={team.members.map((member) => (member.role ? `${member.name} · ${member.role}` : member.name))} />
      <CardMeta createdAt={team.createdAt} commentCount={team.commentCount}>
        <span className="font-semibold text-[#475569]">팀장 {team.leaderName}</span>
      </CardMeta>
    </Link>
  );
}

function DeliverableCard({ deliverable }: { deliverable: Deliverable }) {
  return (
    <Link href={courseHref("showcase", deliverable.id)} className={cardClass}>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={deliverable.phase === "final" ? "green" : "amber"}>
          {DELIVERABLE_PHASE_LABEL[deliverable.phase]}
        </StatusBadge>
        <StatusBadge tone="slate">{deliverable.teamName}</StatusBadge>
      </div>
      <h3 className="mt-3 line-clamp-2 text-lg font-bold leading-6">{deliverable.title}</h3>
      <p className="mt-2 line-clamp-3 break-keep text-sm leading-6 text-[#475569]">{deliverable.summary}</p>
      <TagRow items={deliverable.techStack} tone="blue" />
      <CardMeta createdAt={deliverable.updatedAt} commentCount={deliverable.commentCount} />
    </Link>
  );
}

// ---------------------------------------------------------------- 목록

type BoardData =
  | { board: "intro"; items: SemesterProfile[] }
  | { board: "recruit"; items: RecruitPost[] }
  | { board: "proposal"; items: Proposal[] }
  | { board: "team"; items: CourseTeam[] }
  | { board: "showcase"; items: Deliverable[] };

const loaders: Record<BoardId, () => Promise<BoardData>> = {
  intro: async () => ({ board: "intro", items: await getSemesterProfiles() }),
  recruit: async () => ({ board: "recruit", items: await getRecruitPosts() }),
  proposal: async () => ({ board: "proposal", items: await getProposals() }),
  team: async () => ({ board: "team", items: await getTeams() }),
  showcase: async () => ({ board: "showcase", items: await getDeliverables() }),
};

/** 게시판마다 다른 칩 한 줄. 전부 "전체 + 값들"이라 목록만 다르게 줍니다. */
const filterOptions: Record<BoardId, Array<{ value: string; label: string }>> = {
  intro: [
    ...(Object.keys(STUDENT_STATUS_LABEL) as StudentStatus[]).map((status) => ({
      value: status,
      label: STUDENT_STATUS_LABEL[status],
    })),
    ...ROLE_PRESETS.map((role) => ({ value: `role:${role}`, label: role })),
  ],
  recruit: [
    { value: "Recruiting", label: RECRUIT_STATUS_LABEL.Recruiting },
    { value: "Closed", label: RECRUIT_STATUS_LABEL.Closed },
    ...ROLE_PRESETS.map((role) => ({ value: `role:${role}`, label: role })),
  ],
  proposal: PROPOSAL_CATEGORIES.map((item) => ({ value: item, label: item })),
  team: [
    { value: "Activities", label: TEAM_STATUS_LABEL.Activities },
    { value: "Completed", label: TEAM_STATUS_LABEL.Completed },
  ],
  showcase: (Object.keys(DELIVERABLE_PHASE_LABEL) as DeliverablePhase[]).map((phase) => ({
    value: phase,
    label: DELIVERABLE_PHASE_LABEL[phase],
  })),
};

export function BoardListPage({ board }: { board: BoardId }) {
  const config = BOARDS[board];
  const router = useRouter();
  const viewer = useViewer();
  const [data, setData] = useState<BoardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [writing, setWriting] = useState(false);

  useEffect(() => {
    let mounted = true;
    setData(null);
    setQuery("");
    setFilter("all");
    loaders[board]()
      .then((loaded) => { if (mounted) setData(loaded); })
      .catch((reason) => {
        if (!mounted) return;
        setError(toMessage(reason, "목록을 불러오지 못했습니다."));
        setData({ board, items: [] } as BoardData);
      });
    return () => { mounted = false; };
  }, [board]);

  const visible = useMemo(() => filterBoard(data, query, filter), [data, query, filter]);
  const visibleCount = visible ? visible.items.length : 0;

  // 자기소개는 학기당 한 장이라 "새 글"이 아닙니다. 이미 올렸다면 버튼도 그렇게 말해야 합니다.
  const myIntro =
    data?.board === "intro" ? data.items.find((item) => item.userId === viewer.id) ?? null : null;
  const createLabel = board === "intro" && myIntro ? "내 자기소개 수정" : config.createLabel;

  const onCreated = (id: string) => {
    setWriting(false);
    router.push(courseHref(board, id));
  };

  return (
    <CourseShell active={board}>
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{config.label}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#475569]">{config.description}</p>
        </div>
        <div className="shrink-0 md:max-w-md">
          <WriteGate viewer={viewer} action={createLabel}>
            <Button size="lg" icon={<Plus size={16} />} onClick={() => setWriting(true)}>{createLabel}</Button>
          </WriteGate>
        </div>
      </header>

      <div className="mb-6 space-y-3">
        <div className="relative flex items-center">
          <Search size={18} className="pointer-events-none absolute left-4 text-[#94A3B8]" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`${config.label} 검색`}
            aria-label={`${config.label} 검색`}
            className={cn(inputClass, "mt-0 h-12 rounded-xl bg-white pl-12")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <ChoiceChip selected={filter === "all"} onClick={() => setFilter("all")}>전체</ChoiceChip>
          {filterOptions[board].map((option) => (
            <ChoiceChip key={option.value} selected={filter === option.value} onClick={() => setFilter(option.value)}>
              {option.label}
            </ChoiceChip>
          ))}
        </div>
      </div>

      {error && <Notice tone="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Notice>}

      {data === null ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-48 w-full" />)}
        </div>
      ) : visibleCount === 0 ? (
        <EmptyState
          title={query || filter !== "all" ? "조건에 맞는 글이 없습니다" : config.emptyTitle}
          description={query || filter !== "all" ? "검색어나 필터를 바꿔 보세요." : config.emptyDescription}
          action={
            query || filter !== "all" ? (
              <Button variant="secondary" onClick={() => { setQuery(""); setFilter("all"); }}>필터 초기화</Button>
            ) : (
              <WriteGate viewer={viewer} action={createLabel}>
                <Button onClick={() => setWriting(true)} icon={<Plus size={15} />}>{createLabel}</Button>
              </WriteGate>
            )
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-[#64748B]">
            <strong className="font-bold tabular-nums text-[#0F172A]">{visibleCount}</strong>건
          </p>
          <div className="animate-in-stagger grid gap-4 md:grid-cols-2">
            {visible?.board === "intro" && visible.items.map((item) => (
              <IntroCard key={item.id} profile={item} isMine={item.userId === viewer.id} />
            ))}
            {visible?.board === "recruit" && visible.items.map((item) => <RecruitCard key={item.id} post={item} />)}
            {visible?.board === "proposal" && visible.items.map((item) => <ProposalCard key={item.id} proposal={item} />)}
            {visible?.board === "team" && visible.items.map((item) => <TeamCard key={item.id} team={item} />)}
            {visible?.board === "showcase" && visible.items.map((item) => <DeliverableCard key={item.id} deliverable={item} />)}
          </div>
        </>
      )}

      {writing && board === "intro" && (
        <SemesterProfileForm
          current={myIntro}
          onClose={() => setWriting(false)}
          onSaved={(profile) => onCreated(profile.id)}
        />
      )}
      {writing && board === "recruit" && <RecruitForm onClose={() => setWriting(false)} onCreated={onCreated} />}
      {writing && board === "proposal" && <ProposalForm onClose={() => setWriting(false)} onCreated={onCreated} />}
      {writing && board === "team" && <TeamForm onClose={() => setWriting(false)} onCreated={onCreated} />}
      {writing && board === "showcase" && <DeliverableForm onClose={() => setWriting(false)} onCreated={onCreated} />}
    </CourseShell>
  );
}

/**
 * 검색과 칩 필터를 게시판별로 적용합니다.
 *
 * 정렬도 여기서 끝냅니다 — 모집 중인 글과 마감이 임박한 제안이 위로 오는 규칙은
 * 화면이 아니라 도메인(course.ts)에 있고, 이 함수는 그것을 부르기만 합니다.
 */
function filterBoard(data: BoardData | null, query: string, filter: string): BoardData | null {
  if (!data) return null;

  if (data.board === "intro") {
    return {
      board: "intro",
      // 팀을 찾는 사람이 먼저 보여야 합니다. 이미 팀이 있는 사람은 아래로 내려갑니다.
      items: [...data.items]
        .sort((a, b) => {
          const rank = (status: string) => (status === "LOOKING" ? 0 : status === "TEAMED" ? 1 : 2);
          const gap = rank(a.status) - rank(b.status);
          return gap !== 0 ? gap : b.createdAt.localeCompare(a.createdAt);
        })
        .filter((profile) => {
          if (filter.startsWith("role:") && profile.role !== filter.slice(5)) return false;
          if (["LOOKING", "TEAMED", "DONE"].includes(filter) && profile.status !== filter) return false;
          return matchesQuery([profile.fullName, profile.major, profile.role, profile.bio, ...profile.techStack], query);
        }),
    };
  }

  if (data.board === "recruit") {
    return {
      board: "recruit",
      items: sortRecruitPosts(data.items).filter((post) => {
        if (filter.startsWith("role:") && !post.recruitingRoles.some((role) => role.role === filter.slice(5))) return false;
        if ((filter === "Recruiting" || filter === "Closed") && post.status !== filter) return false;
        return matchesQuery(
          [post.title, post.content, post.authorName, ...post.tags, ...post.recruitingRoles.map((role) => role.role)],
          query,
        );
      }),
    };
  }

  if (data.board === "proposal") {
    return {
      board: "proposal",
      items: sortProposals(data.items).filter((proposal) => {
        if (filter !== "all" && !proposal.categories.includes(filter)) return false;
        return matchesQuery([proposal.title, proposal.content, proposal.companyName, ...proposal.categories], query);
      }),
    };
  }

  if (data.board === "team") {
    return {
      board: "team",
      items: data.items.filter((team) => {
        if (filter !== "all" && team.status !== filter) return false;
        return matchesQuery(
          [team.teamName, team.projectItem, team.leaderName, ...team.members.map((member) => `${member.name} ${member.role}`)],
          query,
        );
      }),
    };
  }

  // 결과물은 필터를 걸지 않아도 기말이 먼저입니다. 최신 성과를 먼저 보여 주는 게시판입니다.
  const byPhase = groupDeliverables(data.items);
  const items = filter === "midterm" || filter === "final" ? byPhase[filter] : [...byPhase.final, ...byPhase.midterm];
  return {
    board: "showcase",
    items: items.filter((item) => matchesQuery([item.title, item.summary, item.teamName, ...item.techStack], query)),
  };
}
