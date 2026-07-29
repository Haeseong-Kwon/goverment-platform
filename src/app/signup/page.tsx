"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, MailCheck } from "lucide-react";
import { AuthError, AuthField, AuthShell, authInputClass } from "@/features/auth/AuthShell";
import { Button } from "@/features/startup-workspace/ui";
import { DEV_BYPASS } from "@/lib/dev/devMode";
import { getCurrentUser, signUp, toAuthMessage } from "@/lib/services/AuthService";
import { getStartupProfile, resolveWorkspaceDestination } from "@/lib/services/WorkspaceService";

const MIN_PASSWORD_LENGTH = 6;

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [sentTo, setSentTo] = useState<string | null>(null);

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await signUp(form.email, form.password, form.fullName.trim());
      setSentTo(form.email);
    } catch (reason) {
      setError(toAuthMessage(reason, "회원가입에 실패했습니다."));
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

  if (sentTo) {
    return (
      <AuthShell
        title="이메일 인증만 남았습니다"
        description="아래 주소로 인증 링크를 보냈습니다. 링크를 누르면 팀 설정 화면으로 이어집니다."
        footer={<Link href="/login" className="font-bold text-[#2563EB]">로그인 화면으로</Link>}
      >
        <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
          <MailCheck className="text-[#16A34A]" size={20} />
          <p className="mt-3 text-sm font-bold text-[#0F172A]">{sentTo}</p>
          <p className="mt-2 text-sm leading-6 text-[#475569]">
            메일이 보이지 않으면 스팸함을 확인해 주세요. 인증을 마치기 전에는 워크스페이스 데이터가 저장되지 않습니다.
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="창업자 계정 만들기"
      description="가입 후 팀 이름과 준비 중인 지원사업을 입력하면 마감 기준 TODO가 자동 생성됩니다."
      footer={
        <p className="flex flex-wrap items-center justify-between gap-2 text-[#475569]">
          이미 계정이 있으신가요?
          <Link href="/login" className="font-bold text-[#2563EB]">로그인</Link>
        </p>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <AuthField label="이름">
          <input required value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} placeholder="홍길동" className={authInputClass} />
        </AuthField>

        <AuthField label="이메일">
          <input required type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="founder@example.com" className={authInputClass} />
        </AuthField>

        <AuthField label="비밀번호" hint={`${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`}>
          <input
            required
            type="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            value={form.password}
            onChange={(event) => setForm({ ...form, password: event.target.value })}
            placeholder="비밀번호"
            className={authInputClass}
          />
        </AuthField>

        {error && <AuthError>{error}</AuthError>}

        <Button type="submit" size="lg" block loading={loading}>가입하고 인증 메일 받기</Button>

        <p className="text-xs leading-6 text-[#94A3B8]">
          주관기관 매니저 계정은 기관이 직접 발급합니다. 기관 담당자에게 문의해 주세요.
        </p>
      </form>
    </AuthShell>
  );
}
