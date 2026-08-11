"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { AuthError, AuthField, AuthShell, authInputClass } from "@/features/auth/AuthShell";
import { Button } from "@/features/startup-workspace/ui";
import { DEV_BYPASS } from "@/lib/dev/devMode";
import { getCurrentUser, requestPasswordReset, signIn, toAuthMessage } from "@/lib/services/AuthService";
import { getStartupProfile, resolveWorkspaceDestination } from "@/lib/services/WorkspaceService";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [resetMode, setResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    // 개발용 진입 모드에서는 항상 세션이 있는 것처럼 보이므로, 이 화면 자체를 볼 수 있게 자동 이동을 건너뜁니다.
    if (DEV_BYPASS) {
      setCheckingSession(false);
      return;
    }
    let mounted = true;
    getCurrentUser()
      .then(async (user) => {
        if (!mounted) return;
        if (!user) {
          setCheckingSession(false);
          return;
        }
        const profile = await getStartupProfile().catch(() => null);
        router.replace(profile ? resolveWorkspaceDestination(profile) : "/onboarding");
      })
      .catch(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, [router]);

  const submitLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password);
      const profile = await getStartupProfile().catch(() => null);
      router.replace(profile ? resolveWorkspaceDestination(profile) : "/onboarding");
    } catch (reason) {
      setError(toAuthMessage(reason, "로그인에 실패했습니다."));
      setLoading(false);
    }
  };

  const submitReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      setResetSent(true);
    } catch (reason) {
      setError(toAuthMessage(reason, "재설정 메일을 보내지 못했습니다."));
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <main className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="animate-spin text-[#2563EB]" size={28} />
      </main>
    );
  }

  if (resetMode) {
    return (
      <AuthShell
        title="비밀번호 재설정"
        description="가입한 이메일로 재설정 링크를 보내드립니다."
        footer={
          <button
            type="button"
            onClick={() => { setResetMode(false); setResetSent(false); setError(null); }}
            className="font-bold text-[#2563EB]"
          >
            로그인으로 돌아가기
          </button>
        }
      >
        {resetSent ? (
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
            <MailCheck className="text-[#16A34A]" size={20} />
            <p className="mt-3 text-sm font-bold text-[#0F172A]">{email} 으로 메일을 보냈습니다</p>
            <p className="mt-2 text-sm leading-6 text-[#475569]">
              메일이 보이지 않으면 스팸함을 확인해 주세요. 링크를 누르면 새 비밀번호를 설정하는 화면으로 이동합니다.
            </p>
          </div>
        ) : (
          <form onSubmit={submitReset} className="space-y-5">
            <AuthField label="이메일">
              <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="founder@example.com" className={authInputClass} />
            </AuthField>
            {error && <AuthError>{error}</AuthError>}
            <Button type="submit" size="lg" block loading={loading}>재설정 링크 받기</Button>
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="워크스페이스 로그인"
      description="팀 TODO, 진단 결과, 서류 보관함은 팀 계정에 저장됩니다."
      footer={
        <div className="space-y-3 text-[#475569]">
          <p className="flex flex-wrap items-center justify-between gap-2">
            아직 계정이 없으신가요?
            <Link href="/signup" className="font-bold text-[#2563EB]">회원가입</Link>
          </p>
          <p className="flex flex-wrap items-center justify-between gap-2">
            주관기관 담당자이신가요?
            <Link href="/manager/login" className="font-bold text-[#2563EB]">주관기관 로그인</Link>
          </p>
        </div>
      }
    >
      <form onSubmit={submitLogin} className="space-y-5">
        <AuthField label="이메일">
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="founder@example.com" className={authInputClass} />
        </AuthField>

        <div>
          <AuthField label="비밀번호">
            <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" className={authInputClass} />
          </AuthField>
          <button type="button" onClick={() => { setResetMode(true); setError(null); }} className="mt-2 text-xs font-bold text-[#2563EB]">
            비밀번호를 잊으셨나요?
          </button>
        </div>

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" block loading={loading}>로그인</Button>
      </form>
    </AuthShell>
  );
}
