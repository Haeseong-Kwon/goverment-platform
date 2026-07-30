/**
 * 던져진 값에서 사용자에게 보여줄 문구를 뽑습니다.
 *
 * Supabase가 던지는 PostgrestError·StorageError는 `Error`의 인스턴스가 아니라
 * `{ message, code, details, hint }` 형태의 평범한 객체입니다. 그래서
 * `reason instanceof Error ? reason.message : fallback` 로 처리하면 DB·스토리지
 * 실패가 전부 fallback 문구로 뭉개져 원인이 화면에서 사라집니다.
 * (온보딩이 조용히 실패하던 원인이 이것이었습니다.)
 */

/** 사용자가 실제로 마주치는 Postgres 오류코드만 한국어 안내로 바꿉니다. */
const CODE_MESSAGES: Record<string, string> = {
  "23505": "이미 등록된 항목입니다.",
  "23503": "연결된 데이터가 없어 처리할 수 없습니다. 이전 단계를 먼저 완료해 주세요.",
  "23514": "입력값이 허용 범위를 벗어났습니다.",
  "42501": "권한이 없어 처리하지 못했습니다. 로그인 상태와 팀 소속을 확인해 주세요.",
  "PGRST116": "대상을 찾지 못했습니다. 새로 고친 뒤 다시 시도해 주세요.",
};

/** RLS 거부는 코드 대신 문구로 오는 경우가 있어 함께 봅니다. */
const PATTERN_MESSAGES: Array<[RegExp, string]> = [
  [/row-level security|violates row-level security/i, "권한이 없어 처리하지 못했습니다. 로그인 상태와 팀 소속을 확인해 주세요."],
  [/jwt|token is expired|invalid claim/i, "로그인이 만료되었습니다. 다시 로그인해 주세요."],
  [/failed to fetch|networkerror|load failed/i, "네트워크 연결을 확인한 뒤 다시 시도해 주세요."],
];

function readMessage(reason: unknown): string | null {
  if (typeof reason === "string") return reason.trim() || null;
  if (reason instanceof Error) return reason.message.trim() || null;
  if (reason && typeof reason === "object") {
    const value = (reason as { message?: unknown }).message;
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readCode(reason: unknown): string | null {
  if (reason && typeof reason === "object") {
    const value = (reason as { code?: unknown }).code;
    if (typeof value === "string" && value) return value;
  }
  return null;
}

/**
 * `fallback`은 최후의 수단입니다. 원인을 알 수 있으면 원인을 보여 줍니다.
 * 알려진 오류코드는 한국어 안내로, 그 밖에는 원문을 그대로 노출해
 * 사용자가 문의할 때 근거가 남게 합니다.
 */
export function toMessage(reason: unknown, fallback: string): string {
  const code = readCode(reason);
  if (code && CODE_MESSAGES[code]) return CODE_MESSAGES[code];

  const message = readMessage(reason);
  if (!message) return fallback;

  const matched = PATTERN_MESSAGES.find(([pattern]) => pattern.test(message));
  if (matched) return matched[1];

  return message;
}
