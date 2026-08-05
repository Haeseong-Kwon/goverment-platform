"use client";

import Link from "next/link";
import { CalendarCheck, Radar, ShieldCheck } from "lucide-react";
import { inputClass } from "@/features/startup-workspace/ui";
import { cn } from "@/lib/utils";

const HIGHLIGHTS = [
  { Icon: Radar, title: "AI 자격·계획서 진단", desc: "근거 조항과 함께 판정 결과를 돌려줍니다." },
  { Icon: CalendarCheck, title: "마감 기준 자동 TODO", desc: "공고 마감일에서 준비 마일스톤을 역산합니다." },
  { Icon: ShieldCheck, title: "정산 사전검증", desc: "반려될 항목을 제출 전에 먼저 찾습니다." },
];

/** 로그인·회원가입·비밀번호 재설정이 같은 화면 구조와 어조를 쓰도록 합니다. */
export function AuthShell({ title, description, children, footer }: {
  title: string;
  description: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white text-[#0F172A] lg:grid-cols-2">
      <aside className="hidden flex-col justify-between bg-[#F8FAFC] p-12 lg:flex">
        <Link href="/" className="text-xl font-bold">StartUp Pilot</Link>
        <div>
          <h2 className="text-[32px] font-bold leading-tight">정부 창업지원사업 행정을<br />한 워크스페이스에서</h2>
          <ul className="mt-10 space-y-6">
            {HIGHLIGHTS.map(({ Icon, title: label, desc }) => (
              <li key={label} className="flex gap-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EFF6FF] text-[#2563EB]"><Icon size={18} /></span>
                <span>
                  <strong className="block text-sm font-bold">{label}</strong>
                  <span className="mt-1 block text-sm leading-6 text-[#475569]">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs leading-6 text-[#94A3B8]">
          AI 진단·계산 결과는 참고용이며, 최종 기준은 각 사업 공고문과 관리지침입니다.
        </p>
      </aside>

      <div className="flex items-center justify-center px-5 py-12 md:px-10">
        <div className="w-full max-w-[420px]">
          <Link href="/" className="text-xl font-bold lg:hidden">StartUp Pilot</Link>
          <h1 className="mt-6 text-[28px] font-bold leading-tight lg:mt-0">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-[#475569]">{description}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-8 border-t border-[#E2E8F0] pt-6 text-sm">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

/** 인증 화면 입력. 워크스페이스 입력과 같은 hover·focus 규칙을 따릅니다. */
export const authInputClass = cn(inputClass, "h-12 px-4");

export function AuthField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-bold text-[#0F172A]">
      {label}
      {children}
      {hint && <span className="mt-1.5 block text-xs font-medium text-[#94A3B8]">{hint}</span>}
    </label>
  );
}

export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-3 text-sm font-semibold text-[#DC2626]">
      {children}
    </p>
  );
}
