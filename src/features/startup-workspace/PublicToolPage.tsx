import Link from "next/link";
import { cn } from "@/lib/utils";
import { focusRing } from "./ui";

/**
 * 로그인 없이 열리는 도구 페이지의 공통 껍데기.
 *
 * 워크스페이스 사이드바 대신 홈으로 돌아갈 길과 가입 유도만 둡니다.
 * 검색으로 들어온 방문자가 첫 화면에서 값을 얻고, 원하면 그때 가입하는 순서입니다.
 */
export function PublicToolPage({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8">
      <nav className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className={cn("text-lg font-bold text-[#0F172A]", focusRing)}>
          StartUp Pilot
        </Link>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <Link href="/calculator" className={cn("rounded-lg px-3 py-2 text-[#475569] hover:bg-[#F1F5F9]", focusRing)}>계산기</Link>
          <Link href="/library" className={cn("rounded-lg px-3 py-2 text-[#475569] hover:bg-[#F1F5F9]", focusRing)}>무료 자료실</Link>
          <Link href="/signup" className={cn("rounded-lg bg-[#2563EB] px-3 py-2 text-white hover:bg-[#1D4ED8]", focusRing)}>무료로 시작</Link>
        </div>
      </nav>

      <header className="mb-8">
        <h1 className="text-3xl font-bold text-[#0F172A] md:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-[#475569]">{description}</p>
      </header>

      {children}

      <section className="mt-12 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
        <h2 className="text-xl font-bold text-[#0F172A]">지원사업 준비도 같이 정리하세요</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#475569]">
          공고 마감 기준 자동 TODO, 자격 진단, 사업계획서 AI 진단, 서류 보관함까지 무료로 쓸 수 있습니다.
        </p>
        <Link href="/signup" className={cn("mt-4 inline-block rounded-xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white hover:bg-[#1D4ED8]", focusRing)}>
          워크스페이스 시작하기
        </Link>
      </section>
    </main>
  );
}
