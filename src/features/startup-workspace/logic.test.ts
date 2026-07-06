import { describe, expect, it } from "vitest";
import {
  canManagerSeeReviewItem,
  getDdayTone,
  getMonthlyDiagnosticUsage,
  getLandingNavigation,
  getSidebarLinks,
  getSidebarItems,
  getStartupMilestones,
} from "./logic";

describe("getDdayTone", () => {
  it("uses slate, amber, and red thresholds from the design handoff", () => {
    expect(getDdayTone(8)).toBe("slate");
    expect(getDdayTone(7)).toBe("amber");
    expect(getDdayTone(4)).toBe("amber");
    expect(getDdayTone(3)).toBe("red");
  });
});

describe("getStartupMilestones", () => {
  it("creates automatic milestones without destructive deletion affordance", () => {
    expect(getStartupMilestones("예창패").map((item) => [item.title, item.dday, item.isAutomatic, item.action])).toEqual([
      ["예창패 사업계획서 초안 완성", 14, true, "hide"],
      ["예창패 증빙 서류 준비", 10, true, "hide"],
      ["예창패 발표 리허설", 7, true, "hide"],
      ["예창패 최종 검토 요청", 1, true, "hide"],
    ]);
  });
});

describe("getMonthlyDiagnosticUsage", () => {
  it("limits free diagnostics to twice per calendar month", () => {
    expect(
      getMonthlyDiagnosticUsage(
        ["2026-07-01T09:00:00.000Z", "2026-07-20T09:00:00.000Z", "2026-06-30T09:00:00.000Z"],
        new Date("2026-07-24T00:00:00.000Z"),
      ),
    ).toEqual({ used: 2, remaining: 0, isExhausted: true });
  });
});

describe("canManagerSeeReviewItem", () => {
  it("only exposes founder review requests that passed pre-validation", () => {
    expect(canManagerSeeReviewItem({ role: "pre_founder", status: "requested", validation: "passed" })).toBe(false);
    expect(canManagerSeeReviewItem({ role: "founder", status: "draft", validation: "passed" })).toBe(false);
    expect(canManagerSeeReviewItem({ role: "founder", status: "requested", validation: "failed" })).toBe(false);
    expect(canManagerSeeReviewItem({ role: "founder", status: "requested", validation: "passed" })).toBe(true);
  });
});

describe("getSidebarItems", () => {
  it("returns role-specific fixed navigation", () => {
    expect(getSidebarItems("pre_founder")).toContain("AI 진단");
    expect(getSidebarItems("founder")).toEqual(["홈", "정산 사전검증", "상태 트래커", "서류 보관함", "팀 설정"]);
    expect(getSidebarItems("manager")).toEqual(["대시보드", "검토 큐", "팀 관리", "리포트", "설정"]);
  });
});

describe("getSidebarLinks", () => {
  it("gives every founder preparation menu an addressable target", () => {
    expect(getSidebarLinks("pre_founder").map((item) => item.href)).toEqual([
      "/founder",
      "/founder/todo",
      "/founder/calendar",
      "/founder/diagnostics",
      "/founder/calculator",
      "/founder/incorporation",
      "/founder/connect",
      "/founder/vault",
      "/founder/settings",
    ]);
  });

  it("separates manager navigation from founder navigation", () => {
    expect(getSidebarLinks("manager").map((item) => item.href)).toEqual([
      "/manager",
      "/manager/review",
      "/manager/teams",
      "/manager/reports",
      "/manager/settings",
    ]);
  });

  it("uses independent founder agreement routes after conversion", () => {
    expect(getSidebarLinks("founder").map((item) => item.href)).toEqual([
      "/workspace",
      "/workspace/precheck",
      "/workspace/tracker",
      "/workspace/vault",
      "/workspace/settings",
    ]);
  });
});

describe("getLandingNavigation", () => {
  it("starts on the founder landing and sends workspace entry buttons to the role selection screen", () => {
    expect(getLandingNavigation("founder")).toEqual({
      homeHref: "/",
      counterpartHref: "/manager/landing",
      workspaceEntryHref: "/workspace-entry",
    });
  });

  it("lets the manager landing return to the founder landing and share the same workspace entry", () => {
    expect(getLandingNavigation("manager")).toEqual({
      homeHref: "/",
      counterpartHref: "/",
      workspaceEntryHref: "/workspace-entry",
    });
  });
});
