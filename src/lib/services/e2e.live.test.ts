/**
 * 실제 Supabase에 붙어 로그인한 상태로 서비스 함수를 그대로 돌립니다.
 *
 * 기본으로는 건너뜁니다. 운영 DB에 테스트 계정과 팀을 만들기 때문입니다.
 * 실행: RUN_LIVE_E2E=1 npx vitest run src/lib/services/e2e.live.test.ts
 * 끝나면 만든 계정을 지우고, auth.users CASCADE로 팀·할 일·코멘트도 함께 사라집니다.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const LIVE = process.env.RUN_LIVE_E2E === "1";

const env = Object.fromEntries(
  fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("=");
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  }),
);

// vitest는 Next.js와 달리 .env.local을 자동으로 읽지 않습니다.
// 서비스 모듈이 로드 시점에 환경변수를 읽으므로, 동적 import보다 먼저 채워 둡니다.
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
process.env.NEXT_PUBLIC_DEV_BYPASS = "0";

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const email = `e2e-${Date.now()}@startup-pilot.test`;
const password = "Test-Passw0rd-e2e";
let userId = "";

describe.skipIf(!LIVE)("실제 DB 통합 — 로그인 후 창업자 흐름", () => {
  beforeAll(async () => {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "E2E 테스트" },
    });
    if (error) throw error;
    userId = data.user.id;
  }, 60_000);

  afterAll(async () => {
    // prep_teams.leader_id와 consultation_requests.user_id는 CASCADE가 아니라
    // 계정을 지워도 남습니다. 검증이 운영 데이터에 흔적을 남기면 안 됩니다.
    await admin.from("consultation_requests").delete().eq("contact_email", email);
    await admin.from("leads").delete().eq("email", email);
    await admin.from("prep_teams").delete().eq("name", "E2E 팀");
    if (userId) await admin.auth.admin.deleteUser(userId);
  }, 60_000);

  it("로그인 → 온보딩 → 자동 마일스톤 → 담당자·코멘트 → 자격진단 저장/복원", async () => {
    // 서비스 모듈은 환경변수를 모듈 로드 시점에 읽으므로 여기서 동적 import 합니다.
    process.env.NEXT_PUBLIC_DEV_BYPASS = "0";
    const ws = await import("./WorkspaceService");
    const fws = await import("./FounderWorkspaceService");
    const auth = await import("./AuthService");

    // 1) 로그인
    await auth.signIn(email, password);
    const user = await auth.getCurrentUser();
    expect(user?.id, "로그인 후 세션에서 사용자를 읽어야 합니다").toBe(userId);

    // 2) 온보딩 — 실제 서비스 함수 그대로
    const result = await ws.completeOnboarding({
      fullName: "E2E 테스트",
      position: "대표",
      teamName: "E2E 팀",
      itemSummary: "통합 검증용 아이템",
      industry: "SaaS",
      programIds: ["modu-2026"],
      teamBuildingIntent: false,
      desiredPositions: [],
    });
    expect(result.redirect).toBe("/founder");

    // 3) 프로필이 온보딩 완료로 갱신되고 캐시가 무효화됐는가
    const profile = await ws.getStartupProfile();
    expect(profile?.onboardingComplete, "온보딩 후 프로필 캐시가 갱신되어야 합니다").toBe(true);

    // 4) 자동 마일스톤 4건 — programs.deadline 이 채워져 있어야 생깁니다
    const tasks = await ws.getWorkspaceTasks();
    const auto = tasks.filter((t) => t.task_type === "auto");
    expect(auto.length, `자동 마일스톤이 생성되어야 합니다. 받은 할 일: ${JSON.stringify(tasks.map((t) => t.title))}`).toBe(4);
    expect(auto.every((t) => t.due_date), "마일스톤에는 마감일이 있어야 합니다").toBe(true);

    // 5) 담당자 지정
    const target = auto[0];
    await ws.assignTask(target.id, userId);
    const afterAssign = (await ws.getWorkspaceTasks()).find((t) => t.id === target.id);
    expect(afterAssign?.assignee_id).toBe(userId);

    // 6) 코멘트 스레드
    await ws.addTaskComment(target.id, "E2E 코멘트");
    const comments = await ws.getTaskComments(target.id);
    expect(comments.map((c) => c.content)).toContain("E2E 코멘트");
    const withCount = (await ws.getWorkspaceTasks()).find((t) => t.id === target.id);
    expect(withCount?.comment_count, "코멘트 개수 집계가 목록에 반영되어야 합니다").toBe(1);

    // 7) 자격 진단 저장 → 복원 (형태 불일치 회귀 방지)
    const answers = { hasBusinessRegistration: false, hasPriorBenefit: false, hasClosureHistory: null, isEmployed: null, hasCoRepresentative: null };
    const { evaluateEligibility } = await import("@/features/startup-workspace/rules");
    const report = evaluateEligibility("modu-2026", answers);
    await ws.saveEligibilityReport("modu-2026", answers, report);
    const restored = await ws.getLatestEligibilityReport();
    expect(restored?.report, "저장한 자격 진단이 복원되어야 합니다").toBeTruthy();
    expect(restored?.programId).toBe("modu-2026");

    // 8) 선택한 지원사업과 캘린더
    const programs = await fws.getSelectedPrograms();
    expect(programs.map((p) => p.id)).toContain("modu-2026");
    expect(programs[0].deadline, "공고 마감일이 있어야 캘린더·히어로가 채워집니다").toBeTruthy();
    const today = new Date().toISOString().slice(0, 10);
    expect(programs[0].deadline! >= today, `공고 마감이 이미 지났습니다(${programs[0].deadline}). 신규 팀이 지난 마감으로 찬 보드를 받습니다`).toBe(true);
    expect(auto.every((t) => t.due_date! >= today), `자동 마일스톤이 전부 미래여야 합니다: ${JSON.stringify(auto.map((t) => t.due_date))}`).toBe(true);
    const calendar = await fws.getCalendarItems();
    expect(calendar.some((i) => i.kind === "program"), "캘린더에 공고 마감이 들어와야 합니다").toBe(true);

    // 9) 팀 초대 코드 발급 → 조회
    const invite = await fws.createTeamInvite();
    expect(invite.code).toHaveLength(8);
    expect((await fws.getActiveTeamInvite())?.code).toBe(invite.code);

    // 10) 대기 신청 저장 → 복원
    await ws.joinWaitlist("mentor");
    expect(await ws.getWaitlistEntries()).toContain("mentor");

    // 11) 상담 신청
    await ws.requestConsultation({ topic: "incorporation", contactEmail: email, contactName: "E2E", message: "검증" });

    // 12) 자료실 (008 시드)
    const lib = await import("./LibraryService");
    expect((await lib.listLibraryDocuments()).length).toBeGreaterThanOrEqual(7);

    // 13) 매니저에게 준비 데이터가 보이지 않아야 함 — 익명 클라이언트로 확인
    const anon = createClient(URL_, ANON, { auth: { persistSession: false } });
    const { data: leaked } = await anon.from("workspace_tasks").select("id");
    expect(leaked ?? [], "비로그인에게 팀 할 일이 보이면 안 됩니다").toHaveLength(0);
  }, 180_000);
});
