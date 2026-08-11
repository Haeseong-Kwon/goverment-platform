"use client";

import { useState } from "react";
import { CaseListPanel } from "./CasePanel";
import { VaultPanel } from "./FounderPanels";
import { LibraryPanel } from "./LibraryPanel";
import { focusRing, interactive } from "./ui";
import { cn } from "@/lib/utils";

/**
 * 서류 보관함의 3탭.
 *
 * 내 서류·참고 자료·다른 팀의 문제 해결 사례를 한 메뉴 안에 둡니다.
 * 사이드바에는 항목을 늘리지 않습니다 — 보관함 안쪽에서만 갈라집니다.
 * 무료 자료실은 비로그인 공개 페이지(/library)와 사이드바 항목이 그대로 남고, 여기서도 같은 목록을 봅니다.
 */
export type VaultTabId = "documents" | "library" | "cases";

const TABS: Array<{ id: VaultTabId; label: string }> = [
  { id: "documents", label: "내 서류" },
  { id: "library", label: "무료 자료실" },
  { id: "cases", label: "문제 해결 사례" },
];

export function VaultTabs({ initialTab = "documents", founder = false }: { initialTab?: VaultTabId; founder?: boolean }) {
  const [tab, setTab] = useState<VaultTabId>(initialTab);
  const casesHref = founder ? "/workspace/vault/cases" : "/founder/vault/cases";

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="서류 보관함" className="-mt-2 flex gap-1 overflow-x-auto border-b border-[#E2E8F0]">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`vault-tab-${item.id}`}
              aria-selected={active}
              aria-controls={`vault-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={cn(
                "-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold",
                interactive,
                focusRing,
                active ? "border-[#2563EB] text-[#2563EB]" : "border-transparent text-[#475569] hover:text-[#0F172A]",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" id={`vault-panel-${tab}`} aria-labelledby={`vault-tab-${tab}`}>
        {tab === "documents" && <VaultPanel />}
        {tab === "library" && <LibraryPanel />}
        {tab === "cases" && <CaseListPanel listHref={casesHref} />}
      </div>
    </div>
  );
}
