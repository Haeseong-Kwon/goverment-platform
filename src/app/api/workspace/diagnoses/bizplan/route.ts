import { NextRequest, NextResponse } from "next/server";
import { runBizplanDiagnosis } from "@/lib/ai/openrouter";

export async function POST(request: NextRequest) {
  let body: { text?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON 요청 본문이 필요합니다." }, { status: 400 }); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 100) return NextResponse.json({ error: "진단할 사업계획서 본문을 100자 이상 입력해 주세요." }, { status: 400 });
  if (text.length > 40_000) return NextResponse.json({ error: "사업계획서 본문은 40,000자 이하로 입력해 주세요." }, { status: 413 });
  try {
    const diagnosis = await runBizplanDiagnosis(text);
    return NextResponse.json(diagnosis, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 진단에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
