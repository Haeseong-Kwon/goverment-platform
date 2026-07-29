import { CATEGORIES, ITEM_FLAG_LABELS, RULESET_VERSION } from "@/features/expense-rules/ruleset";
import type { ExpenseCategory, ItemFlag } from "@/features/expense-rules/types";

export interface ExpenseJudgement {
  /** AI가 자연어 설명에서 읽어낸 비목 */
  category: ExpenseCategory;
  /** 규정 위반 가능성이 있는 항목 특성 */
  itemFlags: ItemFlag[];
  /** 왜 그렇게 분류했는지 */
  rationale: string;
  /** 창업자가 바로 고칠 수 있는 문장 */
  correction: string;
}

const CATEGORY_IDS = Object.keys(CATEGORIES) as ExpenseCategory[];
const FLAG_IDS = Object.keys(ITEM_FLAG_LABELS) as ItemFlag[];

export function parseJudgement(content: string): ExpenseJudgement {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
  const result = value as Partial<ExpenseJudgement> | null;
  if (!result || typeof result !== "object") throw new Error("AI 응답 형식이 올바르지 않습니다.");
  if (!result.category || !CATEGORY_IDS.includes(result.category)) throw new Error("AI가 비목을 판별하지 못했습니다.");
  if (typeof result.rationale !== "string" || typeof result.correction !== "string") throw new Error("AI 응답 형식이 올바르지 않습니다.");
  const itemFlags = Array.isArray(result.itemFlags) ? result.itemFlags.filter((flag): flag is ItemFlag => FLAG_IDS.includes(flag as ItemFlag)) : [];
  return { category: result.category, itemFlags, rationale: result.rationale, correction: result.correction };
}

function buildRulesetBrief() {
  return CATEGORY_IDS.map((id) => {
    const spec = CATEGORIES[id];
    return `- ${id}(${spec.name}): ${spec.definition}\n  유의: ${spec.cautions.slice(0, 4).join(" / ")}`;
  }).join("\n");
}

const SYSTEM_PROMPT = [
  "You classify Korean government startup-grant expense items against a fixed 비목 ruleset.",
  "Return only JSON. Choose exactly one category id from the ruleset.",
  "Set itemFlags only for characteristics you can actually infer from the text; never guess.",
  "rationale: 1-2 Korean sentences on why this 비목.",
  "correction: one concrete Korean sentence telling the founder what to change before submitting. If nothing needs changing, say 수정할 항목이 없습니다.",
  "Do not decide approval or rejection — a human manager makes the final call.",
].join(" ");

/**
 * 창업자가 쓴 집행 내역 설명을 룰셋 어휘(비목 + 항목 플래그)로 번역합니다.
 * 최종 판정은 결정론적 엔진이 하고, 이 함수는 입력을 보강하는 역할만 합니다.
 */
export async function judgeExpenseDescription(description: string): Promise<ExpenseJudgement> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");

  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["category", "itemFlags", "rationale", "correction"],
    properties: {
      category: { type: "string", enum: CATEGORY_IDS },
      itemFlags: { type: "array", items: { type: "string", enum: FLAG_IDS } },
      rationale: { type: "string" },
      correction: { type: "string" },
    },
  };

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      "X-OpenRouter-Title": "StartUp Pilot",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2",
      temperature: 0,
      stream: false,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\n[RULESET ${RULESET_VERSION}]\n${buildRulesetBrief()}\n\n[FLAGS]\n${FLAG_IDS.map((flag) => `${flag}: ${ITEM_FLAG_LABELS[flag]}`).join("\n")}` },
        { role: "user", content: description },
      ],
      response_format: { type: "json_schema", json_schema: { name: "expense_judgement", strict: true, schema } },
    }),
  });

  if (!response.ok) throw new Error("AI 비목 판정 요청에 실패했습니다.");
  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답이 비어 있습니다.");
  return parseJudgement(content);
}
