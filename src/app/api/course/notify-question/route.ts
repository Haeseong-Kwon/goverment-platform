import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabaseAdmin";

/**
 * 새 Q&A 질문을 과목 운영진 메일로 알립니다.
 *
 * 브라우저에서 직접 보내지 않는 이유가 둘입니다 — 발송 키를 브라우저에 둘 수 없고,
 * 운영진 메일 주소를 화면에 내려보내면 명단을 운영진에게만 연 의미가 없어집니다.
 *
 * 발송 수단(RESEND_API_KEY)이 없으면 조용히 넘어갑니다. 알림이 없다고 질문 등록이
 * 실패하면 본말이 뒤집힙니다 — 호출하는 쪽도 실패를 무시합니다.
 */
export const runtime = "nodejs";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function POST(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  let questionId: string;
  try {
    const body = await request.json();
    questionId = String(body?.questionId ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(questionId)) throw new Error("bad id");
  } catch {
    return NextResponse.json({ error: "질문 id가 올바르지 않습니다." }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // service_role 키가 없는 환경(로컬 등). 알림은 없지만 질문은 이미 등록됐습니다.
    return NextResponse.json({ sent: false, reason: "not_configured" });
  }

  // 토큰이 실제 로그인 사용자의 것인지 확인합니다. 이걸 빼면 아무나 이 경로를 두드려
  // 운영진에게 메일을 쏟아부을 수 있습니다.
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });

  // 질문이 실제로 있는지, 그리고 그 사람이 쓴 것인지 확인합니다.
  const { data: question } = await admin
    .from("course_questions")
    .select("id, title, content, author_id")
    .eq("id", questionId)
    .maybeSingle();
  if (!question || question.author_id !== userData.user.id) {
    return NextResponse.json({ error: "대상을 찾지 못했습니다." }, { status: 404 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.COURSE_NOTIFY_FROM;
  if (!apiKey || !from) {
    // 발송 수단이 아직 없습니다. 실패가 아니라 "설정 안 됨"입니다.
    return NextResponse.json({ sent: false, reason: "not_configured" });
  }

  const { data: staff } = await admin.from("course_staff").select("email");
  const recipients = (staff ?? []).map((row) => row.email as string).filter(Boolean);
  if (recipients.length === 0) return NextResponse.json({ sent: false, reason: "no_staff" });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  const link = `${siteUrl}/course/qna/${question.id}`;
  const excerpt = String(question.content).slice(0, 500);

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: recipients,
      subject: `[Q&A] ${question.title}`,
      text: `새 질문이 등록되었습니다.\n\n제목: ${question.title}\n\n${excerpt}\n\n답변하기: ${link}`,
    }),
  });

  if (!response.ok) {
    // 원문을 그대로 흘리지 않습니다. 발송 실패는 서버 로그로 충분합니다.
    console.error("Q&A 알림 메일 발송 실패:", response.status);
    return NextResponse.json({ sent: false, reason: "send_failed" }, { status: 502 });
  }

  return NextResponse.json({ sent: true, recipients: recipients.length });
}
