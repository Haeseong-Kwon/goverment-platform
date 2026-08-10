import { buildAnnouncementUrl, type CalendarItem, type ConversionCode, type TeamInvite, type TeamMember, type TrackedSubmission, type VaultDocument, type VaultFolder } from "../services/FounderWorkspaceService";
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
import { matchesAnnouncementFilters, type Announcement } from "../kstartup/announcements";
import { toKstDateKey } from "@/features/startup-workspace/logic";

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

export function devCreateTask(title: string, dueDate?: string, announcementSn?: number): PersistedTask {
  // 실제 DB의 (팀, 공고) 유니크 인덱스와 같은 규칙을 개발 모드에서도 적용합니다.
  if (announcementSn !== undefined && devState().tasks.some((task) => task.announcement_sn === announcementSn)) {
    throw new Error("이미 캘린더에 담은 공고입니다.");
  }
  const created: PersistedTask = {
    id: nextId(),
    title: title.trim(),
    due_date: dueDate || null,
    status: "todo",
    task_type: "custom",
    is_hidden: false,
    assignee_id: null,
    comment_count: 0,
    announcement_sn: announcementSn ?? null,
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

/** 검토 착수. 프로덕션의 claim_settlement_submission과 같은 멱등 규칙을 따릅니다. */
export function devClaimSubmission(submissionId: string) {
  devUpdate((current) => ({
    ...current,
    submissions: current.submissions.map((submission) =>
      submission.id === submissionId && submission.status === "validated" ? { ...submission, status: "in_review" as const } : submission,
    ),
  }));
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
  const state = devState();
  const commentCount = (taskId: string) => state.comments.filter((comment) => comment.taskId === taskId).length;

  const tasks: CalendarItem[] = state.tasks
    .filter((task) => !task.is_hidden && task.due_date)
    .map((task) => {
      const sn = task.announcement_sn ?? null;
      const announcement = devAnnouncements().find((item) => item.pbanc_sn === sn);
      return {
        id: task.id,
        taskId: task.id,
        title: task.title,
        date: task.due_date as string,
        kind: sn === null ? ("task" as const) : ("announcement" as const),
        status: task.status,
        commentCount: commentCount(task.id),
        ...(sn === null
          ? {}
          : {
              announcement: {
                sn,
                detailUrl: announcement?.detail_url ?? buildAnnouncementUrl(sn),
                startDate: announcement?.start_date ?? null,
                endDate: announcement?.end_date ?? null,
                supportField: announcement?.support_field ?? null,
                regions: announcement?.regions ?? [],
                resolved: Boolean(announcement),
              },
            }),
      };
    });

  const programs: CalendarItem[] = DEV_PROGRAM_DEADLINES.map((program) => ({
    id: `program-${program.id}`,
    taskId: null,
    title: `${program.name} 마감`,
    date: program.deadline,
    kind: "program",
    commentCount: 0,
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
  return [...devState().conversionCodes, ...DEV_CONVERSION_CODES];
}

const DEV_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function devIssueConversionCode(programId: string) {
  const code = Array.from(crypto.getRandomValues(new Uint8Array(8)), (byte) => DEV_CODE_ALPHABET[byte % DEV_CODE_ALPHABET.length]).join("");
  const issued: ConversionCode = {
    code,
    programId,
    expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    useCount: 0,
    maxUses: 100,
  };
  devUpdate((current) => ({ ...current, conversionCodes: [issued, ...current.conversionCodes] }));
  return code;
}

export function devTaskComments(taskId: string) {
  return devState().comments.filter((comment) => comment.taskId === taskId);
}

export function devAddTaskComment(taskId: string, content: string) {
  const created = {
    id: nextId(),
    taskId,
    authorId: DEV_USER.id,
    authorName: DEV_USER.fullName,
    content,
    createdAt: new Date().toISOString(),
  };
  devUpdate((current) => ({
    ...current,
    comments: [...current.comments, created],
    tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, comment_count: task.comment_count + 1 } : task)),
  }));
  return created;
}

export function devAssignTask(taskId: string, assigneeId: string | null) {
  devUpdate((current) => ({
    ...current,
    tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, assignee_id: assigneeId } : task)),
  }));
}

/** 협약 배정액 예시. 집행 누계는 실제 제출 건에서 계산해 화면과 판정이 어긋나지 않게 합니다. */
export function devBudgetLines() {
  const allocations = devState().budgets;
  const executed = devState()
    .submissions.filter((submission) => submission.team === DEV_TEAM_NAME && submission.status !== "rejected")
    .reduce<Record<string, number>>((acc, submission) => {
      const category = submission.expense.category;
      return { ...acc, [category]: (acc[category] ?? 0) + submission.amount };
    }, {});
  return Object.entries(allocations).map(([category, allocated]) => ({
    category,
    allocated,
    executed: executed[category] ?? 0,
    remaining: allocated - (executed[category] ?? 0),
  }));
}

export function devSaveBudget(category: string, allocatedAmount: number) {
  devUpdate((current) => ({ ...current, budgets: { ...current.budgets, [category]: Math.round(allocatedAmount) } }));
}

export function devProgramDeadlines(): Record<string, string | null> {
  return Object.fromEntries(DEV_PROGRAM_DEADLINES.map((program) => [program.id, program.deadline]));
}

export function devSelectedPrograms() {
  return DEV_PROGRAM_DEADLINES.map((program) => ({ id: program.id, name: program.name, deadline: program.deadline }));
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

/** 점수 추이 UI를 개발 모드에서도 볼 수 있게 두 버전을 넣어 둡니다. */
export function devBizplanHistory() {
  return [
    {
      score: 48,
      createdAt: "2026-06-02T02:00:00.000Z",
      psst: { problem: { score: 10, evidence: "문제 정의가 일반론에 머무릅니다." }, solution: { score: 14, evidence: "핵심 기능은 제시했습니다." }, scale_up: { score: 12, evidence: "시장 규모 근거가 없습니다." }, team: { score: 12, evidence: "역할 분담만 기술했습니다." } },
      swot: { strength: ["기술 역량"], weakness: ["시장 근거 부족"], opportunity: ["소상공인 디지털화"], threat: ["기존 솔루션"] },
      actions: ["문제의 손실 규모를 수치로 제시하세요.", "초기 진입 세분 시장을 특정하세요."],
    },
    {
      score: 62,
      createdAt: "2026-07-14T02:00:00.000Z",
      psst: { problem: { score: 17, evidence: "재고 손실률 12%를 인용했습니다." }, solution: { score: 17, evidence: "예측 알고리즘 구조를 설명했습니다." }, scale_up: { score: 14, evidence: "TAM은 있으나 SAM이 없습니다." }, team: { score: 14, evidence: "개발 경력을 명시했습니다." } },
      swot: { strength: ["문제 근거 확보", "기술 역량"], weakness: ["세분 시장 미정의"], opportunity: ["소상공인 디지털화"], threat: ["기존 솔루션"] },
      actions: ["SAM과 초기 목표 점유율을 추가하세요.", "경쟁 대비 차별점을 한 문단으로 정리하세요."],
    },
  ];
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

/**
 * K-Startup 공고 화면용 예시. 실제 API 응답 3건을 형태 그대로 옮기고 날짜만
 * 오늘 기준으로 밀어 접수중·접수예정·마감이 한 화면에 나오게 했습니다.
 */
function devAnnouncements(): Announcement[] {
  const today = toKstDateKey();
  const shift = (days: number) => new Date(Date.parse(`${today}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
  return [
    {
      pbanc_sn: 178845,
      title: "2026년 웰컴 투 팁스 1차 참가기업 모집 (충청권)",
      summary: "충청권 소재의 유망한 기술 기반 초기 창업기업을 발굴하여, 팁스(TIPS) 사업 연계 등 사업 성장을 지원하는 『2026년 웰컴 투 팁스』프로그램의 참가기업을 아래와 같이 공고합니다.",
      start_date: shift(-3), end_date: shift(5),
      support_field: "행사ㆍ네트워크",
      regions: ["전국"], biz_ages: ["3년미만"], applicant_types: ["일반기업", "1인 창조기업"],
      target_ages: ["만 20세 이상 ~ 만 39세 이하", "만 40세 이상"],
      organizer: "(주)로우파트너스", supervising_institution: "민간", department: "프리팁스 투자육성부", contact: "0428629583",
      apply_target: "충청권(대전·세종·충남·충북) 소재 창업 후 2년 3개월 미만 기업",
      exclude_target: "팁스 R&D 및 팁스 연계 사업에 선정되어 협약을 체결한 이력이 있는 창업기업(대표자 포함)은 신청 불가",
      apply_methods: { 온라인: "https://buly.kr/HHf3KNe" },
      notes: null,
      detail_url: "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=178845",
      guide_url: null, is_integrated: false,
    },
    {
      pbanc_sn: 178702,
      title: "2026년 예비창업패키지 예비창업자 모집 공고",
      summary: "혁신적인 기술창업 아이디어를 보유한 예비창업자의 성공적인 창업사업화를 지원합니다.",
      start_date: shift(7), end_date: shift(30),
      support_field: "사업화",
      regions: ["전국"], biz_ages: ["예비창업자"], applicant_types: ["예비창업자", "일반인"],
      target_ages: ["만 20세 이상 ~ 만 39세 이하", "만 40세 이상"],
      organizer: "창업진흥원", supervising_institution: "공공기관", department: "예비창업부", contact: "0442808000",
      apply_target: "공고일 기준 신청자 명의의 사업자등록(개인·법인)이 없는 예비창업자",
      exclude_target: "동일 사업 기수혜자, 국세 또는 지방세 체납 중인 자",
      apply_methods: { 온라인: "K-Startup 누리집 온라인 접수" },
      notes: "제출 서류 미비 시 평가에서 제외될 수 있습니다.",
      detail_url: "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=178702",
      guide_url: null, is_integrated: true,
    },
    {
      pbanc_sn: 178410,
      title: "2026년 서울 청년창업사관학교 입교생 모집",
      summary: "만 39세 이하 청년 창업자를 대상으로 사업화 자금과 보육 공간을 지원합니다.",
      start_date: shift(-40), end_date: shift(-6),
      support_field: "시설ㆍ공간ㆍ보육",
      regions: ["서울"], biz_ages: ["3년미만", "5년미만"], applicant_types: ["일반기업", "대학생"],
      target_ages: ["만 20세 이상 ~ 만 39세 이하"],
      organizer: "중소벤처기업진흥공단", supervising_institution: "공공기관", department: "청년창업처", contact: "0554408000",
      apply_target: "만 39세 이하, 창업 3년 이내 기업의 대표자",
      exclude_target: null,
      apply_methods: { 온라인: "청년창업사관학교 누리집", 방문: "서울 청년창업사관학교" },
      notes: null,
      detail_url: "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do?schM=view&pbancSn=178410",
      guide_url: null, is_integrated: false,
    },
  ];
}

export function devSearchAnnouncements(
  filters: Parameters<typeof matchesAnnouncementFilters>[1] & { sort: "deadline" | "recent" },
  page: number,
  pageSize: number,
) {
  const today = toKstDateKey();
  const matched = devAnnouncements()
    .filter((announcement) => matchesAnnouncementFilters(announcement, filters, today))
    .sort((a, b) =>
      filters.sort === "recent"
        ? b.pbanc_sn - a.pbanc_sn
        : (a.end_date ?? "9999-12-31").localeCompare(b.end_date ?? "9999-12-31"),
    );
  return { rows: matched.slice(page * pageSize, page * pageSize + pageSize), total: matched.length };
}

export function devAnnouncementsSyncedAt(): string {
  return new Date().toISOString();
}
