"use client";

import { useEffect, useState } from "react";
import { getSession, onAuthStateChange } from "@/lib/services/AuthService";
import { getCurrentPrepTeamId, getStartupProfile, type StartupProfile } from "@/lib/services/WorkspaceService";

export type SessionState =
  | { status: "loading" }
  | { status: "signed_out" }
  | { status: "signed_in"; profile: StartupProfile | null; email: string | null };

/**
 * 워크스페이스 화면이 "로그인했는가 / 온보딩을 마쳤는가"를 한 번만 판단하도록 모읍니다.
 * 각 패널이 따로 물어보면 화면마다 다른 오류 문구가 나옵니다.
 *
 * 로컬 세션을 읽어 화면을 즉시 그립니다. 실제 접근 통제는 Supabase RLS가 담당하므로
 * 이 판단은 보안 경계가 아니라 다음 행동을 안내하는 용도입니다.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let mounted = true;

    const resolve = async () => {
      const session = await getSession();
      if (!mounted) return;
      if (!session?.user) {
        setState({ status: "signed_out" });
        return;
      }
      /**
       * 팀 id를 프로필과 나란히 데웁니다.
       *
       * 게이트가 통과해야 패널이 마운트되고, 그때부터 팀 id를 물어본 뒤에야 데이터를 부릅니다.
       * 그대로 두면 조회 3개가 줄줄이 이어져 왕복 3회가 됩니다. 여기서 미리 시작해 두면
       * 패널이 뜰 때 이미 답이 캐시에 있어 데이터 조회 한 번만 남습니다.
       * 팀이 아직 없는 계정(온보딩 전)은 실패가 정상이라 조용히 무시합니다.
       */
      void getCurrentPrepTeamId().catch(() => undefined);

      const profile = await getStartupProfile().catch(() => null);
      if (mounted) setState({ status: "signed_in", profile, email: session.user.email ?? null });
    };

    void resolve();
    // 같은 사용자로 토큰만 갱신된 경우까지 다시 조회하면, 보고 있던 화면이 주기적으로 새로 로딩됩니다.
    let lastUserId: string | null | undefined;
    const unsubscribe = onAuthStateChange((user) => {
      const nextUserId = user?.id ?? null;
      if (lastUserId === undefined) {
        lastUserId = nextUserId;
        return;
      }
      if (nextUserId === lastUserId) return;
      lastUserId = nextUserId;
      void resolve();
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
