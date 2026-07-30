"use client";

import { useEffect } from "react";
import { Button, LinkButton, StatusBadge } from "@/features/startup-workspace/ui";

/**
 * 화면 렌더링 중 예외가 나면 흰 화면 대신 이 화면이 뜹니다.
 * 원인을 사용자에게 떠넘기지 않고, 다시 시도와 홈 이동이라는 다음 행동을 줍니다.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("화면 렌더링 오류:", error);
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center">
        <StatusBadge tone="red">화면 오류</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">화면을 표시하지 못했습니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          입력하신 내용은 저장되지 않았을 수 있습니다. 다시 시도해도 같은 화면이 나오면 담당자에게 아래 코드를 알려주세요.
        </p>
        {error.digest && (
          <p className="mt-3 rounded-lg bg-[#F8FAFC] px-3 py-2 font-mono text-xs text-[#475569]">{error.digest}</p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>다시 시도</Button>
          <LinkButton href="/" variant="secondary">홈으로</LinkButton>
        </div>
      </div>
    </main>
  );
}
