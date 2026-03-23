"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, MailCheck, TriangleAlert } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/common/Button";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("이메일 인증을 확인하고 있습니다.");

  useEffect(() => {
    const completeAuth = async () => {
      if (!supabase) {
        setStatus("error");
        setMessage("Supabase 설정을 확인할 수 없습니다.");
        return;
      }

      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (tokenHash && type) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type as any,
          });
          if (error) throw error;
        } else {
          throw new Error("인증 정보가 올바르지 않습니다.");
        }

        setStatus("success");
        setMessage("이메일 인증이 완료되었습니다. 잠시 후 대시보드로 이동합니다.");
        setTimeout(() => router.replace("/dashboard"), 1200);
      } catch (error: any) {
        console.error("Auth callback failed:", error);
        setStatus("error");
        setMessage(error?.message || "이메일 인증 처리 중 오류가 발생했습니다.");
      }
    };

    completeAuth();
  }, [router, searchParams]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-slate-950">
      <div className="w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-10 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <div className={`mb-6 rounded-full p-4 ${status === "error" ? "bg-red-50 text-red-500 dark:bg-red-500/10" : "bg-primary/10 text-primary dark:bg-blue-500/10 dark:text-blue-400"}`}>
            {status === "error" ? <TriangleAlert size={24} /> : status === "success" ? <MailCheck size={24} /> : <Loader2 className="animate-spin" size={24} />}
          </div>

          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-50">
            {status === "loading" && "이메일 인증 처리 중"}
            {status === "success" && "인증 완료"}
            {status === "error" && "인증 실패"}
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">{message}</p>

          {status === "error" && (
            <Link href="/login" className="mt-8">
              <Button className="rounded-2xl px-6 py-3">로그인 화면으로 이동</Button>
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6 dark:bg-slate-950">
          <Loader2 className="animate-spin text-primary" size={28} />
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
