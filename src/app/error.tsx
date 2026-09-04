"use client";

import { useEffect } from "react";
import { Button, LinkButton, StatusBadge } from "@/features/startup-workspace/ui";

/**
 * 배포 직후, 열어 둔 탭이 이전 버전의 스크립트를 부르면 그 파일이 이미 없습니다.
 * 이 경우 "다시 시도"(reset)로는 절대 낫지 않습니다 — 없는 파일을 다시 부를 뿐입니다.
 * 새로고침만이 답이라 문구도 버튼도 다르게 줍니다.
 */
const STALE_BUILD = /ChunkLoadError|Loading chunk|dynamically imported module|module script failed/i;

/**
 * 화면 렌더링 중 예외가 나면 흰 화면 대신 이 화면이 뜹니다.
 * 원인을 사용자에게 떠넘기지 않고, 다시 시도와 홈 이동이라는 다음 행동을 줍니다.
 */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("화면 렌더링 오류:", error);
  }, [error]);

  const stale = STALE_BUILD.test(`${error.name} ${error.message}`);

  /*
   * digest는 서버에서 터진 오류에만 붙습니다. 화면(클라이언트)에서 터지면 없습니다.
   * 그때 코드 칸을 통째로 감추면 "아래 코드를 알려주세요"라고 해 놓고 알려 줄 것이
   * 없어, 문의를 받아도 어느 화면이 왜 죽었는지 알 수가 없습니다.
   */
  const code = error.digest ?? error.message.slice(0, 200);

  if (stale) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
        <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center">
          <StatusBadge tone="blue">업데이트됨</StatusBadge>
          <h1 className="mt-4 text-2xl font-bold">새 버전이 배포되었습니다</h1>
          <p className="mt-3 text-sm leading-6 text-[#475569]">
            열어 두신 화면이 이전 버전이라 이어서 열지 못했습니다. 새로고침하면 바로 정상 동작합니다.
          </p>
          <div className="mt-6 flex justify-center">
            <Button onClick={() => window.location.reload()}>새로고침</Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center">
        <StatusBadge tone="red">화면 오류</StatusBadge>
        <h1 className="mt-4 text-2xl font-bold">화면을 표시하지 못했습니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          입력하신 내용은 저장되지 않았을 수 있습니다. 다시 시도해도 같은 화면이 나오면 담당자에게 아래 코드를 알려주세요.
        </p>
        {code && (
          <p className="mt-3 break-words rounded-lg bg-[#F8FAFC] px-3 py-2 text-left font-mono text-xs leading-5 text-[#475569]">
            {code}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button onClick={reset}>다시 시도</Button>
          <LinkButton href="/" variant="secondary">홈으로</LinkButton>
        </div>
      </div>
    </main>
  );
}
