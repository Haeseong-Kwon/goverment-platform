export interface BizplanDiagnosis {
  psst: Record<"problem" | "solution" | "scale_up" | "team", { score: number; evidence: string }>;
  actions: string[];
  swot: Record<"strength" | "weakness" | "opportunity" | "threat", string[]>;
}

const dimensions = ["problem", "solution", "scale_up", "team"] as const;
const quadrants = ["strength", "weakness", "opportunity", "threat"] as const;

/** 응답이 없으면 화면이 무한히 "분석 중"에 머뭅니다. 상한을 두고 사용자에게 되돌려 줍니다. */
const TIMEOUT_MS = 60_000;

const SYSTEM_PROMPT = [
  "You diagnose Korean startup business plans. Return only JSON.",
  "Score PSST dimensions 0-25 using supplied text evidence.",
  "evidence: quote or paraphrase the sentence in the plan that justifies the score, in Korean.",
  "actions: 2-4 Korean sentences. Each must be one concrete revision the founder should make to the plan text — never a bare section name.",
  "swot: short Korean noun phrases grounded in the plan text.",
  "Do not predict selection, eligibility, funding, or legal/tax outcomes.",
].join(" ");

export function parseDiagnosis(content: string): BizplanDiagnosis {
  let value: unknown;
  try { value = JSON.parse(content); } catch { throw new Error("AI 응답 형식이 올바르지 않습니다."); }
  if (!value || typeof value !== "object") throw new Error("AI 응답 형식이 올바르지 않습니다.");
  const result = value as Record<string, unknown>;
  const psst = result.psst as Record<string, unknown> | undefined;
  const swot = result.swot as Record<string, unknown> | undefined;
  if (!psst || !swot || !Array.isArray(result.actions) || result.actions.length < 2) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  for (const dimension of dimensions) {
    const item = psst[dimension] as Record<string, unknown> | undefined;
    if (!item || typeof item.score !== "number" || item.score < 0 || item.score > 25 || typeof item.evidence !== "string") throw new Error("AI 응답 형식이 올바르지 않습니다.");
  }
  for (const quadrant of quadrants) if (!Array.isArray(swot[quadrant]) || !(swot[quadrant] as unknown[]).every((item) => typeof item === "string")) throw new Error("AI 응답 형식이 올바르지 않습니다.");
  return result as unknown as BizplanDiagnosis;
}

/**
 * 진단 입력. 본문을 붙여 넣거나 파일을 첨부합니다.
 *
 * PDF는 OpenRouter의 file-parser 플러그인이 텍스트를 뽑아 모델에 넘깁니다.
 * 별도 PDF 라이브러리를 넣지 않는 이유이고, 대신 텍스트 레이어가 있는 PDF만 읽힙니다.
 * 스캔 이미지 PDF는 글자가 없어 아무것도 나오지 않습니다.
 */
export type BizplanInput =
  | { kind: "text"; text: string; sourceName?: string }
  | { kind: "file"; fileName: string; base64: string };

const USER_INSTRUCTION =
  "첨부한 사업계획서를 PSST 기준으로 진단하세요. 표지·목차·양식 안내문은 근거로 쓰지 말고 본문만 봅니다.";

function buildMessages(input: BizplanInput) {
  if (input.kind === "text") {
    return { messages: [{ role: "user", content: input.text }], plugins: undefined };
  }
  return {
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: USER_INSTRUCTION },
          { type: "file", file: { filename: input.fileName, file_data: `data:application/pdf;base64,${input.base64}` } },
        ],
      },
    ],
    // pdf-text는 문서에 이미 있는 텍스트 레이어만 읽습니다(무료). OCR은 돌리지 않습니다.
    plugins: [{ id: "file-parser", pdf: { engine: "pdf-text" } }],
  };
}

export async function runBizplanDiagnosis(input: BizplanInput | string) {
  const normalized: BizplanInput = typeof input === "string" ? { kind: "text", text: input } : input;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
  const request = buildMessages(normalized);
  const sectionSchema = { type: "object", additionalProperties: false, required: ["score", "evidence"], properties: { score: { type: "number", minimum: 0, maximum: 25 }, evidence: { type: "string" } } };
  const schema = {
    type: "object", additionalProperties: false, required: ["psst", "actions", "swot"],
    properties: {
      psst: { type: "object", additionalProperties: false, required: dimensions, properties: Object.fromEntries(dimensions.map((key) => [key, sectionSchema])) },
      actions: { type: "array", minItems: 2, items: { type: "string" } },
      swot: { type: "object", additionalProperties: false, required: quadrants, properties: Object.fromEntries(quadrants.map((key) => [key, { type: "array", items: { type: "string" } }])) },
    },
  };
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", "X-OpenRouter-Title": "StartUp Pilot" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2", temperature: 0.2, stream: false,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...request.messages],
      ...(request.plugins ? { plugins: request.plugins } : {}),
      response_format: { type: "json_schema", json_schema: { name: "bizplan_diagnosis", strict: true, schema } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch((reason) => {
    // 타임아웃은 DOMException으로 올라와 영문 메시지가 그대로 노출됩니다.
    if (reason instanceof Error && reason.name === "TimeoutError") throw new Error("AI 진단이 시간 내에 끝나지 않았습니다. 잠시 후 다시 시도해 주세요.");
    throw reason;
  });
  if (!response.ok) throw new Error("AI 진단 요청에 실패했습니다.");
  const body = await response.json() as { id?: string; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답이 비어 있습니다.");
  return { report: parseDiagnosis(content), generationId: body.id ?? null, model: body.model ?? process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2", usage: body.usage ?? {} };
}
