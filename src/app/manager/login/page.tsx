"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BarChart3, ClipboardCheck, Loader2, ShieldCheck } from "lucide-react";
import { AuthError, AuthField, AuthShell, authInputClass } from "@/features/auth/AuthShell";
import { Button } from "@/features/startup-workspace/ui";
import { DEV_BYPASS } from "@/lib/dev/devMode";
import { getCurrentUser, signIn, toAuthMessage } from "@/lib/services/AuthService";
import { bootstrapManagerAccess, getStartupProfile } from "@/lib/services/WorkspaceService";

const HIGHLIGHTS = [
  { Icon: ClipboardCheck, title: "사전검증 통과 건만 도착", desc: "형식 미비 건을 큐에서 먼저 걸러 냅니다." },
  { Icon: ShieldCheck, title: "사유코드 기반 반려 안내", desc: "관리지침 조항을 인용한 안내문을 자동으로 씁니다." },
  { Icon: BarChart3, title: "기관 리포트", desc: "반려 사유 분포와 처리 지연을 한눈에 봅니다." },
];

/**
 * 주관기관 담당자 전용 로그인.
 *
 * 매니저 계정은 자가 가입 대상이 아닙니다. 기관이 사전 등록한 계정만 열리며,
 * 이 화면이 로그인과 기관 연결을 한 번에 처리합니다. 예전에는 창업자용으로 가입한 뒤
 * /manager를 직접 입력해 "권한 없음" 화면 맨 아래 버튼을 찾아야 열렸습니다.
 */
export default function ManagerLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notRegistered, setNotRegistered] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (DEV_BYPASS) {
      setCheckingSession(false);
      return;
    }
    let mounted = true;
    getCurrentUser()
      .then(async (user) => {
        if (!mounted) return;
        // 이미 기관 계정으로 로그인한 사람에게 로그인 화면을 다시 보여 주지 않습니다.
        const profile = user ? await getStartupProfile().catch(() => null) : null;
        if (profile?.role === "manager" && profile.institutionId) {
          router.replace("/manager");
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => { if (mounted) setCheckingSession(false); });
    return () => { mounted = false; };
  }, [router]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setNotRegistered(false);
    try {
      await signIn(email, password);
      const profile = await getStartupProfile().catch(() => null);
      if (profile?.role === "manager" && profile.institutionId) {
        router.replace("/manager");
        return;
      }
      // 사전 등록된 계정이면 여기서 기관에 연결됩니다. 아니면 서버가 거절합니다.
      await bootstrapManagerAccess();
      router.replace("/manager");
    } catch (reason) {
      const message = toAuthMessage(reason, "로그인에 실패했습니다.");
      // 비밀번호가 틀린 것과 "기관 담당자가 아닌 것"은 다음 행동이 다릅니다.
      setNotRegistered(message.includes("기관"));
      setError(message);
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

  return (
    <AuthShell
      title="주관기관 로그인"
      description="기관이 사전 등록한 담당자 계정만 열립니다. 로그인하면 소속 기관의 검토 큐로 이동합니다."
      lead={<>협약 팀의 정산 검토를<br />기관 화면 한 곳에서</>}
      highlights={HIGHLIGHTS}
      footer={
        <div className="space-y-3 text-[#475569]">
          <p>
            아직 담당자로 등록되지 않으셨나요?{" "}
            <Link href="/manager/landing" className="font-bold text-[#2563EB]">기관 도입 안내</Link>
          </p>
          <p>
            창업자 계정으로 오셨다면{" "}
            <Link href="/login" className="font-bold text-[#2563EB]">워크스페이스 로그인</Link>
          </p>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-5">
        <AuthField label="업무 이메일" hint="기관에 등록한 주소로만 로그인됩니다.">
          <input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="manager@institution.or.kr" className={authInputClass} />
        </AuthField>

        <AuthField label="비밀번호">
          <input required type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" className={authInputClass} />
        </AuthField>

        {error && (
          <AuthError>
            {error}
            {notRegistered && (
              <span className="mt-1.5 block font-medium">
                기관 담당자 등록은 기관 관리자가 진행합니다. 소속 기관에 문의해 주세요.
              </span>
            )}
          </AuthError>
        )}

        <Button type="submit" size="lg" block loading={loading}>로그인</Button>
      </form>
    </AuthShell>
  );
}
