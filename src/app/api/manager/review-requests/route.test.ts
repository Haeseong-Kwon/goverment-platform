import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

vi.mock("../../../../lib/services/WorkspaceService", () => ({
  getManagerReviewSubmissions: vi.fn(),
}));

import { getManagerReviewSubmissions } from "../../../../lib/services/WorkspaceService";

const mockedGetManagerReviewSubmissions = vi.mocked(getManagerReviewSubmissions);

describe("manager review requests API", () => {
  beforeEach(() => {
    mockedGetManagerReviewSubmissions.mockReset();
  });

  it("rejects non-manager access", async () => {
    const response = await GET(new NextRequest("https://startup-os.test/api/manager/review-requests"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "manager role required" });
  });

  it("returns only validated founder review requests without diagnostic scores", async () => {
    mockedGetManagerReviewSubmissions.mockResolvedValue([
      { id: "rv-001", title: "정산 A", team: "실제팀 A", amount: "400만원", evidenceCount: 3, role: "founder", status: "validated", validation: "passed", createdAt: "2026-07-15T00:00:00.000Z" },
      { id: "rv-002", title: "정산 B", team: "실제팀 B", amount: "180만원", evidenceCount: 4, role: "founder", status: "rejected", validation: "passed", createdAt: "2026-07-16T00:00:00.000Z" },
      { id: "prep-001", title: "초안", team: "준비팀", amount: "비공개", evidenceCount: 0, role: "pre_founder", status: "draft", validation: "passed", createdAt: "2026-07-17T00:00:00.000Z" },
    ]);

    const response = await GET(
      new NextRequest("https://startup-os.test/api/manager/review-requests", {
        headers: { "x-startup-role": "manager" },
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { team: string }) => item.team)).toEqual(["실제팀 A", "실제팀 B"]);
    expect(JSON.stringify(body)).not.toContain("score");
  });
});
