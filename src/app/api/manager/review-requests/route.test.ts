import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

describe("manager review requests API", () => {
  it("rejects non-manager access", async () => {
    const response = GET(new NextRequest("https://startup-os.test/api/manager/review-requests"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "manager role required" });
  });

  it("returns only validated founder review requests without diagnostic scores", async () => {
    const response = GET(
      new NextRequest("https://startup-os.test/api/manager/review-requests", {
        headers: { "x-startup-role": "manager" },
      }),
    );

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items.map((item: { team: string }) => item.team)).toEqual(["인벤티", "그린루프"]);
    expect(JSON.stringify(body)).not.toContain("score");
  });
});
