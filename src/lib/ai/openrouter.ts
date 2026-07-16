export interface BizplanDiagnosis {
  psst: Record<"problem" | "solution" | "scale_up" | "team", { score: number; evidence: string }>;
  actions: string[];
  swot: Record<"strength" | "weakness" | "opportunity" | "threat", string[]>;
}

const dimensions = ["problem", "solution", "scale_up", "team"] as const;
const quadrants = ["strength", "weakness", "opportunity", "threat"] as const;

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

export async function runBizplanDiagnosis(text: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY가 설정되지 않았습니다.");
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
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000", "X-OpenRouter-Title": "StartupOS" },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2", temperature: 0.2, stream: false,
      messages: [
        { role: "system", content: "You diagnose Korean startup business plans. Return only JSON. Score PSST dimensions 0-25 using supplied text evidence. Do not predict selection, eligibility, funding, or legal/tax outcomes." },
        { role: "user", content: text },
      ],
      response_format: { type: "json_schema", json_schema: { name: "bizplan_diagnosis", strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error("AI 진단 요청에 실패했습니다.");
  const body = await response.json() as { id?: string; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number }; choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI 응답이 비어 있습니다.");
  return { report: parseDiagnosis(content), generationId: body.id ?? null, model: body.model ?? process.env.OPENROUTER_MODEL ?? "z-ai/glm-5.2", usage: body.usage ?? {} };
}
