import { CATEGORIES } from "./ruleset";
import type { ExpenseCategory, ExpenseInput } from "./types";

const NAME_TO_CATEGORY = new Map<string, ExpenseCategory>(
  (Object.keys(CATEGORIES) as ExpenseCategory[]).flatMap((id) => [
    [CATEGORIES[id].name, id],
    [id, id],
  ]),
);

/** 기호·공백을 지운 비교 키. 기관마다 계획서 비목 표기가 조금씩 다릅니다. */
const normalize = (value: string) => value.replace(/[\s()·,/-]/g, "");

const ALIASES = new Map<string, ExpenseCategory>(
  (
    [
      ["기계장치·도구", "equipment"],
      ["기계장치", "equipment"],
      ["공구기구비", "equipment"],
      ["기기구입비", "equipment"],
      ["무형자산취득비", "ip"],
      ["특허권등무형자산취득비", "ip"],
      ["지급수수료비", "fee"],
      ["홍보비", "advertising"],
      ["마케팅비", "advertising"],
      ["외주비", "outsourcing"],
      ["용역비", "outsourcing"],
    ] as const
  ).map(([label, id]) => [normalize(label), id]),
);

export function resolveCategory(label: string): ExpenseCategory | null {
  const key = label.trim();
  return NAME_TO_CATEGORY.get(key) ?? ALIASES.get(normalize(key)) ?? null;
}

export interface PlanRow {
  line: number;
  raw: string;
  team?: string;
  expense?: ExpenseInput;
  error?: string;
}

const parseAmount = (value: string) => Number(value.replace(/[^\d.-]/g, ""));

/**
 * 협약 초기 사업비 집행 계획을 붙여넣기로 일괄 검토합니다.
 * 형식: 팀명, 비목, 건명, 금액, 집행일, 납품일 (탭 또는 쉼표 구분)
 */
export function parsePlanRows(text: string, agreement: { start: string; end: string }): PlanRow[] {
  return text
    .split("\n")
    .map((raw, index) => ({ raw: raw.trim(), line: index + 1 }))
    .filter((row) => row.raw.length > 0 && !row.raw.startsWith("#"))
    .map(({ raw, line }) => {
      // 탭이 있으면 탭 우선 — 엑셀 붙여넣기의 "1,800,000" 같은 천단위 쉼표를 쪼개지 않기 위함.
      const cells = raw.split(raw.includes("\t") ? "\t" : ",").map((cell) => cell.trim());
      if (cells.length < 4) return { line, raw, error: "열이 부족합니다. 팀명, 비목, 건명, 금액 순으로 입력하세요." };
      const [team, categoryLabel, title, amountText, executionDate, deliveryDate] = cells;
      const category = resolveCategory(categoryLabel);
      if (!category) return { line, raw, team, error: `비목 '${categoryLabel}'을 인식하지 못했습니다.` };
      const amount = parseAmount(amountText ?? "");
      if (!Number.isFinite(amount)) return { line, raw, team, error: `금액 '${amountText}'을 숫자로 읽지 못했습니다.` };
      return {
        line,
        raw,
        team,
        expense: {
          category,
          title,
          amount,
          agreementStart: agreement.start,
          agreementEnd: agreement.end,
          executionDate: executionDate || undefined,
          deliveryDate: deliveryDate || undefined,
          evidence: [],
          itemFlags: [],
        },
      };
    });
}
