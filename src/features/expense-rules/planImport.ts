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
      ["기계장치·도구 구입비", "equipment"],
      ["기계장치", "equipment"],
      ["기계장치비", "equipment"],
      ["공구기구비", "equipment"],
      ["기기구입비", "equipment"],
      ["무형자산취득비", "ip"],
      ["특허권등무형자산취득비", "ip"],
      ["특허권 등 무형자산 취득비", "ip"],
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

/** 금액 셀. 통화 기호·천단위 쉼표는 허용하되, 숫자가 하나도 없으면 실패로 봅니다. */
const parseAmount = (value: string): number | null => {
  const digits = value.replace(/[^\d.-]/g, "");
  if (!/\d/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? amount : null;
};

/** 따옴표로 감싼 셀 안의 구분자는 값의 일부입니다. */
function splitCells(raw: string, delimiter: string): string[] {
  const { cells, current } = [...raw].reduce(
    (state, char, index) => {
      if (char === '"') {
        // 따옴표 안의 ""는 문자 그대로의 따옴표입니다.
        if (state.quoted && raw[index + 1] === '"' && !state.escaped) return { ...state, current: `${state.current}"`, escaped: true };
        if (state.escaped) return { ...state, escaped: false };
        return { ...state, quoted: !state.quoted };
      }
      if (char === delimiter && !state.quoted) return { ...state, cells: [...state.cells, state.current], current: "" };
      return { ...state, current: state.current + char, escaped: false };
    },
    { cells: [] as string[], current: "", quoted: false, escaped: false },
  );
  return [...cells, current].map((cell) => cell.trim());
}

/**
 * 쉼표 구분에서 "1,800,000"의 쉼표는 열 구분자가 아니라 숫자의 일부입니다.
 * 앞 셀이 숫자로만 이뤄져 있고 현재 셀이 정확히 세 자리 숫자일 때만 도로 붙입니다.
 * 앞 셀을 "숫자로 끝남"이 아니라 "전체가 숫자"로 좁혀, '모델3'+'500' 같은 오결합을 막습니다.
 */
function mergeThousandGroups(cells: string[]): string[] {
  return cells.reduce<string[]>((merged, cell) => {
    const previous = merged.at(-1);
    return previous !== undefined && /^\d[\d,]*$/.test(previous) && /^\d{3}$/.test(cell)
      ? [...merged.slice(0, -1), `${previous},${cell}`]
      : [...merged, cell];
  }, []);
}

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
      // 탭이 있으면 탭 우선. 쉼표 구분일 때만 천단위 그룹을 복원합니다.
      const useTab = raw.includes("\t");
      const split = splitCells(raw, useTab ? "\t" : ",");
      const cells = useTab ? split : mergeThousandGroups(split);
      if (cells.length < 4) return { line, raw, error: "열이 부족합니다. 팀명, 비목, 건명, 금액 순으로 입력하세요." };
      const [team, categoryLabel, title, amountText, executionDate, deliveryDate] = cells;
      const category = resolveCategory(categoryLabel);
      if (!category) return { line, raw, team, error: `비목 '${categoryLabel}'을 인식하지 못했습니다.` };
      const amount = parseAmount(amountText ?? "");
      if (amount === null) return { line, raw, team, error: `금액 '${amountText ?? ""}'을 숫자로 읽지 못했습니다.` };
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
