import { describe, it, expect, vi, beforeEach } from "vitest";

/** 왕복 계측: 실제 서비스 코드가 Supabase를 몇 번 부르는지 셉니다. */
const calls: string[] = [];
const LATENCY = { auth: 525, rest: 200 }; // 실측 중앙값(ms)

const chain = (table: string): any => {
  const self: any = {};
  for (const m of ["select","eq","neq","order","limit","gt","in","is","update","insert","upsert","delete"]) {
    self[m] = () => self;
  }
  self.maybeSingle = async () => { calls.push(`rest:${table}`); return { data: table === "prep_team_members" ? { prep_team_id: "t1", joined_at: "x" } : { id: "u1", role: "pre_founder", onboarding_complete: true, institution_id: null }, error: null }; };
  self.single = async () => { calls.push(`rest:${table}`); return { data: {}, error: null }; };
  self.then = (res: any) => { calls.push(`rest:${table}`); return Promise.resolve({ data: [], error: null }).then(res); };
  return self;
};

vi.mock("../supabase", () => ({
  supabase: {
    auth: {
      getSession: async () => { calls.push("auth:getSession(local)"); return { data: { session: { user: { id: "u1" }, access_token: "t" } }, error: null }; },
      getUser: async () => { calls.push("auth:getUser(NETWORK)"); return { data: { user: { id: "u1" } }, error: null }; },
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from: (table: string) => chain(table),
  },
}));
vi.mock("../dev/devMode", () => ({ DEV_BYPASS: false, DEV_USER: { id: "u1" } }));

describe("성능 회귀 방지 — 페이지 로드 왕복", () => {
  beforeEach(async () => {
    calls.length = 0;
    (await import("./sessionCache")).clearSessionCache();
  });

  it("/founder/todo 진입: 게이트 2개 + 할 일 + 팀원", async () => {
    const ws = await import("./WorkspaceService");
    const fws = await import("./FounderWorkspaceService");

    // 게이트(RequireFounderSession)와 사이드바(WorkspaceShell)가 각각 세션을 확인합니다.
    await Promise.all([ws.getStartupProfile(), ws.getStartupProfile()]);
    // 게이트 통과 뒤 패널이 부르는 것들
    await Promise.all([ws.getWorkspaceTasks(), fws.getTeamMembers()]);

    const network = calls.filter((c) => !c.includes("local"));
    const authNet = calls.filter((c) => c.includes("NETWORK")).length;

    // auth.getUser()는 실측 중앙값 525ms짜리 인증 서버 왕복입니다.
    // 클라이언트 경로에서는 getSession(로컬)으로 충분하며, 접근 통제는 RLS가 합니다.
    expect(authNet, `클라이언트 경로에 getUser()가 다시 들어왔습니다: ${calls.join(" → ")}`).toBe(0);

    // 프로필과 팀 id는 세션 캐시를 공유해야 합니다. 늘어나면 중복 조회가 생긴 것입니다.
    expect(calls.filter((c) => c === "rest:startup_profiles")).toHaveLength(1);
    expect(network.length, `왕복이 늘었습니다: ${calls.join(" → ")}`).toBeLessThanOrEqual(4);
    void LATENCY;
  });
});
