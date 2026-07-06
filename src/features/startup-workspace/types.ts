export type StartupRole = "pre_founder" | "founder" | "manager";

export type DdayTone = "slate" | "amber" | "red";

export type ReviewStatus = "draft" | "requested" | "approved" | "rejected";

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
