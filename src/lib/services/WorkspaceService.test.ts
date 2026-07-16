import { describe, expect, it } from "vitest";
import { resolveWorkspaceDestination } from "./WorkspaceService";

describe("resolveWorkspaceDestination", () => {
  it("sends an incomplete pre-founder through onboarding", () => {
    expect(resolveWorkspaceDestination({ role: "pre_founder", onboardingComplete: false })).toBe("/onboarding");
  });

  it("keeps founders and managers on their separated workspaces", () => {
    expect(resolveWorkspaceDestination({ role: "founder", onboardingComplete: true })).toBe("/workspace");
    expect(resolveWorkspaceDestination({ role: "manager", onboardingComplete: true })).toBe("/manager");
  });
});
