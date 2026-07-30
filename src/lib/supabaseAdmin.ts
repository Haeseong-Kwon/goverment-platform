import { createClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트. service_role 키는 RLS를 우회하므로
 * 라우트 핸들러 안에서만 쓰고, 절대 NEXT_PUBLIC_ 접두사를 붙이지 않습니다.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

/**
 * 요청자의 액세스 토큰으로 동작하는 서버 클라이언트.
 * service_role과 달리 RLS를 그대로 받으므로, 이 클라이언트로 읽고 쓴 것은
 * 그 사용자가 직접 한 것과 같습니다. AI 호출처럼 비용이 드는 경로의 관문으로 씁니다.
 */
export function createUserClient(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  return createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** 개발용 진입 모드에서는 실제 세션이 없어 서버 인증을 건너뜁니다. 프로덕션 빌드에서는 항상 꺼집니다. */
export const DEV_BYPASS_SERVER =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_DEV_BYPASS === "1";

/** 기관 계정으로 승격할 수 있는 이메일 허용목록. 비어 있으면 기능 자체가 꺼집니다. */
export function getManagerAllowlist() {
  return (process.env.MANAGER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
