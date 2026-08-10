import { CATEGORIES, ITEM_FLAG_LABELS, RULESET_VERSION } from "@/features/expense-rules/ruleset";
import type { ExpenseCategory, ItemFlag } from "@/features/expense-rules/types";

export const CATEGORY_IDS = Object.keys(CATEGORIES) as ExpenseCategory[];
export const FLAG_IDS = Object.keys(ITEM_FLAG_LABELS) as ItemFlag[];

/**
 * 「사업비 비목 해설」에서 옮긴 룰셋을 모델이 읽을 수 있는 한 덩어리로 만듭니다.
 *
 * 원본 PDF는 파워포인트 내보내기라 기계가 읽을 수 있는 글자가 거의 없습니다. 그래서
 * 근거는 `ruleset.ts`에 사람이 옮겨 적은 이 표이고, 문서가 개정되면 그 파일을 고쳐야
 * 합니다(docs/사업비-비목-룰셋-갱신.md 참고).
 *
 * `maxCautions`로 분량을 조절합니다. 집행 건 한 줄을 분류할 때는 짧아도 되지만,
 * 사업계획서의 사업비 계획 전체를 훑을 때는 금지 항목까지 봐야 합니다.
 */
export function buildRulesetBrief({ maxCautions = 4, includeViolations = false } = {}) {
  const body = CATEGORY_IDS.map((id) => {
    const spec = CATEGORIES[id];
    const lines = [`- ${id}(${spec.name}): ${spec.definition}`, `  유의: ${spec.cautions.slice(0, maxCautions).join(" / ")}`];
    if (includeViolations && spec.violations.length > 0) lines.push(`  집행 불가: ${spec.violations.join(" / ")}`);
    return lines.join("\n");
  }).join("\n");
  return `[RULESET ${RULESET_VERSION}]\n${body}`;
}

export function buildFlagBrief() {
  return `[FLAGS]\n${FLAG_IDS.map((flag) => `${flag}: ${ITEM_FLAG_LABELS[flag]}`).join("\n")}`;
}
