"use client";

import { useEffect, useState } from "react";
import { getSession, onAuthStateChange } from "@/lib/services/AuthService";
import { getStartupProfile, type StartupProfile } from "@/lib/services/WorkspaceService";

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
      const profile = await getStartupProfile().catch(() => null);
      if (mounted) setState({ status: "signed_in", profile, email: session.user.email ?? null });
    };

    void resolve();
    const unsubscribe = onAuthStateChange(() => void resolve());
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
