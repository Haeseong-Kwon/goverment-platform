"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen } from "lucide-react";
import { findRelatedCaseIds, getCase } from "./cases";
import { focusRing, interactive } from "./ui";
import { cn } from "@/lib/utils";

/**
 * 이미 있는 화면 위에 사례를 한 줄로 얹습니다.
 *
 * 카드 안에 사례 본문을 펼치지 않습니다 — 원문은 보관함에만 있고 여기서는 가는 길만 알려 줍니다.
 * 걸리는 사례가 없으면 아무것도 그리지 않아 기존 레이아웃이 그대로 남습니다.
 */
export function RelatedCaseLine({ text, variant = "inline", className }: { text: string; variant?: "inline" | "collapsible"; className?: string }) {
  // 협약 팀(/workspace)과 준비 팀(/founder)은 보관함 주소가 다릅니다.
  const pathname = usePathname();
  const base = pathname?.startsWith("/workspace") ? "/workspace/vault/cases" : "/founder/vault/cases";

  const cases = findRelatedCaseIds(text).map(getCase).filter((item) => item !== undefined);
  if (cases.length === 0) return null;

  const linkClass = cn("font-semibold text-[#2563EB]", interactive, focusRing, "hover:text-[#1D4ED8] hover:underline underline-offset-2");

  if (variant === "collapsible") {
    return (
      <details className={cn("text-xs", className)}>
        <summary className={cn("inline-flex cursor-pointer items-center gap-1.5 text-[#475569]", focusRing)}>
          <BookOpen size={12} className="text-[#94A3B8]" />
          관련 사례 <span className="tabular-nums">{cases.length}</span>건
        </summary>
        <ul className="mt-1.5 space-y-1 pl-[18px]">
          {cases.map((item) => (
            <li key={item.id}>
              <Link href={`${base}/${item.id}`} className={linkClass}>
                <span className="font-mono">{item.id}</span> {item.shortLabel}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    );
  }

  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-[#475569]", className)}>
      <BookOpen size={14} className="shrink-0 text-[#94A3B8]" />
      관련 사례:
      {cases.map((item) => (
        <Link key={item.id} href={`${base}/${item.id}`} className={linkClass}>
          <span className="font-mono text-[13px]">{item.id}</span> {item.shortLabel}
        </Link>
      ))}
    </p>
  );
}
