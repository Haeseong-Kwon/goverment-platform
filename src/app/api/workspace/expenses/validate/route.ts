import { NextRequest, NextResponse } from "next/server";
import { validateExpense } from "@/features/expense-rules/engine";
import { CATEGORIES } from "@/features/expense-rules/ruleset";
import type { ExpenseCategory, ExpenseInput, ItemFlag } from "@/features/expense-rules/types";
import { judgeExpenseDescription } from "@/lib/ai/expenseJudge";

const CATEGORY_IDS = Object.keys(CATEGORIES) as ExpenseCategory[];

function parseInput(raw: unknown): ExpenseInput {
  if (!raw || typeof raw !== "object") throw new Error("집행 내역이 필요합니다.");
  const value = raw as Record<string, unknown>;
  const category = value.category as ExpenseCategory;
  if (!CATEGORY_IDS.includes(category)) throw new Error("비목을 선택해 주세요.");
  const amount = Number(value.amount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error("집행 금액을 숫자로 입력해 주세요.");
  if (typeof value.agreementStart !== "string" || typeof value.agreementEnd !== "string") throw new Error("협약 시작일과 종료일이 필요합니다.");
  return { ...(value as unknown as ExpenseInput), category, amount };
}

export async function POST(request: NextRequest) {
  let body: { expense?: unknown; description?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON 요청 본문이 필요합니다." }, { status: 400 });
  }

  let expense: ExpenseInput;
  try {
    expense = parseInput(body.expense);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "입력이 올바르지 않습니다." }, { status: 400 });
  }

  const description = typeof body.description === "string" ? body.description.trim() : "";
  let ai: { category: ExpenseCategory; itemFlags: ItemFlag[]; rationale: string; correction: string; categoryMismatch: boolean } | null = null;
  let aiError: string | null = null;

  if (description.length >= 10) {
    try {
      const judgement = await judgeExpenseDescription(description.slice(0, 4_000));
      ai = { ...judgement, categoryMismatch: judgement.category !== expense.category };
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI 비목 판정에 실패했습니다.";
    }
  }

  // AI가 읽어낸 항목 특성을 입력에 합쳐 결정론적 엔진으로 최종 판정합니다.
  const merged: ExpenseInput = ai
    ? { ...expense, itemFlags: Array.from(new Set([...(expense.itemFlags ?? []), ...ai.itemFlags])) }
    : expense;

  return NextResponse.json({
    verdict: validateExpense(merged),
    ai,
    aiError,
    appliedFlags: merged.itemFlags ?? [],
  });
}
