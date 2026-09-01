"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Download,
  ExternalLink,
  Github,
  Mail,
  Paperclip,
  Pencil,
  Pin,
  Play,
  Presentation,
  Trash2,
  Users,
} from "lucide-react";
import {
  deleteDeliverable,
  deleteNotice,
  deleteProposal,
  deleteRecruitPost,
  deleteSemesterProfile,
  deleteTeam,
  getDeliverable,
  getDeliverables,
  getNotice,
  getProposal,
  getProposalFiles,
  getProposalFileUrl,
  getRecruitPost,
  getSemesterProfileById,
  getTeam,
  setNoticePinned,
  setRecruitStatus,
  setTeamStatus,
} from "@/lib/services/CourseService";
import {
  BOARDS,
  DELIVERABLE_PHASE_LABEL,
  PROJECT_PHASE_LABEL,
  RECRUIT_STATUS_LABEL,
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
  TEAM_STATUS_LABEL,
  countOpenRoles,
  courseHref,
  formatBytes,
  formatDateTime,
  getProposalDeadline,
  type BoardId,
  type CourseFile,
  type CourseNotice,
  type CourseTeam,
  type Deliverable,
  type Proposal,
  type RecruitPost,
  type SemesterProfile,
} from "./course";
import { AuthorLabel, CourseShell, StaffBadge, useStaffIds, useViewer } from "./CourseChrome";
import { NoticeForm, ProposalForm, RecruitForm, TeamForm } from "./forms";
import { CommentThread } from "./CommentThread";
import { Button, EmptyState, Notice, Skeleton, StatusBadge, focusRing } from "@/features/startup-workspace/ui";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type Entry =
  | { board: "notice"; item: CourseNotice }
  | { board: "intro"; item: SemesterProfile }
  | { board: "recruit"; item: RecruitPost }
  | { board: "proposal"; item: Proposal; files: CourseFile[] }
  | { board: "team"; item: CourseTeam; deliverables: Deliverable[] }
  | { board: "showcase"; item: Deliverable };

async function loadEntry(board: BoardId, id: string): Promise<Entry | null> {
  if (board === "notice") {
    const item = await getNotice(id);
    return item && { board, item };
  }
  if (board === "intro") {
    const item = await getSemesterProfileById(id);
    return item && { board, item };
  }
  if (board === "recruit") {
    const item = await getRecruitPost(id);
    return item && { board, item };
  }
  if (board === "proposal") {
    const item = await getProposal(id);
    if (!item) return null;
    // 첨부를 못 읽어도 제안 본문은 보여야 합니다. 첨부는 부속물입니다.
    const files = await getProposalFiles(id).catch(() => [] as CourseFile[]);
    return { board, item, files };
  }
  if (board === "team") {
    const item = await getTeam(id);
    if (!item) return null;
    // 팀 상세에서 그 팀의 중간·기말 결과물로 바로 건너갈 수 있어야 합니다.
    const deliverables = (await getDeliverables().catch(() => [])).filter((row) => row.teamId === id);
    return { board, item, deliverables };
  }
  const item = await getDeliverable(id);
  return item && { board, item };
}

/** 상세 화면의 본문 블록. 제목 아래 회색 라벨 + 내용 순서를 네 게시판이 같이 씁니다. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-bold uppercase tracking-widest text-[#94A3B8]">{title}</h2>
      <div className="mt-2">{children}</div>
    </div>
  );
}

function Body({ text }: { text: string }) {
  // 작성자가 넣은 줄바꿈을 그대로 살립니다. 게시글은 한 문단으로 뭉치면 읽히지 않습니다.
  return <p className="whitespace-pre-wrap break-words text-[15px] leading-8 text-[#334155]">{text}</p>;
}

const LINK_ICONS = { demoUrl: ExternalLink, repoUrl: Github, deckUrl: Presentation, videoUrl: Play } as const;
const LINK_LABELS = { demoUrl: "데모 열기", repoUrl: "저장소", deckUrl: "발표자료", videoUrl: "시연 영상" } as const;

function DeliverableLinks({ deliverable }: { deliverable: Deliverable }) {
  const links = (Object.keys(LINK_LABELS) as Array<keyof typeof LINK_LABELS>)
    .map((key) => ({ key, href: deliverable[key] }))
    .filter((link): link is { key: keyof typeof LINK_LABELS; href: string } => Boolean(link.href));

  if (links.length === 0) return <p className="text-sm text-[#94A3B8]">등록된 링크가 없습니다.</p>;

  return (
    <div className="flex flex-wrap gap-2">
      {links.map(({ key, href }) => {
        const Icon = LINK_ICONS[key];
        return (
          <a
            key={key}
            href={href}
            target="_blank"
            // 새 탭으로 여는 외부 링크는 opener를 끊습니다. 열린 페이지가 원본 탭 주소를 바꿀 수 있습니다.
            rel="noopener noreferrer"
            className={cn(
              "inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-bold text-[#475569]",
              focusRing,
              "transition-colors hover:border-[#2563EB] hover:text-[#2563EB]",
            )}
          >
            <Icon size={15} />
            {LINK_LABELS[key]}
          </a>
        );
      })}
    </div>
  );
}

export function BoardDetailPage({ board, id }: { board: BoardId; id: string }) {
  const router = useRouter();
  const viewer = useViewer();
  const staffIds = useStaffIds();
  const [entry, setEntry] = useState<Entry | null | "missing">(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let mounted = true;
    setEntry(null);
    loadEntry(board, id)
      .then((loaded) => { if (mounted) setEntry(loaded ?? "missing"); })
      .catch((reason) => {
        if (!mounted) return;
        setError(toMessage(reason, "글을 불러오지 못했습니다."));
        setEntry("missing");
      });
    return () => { mounted = false; };
  }, [board, id]);

  /** 소유자 조작(마감·삭제) 공통 처리. 성공하면 목록이나 갱신된 상세로 돌려보냅니다. */
  const act = async (run: () => Promise<void>, after: "reload" | "list") => {
    setBusy(true);
    setError(null);
    try {
      await run();
      if (after === "list") {
        router.push(courseHref(board));
        return;
      }
      setEntry(await loadEntry(board, id).then((loaded) => loaded ?? "missing"));
    } catch (reason) {
      setError(toMessage(reason, "처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  const remove = (run: () => Promise<void>) => {
    if (!window.confirm("이 글을 삭제할까요? 달린 댓글도 함께 사라지며 되돌릴 수 없습니다.")) return;
    void act(run, "list");
  };

  if (entry === null) {
    return (
      <CourseShell active={board}>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-4 h-64 w-full" />
      </CourseShell>
    );
  }

  if (entry === "missing") {
    return (
      <CourseShell active={board}>
        <EmptyState
          title="글을 찾을 수 없습니다"
          description={error ?? "삭제되었거나 주소가 잘못되었습니다."}
          action={<Button onClick={() => router.push(courseHref(board))}>{BOARDS[board].label} 목록으로</Button>}
        />
      </CourseShell>
    );
  }

  /*
   * 공지만 판정이 다릅니다. 다른 글은 "내가 쓴 글인가"지만, 공지는 "운영진인가"입니다 —
   * 교수님이 올린 공지의 오타를 조교가 못 고치면 곤란합니다(019의 정책과 같은 규칙).
   */
  // 공지와 기업 제안은 운영진 게시판입니다(019·020). 나머지는 "내가 쓴 글인가"입니다.
  const isStaffBoard = entry.board === "notice" || entry.board === "proposal";
  const isOwner =
    isStaffBoard
      ? viewer.staff
      : viewer.id !== null &&
        viewer.id ===
          (entry.board === "intro" ? entry.item.userId
            : entry.board === "recruit" ? entry.item.authorId
            : entry.board === "team" ? entry.item.leaderId
            : entry.item.createdBy);

  return (
    <CourseShell active={board}>
      <Link
        href={courseHref(board)}
        className={cn("mb-5 inline-flex items-center gap-1.5 text-sm font-bold text-[#64748B] hover:text-[#0F172A]", focusRing)}
      >
        <ArrowLeft size={15} />{BOARDS[board].label} 목록
      </Link>

      {error && <Notice tone="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Notice>}

      <article className="animate-in rounded-2xl border border-[#E2E8F0] bg-white p-6 md:p-8">
        {entry.board === "notice" && <NoticeDetail notice={entry.item} />}
        {entry.board === "intro" && <IntroDetail profile={entry.item} />}
        {entry.board === "recruit" && <RecruitDetail post={entry.item} staffIds={staffIds} />}
        {entry.board === "proposal" && <ProposalDetail proposal={entry.item} files={entry.files} />}
        {entry.board === "team" && <TeamDetail team={entry.item} deliverables={entry.deliverables} staffIds={staffIds} />}
        {entry.board === "showcase" && <ShowcaseDetail deliverable={entry.item} />}

        {isOwner && (
          <div className="mt-8 flex flex-wrap gap-2 border-t border-[#F1F5F9] pt-6">
            {/*
              수정은 글이 있는 게시판 전부에 둡니다. 없으면 오타 하나를 고치려고 지워야 하는데,
              모집글은 댓글이 곧 지원이고 팀은 결과물이 매달려 있어 지우는 순간 함께 사라집니다.
            */}
            {(isStaffBoard || entry.board === "recruit" || entry.board === "team") && (
              <Button variant="secondary" icon={<Pencil size={14} />} disabled={busy} onClick={() => setEditing(true)}>
                수정
              </Button>
            )}
            {entry.board === "notice" && (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() => void act(() => setNoticePinned(entry.item.id, !entry.item.isPinned), "reload")}
              >
                {entry.item.isPinned ? "상단 고정 해제" : "상단에 고정"}
              </Button>
            )}
            {entry.board === "recruit" && (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void act(
                    () => setRecruitStatus(entry.item.id, entry.item.status === "Recruiting" ? "Closed" : "Recruiting"),
                    "reload",
                  )
                }
              >
                {entry.item.status === "Recruiting" ? "모집 마감하기" : "다시 모집하기"}
              </Button>
            )}
            {entry.board === "team" && (
              <Button
                variant="secondary"
                loading={busy}
                onClick={() =>
                  void act(
                    () => setTeamStatus(entry.item.id, entry.item.status === "Activities" ? "Completed" : "Activities"),
                    "reload",
                  )
                }
              >
                {entry.item.status === "Activities" ? "수행 완료로 변경" : "활동 중으로 되돌리기"}
              </Button>
            )}
            <Button
              variant="danger"
              icon={<Trash2 size={15} />}
              disabled={busy}
              onClick={() =>
                remove(() =>
                  entry.board === "notice" ? deleteNotice(entry.item.id)
                  : entry.board === "intro" ? deleteSemesterProfile(entry.item.id)
                  : entry.board === "recruit" ? deleteRecruitPost(entry.item.id)
                  : entry.board === "proposal" ? deleteProposal(entry.item.id)
                  : entry.board === "team" ? deleteTeam(entry.item.id)
                  : deleteDeliverable(entry.item.id),
                )
              }
            >
              삭제
            </Button>
          </div>
        )}
      </article>

      <div className="mt-6">
        <CommentThread board={board} targetId={id} />
      </div>

      {editing && entry.board === "notice" && (
        <NoticeForm
          current={entry.item}
          onClose={() => setEditing(false)}
          onCreated={() => { setEditing(false); void act(async () => undefined, "reload"); }}
        />
      )}
      {editing && entry.board === "recruit" && (
        <RecruitForm
          current={entry.item}
          onClose={() => setEditing(false)}
          onCreated={() => { setEditing(false); void act(async () => undefined, "reload"); }}
        />
      )}
      {editing && entry.board === "team" && (
        <TeamForm
          current={entry.item}
          onClose={() => setEditing(false)}
          onCreated={() => { setEditing(false); void act(async () => undefined, "reload"); }}
        />
      )}
      {editing && entry.board === "proposal" && (
        <ProposalForm
          current={entry.item}
          currentFiles={entry.files}
          onClose={() => setEditing(false)}
          onCreated={() => { setEditing(false); void act(async () => undefined, "reload"); }}
        />
      )}
    </CourseShell>
  );
}

// ---------------------------------------------------------------- 게시판별 본문

function NoticeDetail({ notice }: { notice: CourseNotice }) {
  return (
    <>
      {notice.isPinned && (
        <StatusBadge tone="blue">
          <Pin size={11} className="mr-0.5 inline" />상단 고정
        </StatusBadge>
      )}
      <h1 className={cn("text-[26px] font-bold leading-tight tracking-tight md:text-[32px]", notice.isPinned && "mt-4")}>
        {notice.title}
      </h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#94A3B8]">
        <span className="font-semibold text-[#475569]">{notice.authorName}</span>
        <StaffBadge />
        <span>·</span>
        <span className="tabular-nums">{formatDateTime(notice.createdAt, true)}</span>
      </p>

      <div className="mt-8">
        <Body text={notice.content} />
      </div>
    </>
  );
}

/**
 * 자기소개 상세.
 *
 * 수정 버튼을 여기 두지 않습니다 — 자기소개는 학기당 한 장이라 목록의
 * "내 자기소개" 버튼이 곧 수정 버튼이고, 같은 폼을 두 곳에서 열면 어느 쪽이
 * 최신인지 헷갈립니다. 여기서는 삭제만 남깁니다(아래 소유자 영역).
 */
function IntroDetail({ profile }: { profile: SemesterProfile }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={STUDENT_STATUS_TONE[profile.status]} dot>{STUDENT_STATUS_LABEL[profile.status]}</StatusBadge>
        {profile.role && profile.role !== "Student" && <StatusBadge tone="blue">{profile.role}</StatusBadge>}
      </div>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{profile.fullName}</h1>
      <p className="mt-3 text-sm text-[#94A3B8]">
        {profile.major && <span className="font-semibold text-[#475569]">{profile.major}</span>}
        {profile.major && <span className="mx-2">·</span>}
        <span className="tabular-nums">등록 {formatDateTime(profile.createdAt)}</span>
      </p>

      <div className="mt-8 space-y-8">
        {profile.bio && <Section title="소개"><Body text={profile.bio} /></Section>}

        {profile.techStack.length > 0 && (
          <Section title="기술 스택">
            <div className="flex flex-wrap gap-1.5">
              {profile.techStack.map((item) => (
                <span key={item} className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">{item}</span>
              ))}
            </div>
          </Section>
        )}

        {(profile.githubUrl || profile.portfolioUrl) && (
          <Section title="링크">
            <div className="flex flex-wrap gap-2">
              {profile.githubUrl && <ExternalLinkButton href={profile.githubUrl} icon={<Github size={15} />} label="GitHub" />}
              {profile.portfolioUrl && <ExternalLinkButton href={profile.portfolioUrl} icon={<ExternalLink size={15} />} label="포트폴리오" />}
            </div>
          </Section>
        )}
      </div>

      {profile.status === "LOOKING" && (
        <p className="mt-8 rounded-xl bg-[#EFF6FF] px-4 py-3.5 text-sm leading-6 text-[#1D4ED8]">
          아직 팀을 찾고 있습니다. 함께하고 싶다면 아래 댓글로 어떤 팀인지 알려 주세요.
        </p>
      )}
    </>
  );
}

/** 새 탭으로 여는 외부 링크. 결과물 링크와 같은 모양을 씁니다. */
function ExternalLinkButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-xl border border-[#CBD5E1] bg-white px-4 py-2.5 text-sm font-bold text-[#475569]",
        focusRing,
        "transition-colors hover:border-[#2563EB] hover:text-[#2563EB]",
      )}
    >
      {icon}
      {label}
    </a>
  );
}

function RecruitDetail({ post, staffIds }: { post: RecruitPost; staffIds: Set<string> }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={post.status === "Recruiting" ? "green" : "slate"} dot>
          {RECRUIT_STATUS_LABEL[post.status]}
        </StatusBadge>
        <StatusBadge tone="blue">{PROJECT_PHASE_LABEL[post.projectPhase]}</StatusBadge>
      </div>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{post.title}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#94A3B8]">
        <AuthorLabel name={post.authorName} authorId={post.authorId} staffIds={staffIds} className="text-[#475569]" />
        <span>·</span>
        <span className="tabular-nums">{formatDateTime(post.createdAt, true)}</span>
      </p>

      <div className="mt-8 space-y-8">
        <Section title="아이디어 소개"><Body text={post.content} /></Section>

        <Section title={`모집 역할 · 총 ${countOpenRoles(post.recruitingRoles)}명`}>
          {post.recruitingRoles.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">지정된 역할이 없습니다.</p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {post.recruitingRoles.map((role) => (
                <li key={role.role} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <span className="text-sm font-bold">{role.role}</span>
                  <span className="text-sm font-semibold tabular-nums text-[#2563EB]">{role.count}명</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {post.tags.length > 0 && (
          <Section title="태그">
            <div className="flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-lg bg-[#F1F5F9] px-2.5 py-1 text-xs font-semibold text-[#475569]">#{tag}</span>
              ))}
            </div>
          </Section>
        )}
      </div>

      {post.status === "Recruiting" && (
        <p className="mt-8 rounded-xl bg-[#EFF6FF] px-4 py-3.5 text-sm leading-6 text-[#1D4ED8]">
          관심 있다면 아래 댓글로 어떤 역할을 맡고 싶은지 남겨 주세요. 작성자에게 바로 보입니다.
        </p>
      )}
    </>
  );
}

function ProposalDetail({ proposal, files }: { proposal: Proposal; files: CourseFile[] }) {
  const deadline = getProposalDeadline(proposal.deadline);
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone="slate">{proposal.companyName}</StatusBadge>
        {deadline ? (
          <StatusBadge tone={deadline.tone} dot={!deadline.expired}>{deadline.label}</StatusBadge>
        ) : (
          <StatusBadge tone="blue">상시 모집</StatusBadge>
        )}
      </div>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{proposal.title}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#94A3B8]">
        <StaffBadge />
        <span className="tabular-nums">등록 {formatDateTime(proposal.createdAt, true)}</span>
      </p>

      <div className="mt-8 space-y-8">
        <Section title="제안 내용"><Body text={proposal.content} /></Section>

        {proposal.categories.length > 0 && (
          <Section title="분야">
            <div className="flex flex-wrap gap-1.5">
              {proposal.categories.map((item) => (
                <span key={item} className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">{item}</span>
              ))}
            </div>
          </Section>
        )}

        {files.length > 0 && (
          <Section title={`첨부파일 ${files.length}건`}>
            <ul className="space-y-2">
              {files.map((file) => (
                <li key={file.id}>
                  <a
                    href={getProposalFileUrl(file.storagePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 transition-colors hover:border-[#2563EB] hover:bg-[#F8FAFC]",
                      focusRing,
                    )}
                  >
                    <Paperclip size={15} className="shrink-0 text-[#94A3B8]" />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{file.fileName}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-[#94A3B8]">
                      {formatBytes(file.sizeBytes)}
                    </span>
                    <Download size={15} className="shrink-0 text-[#2563EB]" />
                  </a>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {proposal.deadline && (
            <Section title="지원 마감">
              <p className="inline-flex items-center gap-2 text-sm font-bold tabular-nums">
                <CalendarClock size={15} className="text-[#2563EB]" />{proposal.deadline}
              </p>
            </Section>
          )}
          {proposal.contact && (
            <Section title="담당자 연락처">
              <p className="inline-flex items-center gap-2 break-all text-sm font-bold">
                <Mail size={15} className="shrink-0 text-[#2563EB]" />{proposal.contact}
              </p>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function TeamDetail({ team, deliverables, staffIds }: { team: CourseTeam; deliverables: Deliverable[]; staffIds: Set<string> }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={team.status === "Activities" ? "blue" : "green"} dot>
          {TEAM_STATUS_LABEL[team.status]}
        </StatusBadge>
        <span className="inline-flex items-center gap-1 text-sm font-semibold text-[#64748B]">
          <Users size={14} />
          <span className="tabular-nums">{team.members.length}</span>명
        </span>
      </div>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{team.teamName}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#94A3B8]">
        <AuthorLabel name={`팀장 ${team.leaderName}`} authorId={team.leaderId} staffIds={staffIds} className="text-[#475569]" />
        <span>·</span>
        <span className="tabular-nums">등록 {formatDateTime(team.createdAt)}</span>
      </p>

      <div className="mt-8 space-y-8">
        <Section title="프로젝트 아이템"><Body text={team.projectItem} /></Section>

        <Section title="팀원">
          <ul className="grid gap-2 sm:grid-cols-2">
            {team.members.map((member, index) => (
              <li key={`${member.name}-${index}`} className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-xs font-bold text-[#2563EB]">
                  {member.name.slice(0, 1)}
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-bold">{member.name}</strong>
                  {member.role && <span className="block truncate text-xs font-semibold text-[#94A3B8]">{member.role}</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="이 팀의 결과물">
          {deliverables.length === 0 ? (
            <p className="text-sm text-[#94A3B8]">아직 등록된 중간·기말 결과물이 없습니다.</p>
          ) : (
            <ul className="space-y-2">
              {deliverables.map((item) => (
                <li key={item.id}>
                  <Link
                    href={courseHref("showcase", item.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-white px-4 py-3 transition-colors hover:border-[#2563EB] hover:bg-[#F8FAFC]",
                      focusRing,
                    )}
                  >
                    <StatusBadge tone={item.phase === "final" ? "green" : "amber"}>
                      {DELIVERABLE_PHASE_LABEL[item.phase]}
                    </StatusBadge>
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </>
  );
}

function ShowcaseDetail({ deliverable }: { deliverable: Deliverable }) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={deliverable.phase === "final" ? "green" : "amber"}>
          {DELIVERABLE_PHASE_LABEL[deliverable.phase]}
        </StatusBadge>
        <Link href={courseHref("team", deliverable.teamId)} className={cn("text-sm font-bold text-[#2563EB] hover:underline", focusRing)}>
          {deliverable.teamName}
        </Link>
      </div>
      <h1 className="mt-4 text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">{deliverable.title}</h1>
      <p className="mt-3 text-sm tabular-nums text-[#94A3B8]">최종 수정 {formatDateTime(deliverable.updatedAt, true)}</p>

      <div className="mt-8 space-y-8">
        <Section title="요약"><Body text={deliverable.summary} /></Section>

        {deliverable.techStack.length > 0 && (
          <Section title="기술 스택">
            <div className="flex flex-wrap gap-1.5">
              {deliverable.techStack.map((item) => (
                <span key={item} className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">{item}</span>
              ))}
            </div>
          </Section>
        )}

        <Section title="링크"><DeliverableLinks deliverable={deliverable} /></Section>
      </div>
    </>
  );
}
