import { supabase } from "../supabase";

/**
 * 세션 단위 캐시와 사용자 식별.
 *
 * 왜 필요한가 — 한 화면이 서비스 함수를 5~10개 부르는데, 그때마다 인증 왕복과
 * 팀 조회를 처음부터 다시 했습니다. 실측 기준 `auth.getUser()`는 중앙값 525ms,
 * 테이블 조회는 200ms입니다. 할 일 화면 하나가 왕복 8회를 넘겨 1.6초를 썼습니다.
 *
 * 두 가지를 고칩니다.
 *  1) `getUser()` 대신 `getSession()` — 토큰은 로컬에 있고 만료됐을 때만 네트워크를 씁니다.
 *  2) 사용자 id와 팀 id를 세션 동안 재사용 — 같은 질문을 화면마다 반복하지 않습니다.
 *
 * 보안은 그대로입니다. 접근 통제의 경계는 처음부터 이 값이 아니라 데이터베이스 권한(RLS)이고,
 * 모든 요청에는 서명된 토큰이 그대로 실려 갑니다. 여기서 읽는 id는 "어느 행을 물어볼지"를
 * 정하는 용도이며, 위조해 봐야 RLS가 거부합니다.
 */

/** 값이 아니라 진행 중인 약속을 담습니다. 동시에 부르면 왕복이 하나로 합쳐집니다. */
let userIdPromise: Promise<string | null> | null = null;
const entries = new Map<string, Promise<unknown>>();

export function clearSessionCache() {
  userIdPromise = null;
  entries.clear();
}

/**
 * 세션 동안 한 번만 조회합니다.
 * 실패하면 캐시에서 지워, 일시적 오류가 세션 내내 굳지 않게 합니다.
 */
export function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  const existing = entries.get(key) as Promise<T> | undefined;
  if (existing) return existing;
  const promise = load().catch((reason) => {
    entries.delete(key);
    throw reason;
  });
  entries.set(key, promise);
  return promise;
}

/** 팀 구성이 바뀌는 동작(온보딩·초대 합류·합격 전환) 뒤에 호출합니다. */
export function invalidateTeamCache() {
  entries.delete("prepTeamId");
  entries.delete("founderTeamId");
}

/** 역할이나 온보딩 완료 여부가 바뀌는 동작 뒤에 호출합니다. */
export function invalidateProfileCache() {
  entries.delete("startupProfile");
}

/**
 * 계정이 바뀔 때만 캐시를 버립니다.
 *
 * 모든 이벤트에 비우면 안 됩니다. TOKEN_REFRESHED는 토큰 만료 주기마다,
 * INITIAL_SESSION은 탭을 열 때마다 옵니다. 같은 사용자인데 캐시를 버리면
 * 화면이 멀쩡히 떠 있는 중에 조회가 처음부터 다시 일어납니다.
 */
let lastUserId: string | null | undefined;
if (supabase) {
  supabase.auth.onAuthStateChange((_event, session) => {
    const nextUserId = session?.user?.id ?? null;
    if (lastUserId === undefined) {
      lastUserId = nextUserId;
      return;
    }
    if (nextUserId !== lastUserId) {
      lastUserId = nextUserId;
      clearSessionCache();
    }
  });
}

export async function getAuthUserId(): Promise<string | null> {
  if (!supabase) return null;
  if (!userIdPromise) {
    userIdPromise = supabase.auth
      .getSession()
      .then(({ data }) => data.session?.user?.id ?? null)
      .catch(() => null);
    // 실패나 비로그인은 캐시하지 않습니다. 로그인 직후 재조회가 막히면 안 됩니다.
    userIdPromise = userIdPromise.then((id) => {
      if (!id) userIdPromise = null;
      return id;
    });
  }
  return userIdPromise;
}

/** 로그인이 필요한 경로용. 세션이 없으면 같은 문구로 끊습니다. */
export async function requireAuthUserId(): Promise<string> {
  const userId = await getAuthUserId();
  if (!userId) throw new Error("로그인이 필요합니다.");
  return userId;
}
