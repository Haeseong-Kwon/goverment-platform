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

const base = {
  psst: {
    problem: { score: 20, evidence: "고객 문제를 설명합니다." },
    solution: { score: 18, evidence: "해결 방안을 설명합니다." },
    scale_up: { score: 17, evidence: "성장 전략을 설명합니다." },
    team: { score: 15, evidence: "팀 역량을 설명합니다." },
  },
  actions: ["고객 인터뷰 근거를 추가하세요.", "시장 규모 출처를 추가하세요."],
  swot: { strength: ["기술"], weakness: ["채널"], opportunity: ["지원사업"], threat: ["경쟁"] },
};

describe("parseDiagnosis — 사업비 비목 점검", () => {
  it("사업비 지적을 그대로 옮긴다", () => {
    const parsed = parseDiagnosis(JSON.stringify({
      ...base,
      budget: {
        found: true,
        note: "사업화자금 소요명세 6개 항목을 확인했습니다.",
        findings: [
          { category: "equipment", item: "노트북 2대", issue: "범용 사무기기는 사전검토가 필요합니다.", fix: "필요연관성을 기재해 사전검토를 받으세요.", severity: "warn" },
          { category: "advertising", item: "기념품 텀블러 300개", issue: "일회성 기념품은 집행할 수 없습니다.", fix: "해당 항목을 삭제하세요.", severity: "block" },
        ],
      },
    }));
    expect(parsed.budget.found).toBe(true);
    expect(parsed.budget.findings).toHaveLength(2);
    expect(parsed.budget.findings[1]).toMatchObject({ category: "advertising", severity: "block" });
  });

  it("사업비 계획이 없는 계획서도 정상 결과다 — 진단 자체를 실패시키지 않는다", () => {
    const parsed = parseDiagnosis(JSON.stringify({ ...base, budget: { found: false, note: "사업비 항목을 찾지 못했습니다.", findings: [] } }));
    expect(parsed.budget.found).toBe(false);
    expect(parsed.budget.findings).toEqual([]);
    expect(parsed.psst.problem.score).toBe(20);
  });

  it("budget이 통째로 빠져도 PSST 진단은 살린다", () => {
    const parsed = parseDiagnosis(JSON.stringify(base));
    expect(parsed.budget).toEqual({ found: false, note: "", findings: [] });
    expect(parsed.actions).toHaveLength(2);
  });

  it("모르는 비목·잘못된 severity는 안전한 값으로 떨어뜨린다", () => {
    const parsed = parseDiagnosis(JSON.stringify({
      ...base,
      budget: { found: true, note: "", findings: [{ category: "존재하지않는비목", item: "X", issue: "Y", fix: "Z", severity: "critical" }] },
    }));
    expect(parsed.budget.findings[0]).toMatchObject({ category: "unknown", severity: "warn" });
  });

  it("필수 문장이 빠진 지적은 버린다 — 빈 칸이 화면에 뜨지 않게", () => {
    const parsed = parseDiagnosis(JSON.stringify({
      ...base,
      budget: { found: true, note: "", findings: [{ category: "labor", item: "대표 급여" }, { category: "labor", item: "직원 급여", issue: "i", fix: "f", severity: "warn" }] },
    }));
    expect(parsed.budget.findings).toHaveLength(1);
    expect(parsed.budget.findings[0].item).toBe("직원 급여");
  });
});
