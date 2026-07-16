import { describe, expect, it } from "vitest";
import { parseDiagnosis } from "./openrouter";

describe("parseDiagnosis", () => {
  it("accepts the required PSST and SWOT payload", () => {
    expect(parseDiagnosis(JSON.stringify({
      psst: {
        problem: { score: 20, evidence: "고객 문제를 설명합니다." },
        solution: { score: 18, evidence: "해결 방안을 설명합니다." },
        scale_up: { score: 17, evidence: "성장 전략을 설명합니다." },
        team: { score: 15, evidence: "팀 역량을 설명합니다." },
      },
      actions: ["고객 인터뷰 근거를 추가하세요.", "시장 규모 출처를 추가하세요."],
      swot: { strength: ["기술"], weakness: ["채널"], opportunity: ["지원사업"], threat: ["경쟁" ] },
    }))).toMatchObject({ psst: { problem: { score: 20 }, team: { score: 15 } } });
  });

  it("rejects an incomplete provider response", () => {
    expect(() => parseDiagnosis(JSON.stringify({ psst: {} }))).toThrow("AI 응답 형식");
  });
});
