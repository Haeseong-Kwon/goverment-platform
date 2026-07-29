"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, TriangleAlert } from "lucide-react";
import { AuthError, AuthField, AuthShell, authInputClass } from "@/features/auth/AuthShell";
import { Button, LinkButton } from "@/features/startup-workspace/ui";
import { completeAuthFromUrl, toAuthMessage, updatePassword } from "@/lib/services/AuthService";
import { getStartupProfile, resolveWorkspaceDestination } from "@/lib/services/WorkspaceService";

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
      const profile = await getStartupProfile().catch(() => null);
      router.replace(profile ? resolveWorkspaceDestination(profile) : "/onboarding");
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
