import { NextRequest, NextResponse } from "next/server";
import { runBizplanDiagnosis } from "@/lib/ai/openrouter";
import { createUserClient, DEV_BYPASS_SERVER } from "@/lib/supabaseAdmin";
import { MONTHLY_DIAGNOSIS_LIMIT } from "@/features/startup-workspace/logic";

const EVENT_NAME = "bizplan_diagnosis";

const monthStart = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
};

/**
 * 무료 횟수는 서버에서 셉니다. 브라우저에서만 막으면 요청을 직접 보내는 것으로
 * 얼마든지 넘길 수 있고, 호출 한 번마다 실제 비용이 나갑니다.
 */
export async function POST(request: NextRequest) {
  let body: { text?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON 요청 본문이 필요합니다." }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 100) return NextResponse.json({ error: "진단할 사업계획서 본문을 100자 이상 입력해 주세요." }, { status: 400 });
  if (text.length > 40_000) return NextResponse.json({ error: "사업계획서 본문은 40,000자 이하로 입력해 주세요." }, { status: 413 });

  const client = DEV_BYPASS_SERVER ? null : createUserClient(request);
  let userId: string | null = null;

  if (!DEV_BYPASS_SERVER) {
    if (!client) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const { data: auth, error: authError } = await client.auth.getUser();
    if (authError || !auth.user) return NextResponse.json({ error: "세션이 유효하지 않습니다. 다시 로그인해 주세요." }, { status: 401 });
    userId = auth.user.id;

    const { count, error: countError } = await client
      .from("workspace_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_name", EVENT_NAME)
      .gte("created_at", monthStart());
    if (countError) return NextResponse.json({ error: "사용 이력을 확인하지 못했습니다." }, { status: 500 });
    if ((count ?? 0) >= MONTHLY_DIAGNOSIS_LIMIT) {
      return NextResponse.json(
        { error: `이번 달 무료 진단 ${MONTHLY_DIAGNOSIS_LIMIT}회를 모두 사용했습니다. 다음 달 1일에 초기화됩니다.` },
        { status: 429 },
      );
    }
  }

  try {
    const { report, model, generationId } = await runBizplanDiagnosis(text);
    // 사용 이력은 서버가 남깁니다. 클라이언트가 기록을 건너뛰어 횟수를 늘릴 수 없어야 합니다.
    if (client && userId) {
      await client.from("workspace_events").insert({ user_id: userId, event_name: EVENT_NAME, payload: { model, generationId } });
    }
    // 토큰 사용량·비용은 내부 지표라 브라우저로 내보내지 않습니다.
    return NextResponse.json({ ...report, model }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 진단에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
