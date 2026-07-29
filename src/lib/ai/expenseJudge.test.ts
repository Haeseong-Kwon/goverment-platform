import { describe, expect, it } from "vitest";
import { parseJudgement } from "./expenseJudge";
import { validateExpense } from "@/features/expense-rules/engine";
import type { ExpenseInput } from "@/features/expense-rules/types";

describe("parseJudgement", () => {
  it("정상 응답을 파싱한다", () => {
    const result = parseJudgement(
      JSON.stringify({ category: "equipment", itemFlags: ["general_software"], rationale: "범용 SW 구매입니다.", correction: "사전검토 요청서를 제출하세요." }),
    );
    expect(result).toMatchObject({ category: "equipment", itemFlags: ["general_software"] });
  });

  it("모르는 비목·플래그는 거부하거나 걸러낸다", () => {
    expect(() => parseJudgement(JSON.stringify({ category: "잡비", itemFlags: [], rationale: "x", correction: "y" }))).toThrow();
    expect(parseJudgement(JSON.stringify({ category: "material", itemFlags: ["made_up_flag"], rationale: "x", correction: "y" })).itemFlags).toEqual([]);
  });

  it("JSON이 아니면 실패한다", () => {
    expect(() => parseJudgement("설명 텍스트")).toThrow("AI 응답 형식이 올바르지 않습니다.");
  });
});

describe("AI 플래그 병합 효과", () => {
  const expense: ExpenseInput = {
    category: "material",
    title: "키보드 구매",
    amount: 320_000,
    agreementStart: "2026-04-01",
    agreementEnd: "2026-12-31",
    executionDate: "2026-06-01",
    evidence: ["세금계산서", "계좌이체 확인증", "거래명세서"],
  };

  it("체크박스를 놓친 건도 AI가 읽어낸 플래그를 합치면 위반이 드러난다", () => {
    expect(validateExpense(expense).verdict).toBe("pass");

    const judged = parseJudgement(
      JSON.stringify({ category: "material", itemFlags: ["office_supply"], rationale: "사무용품입니다.", correction: "정산에서 제외하세요." }),
    );
    const merged = { ...expense, itemFlags: [...(expense.itemFlags ?? []), ...judged.itemFlags] };
    const verdict = validateExpense(merged);
    expect(verdict.verdict).toBe("fail");
    expect(verdict.findings.map((finding) => finding.code)).toContain("MAT-02");
  });
});
