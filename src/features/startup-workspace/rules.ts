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

/**
 * 인건비 총부담액 — 급여에 사업주 4대보험과 퇴직급여 충당을 더한 실제 지출.
 * 퇴직급여는 1년 이상 근속 시 30일분 이상이므로 월 급여의 1/12을 적립분으로 봅니다(근로자퇴직급여보장법 제8조).
 */
export function calculateTotalLaborCost({ monthlySalary, people, accidentRate, includeSeverance = true }: InsuranceInput & { includeSeverance?: boolean }) {
  const insurance = calculateInsurance({ monthlySalary, people, accidentRate });
  const grossSalary = Math.max(0, monthlySalary) * Math.max(1, people);
  const severanceReserve = includeSeverance ? Math.round(grossSalary / 12) : 0;
  const monthlyTotal = grossSalary + insurance.employerTotal + severanceReserve;
  return {
    grossSalary,
    employerInsurance: insurance.employerTotal,
    severanceReserve,
    monthlyTotal,
    yearlyTotal: monthlyTotal * 12,
    // 급여 1원당 실제로 나가는 돈. 채용 판단에서 가장 자주 묻는 값입니다.
    burdenRatio: grossSalary > 0 ? Math.round((monthlyTotal / grossSalary) * 1000) / 1000 : 0,
  };
}

/** 2026년 종합소득세 누진세율 (지방소득세 10% 별도). */
const INCOME_TAX_BRACKETS = [
  { upTo: 14_000_000, rate: 0.06, deduction: 0 },
  { upTo: 50_000_000, rate: 0.15, deduction: 1_260_000 },
  { upTo: 88_000_000, rate: 0.24, deduction: 5_760_000 },
  { upTo: 150_000_000, rate: 0.35, deduction: 15_440_000 },
  { upTo: 300_000_000, rate: 0.38, deduction: 19_940_000 },
  { upTo: 500_000_000, rate: 0.40, deduction: 25_940_000 },
  { upTo: 1_000_000_000, rate: 0.42, deduction: 35_940_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.45, deduction: 65_940_000 },
] as const;

/** 2026년 법인세율 (지방소득세 10% 별도). */
const CORPORATE_TAX_BRACKETS = [
  { upTo: 200_000_000, rate: 0.09, deduction: 0 },
  { upTo: 20_000_000_000, rate: 0.19, deduction: 20_000_000 },
  { upTo: 300_000_000_000, rate: 0.21, deduction: 420_000_000 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.24, deduction: 9_420_000_000 },
] as const;

const applyBrackets = (base: number, brackets: readonly { upTo: number; rate: number; deduction: number }[]) => {
  if (base <= 0) return 0;
  const bracket = brackets.find((item) => base <= item.upTo) ?? brackets[brackets.length - 1];
  return Math.max(0, Math.round(base * bracket.rate - bracket.deduction));
};

export interface TaxComparisonInput {
  /** 연 매출에서 필요경비를 뺀 이익(원) */
  annualProfit: number;
  /** 법인일 때 대표가 가져갈 연 급여(원). 이 금액은 법인 비용으로 빠지고 대표 근로소득이 됩니다. */
  ownerSalary: number;
}

/**
 * 법인 vs 개인사업자 세부담 비교.
 *
 * 참고용 추정입니다. 각종 공제·감면·성실신고 요건을 반영하지 않으므로
 * 실제 신고는 세무 전문가 확인이 필요합니다(세무사법 경계).
 */
export function compareBusinessTax({ annualProfit, ownerSalary }: TaxComparisonInput) {
  const profit = Math.max(0, annualProfit);
  const salary = Math.min(Math.max(0, ownerSalary), profit);
  const LOCAL_TAX_RATE = 0.1;

  const soleIncomeTax = applyBrackets(profit, INCOME_TAX_BRACKETS);
  const sole = { incomeTax: soleIncomeTax, localTax: Math.round(soleIncomeTax * LOCAL_TAX_RATE) };

  // 대표 급여는 법인 손금이라 과세표준에서 빠지고, 대신 대표 개인의 근로소득세가 붙습니다.
  const corporateBase = Math.max(0, profit - salary);
  const corporateTax = applyBrackets(corporateBase, CORPORATE_TAX_BRACKETS);
  const salaryTax = applyBrackets(salary, INCOME_TAX_BRACKETS);
  const corporate = {
    corporateTax,
    corporateLocalTax: Math.round(corporateTax * LOCAL_TAX_RATE),
    salaryIncomeTax: salaryTax,
    salaryLocalTax: Math.round(salaryTax * LOCAL_TAX_RATE),
  };

  const soleTotal = sole.incomeTax + sole.localTax;
  const corporateTotal = corporate.corporateTax + corporate.corporateLocalTax + corporate.salaryIncomeTax + corporate.salaryLocalTax;

  return {
    sole: { ...sole, total: soleTotal },
    corporate: { ...corporate, total: corporateTotal },
    difference: Math.abs(soleTotal - corporateTotal),
    cheaper: soleTotal === corporateTotal ? ("equal" as const) : soleTotal < corporateTotal ? ("sole" as const) : ("corporate" as const),
  };
}

export function getDiagnosisCreditBalance({ used, acceptedInvites }: { used: number; acceptedInvites: number }) {
  const total = 2 + Math.max(0, acceptedInvites);
  return { total, remaining: Math.max(0, total - Math.max(0, used)) };
}

export function canManagerSeeSubmission({ role, status, validation }: { role: "pre_founder" | "founder"; status: string; validation: "pending" | "passed" | "failed" }) {
  return role === "founder" && validation === "passed" && ["validated", "in_review", "approved", "rejected"].includes(status);
}
