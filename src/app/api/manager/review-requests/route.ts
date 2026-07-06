import { NextRequest, NextResponse } from "next/server";
import { canManagerSeeReviewItem } from "../../../../features/startup-workspace/logic";
import type { ReviewVisibilityInput } from "../../../../features/startup-workspace/types";

const reviewRequests: Array<ReviewVisibilityInput & { id: string; team: string; amount: string; evidenceCount: number }> = [
  { id: "rv-001", team: "인벤티", amount: "400만원", evidenceCount: 3, role: "founder", status: "requested", validation: "passed" },
  { id: "rv-002", team: "그린루프", amount: "180만원", evidenceCount: 4, role: "founder", status: "requested", validation: "passed" },
  { id: "prep-001", team: "프리팀 초안", amount: "비공개", evidenceCount: 0, role: "pre_founder", status: "draft", validation: "passed" },
];

export function GET(request: NextRequest) {
  const role = request.headers.get("x-startup-role");

  if (role !== "manager") {
    return NextResponse.json({ error: "manager role required" }, { status: 403 });
  }

  return NextResponse.json({
    items: reviewRequests.filter(canManagerSeeReviewItem).map(({ id, team, amount, evidenceCount }) => ({
      id,
      team,
      amount,
      evidenceCount,
      aiValidation: "검증 통과 🟢",
    })),
  });
}
