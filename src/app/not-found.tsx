import { LinkButton } from "@/features/startup-workspace/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 text-center">
        <p className="text-sm font-bold tracking-widest text-[#2563EB]">404</p>
        <h1 className="mt-3 text-2xl font-bold">요청하신 화면을 찾을 수 없습니다</h1>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          주소가 바뀌었거나 접근 권한이 없는 화면일 수 있습니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <LinkButton href="/">홈으로</LinkButton>
          <LinkButton href="/workspace-entry" variant="secondary">워크스페이스 진입</LinkButton>
        </div>
      </div>
    </main>
  );
}
