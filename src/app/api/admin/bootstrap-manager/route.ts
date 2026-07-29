import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getManagerAllowlist } from "@/lib/supabaseAdmin";

const DEFAULT_INSTITUTION = process.env.MANAGER_INSTITUTION_NAME?.trim() || "기본 주관기관";
const DEFAULT_PROGRAM = "modu-2026";

const makeCode = () => Math.random().toString(36).slice(2, 10).toUpperCase();

/**
 * 허용목록에 있는 계정을 기관 매니저로 승격하고, 검토 큐를 실제로 돌려보는 데
 * 필요한 기관·전환 코드를 함께 만듭니다. 004-seed.sql을 수동 실행하는 대신
 * 쓰는 경로이며, MANAGER_EMAILS가 비어 있으면 전체가 비활성화됩니다.
 */
export async function POST(request: NextRequest) {
  const allowlist = getManagerAllowlist();
  if (allowlist.length === 0) {
    return NextResponse.json({ error: "기관 계정 전환이 비활성화되어 있습니다. MANAGER_EMAILS를 설정하세요." }, { status: 404 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "서버 설정 오류" }, { status: 500 });
  }

  const { data: auth, error: authError } = await admin.auth.getUser(token);
  const email = auth?.user?.email?.toLowerCase();
  if (authError || !auth.user || !email) return NextResponse.json({ error: "세션이 유효하지 않습니다." }, { status: 401 });
  if (!allowlist.includes(email)) {
    return NextResponse.json({ error: "이 계정은 기관 계정 전환 대상이 아닙니다." }, { status: 403 });
  }

  try {
    const { data: existing } = await admin.from("institutions").select("id").eq("name", DEFAULT_INSTITUTION).maybeSingle();
    let institutionId = existing?.id as string | undefined;
    if (!institutionId) {
      const { data: created, error } = await admin.from("institutions").insert({ name: DEFAULT_INSTITUTION }).select("id").single();
      if (error) throw error;
      institutionId = created.id as string;
    }

    const { error: profileError } = await admin
      .from("startup_profiles")
      .upsert(
        { id: auth.user.id, role: "manager", institution_id: institutionId, onboarding_complete: true, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    if (profileError) throw profileError;

    // 자동 마일스톤 TODO는 programs.deadline이 있어야 생성됩니다.
    const deadline = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
    await admin.from("programs").update({ deadline }).is("deadline", null);

    const { data: codes } = await admin
      .from("conversion_codes")
      .select("code, expires_at, use_count, max_uses")
      .eq("institution_id", institutionId)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    let conversionCode = codes?.[0]?.code as string | undefined;
    if (!conversionCode) {
      conversionCode = makeCode();
      const { error } = await admin.from("conversion_codes").insert({
        institution_id: institutionId,
        program_id: DEFAULT_PROGRAM,
        code: conversionCode,
        expires_at: new Date(Date.now() + 90 * 86_400_000).toISOString(),
        max_uses: 100,
        created_by: auth.user.id,
      });
      if (error) throw error;
    }

    return NextResponse.json({ institutionId, institutionName: DEFAULT_INSTITUTION, conversionCode });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "기관 계정 전환에 실패했습니다." }, { status: 500 });
  }
}
