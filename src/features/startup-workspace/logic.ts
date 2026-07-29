import type { DashboardTaskInput, ManagerSubmissionInput, ReviewVisibilityInput, StartupMilestone, StartupRole } from "./types";

const sidebarByRole: Record<StartupRole, Array<{ label: string; href: string }>> = {
  pre_founder: [
    { label: "홈", href: "/founder" },
    { label: "팀 TODO", href: "/founder/todo" },
    { label: "마감 캘린더", href: "/founder/calendar" },
    { label: "AI 진단", href: "/founder/diagnostics" },
    { label: "계산기", href: "/founder/calculator" },
    { label: "법인 설립", href: "/founder/incorporation" },
    { label: "커넥트", href: "/founder/connect" },
    { label: "서류 보관함", href: "/founder/vault" },
    { label: "팀 설정", href: "/founder/settings" },
  ],
  founder: [
    { label: "홈", href: "/workspace" },
    { label: "정산 사전검증", href: "/workspace/precheck" },
    { label: "사전심의 합본", href: "/workspace/predeliberation" },
    { label: "상태 트래커", href: "/workspace/tracker" },
    { label: "서류 보관함", href: "/workspace/vault" },
    { label: "팀 설정", href: "/workspace/settings" },
  ],
  manager: [
    { label: "대시보드", href: "/manager" },
    { label: "검토 큐", href: "/manager/review" },
    { label: "사업비 계획 검토", href: "/manager/plan-review" },
    { label: "팀 관리", href: "/manager/teams" },
    { label: "리포트", href: "/manager/reports" },
    { label: "설정", href: "/manager/settings" },
  ],
};

export function getDdayTone(dday: number) {
  if (dday <= 3) return "red";
  if (dday <= 7) return "amber";
  return "slate";
}

export function getSidebarItems(role: StartupRole) {
  return sidebarByRole[role].map((item) => item.label);
}

export function getSidebarLinks(role: StartupRole) {
  return sidebarByRole[role];
}

export function isSidebarLinkActive(href: string, pathname: string | null | undefined) {
  if (!pathname) return false;
  if (pathname === href) return true;
  const isSectionRoot = ["/founder", "/workspace", "/manager"].includes(href);
  return !isSectionRoot && pathname.startsWith(`${href}/`);
}

export function getFounderDashboardSummary(tasks: DashboardTaskInput[]) {
  const visibleTasks = tasks.filter((task) => !task.is_hidden);
  const remainingTasks = visibleTasks.filter((task) => task.status !== "done").length;
  const automaticTasks = visibleTasks.filter((task) => task.task_type === "auto").length;
  const doneTasks = visibleTasks.filter((task) => task.status === "done").length;
  const completionRate = visibleTasks.length ? Math.round((doneTasks / visibleTasks.length) * 100) : 0;
  const nextDueDate = visibleTasks
    .filter((task) => task.status !== "done" && task.due_date)
    .map((task) => task.due_date as string)
    .sort()[0] ?? null;
  return { remainingTasks, automaticTasks, completionRate, nextDueDate };
}

export function getManagerDashboardSummary(submissions: ManagerSubmissionInput[], now = new Date()) {
  const visibleSubmissions = submissions.filter((submission) => canManagerSeeReviewItem(submission));
  const requestCount = visibleSubmissions.length;
  const rejectedCount = visibleSubmissions.filter((submission) => submission.status === "rejected").length;
  const delayedCount = visibleSubmissions.filter((submission) => {
    const createdAt = new Date(submission.createdAt).getTime();
    return Number.isFinite(createdAt) && now.getTime() - createdAt >= 3 * 86_400_000;
  }).length;
  const totalWaitDays = visibleSubmissions.reduce((sum, submission) => {
    const createdAt = new Date(submission.createdAt).getTime();
    if (!Number.isFinite(createdAt)) return sum;
    return sum + Math.max(0, (now.getTime() - createdAt) / 86_400_000);
  }, 0);
  return {
    requestCount,
    rejectionRate: requestCount ? Math.round((rejectedCount / requestCount) * 100) : 0,
    delayedCount,
    averageWaitDays: requestCount ? Math.round((totalWaitDays / requestCount) * 10) / 10 : 0,
  };
}

export function getLandingNavigation(role: "founder" | "manager") {
  return {
    homeHref: "/",
    counterpartHref: role === "founder" ? "/manager/landing" : "/",
    workspaceEntryHref: "/workspace-entry",
  };
}

export function getStartupMilestones(program: string): StartupMilestone[] {
  return [
    ["plan", "사업계획서 초안 완성", 14, "김하나", 3],
    ["proof", "증빙 서류 준비", 10, "박민준", 1],
    ["rehearsal", "발표 리허설", 7, "정서연", 2],
    ["review", "최종 검토 요청", 1, "김하나", 5],
  ].map(([id, title, dday, owner, comments]) => ({
    id: `${program}-${id}`,
    title: `${program} ${title}`,
    dday: Number(dday),
    owner: String(owner),
    comments: Number(comments),
    isAutomatic: true,
    action: "hide" as const,
  }));
}

export function getMonthlyDiagnosticUsage(events: string[], now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const used = events.filter((event) => {
    const date = new Date(event);
    return date.getUTCFullYear() === year && date.getUTCMonth() === month;
  }).length;
  const remaining = Math.max(0, 2 - used);
  return { used, remaining, isExhausted: remaining === 0 };
}

export function canManagerSeeReviewItem(item: ReviewVisibilityInput) {
  return item.role === "founder" && ["requested", "validated", "in_review", "approved", "rejected"].includes(item.status) && item.validation === "passed";
}

export function convertPreFounderToFounder<T extends { vaultFiles: string[]; members: string[] }>(prepTeam: T) {
  return {
    role: "founder" as const,
    transferred: {
      vaultFiles: prepTeam.vaultFiles,
      members: prepTeam.members,
    },
    retainedInPrepTeam: ["TODO", "진단 점수", "초안"],
  };
}
