import { validateExpense } from "@/features/expense-rules/engine";
import type { ExpenseInput, ExpenseVerdict } from "@/features/expense-rules/types";
import type { ReviewStatus, ValidationStatus } from "@/features/startup-workspace/types";
import type { EligibilityAnswers, EligibilityReport } from "@/features/startup-workspace/domain";
import { DEV_USER } from "./devMode";

/**
 * 개발용 진입 모드에서 쓰는 인메모리 데이터입니다.
 *
 * 값은 화면을 채우기 위한 예시지만, 판정은 예시를 실제 룰 엔진(validateExpense)에 통과시켜
 * 만듭니다. 그래야 화면에서 보는 지적 사항이 제품이 실제로 내리는 판정과 같습니다.
 * 상태 변경은 localStorage에 남아 새로고침해도 유지됩니다.
 */

const DAY = 86_400_000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();
const day = (offsetDays: number) => iso(offsetDays).slice(0, 10);
const thisYear = new Date().getFullYear();

export interface DevTask {
  id: string;
  title: string;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
  task_type: "auto" | "custom";
  is_hidden: boolean;
  assignee_id: string | null;
  comment_count: number;
  /** K-Startup 공고에서 담은 일정이면 그 공고 일련번호. */
  announcement_sn?: number | null;
}

export interface DevComment {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface DevSubmission {
  id: string;
  team: string;
  title: string;
  amount: number;
  status: ReviewStatus;
  validation: ValidationStatus;
  createdAt: string;
  expense: ExpenseInput;
  /** 첨부된 보관함 증빙의 문서 id. 실제 스키마의 submission_evidence와 같은 역할입니다. */
  documentIds?: string[];
  review?: { decision: "approved" | "rejected"; reasonCode: string | null; feedback: string | null; createdAt: string };
}

export interface DevVaultDoc {
  id: string;
  folder: "bizplan" | "evidence" | "submission_archive";
  fileName: string;
  storagePath: string;
  version: number;
  createdAt: string;
}

interface DevState {
  tasks: DevTask[];
  submissions: DevSubmission[];
  vault: DevVaultDoc[];
  waitlist: string[];
  conversionCodes: Array<{ code: string; programId: string | null; expiresAt: string; useCount: number; maxUses: number }>;
  comments: DevComment[];
  budgets: Record<string, number>;
  bizplanEvents: string[];
  eligibility: { programId: string; answers: EligibilityAnswers; report: EligibilityReport; createdAt: string } | null;
  converted: boolean;
}

const agreement = { agreementStart: `${thisYear}-04-01`, agreementEnd: `${thisYear}-12-31` };

const seedTasks = (): DevTask[] => [
  { id: "t1", title: "예비창업패키지 사업계획서 초안 완성", due_date: day(3), status: "in_progress", task_type: "auto", is_hidden: false, assignee_id: DEV_USER.id, comment_count: 2 },
  { id: "t2", title: "예비창업패키지 증빙 서류 준비", due_date: day(7), status: "todo", task_type: "auto", is_hidden: false, assignee_id: "dev-2", comment_count: 0 },
  { id: "t3", title: "예비창업패키지 발표 리허설", due_date: day(10), status: "todo", task_type: "auto", is_hidden: false, assignee_id: null, comment_count: 0 },
  { id: "t4", title: "예비창업패키지 최종 제출", due_date: day(16), status: "todo", task_type: "auto", is_hidden: false, assignee_id: null, comment_count: 0 },
  { id: "t5", title: "경쟁사 3곳 가격 정책 정리", due_date: day(-2), status: "todo", task_type: "custom", is_hidden: false, assignee_id: "dev-3", comment_count: 1 },
  { id: "t6", title: "베타 사용자 인터뷰 5건", due_date: day(1), status: "in_progress", task_type: "custom", is_hidden: false, assignee_id: "dev-2", comment_count: 0 },
  { id: "t7", title: "팀 소개 페이지 초안", due_date: null, status: "todo", task_type: "custom", is_hidden: false, assignee_id: null, comment_count: 0 },
  { id: "t8", title: "사업자 통장 개설", due_date: day(-6), status: "done", task_type: "custom", is_hidden: false, assignee_id: DEV_USER.id, comment_count: 0 },
  { id: "t9", title: "아이템 한 줄 소개 확정", due_date: day(-9), status: "done", task_type: "custom", is_hidden: false, assignee_id: null, comment_count: 0 },
  // 공고에서 담은 일정. 캘린더가 팀 일정과 다른 색으로 구분하는지 개발 모드에서도 보입니다.
  { id: "t10", title: "[공고] 2026년 웰컴 투 팁스 1차 참가기업 모집 (충청권) 접수 마감", due_date: day(5), status: "todo", task_type: "custom", is_hidden: false, assignee_id: null, comment_count: 1, announcement_sn: 178845 },
];

const seedComments = (): DevComment[] => [
  { id: "c1", taskId: "t1", authorId: "dev-2", authorName: "박민준", content: "문제 인식 파트에 시장 손실 규모 수치를 넣어야 할 것 같습니다.", createdAt: iso(-2) },
  { id: "c2", taskId: "t1", authorId: DEV_USER.id, authorName: DEV_USER.fullName, content: "통계청 자료로 보완했습니다. 오늘 중 초안 공유할게요.", createdAt: iso(-1) },
  { id: "c4", taskId: "t10", authorId: "dev-2", authorName: "박민준", content: "충청권 소재 요건이라 사무실 주소 이전 일정부터 확인해야 합니다.", createdAt: iso(-1) },
  { id: "c3", taskId: "t5", authorId: "dev-3", authorName: "정서연", content: "경쟁사 두 곳은 가격을 공개하지 않아 문의 메일 보냈습니다.", createdAt: iso(-1) },
];

/** 판정 결과가 통과·보완·위반으로 골고루 나오도록 서로 다른 성격의 집행 건을 섞었습니다. */
const seedSubmissions = (): DevSubmission[] => [
  {
    id: "s1",
    team: "성장하는 팀",
    title: "시제품 외관 목업 제작",
    amount: 24_200_000,
    status: "validated",
    validation: "passed",
    createdAt: iso(-1),
    documentIds: ["v3", "v4"],
    expense: {
      ...agreement,
      category: "outsourcing",
      title: "시제품 외관 목업 제작",
      amount: 24_200_000,
      advancePayment: 12_100_000,
      executionDate: day(-20),
      deliveryDate: day(-4),
      vendor: { type: "business", industryRelated: true },
      hasPriorApproval: false,
      evidence: ["세금계산서", "이체확인증", "계약서"],
    },
  },
  {
    id: "s2",
    team: "성장하는 팀",
    title: "개발용 서버 구매",
    amount: 8_800_000,
    status: "in_review",
    validation: "passed",
    createdAt: iso(-4),
    expense: {
      ...agreement,
      category: "equipment",
      title: "개발용 서버 구매",
      amount: 8_800_000,
      executionDate: day(-30),
      deliveryDate: day(-12),
      vendor: { type: "business", industryRelated: true },
      evidence: ["세금계산서", "이체확인증", "거래명세서"],
    },
  },
  {
    id: "s3",
    team: "루프캔버스",
    title: "사무용 멀티탭·키보드",
    amount: 320_000,
    status: "rejected",
    validation: "passed",
    createdAt: iso(-9),
    review: {
      decision: "rejected",
      reasonCode: "E-101,E-102",
      feedback: "사무용품은 재료비 집행 대상이 아닙니다. 해당 항목을 제외하고 재제출해 주세요.",
      createdAt: iso(-7),
    },
    expense: {
      ...agreement,
      category: "material",
      title: "사무용 멀티탭·키보드",
      amount: 320_000,
      executionDate: day(-40),
      deliveryDate: day(-38),
      vendor: { type: "business", industryRelated: true },
      itemFlags: ["office_supply"],
      evidence: ["세금계산서"],
    },
  },
  {
    id: "s4",
    team: "루프캔버스",
    title: "개발자 1인 인건비 (7월)",
    amount: 3_400_000,
    status: "approved",
    validation: "passed",
    createdAt: iso(-14),
    review: { decision: "approved", reasonCode: null, feedback: "확인 후 승인합니다.", createdAt: iso(-12) },
    expense: {
      ...agreement,
      category: "labor",
      title: "개발자 1인 인건비 (7월)",
      amount: 3_400_000,
      executionDate: day(-20),
      vendor: { type: "individual", industryRelated: true },
      labor: { isRepresentative: false, isRelative: false, insuranceEnrolled: true, hiredAt: day(-120), fundedByOtherProgram: false },
      evidence: ["급여대장", "이체확인증", "4대 보험가입자명부", "근로계약서"],
    },
  },
  {
    id: "s5",
    team: "오르카랩스",
    title: "특허 출원 대리인 수수료",
    amount: 1_650_000,
    status: "validated",
    validation: "passed",
    createdAt: iso(-2),
    expense: {
      ...agreement,
      category: "ip",
      title: "특허 출원 대리인 수수료",
      amount: 1_650_000,
      executionDate: day(-15),
      vendor: { type: "business", industryRelated: true },
      ip: { filedAt: day(-16), applicantIsSelf: true },
      evidence: ["세금계산서", "이체확인증"],
    },
  },
  {
    id: "s6",
    team: "오르카랩스",
    title: "국내 전시회 부스 임차",
    amount: 5_500_000,
    status: "validated",
    validation: "passed",
    createdAt: iso(-6),
    expense: {
      ...agreement,
      category: "advertising",
      title: "국내 전시회 부스 임차",
      amount: 5_500_000,
      executionDate: day(-25),
      deliveryDate: day(-18),
      vendor: { type: "business", industryRelated: true },
      evidence: ["세금계산서"],
    },
  },
];

const seedVault = (): DevVaultDoc[] => [
  { id: "v1", folder: "bizplan", fileName: "예비창업패키지_사업계획서.pdf", storagePath: "dev/bizplan/v3", version: 3, createdAt: iso(-1) },
  { id: "v2", folder: "bizplan", fileName: "예비창업패키지_사업계획서.pdf", storagePath: "dev/bizplan/v2", version: 2, createdAt: iso(-8) },
  { id: "v3", folder: "evidence", fileName: "세금계산서_목업제작.pdf", storagePath: "dev/evidence/v1", version: 1, createdAt: iso(-4) },
  { id: "v4", folder: "evidence", fileName: "이체확인증_목업제작.png", storagePath: "dev/evidence/v1b", version: 1, createdAt: iso(-4) },
  { id: "v5", folder: "submission_archive", fileName: "정산검토요청_시제품목업.pdf", storagePath: "dev/archive/v1", version: 1, createdAt: iso(-1) },
];

const seed = (): DevState => ({
  tasks: seedTasks(),
  submissions: seedSubmissions(),
  vault: seedVault(),
  waitlist: [],
  conversionCodes: [],
  comments: seedComments(),
  budgets: { outsourcing: 40_000_000, equipment: 15_000_000, material: 10_000_000, labor: 30_000_000, advertising: 8_000_000 },
  bizplanEvents: [iso(-5)],
  eligibility: null,
  converted: false,
});

const STORE_KEY = "dev-bypass-state";
let memory: DevState | null = null;

function load(): DevState {
  if (memory) return memory;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        memory = { ...seed(), ...(JSON.parse(raw) as Partial<DevState>) };
        return memory;
      }
    } catch {
      // 저장본이 깨졌으면 조용히 새 시드로 시작합니다.
    }
  }
  memory = seed();
  return memory;
}

function save(next: DevState) {
  memory = next;
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
  } catch {
    // 용량 초과 등은 개발 편의 기능이므로 무시합니다.
  }
}

export function devState() {
  return load();
}

export function devUpdate(change: (current: DevState) => DevState) {
  save(change(load()));
  return load();
}

export function devReset() {
  memory = null;
  if (typeof window !== "undefined") window.localStorage.removeItem(STORE_KEY);
  return load();
}

export function devVerdict(submission: DevSubmission): ExpenseVerdict {
  return validateExpense(submission.expense);
}

export const DEV_TEAM_NAME = "성장하는 팀";
export const DEV_INSTITUTION = "한양대학교 창업지원단";

export const DEV_MEMBERS = [
  { userId: DEV_USER.id, role: "leader" as const, fullName: DEV_USER.fullName, joinedAt: iso(-42) },
  { userId: "dev-2", role: "member" as const, fullName: "박민준", joinedAt: iso(-30) },
  { userId: "dev-3", role: "member" as const, fullName: "정서연", joinedAt: iso(-11) },
];

export const DEV_INVITE = { code: "TEAM7X2Q", expiresAt: iso(9), useCount: 2, maxUses: 5 };

export const DEV_CONVERSION_CODES = [
  { code: "HYU2026A", programId: "yechang-2026", expiresAt: iso(60), useCount: 4, maxUses: 100 },
  { code: "HYU2026B", programId: "chocang-2026", expiresAt: iso(-3), useCount: 12, maxUses: 50 },
];

export const DEV_PROGRAM_DEADLINES = [
  { id: "yechang-2026", name: "2026 예비창업패키지", deadline: day(17) },
  { id: "chocang-2026", name: "2026 초기창업패키지", deadline: day(45) },
];
