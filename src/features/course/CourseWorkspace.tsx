"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Github,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Users,
} from "lucide-react";
import { getMyCourseActivity, type StudentActivity } from "@/lib/services/CourseService";
import {
  COURSE,
  DELIVERABLE_PHASE_LABEL,
  RECRUIT_STATUS_LABEL,
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_TONE,
  TEAM_STATUS_LABEL,
  courseHref,
  formatDateTime,
  getStudentProgress,
  getStudentSteps,
  type DeliverablePhase,
  type SemesterProfile,
} from "./course";
import { CourseShell, MembershipNotice, SignInPrompt, useViewer } from "./CourseChrome";
import { DeliverableForm, RecruitForm, SemesterProfileForm, TeamForm } from "./forms";
import {
  Button,
  EmptyState,
  Notice,
  Panel,
  ProgressBar,
  Skeleton,
  StatusBadge,
  focusRing,
  liftCard,
} from "@/features/startup-workspace/ui";
import { toMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

type OpenForm = "profile" | "recruit" | "team" | "deliverable" | null;

/**
 * 수강생 워크스페이스.
 *
 * 게시판은 과목 전체가 함께 보는 곳이고, 여기는 "내 것"만 모읍니다 —
 * 내 프로필, 내가 올린 모집글, 내가 속한 팀, 우리 팀 결과물.
 *
 * 창업자 워크스페이스(`/founder`)와 완전히 분리합니다. 수강생에게 필요한 것은
 * 지원사업 마감이나 정산이 아니라 이번 학기 팀빌딩과 발표이고, 두 화면이 섞이면
 * 양쪽 다 자기 맥락을 잃습니다.
 */
export function CourseWorkspace() {
  const viewer = useViewer();
  const [activity, setActivity] = useState<StudentActivity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openForm, setOpenForm] = useState<OpenForm>(null);

  const reload = useCallback(() => {
    getMyCourseActivity()
      .then(setActivity)
      .catch((reason) => {
        setError(toMessage(reason, "내 활동을 불러오지 못했습니다."));
        setActivity({ profile: null, posts: [], teams: [], deliverables: [] });
      });
  }, []);

  useEffect(() => {
    if (viewer.loading || !viewer.id) return;
    reload();
  }, [viewer.loading, viewer.id, reload]);

  if (viewer.loading) {
    return (
      <CourseShell active="me">
        <Skeleton className="h-10 w-52" />
        <Skeleton className="mt-4 h-64 w-full" />
      </CourseShell>
    );
  }

  if (!viewer.id) {
    return (
      <CourseShell active="me">
        <EmptyState
          title="로그인하면 내 활동이 모입니다"
          description="수강생 프로필, 내가 올린 모집글, 우리 팀과 결과물 제출 현황을 한 화면에서 봅니다. 게시판을 읽는 데는 로그인이 필요 없습니다."
          action={<SignInPrompt action="워크스페이스 열기" />}
        />
      </CourseShell>
    );
  }

  const steps = getStudentSteps({
    hasProfile: Boolean(activity?.profile),
    recruitPostCount: activity?.posts.length ?? 0,
    teamCount: activity?.teams.length ?? 0,
    deliverablePhases: (activity?.deliverables ?? []).map((item) => item.phase),
  });
  const progress = getStudentProgress(steps);

  // 로그인은 했지만 학교 메일 인증이 안 끝난 상태. 버튼을 눌러도 RLS가 거절하므로
  // 아예 띄우지 않고 이유를 먼저 말합니다.
  const canWrite = viewer.member;

  const openFor = (stepId: string) =>
    stepId === "profile" ? "profile"
    : stepId === "recruit" ? "recruit"
    : stepId === "team" ? "team"
    : "deliverable";

  return (
    <CourseShell active="me">
      <header className="mb-6">
        <h1 className="text-[26px] font-bold leading-tight tracking-tight md:text-[32px]">내 워크스페이스</h1>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          {COURSE.label} · 이번 학기 내 활동만 모아 봅니다.
        </p>
      </header>

      {error && <Notice tone="error" className="mb-4" onDismiss={() => setError(null)}>{error}</Notice>}

      {!canWrite && (
        <div className="mb-6">
          <MembershipNotice action="글을 남길" banned={viewer.banned} />
        </div>
      )}

      {activity === null ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <Panel title="이번 학기 진행">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-[32px] font-bold leading-none tabular-nums">{progress.percent}%</span>
              <span className="text-sm font-semibold text-[#64748B]">
                {progress.done} / {progress.total} 단계 완료
              </span>
            </div>
            <ProgressBar value={progress.percent} className="mt-4" />

            {progress.next && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#EFF6FF] px-4 py-3.5">
                <p className="text-sm font-bold text-[#1D4ED8]">다음 할 일 — {progress.next.title}</p>
                {canWrite && (
                  <Button size="sm" onClick={() => setOpenForm(openFor(progress.next!.id))}>{progress.next.cta}</Button>
                )}
              </div>
            )}

            <ol className="mt-5 space-y-2">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={cn(
                    "flex items-start gap-3 rounded-xl border px-4 py-3",
                    step.done ? "border-[#BBF7D0] bg-[#F0FDF4]" : "border-[#E2E8F0] bg-white",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full",
                      step.done ? "bg-[#16A34A] text-white" : "border border-[#CBD5E1] bg-white",
                    )}
                  >
                    {step.done && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className={cn("block text-sm font-bold", step.done && "text-[#166534]")}>
                      {step.title}
                    </strong>
                    <span className="mt-0.5 block text-xs leading-5 text-[#64748B]">{step.description}</span>
                  </span>
                  <Link
                    href={step.href}
                    className={cn("shrink-0 self-center text-xs font-bold text-[#2563EB] hover:underline", focusRing)}
                  >
                    바로가기
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>

          <ProfileCard profile={activity.profile} onEdit={canWrite ? () => setOpenForm("profile") : null} />

          <Panel
            title="내가 올린 모집글"
            action={
              canWrite ? (
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setOpenForm("recruit")}>
                  모집글 쓰기
                </Button>
              ) : null
            }
          >
            {activity.posts.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#64748B]">
                아직 올린 모집글이 없습니다. 다른 팀의 모집글에 댓글로 지원하는 방법도 있습니다.
              </p>
            ) : (
              <ul className="space-y-2">
                {activity.posts.map((post) => (
                  <li key={post.id}>
                    <Link href={courseHref("recruit", post.id)} className={cn("block rounded-xl border border-[#E2E8F0] p-4", liftCard, focusRing)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge tone={post.status === "Recruiting" ? "green" : "slate"} dot>
                          {RECRUIT_STATUS_LABEL[post.status]}
                        </StatusBadge>
                        <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#64748B]">
                          <MessageSquare size={13} />
                          <span className="tabular-nums">{post.commentCount}</span>
                        </span>
                      </div>
                      <strong className="mt-2 block truncate text-sm font-bold">{post.title}</strong>
                      <span className="mt-1 block text-xs tabular-nums text-[#94A3B8]">{formatDateTime(post.createdAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="내 팀"
            action={
              canWrite ? (
                <Button variant="secondary" size="sm" icon={<Plus size={14} />} onClick={() => setOpenForm("team")}>
                  팀 등록
                </Button>
              ) : null
            }
          >
            {activity.teams.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-8 text-center text-sm text-[#64748B]">
                등록된 팀이 없습니다. 팀 구성이 끝났다면 팀장이 등록해 주세요.
              </p>
            ) : (
              <ul className="space-y-3">
                {activity.teams.map((team) => (
                  <li key={team.id} className="rounded-xl border border-[#E2E8F0] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={team.status === "Activities" ? "blue" : "green"} dot>
                        {TEAM_STATUS_LABEL[team.status]}
                      </StatusBadge>
                      {team.leaderId === viewer.id && <StatusBadge tone="slate">팀장</StatusBadge>}
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#64748B]">
                        <Users size={13} />
                        <span className="tabular-nums">{team.members.length}</span>명
                      </span>
                      <Link
                        href={courseHref("team", team.id)}
                        className={cn("ml-auto inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] hover:underline", focusRing)}
                      >
                        팀 페이지 <ArrowRight size={12} />
                      </Link>
                    </div>
                    <strong className="mt-2 block text-base font-bold">{team.teamName}</strong>
                    <p className="mt-1 line-clamp-1 text-sm text-[#475569]">{team.projectItem}</p>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {(["midterm", "final"] as DeliverablePhase[]).map((phase) => {
                        const submitted = activity.deliverables.find(
                          (item) => item.teamId === team.id && item.phase === phase,
                        );
                        return (
                          <div
                            key={phase}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-semibold",
                              submitted ? "border-[#BBF7D0] bg-[#F0FDF4] text-[#166534]" : "border-[#E2E8F0] bg-[#F8FAFC] text-[#94A3B8]",
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate">
                              {DELIVERABLE_PHASE_LABEL[phase]} {submitted ? "제출됨" : "미제출"}
                            </span>
                            {submitted ? (
                              <Link href={courseHref("showcase", submitted.id)} className={cn("shrink-0 font-bold text-[#2563EB] hover:underline", focusRing)}>
                                보기
                              </Link>
                            ) : team.leaderId === viewer.id && canWrite ? (
                              <button
                                type="button"
                                onClick={() => setOpenForm("deliverable")}
                                className={cn("shrink-0 font-bold text-[#2563EB] hover:underline", focusRing)}
                              >
                                등록
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      )}

      {openForm === "profile" && (
        <SemesterProfileForm
          current={activity?.profile ?? null}
          onClose={() => setOpenForm(null)}
          onSaved={() => { setOpenForm(null); reload(); }}
        />
      )}
      {openForm === "recruit" && <RecruitForm onClose={() => setOpenForm(null)} onCreated={() => { setOpenForm(null); reload(); }} />}
      {openForm === "team" && <TeamForm onClose={() => setOpenForm(null)} onCreated={() => { setOpenForm(null); reload(); }} />}
      {openForm === "deliverable" && <DeliverableForm onClose={() => setOpenForm(null)} onCreated={() => { setOpenForm(null); reload(); }} />}
    </CourseShell>
  );
}

/** 팀빌딩 게시판에서 남들이 보게 될 모습 그대로 보여 줍니다. 미리보기와 편집을 겸합니다. */
function ProfileCard({ profile, onEdit }: { profile: SemesterProfile | null; onEdit: (() => void) | null }) {
  if (!profile) {
    return (
      <Panel title="내 자기소개">
        <EmptyState
          title="이번 학기 프로필이 아직 없습니다"
          description="전공과 희망 역할, 기술 스택을 적어 두면 팀을 찾는 쪽에서 먼저 연락이 옵니다. 학기마다 따로 저장됩니다."
          action={onEdit ? <Button onClick={onEdit} icon={<Plus size={15} />}>프로필 작성</Button> : undefined}
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="내 자기소개"
      action={
        onEdit ? <Button variant="secondary" size="sm" icon={<Pencil size={13} />} onClick={onEdit}>수정</Button> : null
      }
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={STUDENT_STATUS_TONE[profile.status]} dot>{STUDENT_STATUS_LABEL[profile.status]}</StatusBadge>
        {profile.role && profile.role !== "Student" && <StatusBadge tone="blue">{profile.role}</StatusBadge>}
      </div>

      <p className="mt-3 text-lg font-bold">
        {profile.fullName}
        {profile.major && <span className="ml-2 text-sm font-semibold text-[#94A3B8]">{profile.major}</span>}
      </p>

      {profile.bio && <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#475569]">{profile.bio}</p>}

      {profile.techStack.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.techStack.map((item) => (
            <span key={item} className="rounded-lg bg-[#EFF6FF] px-2.5 py-1 text-xs font-semibold text-[#2563EB]">{item}</span>
          ))}
        </div>
      )}

      {(profile.githubUrl || profile.portfolioUrl) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.githubUrl && <ProfileLink href={profile.githubUrl} icon={<Github size={14} />} label="GitHub" />}
          {profile.portfolioUrl && <ProfileLink href={profile.portfolioUrl} icon={<Link2 size={14} />} label="포트폴리오" />}
        </div>
      )}
    </Panel>
  );
}

function ProfileLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border border-[#CBD5E1] px-3 py-2 text-xs font-bold text-[#475569]",
        focusRing,
        "transition-colors hover:border-[#2563EB] hover:text-[#2563EB]",
      )}
    >
      {icon}
      {label}
    </a>
  );
}
