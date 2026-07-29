import { describe, expect, it } from "vitest";
import { validateExpense, validateExpensePlan } from "./engine";
import { CATEGORIES } from "./ruleset";
import type { ExpenseInput } from "./types";

const base = (overrides: Partial<ExpenseInput> = {}): ExpenseInput => ({
  category: "material",
  amount: 1_000_000,
  agreementStart: "2026-04-01",
  agreementEnd: "2026-12-31",
  executionDate: "2026-06-01",
  evidence: CATEGORIES[overrides.category ?? "material"].requiredEvidence,
  vendor: { type: "business", industryRelated: true },
  ...overrides,
});

const codes = (input: ExpenseInput) => validateExpense(input).findings.map((finding) => finding.code);

describe("공통 규정", () => {
  it("협약기간을 벗어난 집행은 차단한다", () => {
    const result = validateExpense(base({ executionDate: "2027-01-05" }));
    expect(result.verdict).toBe("fail");
    expect(codes(base({ executionDate: "2027-01-05" }))).toContain("COM-01");
  });

  it("증빙이 모두 첨부되고 위반이 없으면 통과한다", () => {
    expect(validateExpense(base()).verdict).toBe("pass");
  });

  it("증빙이 빠지면 통과 대신 보완 상태가 된다", () => {
    const result = validateExpense(base({ evidence: ["세금계산서"] }));
    expect(result.verdict).toBe("review");
    expect(result.missingEvidence).toContain("계좌이체 확인증");
  });

  it("비목 오분류를 감지하고 올바른 비목을 제시한다", () => {
    const result = validateExpense(base({ category: "material", itemFlags: ["office_furniture"], evidence: CATEGORIES.material.requiredEvidence }));
    expect(result.findings.find((finding) => finding.code === "COM-05")?.fix).toContain("기계장치비");
  });

  it("페이백 정황은 부정집행으로 차단한다", () => {
    expect(codes(base({ itemFlags: ["kickback_suspected"] }))).toContain("COM-04");
  });
});

describe("외주용역비", () => {
  const outsourcing = (overrides: Partial<ExpenseInput> = {}) =>
    base({ category: "outsourcing", evidence: CATEGORIES.outsourcing.requiredEvidence, ...overrides });

  it("2,000만원 초과 계약은 사전승인이 없으면 차단한다", () => {
    expect(codes(outsourcing({ amount: 25_000_000 }))).toContain("OUT-01");
    expect(codes(outsourcing({ amount: 25_000_000, hasPriorApproval: true, evidence: [...CATEGORIES.outsourcing.requiredEvidence, "비교견적서"] }))).not.toContain("OUT-01");
  });

  it("선급금이 계약금액의 50%를 넘으면 차단한다", () => {
    expect(codes(outsourcing({ amount: 10_000_000, advancePayment: 6_000_000 }))).toContain("OUT-02");
    expect(codes(outsourcing({ amount: 10_000_000, advancePayment: 4_000_000, evidence: [...CATEGORIES.outsourcing.requiredEvidence, "선급금보증보험증권"] }))).not.toContain("OUT-02");
  });

  it("선급금 500만원 이상인데 보증보험증권이 없으면 차단한다", () => {
    expect(codes(outsourcing({ amount: 12_000_000, advancePayment: 5_000_000 }))).toContain("OUT-03");
  });

  it("프리랜서·중계 플랫폼 거래는 차단한다", () => {
    expect(codes(outsourcing({ vendor: { type: "platform", industryRelated: true } }))).toContain("OUT-05");
  });

  it("업태·업종 연관성이 미입력이면 확인 필요로 남긴다", () => {
    const result = validateExpense(outsourcing({ vendor: { type: "business" } }));
    expect(result.unchecked).toContain("외주업체 업태·업종 연관성");
    expect(result.verdict).toBe("review");
  });
});

describe("기계장치비", () => {
  const equipment = (overrides: Partial<ExpenseInput> = {}) =>
    base({ category: "equipment", evidence: CATEGORIES.equipment.requiredEvidence, ...overrides });

  it("협약종료 1개월 이내 납품은 차단한다", () => {
    expect(codes(equipment({ deliveryDate: "2026-12-20" }))).toContain("EQP-01");
    expect(codes(equipment({ deliveryDate: "2026-11-01" }))).not.toContain("EQP-01");
  });

  it("범용 소프트웨어는 사전검토 없이 차단한다", () => {
    expect(codes(equipment({ itemFlags: ["general_software"] }))).toContain("EQP-02");
    expect(codes(equipment({ itemFlags: ["general_software"], hasPriorApproval: true }))).not.toContain("EQP-02");
  });

  it("개인 간 중고 거래는 차단한다", () => {
    expect(codes(equipment({ itemFlags: ["used_from_individual"] }))).toContain("EQP-05");
  });
});

describe("인건비", () => {
  const labor = (overrides: Partial<ExpenseInput> = {}) =>
    base({ category: "labor", evidence: CATEGORIES.labor.requiredEvidence, ...overrides });

  it("대표자 인건비는 차단한다", () => {
    expect(codes(labor({ labor: { isRepresentative: true, isRelative: false, insuranceEnrolled: true, fundedByOtherProgram: false } }))).toContain("LAB-01");
  });

  it("4대보험 미가입 인력은 차단한다", () => {
    expect(codes(labor({ labor: { isRepresentative: false, isRelative: false, insuranceEnrolled: false, fundedByOtherProgram: false } }))).toContain("LAB-03");
  });

  it("협약종료 1개월 이내 채용 인력은 차단한다", () => {
    const employee = { isRepresentative: false, isRelative: false, insuranceEnrolled: true, fundedByOtherProgram: false };
    expect(codes(labor({ labor: { ...employee, hiredAt: "2026-12-15" } }))).toContain("LAB-04");
    expect(codes(labor({ labor: { ...employee, hiredAt: "2026-09-01" } }))).not.toContain("LAB-04");
  });
});

describe("지급수수료·여비·광고선전비", () => {
  it("멘토링 1일 한도 초과를 차단한다", () => {
    const result = codes(base({ category: "fee", evidence: CATEGORIES.fee.requiredEvidence, mentoring: { perPersonPerDay: 400_000 } }));
    expect(result).toContain("FEE-01");
  });

  it("국외 출장은 사전승인과 이코노미 좌석을 요구한다", () => {
    const result = codes(base({
      category: "travel",
      evidence: CATEGORIES.travel.requiredEvidence,
      travel: { isOverseas: true, seatClass: "business", isPublicTransport: true },
      labor: { insuranceEnrolled: true },
    }));
    expect(result).toEqual(expect.arrayContaining(["TRV-01", "TRV-02"]));
  });

  it("비즈머니 등 선불 전자화폐 구매를 차단한다", () => {
    expect(codes(base({ category: "advertising", evidence: CATEGORIES.advertising.requiredEvidence, itemFlags: ["prepaid_emoney"] }))).toContain("ADV-04");
  });
});

describe("사업비 계획 일괄 검토", () => {
  it("건별 판정을 집계한다", () => {
    const summary = validateExpensePlan([
      base(),
      base({ executionDate: "2027-02-01" }),
      base({ evidence: [] }),
    ]);
    expect(summary).toMatchObject({ total: 3, passed: 1, failed: 1, review: 1 });
  });
});
