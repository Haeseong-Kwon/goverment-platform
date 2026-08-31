"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { AuthError, AuthField, AuthShell, authInputClass } from "@/features/auth/AuthShell";
import { Button, LinkButton } from "@/features/startup-workspace/ui";
import { completeAuthFromUrl, toAuthMessage, updatePassword } from "@/lib/services/AuthService";
import { getStartupProfile, resolveWorkspaceDestination } from "@/lib/services/WorkspaceService";
import { getCurrentUser } from "@/lib/services/AuthService";
import { courseHref, isCourseAccount } from "@/features/course/course";

/**
 * 인증을 마친 사람을 어디로 보낼지.
 *
 * 과목 경로로 가입한 학생을 창업자 온보딩("팀 설정")으로 보내면 안 됩니다.
 * 과목 가입은 자기 콜백(`/course/auth/callback`)을 쓰지만, 그 전에 발송된 링크와
 * 비밀번호 재설정은 여전히 이 화면으로 돌아오므로 여기서도 갈라 줍니다.
 */
async function resolveDestination() {
  const user = await getCurrentUser().catch(() => null);
  if (isCourseAccount(user?.user_metadata)) return courseHref();
  const profile = await getStartupProfile().catch(() => null);
  return profile ? resolveWorkspaceDestination(profile) : "/onboarding";
}

const MIN_PASSWORD_LENGTH = 6;

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ready, setReady] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    completeAuthFromUrl(new URLSearchParams(searchParams.toString()))
      .then((authenticated) => { if (mounted) setReady(authenticated); })
      .catch((reason) => {
        if (!mounted) return;
        setReady(false);
        setError(toAuthMessage(reason, "재설정 링크가 만료되었거나 올바르지 않습니다."));
      });
    return () => { mounted = false; };
  }, [searchParams]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      setError("두 비밀번호가 서로 다릅니다.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePassword(password);
      router.replace(await resolveDestination());
    } catch (reason) {
      setError(toAuthMessage(reason, "비밀번호를 바꾸지 못했습니다."));
      setSaving(false);
    }
  };

  if (ready === null) {
    return (
      <main className="grid min-h-screen place-items-center bg-white">
        <Loader2 className="animate-spin text-[#2563EB]" size={28} />
      </main>
    );
  }

  if (!ready) {
    return (
      <AuthShell title="링크를 확인할 수 없습니다" description={error ?? "재설정 링크가 만료되었거나 이미 사용되었습니다."}>
        <div className="flex items-center gap-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-5">
          <TriangleAlert className="text-[#DC2626]" size={20} />
          <span className="text-sm font-semibold text-[#DC2626]">로그인 화면에서 재설정 메일을 다시 요청해 주세요.</span>
        </div>
        <LinkButton href="/login" size="lg" block className="mt-6">로그인 화면으로</LinkButton>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="새 비밀번호 설정" description="변경하면 바로 워크스페이스로 이동합니다.">
      <form onSubmit={submit} className="space-y-5">
        <AuthField label="새 비밀번호" hint={`${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요.`}>
          <input required type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={password} onChange={(event) => setPassword(event.target.value)} className={authInputClass} />
        </AuthField>
        <AuthField label="새 비밀번호 확인">
          <input required type="password" autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} value={confirm} onChange={(event) => setConfirm(event.target.value)} className={authInputClass} />
        </AuthField>
        {error && <AuthError>{error}</AuthError>}
        <Button type="submit" size="lg" block loading={saving}>비밀번호 변경</Button>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-white">
          <Loader2 className="animate-spin text-[#2563EB]" size={28} />
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
