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

/** 기관 계정으로 승격할 수 있는 이메일 허용목록. 비어 있으면 기능 자체가 꺼집니다. */
export function getManagerAllowlist() {
  return (process.env.MANAGER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}
