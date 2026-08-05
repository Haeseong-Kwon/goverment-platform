import { NextRequest, NextResponse } from "next/server";
import { runBizplanDiagnosis, type BizplanInput } from "@/lib/ai/openrouter";
import { extractDocxText } from "@/lib/ai/docx";
import { createUserClient, DEV_BYPASS_SERVER } from "@/lib/supabaseAdmin";
import { getDiagnosisCreditBalance } from "@/features/startup-workspace/rules";

const EVENT_NAME = "bizplan_diagnosis";

/**
 * 무료 횟수 집계 기준이 되는 이번 달 시작. 한국 시간 1일 00:00입니다.
 * UTC로 자르면 안내 문구("다음 달 1일 초기화")보다 9시간 늦게 리셋됩니다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const monthStart = () => {
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const kstMonthStart = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), 1);
  return new Date(kstMonthStart - KST_OFFSET_MS).toISOString();
};

/** 진단 리포트를 붙일 준비 팀. 팀이 없으면 저장만 건너뜁니다. */
async function getPrepTeamId(client: NonNullable<ReturnType<typeof createUserClient>>, userId: string) {
  const { data } = await client
    .from("prep_team_members")
    .select("prep_team_id")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.prep_team_id as string | undefined) ?? null;
}

/** 팀 초대 코드로 실제 합류한 인원 수. 진단 무료 횟수의 보너스 근거입니다. */
async function countAcceptedInvites(client: NonNullable<ReturnType<typeof createUserClient>>, teamId: string | null) {
  if (!teamId) return 0;
  const { data } = await client.from("prep_team_invites").select("use_count").eq("prep_team_id", teamId);
  return (data ?? []).reduce((sum, row) => sum + (Number(row.use_count) || 0), 0);
}

/**
 * 첨부 파일 상한. 서버리스 요청 본문 한도(대략 4.5MB) 안에 들어와야 합니다.
 * 텍스트 레이어가 있는 사업계획서 PDF는 보통 이 안에 들어옵니다.
 * 이보다 큰 파일은 대개 스캔 이미지라 어차피 글자를 뽑을 수 없습니다.
 */
const MAX_FILE_BYTES = 4 * 1024 * 1024;

/** 본문 또는 첨부 파일 중 하나를 진단 입력으로 만듭니다. */
async function readInput(request: NextRequest): Promise<BizplanInput | { error: string; status: number }> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return { error: "첨부한 파일을 읽지 못했습니다.", status: 400 };
    if (file.size === 0) return { error: "빈 파일입니다.", status: 400 };
    if (file.size > MAX_FILE_BYTES) {
      return { error: `파일이 너무 큽니다. 최대 4MB까지 첨부할 수 있습니다. (현재 ${(file.size / 1024 / 1024).toFixed(1)}MB)`, status: 413 };
    }
    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // 워드는 우리가 직접 글자를 뽑아 본문 경로로 넘깁니다(OpenRouter의 파서는 PDF만 봅니다).
    if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) {
      let text: string;
      try {
        text = extractDocxText(buffer);
      } catch (error) {
        return { error: error instanceof Error ? error.message : "워드 파일을 읽지 못했습니다.", status: 422 };
      }
      if (text.trim().length < 100) {
        return { error: "워드 파일에서 읽어낸 본문이 100자 미만입니다. 표·이미지로만 이뤄진 문서는 글자를 뽑을 수 없습니다.", status: 422 };
      }
      return { kind: "text", text: text.slice(0, 40_000), sourceName: file.name };
    }

    if (name.endsWith(".doc")) {
      return { error: "구형 워드(.doc)는 지원하지 않습니다. .docx 또는 PDF로 저장한 뒤 올려 주세요.", status: 415 };
    }
    if (name.endsWith(".hwp") || name.endsWith(".hwpx")) {
      return { error: "한글 파일(HWP)은 지원하지 않습니다. PDF로 내보낸 뒤 올려 주세요.", status: 415 };
    }
    if (!file.type.includes("pdf") && !name.endsWith(".pdf")) {
      return { error: "PDF 또는 워드(.docx) 파일만 첨부할 수 있습니다.", status: 415 };
    }
    return { kind: "file", fileName: file.name, base64: buffer.toString("base64") };
  }

  let body: { text?: unknown };
  try { body = await request.json(); } catch { return { error: "JSON 요청 본문이 필요합니다.", status: 400 }; }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (text.length < 100) return { error: "진단할 사업계획서 본문을 100자 이상 입력해 주세요.", status: 400 };
  if (text.length > 40_000) return { error: "사업계획서 본문은 40,000자 이하로 입력해 주세요.", status: 413 };
  return { kind: "text", text };
}

/**
 * 무료 횟수는 서버에서 셉니다. 브라우저에서만 막으면 요청을 직접 보내는 것으로
 * 얼마든지 넘길 수 있고, 호출 한 번마다 실제 비용이 나갑니다.
 */
export async function POST(request: NextRequest) {
  const input = await readInput(request);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: input.status });

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

    // 초대 보너스도 서버에서 셉니다. 화면 뱃지만 늘려 두면 실제 상한과 어긋납니다.
    const teamId = await getPrepTeamId(client, userId);
    const { total } = getDiagnosisCreditBalance({ used: count ?? 0, acceptedInvites: await countAcceptedInvites(client, teamId) });
    if ((count ?? 0) >= total) {
      return NextResponse.json(
        { error: `이번 달 무료 진단 ${total}회를 모두 사용했습니다. 팀원을 초대하면 1회씩 늘어나며, 다음 달 1일에 초기화됩니다.` },
        { status: 429 },
      );
    }
  }

  try {
    const { report, model, generationId } = await runBizplanDiagnosis(input);
    // PSST 4축이 각 0~25점이므로 합이 그대로 100점 만점 "합격 준비도 점수"가 됩니다.
    const totalScore = Object.values(report.psst).reduce((sum, section) => sum + section.score, 0);

    // 사용 이력은 서버가 남깁니다. 클라이언트가 기록을 건너뛰어 횟수를 늘릴 수 없어야 합니다.
    if (client && userId) {
      await client.from("workspace_events").insert({ user_id: userId, event_name: EVENT_NAME, payload: { model, generationId, totalScore } });

      // 리포트 본문을 남겨야 버전별 점수 추이를 볼 수 있습니다.
      // 저장에 실패해도 진단 자체는 이미 비용을 치렀으므로 결과는 돌려줍니다.
      const teamId = await getPrepTeamId(client, userId);
      if (teamId) {
        const { error: saveError } = await client.from("diagnosis_reports").insert({
          prep_team_id: teamId,
          report_type: "bizplan",
          state: totalScore >= 70 ? "eligible" : totalScore >= 40 ? "review" : "ineligible",
          score: totalScore,
          result: { ...report, model, totalScore, source: input.kind === "file" ? input.fileName : input.sourceName ?? "본문 붙여넣기" },
          created_by: userId,
        });
        if (saveError) console.error("bizplan 진단 저장 실패:", saveError.message);
      }
    }
    // 토큰 사용량·비용은 내부 지표라 브라우저로 내보내지 않습니다.
    return NextResponse.json({ ...report, model, totalScore }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 진단에 실패했습니다.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
