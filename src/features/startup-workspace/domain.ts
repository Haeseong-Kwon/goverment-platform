export type StartupRole = "pre_founder" | "founder" | "manager";

export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskType = "auto" | "custom";
export type EligibilityState = "eligible" | "review" | "ineligible" | "pending";

export interface EligibilityAnswers {
  hasBusinessRegistration: boolean | null;
  hasClosureHistory?: boolean | null;
  hasPriorBenefit?: boolean | null;
  isEmployed?: boolean | null;
  hasCoRepresentative?: boolean | null;
}

export interface WorkspaceTaskSeed {
  id: string;
  projectId: string;
  title: string;
  dueDate: string;
  status: TaskStatus;
  taskType: TaskType;
  isHidden: boolean;
}

export interface EligibilityReport {
  state: EligibilityState;
  score: number;
  blockers: string[];
  unchecked: string[];
  reasons: Array<{ clause: string; text: string }>;
  nextActions: string[];
}

export interface ProgramRecommendation {
  programId: string;
  programName: string;
  state: EligibilityState;
  report: EligibilityReport;
}

export interface InsuranceInput {
  monthlySalary: number;
  people: number;
  accidentRate: number;
}

export interface InsuranceResult {
  employerTotal: number;
  workerTotal: number;
  employer: Record<string, number>;
  worker: Record<string, number>;
}
