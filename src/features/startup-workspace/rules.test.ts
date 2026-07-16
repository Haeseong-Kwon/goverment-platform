import { describe, expect, it } from "vitest";
import {
  calculateInsurance,
  createMilestones,
  evaluateEligibility,
  getDiagnosisCreditBalance,
  recommendPrograms,
} from "./rules";

describe("createMilestones", () => {
  it("creates the documented D-14, D-10, D-7 and D-1 tasks", () => {
    expect(createMilestones("project-1", new Date("2026-08-20T00:00:00Z")).map((task) => [task.title, task.dueDate])).toEqual([
      ["사업계획서 초안 완성", "2026-08-06"],
      ["증빙 서류 준비", "2026-08-10"],
      ["발표 리허설", "2026-08-13"],
      ["최종 제출", "2026-08-19"],
    ]);
  });
});

describe("evaluateEligibility", () => {
  it("keeps unanswered facts in the required unchecked section", () => {
    expect(evaluateEligibility("yechang-2026", { hasBusinessRegistration: null })).toMatchObject({
      state: "review",
      unchecked: expect.arrayContaining(["사업자등록 여부"]),
    });
  });

  it("marks same-program benefits as a blocker", () => {
    expect(evaluateEligibility("yechang-2026", {
      hasBusinessRegistration: false,
      hasClosureHistory: false,
      hasPriorBenefit: true,
      isEmployed: false,
      hasCoRepresentative: false,
    })).toMatchObject({ state: "ineligible", blockers: ["동일 사업 기수혜 이력이 있습니다."] });
  });
});

describe("recommendPrograms", () => {
  it("returns eligible programs before ineligible programs", () => {
    const recommendations = recommendPrograms({
      hasBusinessRegistration: true,
      hasClosureHistory: false,
      hasPriorBenefit: false,
      isEmployed: false,
      hasCoRepresentative: false,
    });

    expect(recommendations.map((item) => item.state)).toEqual(["eligible", "eligible", "ineligible"]);
  });
});

describe("calculateInsurance", () => {
  it("separates employer and worker burden", () => {
    const result = calculateInsurance({ monthlySalary: 3_000_000, people: 1, accidentRate: 0.007 });
    expect(result.employerTotal).toBeGreaterThan(0);
    expect(result.workerTotal).toBeGreaterThan(0);
    expect(result.employerTotal).not.toBe(result.workerTotal);
  });
});

describe("getDiagnosisCreditBalance", () => {
  it("adds an invite credit to the monthly free diagnostic allowance", () => {
    expect(getDiagnosisCreditBalance({ used: 2, acceptedInvites: 1 })).toEqual({ total: 3, remaining: 1 });
  });
});
