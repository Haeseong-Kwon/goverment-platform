export type ExpenseCategory =
  | "material"
  | "outsourcing"
  | "equipment"
  | "ip"
  | "labor"
  | "fee"
  | "travel"
  | "training"
  | "advertising";

export type Severity = "block" | "warn" | "info";

export type Verdict = "pass" | "review" | "fail";

export type ReasonCode =
  | "E-101"
  | "E-102"
  | "E-103"
  | "E-104"
  | "E-105"
  | "E-106"
  | "E-107"
  | "E-108";

/** 제품 전반에서 쓰는 항목 특성 플래그. UI 체크박스와 AI 추출 결과가 이 키로 모입니다. */
export type ItemFlag =
  | "office_supply"
  | "office_furniture"
  | "general_software"
  | "communication_device"
  | "used_item"
  | "used_from_individual"
  | "camera_for_promotion_only"
  | "unrelated_to_item"
  | "precious_material"
  | "imported_with_customs"
  | "mass_production_mold"
  | "penalty_or_damages"
  | "deliverable_not_working"
  | "vehicle_rental"
  | "office_deposit_or_maintenance"
  | "residential_space"
  | "sublease_contract"
  | "event_outside_agreement"
  | "invention_compensation"
  | "success_fee"
  | "retirement_reserve"
  | "prepaid_before_work"
  | "self_paid_portion"
  | "refunded_course"
  | "giveaway_or_uniform"
  | "prepaid_emoney"
  | "kickback_suspected";

export interface Finding {
  code: string;
  severity: Severity;
  reasonCode: ReasonCode;
  message: string;
  clause: string;
  fix: string;
}

export interface ExpenseInput {
  category: ExpenseCategory;
  title?: string;
  /** 부가세 포함 총액(원) */
  amount: number;
  agreementStart: string;
  agreementEnd: string;
  executionDate?: string;
  deliveryDate?: string;
  vendor?: {
    type?: "business" | "individual" | "platform" | "unknown";
    industryRelated?: boolean | null;
  };
  advancePayment?: number;
  hasPriorApproval?: boolean | null;
  evidence?: string[];
  labor?: {
    isRepresentative?: boolean | null;
    isRelative?: boolean | null;
    insuranceEnrolled?: boolean | null;
    hiredAt?: string;
    fundedByOtherProgram?: boolean | null;
  };
  travel?: {
    isOverseas?: boolean | null;
    seatClass?: "economy" | "business" | "first";
    isPublicTransport?: boolean | null;
  };
  mentoring?: {
    perPersonPerDay?: number;
    hourlyRate?: number;
  };
  ip?: {
    filedAt?: string;
    applicantIsSelf?: boolean | null;
  };
  itemFlags?: ItemFlag[];
  memo?: string;
}

export interface ExpenseVerdict {
  verdict: Verdict;
  category: ExpenseCategory;
  categoryName: string;
  findings: Finding[];
  missingEvidence: string[];
  unchecked: string[];
  preApprovalRequired: boolean;
  summary: string;
}
