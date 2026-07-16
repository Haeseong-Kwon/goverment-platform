import type {
  EligibilityAnswers,
  EligibilityReport,
  InsuranceInput,
  InsuranceResult,
  ProgramRecommendation,
  WorkspaceTaskSeed,
} from "./domain";

export const STARTUP_PROGRAMS = [
  { id: "yechang-2026", name: "2026 예비창업패키지", requiresNoBusinessRegistration: true, blocksPriorBenefit: true },
  { id: "chocang-2026", name: "2026 초기창업패키지", requiresNoBusinessRegistration: false, blocksPriorBenefit: true },
  { id: "modu-2026", name: "2026 모두의창업", requiresNoBusinessRegistration: false, blocksPriorBenefit: false },
] as const;

const MILESTONES = [
  ["사업계획서 초안 완성", 14],
  ["증빙 서류 준비", 10],
  ["발표 리허설", 7],
  ["최종 제출", 1],
] as const;

const formatDate = (date: Date) => date.toISOString().slice(0, 10);

export function createMilestones(projectId: string, deadline: Date): WorkspaceTaskSeed[] {
  return MILESTONES.map(([title, daysBefore], index) => ({
    id: `${projectId}-milestone-${index + 1}`,
    projectId,
    title,
    dueDate: formatDate(new Date(deadline.getTime() - daysBefore * 86_400_000)),
    status: "todo",
    taskType: "auto",
    isHidden: false,
  }));
}

export function evaluateEligibility(programId: string, answers: EligibilityAnswers): EligibilityReport {
  const program = STARTUP_PROGRAMS.find((item) => item.id === programId);
  if (!program) {
    return {
      state: "pending",
      score: 0,
      blockers: [],
      unchecked: ["이 사업의 자격 룰셋"],
      reasons: [{ clause: "RULESET-PENDING", text: "자격 진단 룰셋을 준비 중입니다." }],
      nextActions: ["공고문 자격 요건을 직접 확인하세요."],
    };
  }

  const blockers: string[] = [];
  const unchecked: string[] = [];
  const reasons: EligibilityReport["reasons"] = [];
  const addUnknown = (value: boolean | null | undefined, label: string) => {
    if (value === null || value === undefined) unchecked.push(label);
  };

  addUnknown(answers.hasBusinessRegistration, "사업자등록 여부");
  addUnknown(answers.hasClosureHistory, "폐업 이력");
  addUnknown(answers.hasPriorBenefit, "동일 사업 기수혜 여부");
  addUnknown(answers.isEmployed, "대표자 재직 상태");
  addUnknown(answers.hasCoRepresentative, "공동대표 여부");

  if (program.requiresNoBusinessRegistration && answers.hasBusinessRegistration === true) {
    blockers.push("사업자등록 이력이 있어 예비창업자 요건을 충족하지 않을 수 있습니다.");
    reasons.push({ clause: "YC-ELIG-01", text: "예비창업자 사업자등록 요건 확인이 필요합니다." });
  }
  if (program.blocksPriorBenefit && answers.hasPriorBenefit === true) {
    blockers.push("동일 사업 기수혜 이력이 있습니다.");
    reasons.push({ clause: "COMMON-ELIG-02", text: "동일 사업 기수혜 제한을 확인하세요." });
  }
  if (answers.hasClosureHistory === true) {
    reasons.push({ clause: "COMMON-ELIG-03", text: "폐업 이력의 제한 조항을 공고문에서 확인하세요." });
  }
  if (answers.isEmployed === true) {
    reasons.push({ clause: "COMMON-ELIG-04", text: "재직 상태에 따른 대표자 요건을 확인하세요." });
  }

  const state = blockers.length > 0 ? "ineligible" : unchecked.length > 0 || answers.isEmployed === true || answers.hasClosureHistory === true ? "review" : "eligible";
  const score = state === "eligible" ? 100 : state === "review" ? Math.max(40, 100 - unchecked.length * 12) : 0;
  return {
    state,
    score,
    blockers,
    unchecked,
    reasons: reasons.length ? reasons : [{ clause: "COMMON-ELIG-00", text: "입력한 항목에서 즉시 결격 사유를 찾지 못했습니다." }],
    nextActions: blockers.length ? ["결격 사유와 공고문 예외 조항을 확인하세요."] : unchecked.length ? ["미확인 항목을 입력해 진단을 보완하세요."] : ["지원사업 일정을 캘린더에 추가하세요."],
  };
}

export function recommendPrograms(answers: EligibilityAnswers): ProgramRecommendation[] {
  const priority = { eligible: 0, review: 1, pending: 2, ineligible: 3 } as const;
  return STARTUP_PROGRAMS.map((program) => ({
    programId: program.id,
    programName: program.name,
    report: evaluateEligibility(program.id, answers),
  })).map((item) => ({ ...item, state: item.report.state }))
    .sort((a, b) => priority[a.state] - priority[b.state]);
}

export function getDdayTone(dday: number) {
  return dday <= 3 ? "red" : dday <= 7 ? "amber" : "slate";
}

export function calculateInsurance({ monthlySalary, people, accidentRate }: InsuranceInput): InsuranceResult {
  const salary = Math.max(0, monthlySalary) * Math.max(1, people);
  const employer = {
    nationalPension: Math.round(salary * 0.045),
    healthInsurance: Math.round(salary * 0.03545),
    longTermCare: Math.round(salary * 0.03545 * 0.1295),
    employmentInsurance: Math.round(salary * 0.0115),
    accidentInsurance: Math.round(salary * Math.max(0, accidentRate)),
  };
  const worker = {
    nationalPension: Math.round(salary * 0.045),
    healthInsurance: Math.round(salary * 0.03545),
    longTermCare: Math.round(salary * 0.03545 * 0.1295),
    employmentInsurance: Math.round(salary * 0.009),
  };
  return {
    employer,
    worker,
    employerTotal: Object.values(employer).reduce((sum, value) => sum + value, 0),
    workerTotal: Object.values(worker).reduce((sum, value) => sum + value, 0),
  };
}

export function getDiagnosisCreditBalance({ used, acceptedInvites }: { used: number; acceptedInvites: number }) {
  const total = 2 + Math.max(0, acceptedInvites);
  return { total, remaining: Math.max(0, total - Math.max(0, used)) };
}

export function canManagerSeeSubmission({ role, status, validation }: { role: "pre_founder" | "founder"; status: string; validation: "pending" | "passed" | "failed" }) {
  return role === "founder" && validation === "passed" && ["validated", "in_review", "approved", "rejected"].includes(status);
}
