import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../supabase";
import { DEV_BYPASS, DEV_USER } from "../dev/devMode";
import type { StartupRole } from "@/features/startup-workspace/domain";

/** 개발용 진입 모드에서 세션 자리에 들어가는 값. 실제 토큰이 아니므로 서버 호출에는 쓰이지 않습니다. */
const DEV_SESSION = {
  access_token: "dev-bypass",
  refresh_token: "dev-bypass",
  expires_in: 3600,
  token_type: "bearer",
  user: { id: DEV_USER.id, email: DEV_USER.email, user_metadata: { full_name: DEV_USER.fullName } } as unknown as User,
} as unknown as Session;

/** Supabase 인증 호출을 한곳에 모으고, 오류 문구를 한국어 사용자 문구로 바꿉니다. */

const AUTH_ERROR_MESSAGES: Array<[RegExp, string]> = [
  [/invalid login credentials/i, "이메일 또는 비밀번호가 올바르지 않습니다."],
  [/email not confirmed/i, "이메일 인증이 아직 끝나지 않았습니다. 받은 편지함의 인증 링크를 눌러 주세요."],
  [/user already registered|already been registered/i, "이미 가입된 이메일입니다. 로그인해 주세요."],
  [/password should be at least/i, "비밀번호는 6자 이상이어야 합니다."],
  /*
   * 메일 발송 한도는 계정이 아니라 **프로젝트 전체**에 걸립니다(기본 SMTP는 시간당 2통).
   * 아래 일반 문구("잠시 후 다시")로 뭉뜽그리면, 본인은 처음 눌렀는데 잦다는 말을 듣고
   * 기다려도 다음 슬롯은 다른 사람이 가져갑니다. 원인과 다음 행동을 따로 말합니다.
   */
  [/email rate limit|over_email_send_rate_limit/i, "지금은 인증 메일을 보낼 수 없습니다. 메일 발송 한도에 걸렸습니다 — 잠시 뒤 다시 시도하시고, 계속 같으면 담당 교수·조교에게 알려 주세요(직접 승인해 드릴 수 있습니다)."],
  [/for security purposes|rate limit|too many requests/i, "요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요."],
  [/invalid email/i, "이메일 형식을 확인해 주세요."],
  [/new password should be different/i, "이전과 다른 비밀번호를 입력해 주세요."],
];

export function toAuthMessage(error: unknown, fallback: string) {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  return AUTH_ERROR_MESSAGES.find(([pattern]) => pattern.test(raw))?.[1] ?? (raw || fallback);
}

const requireClient = () => {
  if (!supabase) throw new Error("Supabase 연결 정보가 없습니다. .env.local을 확인하세요.");
  return supabase;
};

/** 인증 메일의 돌아올 주소. 배포 환경과 로컬 모두에서 동작해야 합니다. */
export function getSiteUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  return typeof window === "undefined" ? "" : window.location.origin;
}

export const signUp = async (
  email: string,
  password: string,
  fullName: string,
  startupRole: Extract<StartupRole, "pre_founder" | "manager"> = "pre_founder",
) => {
  const client = requireClient();

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${getSiteUrl()}/auth/callback`,
      data: { full_name: fullName, startup_role: startupRole },
    },
  });
  if (error) throw error;

  if (data.user) {
    const { error: profileError } = await client
      .from("profiles")
      .upsert({ id: data.user.id, full_name: fullName, role: "Student" }, { onConflict: "id" });
    if (profileError) console.error("Error creating profile:", profileError);

    const { error: startupProfileError } = await client
      .from("startup_profiles")
      .upsert({ id: data.user.id, role: startupRole, onboarding_complete: false }, { onConflict: "id" });
    if (startupProfileError) console.error("Error creating startup profile:", startupProfileError);
  }

  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (DEV_BYPASS) return;
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

/** 비밀번호 재설정 메일 발송. 링크는 /auth/reset 에서 새 비밀번호를 받습니다. */
export const requestPasswordReset = async (email: string) => {
  const { error } = await requireClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${getSiteUrl()}/auth/reset`,
  });
  if (error) throw error;
};

export const updatePassword = async (password: string) => {
  const { error } = await requireClient().auth.updateUser({ password });
  if (error) throw error;
};

/**
 * 이메일 링크(해시 토큰 / PKCE code / OTP)로 돌아온 요청에서 세션을 세웁니다.
 * 인증 콜백과 비밀번호 재설정이 같은 규칙을 쓰도록 한 함수로 모았습니다.
 */
export const completeAuthFromUrl = async (params: URLSearchParams) => {
  const client = requireClient();

  if (typeof window !== "undefined" && window.location.hash) {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access_token = hashParams.get("access_token");
    const refresh_token = hashParams.get("refresh_token");
    if (access_token && refresh_token) {
      const { error } = await client.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
      return true;
    }
  }

  const code = params.get("code");
  if (code) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return true;
  }

  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (tokenHash && type) {
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: type as "email" | "recovery" });
    if (error) throw error;
    return true;
  }

  const { data } = await client.auth.getSession();
  return Boolean(data.session);
};

/**
 * 현재 로그인 사용자.
 *
 * `getUser()`가 아니라 `getSession()`을 씁니다. 전자는 매번 인증 서버로 나가
 * 실측 중앙값 525ms가 들고, 로그인·가입·온보딩 화면은 이 응답을 기다리느라
 * 폼을 그리지 못한 채 스피너만 보여 주고 있었습니다.
 * 후자는 로컬 토큰을 읽고 만료됐을 때만 네트워크를 씁니다.
 *
 * 이 값은 "이미 로그인했으니 워크스페이스로 보낼까"를 정하는 용도입니다.
 * 실제 데이터 접근 권한은 서명된 토큰과 RLS가 판단하므로 판정이 약해지지 않습니다.
 */
export const getCurrentUser = async () => {
  if (DEV_BYPASS) return DEV_SESSION.user;
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user ?? null;
};

export const getSession = async () => {
  if (DEV_BYPASS) return DEV_SESSION;
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session?.user ?? null));
  return () => data.subscription.unsubscribe();
};
