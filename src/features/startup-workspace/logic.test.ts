import { describe, expect, it } from "vitest";
import {
  canManagerSeeReviewItem,
  getFounderDashboardSummary,
  getDday,
  getDdayTone,
  getMonthlyDiagnosticUsage,
  getLandingNavigation,
  getManagerDashboardSummary,
  getSidebarLinks,
  getSidebarItems,
  isSidebarLinkActive,
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

describe("getDday", () => {
  it("counts whole days from today, so a deadline today is D-0", () => {
    const now = new Date("2026-07-30T15:20:00.000Z");
    expect(getDday("2026-07-30", now)).toBe(0);
    expect(getDday("2026-07-31", now)).toBe(1);
    expect(getDday("2026-08-31", now)).toBe(32);
  });

  it("returns a negative number for a deadline that already passed", () => {
    expect(getDday("2026-07-28", new Date("2026-07-30T00:00:00.000Z"))).toBe(-2);
  });

  it("returns null when there is no usable deadline", () => {
    expect(getDday(null)).toBeNull();
    expect(getDday(undefined)).toBeNull();
    expect(getDday("나중에")).toBeNull();
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
    expect(getSidebarItems("founder")).toEqual(["홈", "정산 사전검증", "사전심의 합본", "상태 트래커", "서류 보관함", "팀 설정"]);
    expect(getSidebarItems("manager")).toEqual(["대시보드", "검토 큐", "사업비 계획 검토", "팀 관리", "리포트", "설정"]);
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
      "/manager/plan-review",
      "/manager/teams",
      "/manager/reports",
      "/manager/settings",
    ]);
  });

  it("uses independent founder agreement routes after conversion", () => {
    expect(getSidebarLinks("founder").map((item) => item.href)).toEqual([
      "/workspace",
      "/workspace/precheck",
      "/workspace/predeliberation",
      "/workspace/tracker",
      "/workspace/vault",
      "/workspace/settings",
    ]);
  });
});

describe("isSidebarLinkActive", () => {
  it("marks the exact top-level workspace route without selecting sibling roots", () => {
    expect(isSidebarLinkActive("/founder", "/founder")).toBe(true);
    expect(isSidebarLinkActive("/founder", "/founder/todo")).toBe(false);
    expect(isSidebarLinkActive("/founder", "/founderish")).toBe(false);
  });

  it("marks nested pages under a menu href", () => {
    expect(isSidebarLinkActive("/manager/review", "/manager/review/detail-1")).toBe(true);
    expect(isSidebarLinkActive("/manager/review", "/manager/reports")).toBe(false);
  });
});

describe("getFounderDashboardSummary", () => {
  it("derives dashboard values from persisted tasks instead of fixed demo numbers", () => {
    expect(getFounderDashboardSummary([
      { id: "1", title: "초안", due_date: "2026-07-20", status: "todo", task_type: "auto", is_hidden: false },
      { id: "2", title: "검토", due_date: null, status: "in_progress", task_type: "custom", is_hidden: false },
      { id: "3", title: "완료", due_date: "2026-07-18", status: "done", task_type: "auto", is_hidden: false },
    ])).toEqual({ remainingTasks: 2, automaticTasks: 2, completionRate: 33, nextDueDate: "2026-07-20" });
  });
});

describe("getManagerDashboardSummary", () => {
  const at = (createdAt: string, status: "validated" | "rejected" | "approved" | "draft", role: "founder" | "pre_founder" = "founder") =>
    ({ id: createdAt, title: "건", team: "팀", amount: "100원", evidenceCount: 0, status, validation: "passed", role, createdAt }) as const;

  it("counts only requests a manager is allowed to see", () => {
    const summary = getManagerDashboardSummary([
      at("2026-07-15T00:00:00.000Z", "validated"),
      at("2026-07-10T00:00:00.000Z", "rejected"),
      at("2026-07-17T00:00:00.000Z", "draft", "pre_founder"),
    ], new Date("2026-07-17T00:00:00.000Z"));
    expect(summary.requestCount).toBe(2);
    expect(summary.rejectionRate).toBe(50);
  });

  it("measures waiting and delay on undecided requests only", () => {
    // 승인·반려한 건은 더 이상 기다리는 건이 아니므로 대기 지표에서 빠집니다.
    expect(getManagerDashboardSummary([
      at("2026-07-15T00:00:00.000Z", "validated"),
      at("2026-07-01T00:00:00.000Z", "rejected"),
      at("2026-07-02T00:00:00.000Z", "approved"),
    ], new Date("2026-07-17T00:00:00.000Z"))).toEqual({
      requestCount: 3,
      rejectionRate: 33,
      pendingCount: 1,
      delayedCount: 0,
      averageWaitDays: 2,
    });
  });

  it("flags requests waiting three days or longer as delayed", () => {
    const summary = getManagerDashboardSummary([
      at("2026-07-14T00:00:00.000Z", "validated"),
      at("2026-07-16T00:00:00.000Z", "validated"),
    ], new Date("2026-07-17T00:00:00.000Z"));
    expect(summary).toMatchObject({ pendingCount: 2, delayedCount: 1, averageWaitDays: 2 });
  });

  it("reports zeroes instead of dividing by zero when nothing is visible", () => {
    expect(getManagerDashboardSummary([])).toEqual({
      requestCount: 0,
      rejectionRate: 0,
      pendingCount: 0,
      delayedCount: 0,
      averageWaitDays: 0,
    });
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
