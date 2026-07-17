export type StartupRole = "pre_founder" | "founder" | "manager";

export type DdayTone = "slate" | "amber" | "red";

export type ReviewStatus = "draft" | "requested" | "validated" | "in_review" | "approved" | "rejected";

export type ValidationStatus = "pending" | "passed" | "failed";

export interface ReviewVisibilityInput {
  role: StartupRole;
  status: ReviewStatus;
  validation: ValidationStatus;
}

export interface StartupMilestone {
  id: string;
  title: string;
  dday: number;
  isAutomatic: boolean;
  action: "hide";
  owner: string;
  comments: number;
}

export interface DashboardTaskInput {
  id: string;
  title: string;
  due_date: string | null;
  status: "todo" | "in_progress" | "done";
  task_type: "auto" | "custom";
  is_hidden: boolean;
}

export interface ManagerSubmissionInput {
  id: string;
  title: string;
  team: string;
  amount: string;
  evidenceCount: number;
  role: StartupRole;
  status: ReviewStatus;
  validation: ValidationStatus;
  createdAt: string;
}
