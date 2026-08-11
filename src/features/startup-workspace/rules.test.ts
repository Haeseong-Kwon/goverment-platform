import { describe, expect, it } from "vitest";
import {
  calculateInsurance,
  createMilestones,
  evaluateEligibility,
  getDiagnosisCreditBalance,
  matchProgramByTitle,
  recommendPrograms,
  STARTUP_PROGRAMS,
} from "./rules";

describe("STARTUP_PROGRAMS", () => {
  // 연도가 박히면 해가 바뀔 때마다 코드를 고쳐야 하고, 그 전까지 지난 연도가 화면에 남습니다.
  it("사업명에 연도를 박지 않는다", () => {
    for (const program of STARTUP_PROGRAMS) expect(program.name, program.id).not.toMatch(/\d{4}/);
  });

  it("마감일을 룰셋에 두지 않는다", () => {
    for (const program of STARTUP_PROGRAMS) expect(program, program.id).not.toHaveProperty("deadline");
  });
});

describe("matchProgramByTitle", () => {
  it("연도·차수가 붙은 실제 K-Startup 공고 제목에서 사업을 찾는다", () => {
    expect(matchProgramByTitle("2026년 예비창업패키지 예비창업자 모집 공고")?.id).toBe("yechang-2026");
    expect(matchProgramByTitle("2027년도 제2차 초기창업패키지 창업기업 모집")?.id).toBe("chocang-2026");
  });

  it("관계없는 공고에는 사업을 붙이지 않는다", () => {
    expect(matchProgramByTitle("2026년 웰컴 투 팁스 1차 참가기업 모집 (충청권)")).toBeUndefined();
  });
});

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
