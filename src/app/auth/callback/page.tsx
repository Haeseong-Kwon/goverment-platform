"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck, TriangleAlert } from "lucide-react";
import { AuthShell } from "@/features/auth/AuthShell";
import { LinkButton } from "@/features/startup-workspace/ui";
import { completeAuthFromUrl, toAuthMessage } from "@/lib/services/AuthService";
import { getStartupProfile, resolveWorkspaceDestination } from "@/lib/services/WorkspaceService";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("이메일 인증을 확인하고 있습니다.");

  useEffect(() => {
    let mounted = true;

    completeAuthFromUrl(new URLSearchParams(searchParams.toString()))
      .then(async (authenticated) => {
        if (!mounted) return;
        if (!authenticated) throw new Error("인증 정보가 올바르지 않거나 링크가 만료되었습니다.");
        setStatus("success");
        setMessage("이메일 인증이 완료되었습니다. 잠시 후 워크스페이스로 이동합니다.");
        const profile = await getStartupProfile().catch(() => null);
        setTimeout(() => router.replace(profile ? resolveWorkspaceDestination(profile) : "/onboarding"), 1200);
      })
      .catch((reason) => {
        if (!mounted) return;
        setStatus("error");
        setMessage(toAuthMessage(reason, "이메일 인증 처리 중 오류가 발생했습니다."));
      });

    return () => { mounted = false; };
  }, [router, searchParams]);

  return (
    <AuthShell
      title={status === "error" ? "인증 실패" : status === "success" ? "인증 완료" : "이메일 인증 처리 중"}
      description={message}
    >
      <div className="flex items-center gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-5">
        {status === "error" ? <TriangleAlert className="text-[#DC2626]" size={20} />
          : status === "success" ? <MailCheck className="text-[#16A34A]" size={20} />
          : <Loader2 className="animate-spin text-[#2563EB]" size={20} />}
        <span className="text-sm font-semibold text-[#475569]">
          {status === "error" ? "링크를 다시 요청하거나 로그인 화면에서 재시도해 주세요." : "이 화면을 닫지 말고 잠시 기다려 주세요."}
        </span>
      </div>

      {status === "error" && (
        <LinkButton href="/login" size="lg" block className="mt-6">로그인 화면으로 이동</LinkButton>
      )}
    </AuthShell>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-white">
          <Loader2 className="animate-spin text-[#2563EB]" size={28} />
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
