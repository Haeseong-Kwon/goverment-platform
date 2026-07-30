import type { CalendarItem, ConversionCode, TeamInvite, TeamMember, TrackedSubmission, VaultDocument, VaultFolder } from "../services/FounderWorkspaceService";
import type { ManagerReviewSubmission, PersistedTask, StartupProfile, SavedEligibilityReport, SubmissionEvidenceFile } from "../services/WorkspaceService";
import type { EligibilityAnswers, EligibilityReport } from "@/features/startup-workspace/domain";
import {
  DEV_CONVERSION_CODES,
  DEV_INSTITUTION,
  DEV_INVITE,
  DEV_MEMBERS,
  DEV_PROGRAM_DEADLINES,
  DEV_TEAM_NAME,
  devState,
  devUpdate,
  devVerdict,
  type DevSubmission,
} from "./fixtures";
import { DEV_USER, currentDevRole } from "./devMode";

/** 개발용 진입 모드에서 각 서비스 함수가 대신 돌려주는 값입니다. 실제 스키마와 같은 모양을 지킵니다. */

const won = (value: number) => `${new Intl.NumberFormat("ko-KR").format(value)}원`;
const nextId = () => `dev-${Math.random().toString(36).slice(2, 10)}`;

export function devProfile(): StartupProfile {
  const role = currentDevRole();
  return {
    id: DEV_USER.id,
    role,
    onboardingComplete: true,
    institutionId: role === "manager" ? "dev-institution" : null,
  };
}

export function devTasks(): PersistedTask[] {
  return devState().tasks
    .filter((task) => !task.is_hidden)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

export function devCreateTask(title: string, dueDate?: string): PersistedTask {
  const created: PersistedTask = {
    id: nextId(),
    title: title.trim(),
    due_date: dueDate || null,
    status: "todo",
    task_type: "custom",
    is_hidden: false,
  };
  devUpdate((current) => ({ ...current, tasks: [...current.tasks, created] }));
  return created;
}

export function devUpdateTask(taskId: string, changes: Partial<Pick<PersistedTask, "status" | "is_hidden">>): PersistedTask {
  const next = devUpdate((current) => ({
    ...current,
    tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...changes } : task)),
  }));
  const found = next.tasks.find((task) => task.id === taskId);
  if (!found) throw new Error("할 일을 찾지 못했습니다.");
  return found;
}

/** 제출 건에 연결된 보관함 파일. 실제 스키마의 submission_evidence 조회와 같은 결과를 냅니다. */
function devEvidenceFiles(submission: DevSubmission): SubmissionEvidenceFile[] {
  const documents = devState().vault;
  return (submission.documentIds ?? []).flatMap((documentId) => {
    const document = documents.find((item) => item.id === documentId);
    return document
      ? [{ documentId: document.id, fileName: document.fileName, storagePath: document.storagePath, version: document.version }]
      : [];
  });
}

const toManagerRow = (submission: DevSubmission): ManagerReviewSubmission => ({
  id: submission.id,
  title: submission.title,
  team: submission.team,
  amount: won(submission.amount),
  evidenceCount: devEvidenceFiles(submission).length,
  role: "founder",
  status: submission.status,
  validation: submission.validation,
  createdAt: submission.createdAt,
  verdict: devVerdict(submission),
  expense: submission.expense,
  files: devEvidenceFiles(submission),
});

export function devManagerSubmissions(): ManagerReviewSubmission[] {
  return devState().submissions.map(toManagerRow);
}

/** 창업자 화면에서는 자기 팀 건만 봅니다. 매니저 큐와 다른 범위라는 점이 화면으로 드러나야 합니다. */
export function devTrackedSubmissions(): TrackedSubmission[] {
  return devState()
    .submissions.filter((submission) => submission.team === DEV_TEAM_NAME)
    .map((submission) => ({
      id: submission.id,
      title: submission.title,
      amount: submission.amount,
      status: submission.status === "requested" ? "validated" : submission.status,
      validation: submission.validation,
      createdAt: submission.createdAt,
      decision: submission.review,
    }));
}

export function devRequestReview(input: { title: string; amount: number; expense: Record<string, unknown>; documentIds?: string[] }) {
  const created: DevSubmission = {
    id: nextId(),
    team: DEV_TEAM_NAME,
    title: input.title,
    amount: input.amount,
    status: "validated",
    validation: "passed",
    createdAt: new Date().toISOString(),
    expense: input.expense as unknown as DevSubmission["expense"],
    documentIds: input.documentIds ?? [],
  };
  devUpdate((current) => ({ ...current, submissions: [created, ...current.submissions] }));
  return created.id;
}

export function devReviewDecision(submissionId: string, decision: "approved" | "rejected", payload: { reasonCodes: string[]; feedback: string }) {
  devUpdate((current) => ({
    ...current,
    submissions: current.submissions.map((submission) =>
      submission.id === submissionId
        ? {
            ...submission,
            status: decision,
            review: {
              decision,
              reasonCode: payload.reasonCodes.join(",") || null,
              feedback: payload.feedback,
              createdAt: new Date().toISOString(),
            },
          }
        : submission,
    ),
  }));
  return submissionId;
}

export function devRejectionReasonCodes(): string[] {
  return devState()
    .submissions.filter((submission) => submission.review?.decision === "rejected")
    .flatMap((submission) => String(submission.review?.reasonCode ?? "").split(","))
    .filter(Boolean);
}

export function devCalendarItems(): CalendarItem[] {
  const tasks: CalendarItem[] = devState()
    .tasks.filter((task) => !task.is_hidden && task.due_date)
    .map((task) => ({ id: task.id, title: task.title, date: task.due_date as string, kind: "task", status: task.status }));

  const programs: CalendarItem[] = DEV_PROGRAM_DEADLINES.map((program) => ({
    id: `program-${program.id}`,
    title: `${program.name} 마감`,
    date: program.deadline,
    kind: "program",
  }));

  return [...tasks, ...programs].sort((a, b) => a.date.localeCompare(b.date));
}

export function devVaultDocuments(): VaultDocument[] {
  return devState().vault;
}

export function devUploadVaultDocument(folder: VaultFolder, file: File): VaultDocument {
  const existing = devState().vault.filter((item) => item.folder === folder && item.fileName === file.name);
  const version = existing.reduce((max, item) => Math.max(max, item.version), 0) + 1;
  const created: VaultDocument = {
    id: nextId(),
    folder,
    fileName: file.name,
    storagePath: `dev/${folder}/v${version}-${file.name}`,
    version,
    createdAt: new Date().toISOString(),
  };
  devUpdate((current) => ({ ...current, vault: [created, ...current.vault] }));
  return created;
}

export function devMembers(): TeamMember[] {
  return DEV_MEMBERS;
}

export function devInvite(): TeamInvite {
  return DEV_INVITE;
}

export function devConversionCodes(): ConversionCode[] {
  return DEV_CONVERSION_CODES;
}

export function devInstitutionName(): string | null {
  return currentDevRole() === "pre_founder" ? null : DEV_INSTITUTION;
}

export function devWaitlistJoin(tab: string) {
  devUpdate((current) => ({ ...current, waitlist: current.waitlist.includes(tab) ? current.waitlist : [...current.waitlist, tab] }));
}

export function devWaitlist(): string[] {
  return devState().waitlist;
}

export function devBizplanEvents(): string[] {
  return devState().bizplanEvents;
}

export function devTrackEvent(eventName: string) {
  if (eventName !== "bizplan_diagnosis") return;
  devUpdate((current) => ({ ...current, bizplanEvents: [new Date().toISOString(), ...current.bizplanEvents] }));
}

export function devSaveEligibility(programId: string, answers: EligibilityAnswers, report: EligibilityReport) {
  devUpdate((current) => ({ ...current, eligibility: { programId, answers, report, createdAt: new Date().toISOString() } }));
}

export function devLatestEligibility(): SavedEligibilityReport | null {
  return devState().eligibility;
}

export function devCompleteOnboarding() {
  return { teamId: "dev-team", redirect: "/founder" };
}
