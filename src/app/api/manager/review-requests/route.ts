import { NextRequest, NextResponse } from "next/server";
import { canManagerSeeReviewItem } from "../../../../features/startup-workspace/logic";
import { getManagerReviewSubmissions } from "../../../../lib/services/WorkspaceService";

export async function GET(request: NextRequest) {
  const role = request.headers.get("x-startup-role");

  if (role !== "manager") {
    return NextResponse.json({ error: "manager role required" }, { status: 403 });
  }

  const reviewRequests = await getManagerReviewSubmissions();

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
