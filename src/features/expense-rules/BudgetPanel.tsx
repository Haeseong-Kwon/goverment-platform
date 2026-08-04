"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES } from "./ruleset";
import type { ExpenseCategory } from "./types";
import { getBudgetLines, saveBudgetAllocation, type BudgetLine } from "@/lib/services/FounderWorkspaceService";
import { Button, EmptyState, Field, Notice, Panel, ProgressBar, Skeleton, StatusBadge, inputClass } from "../startup-workspace/ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(Math.round(value));
const CATEGORY_IDS = Object.keys(CATEGORIES) as ExpenseCategory[];

/**
 * 비목별 잔여 한도.
 *
 * 반려 사유 상위권인 "한도 초과"는 규정 위반이 아니라 예산 소진이라 룰만으로는 잡히지 않습니다.
 * 협약서의 비목별 배정액을 여기에 옮겨 두면 사전검증이 집행 누계와 비교해 미리 막습니다.
 */
export function BudgetPanel({ onChange }: { onChange?: (lines: BudgetLine[]) => void }) {
  const [lines, setLines] = useState<BudgetLine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await getBudgetLines();
      setLines(rows);
      onChange?.(rows);
      setDraft(Object.fromEntries(rows.map((row) => [row.category, String(row.allocated)])));
    } catch (reason) {
      setLines([]);
      setError(toMessage(reason, "배정액을 불러오지 못했습니다."));
    }
  }, [onChange]);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      // 값이 바뀐 비목만 씁니다. 전체를 덮어쓰면 다른 화면에서 방금 고친 값을 되돌립니다.
      const changed = Object.entries(draft).filter(([category, value]) => {
        const current = lines?.find((line) => line.category === category)?.allocated ?? 0;
        return Number(value || 0) !== current;
      });
      for (const [category, value] of changed) {
        await saveBudgetAllocation(category, Number(value || 0));
      }
      setEditing(false);
      await load();
    } catch (reason) {
      setError(toMessage(reason, "배정액을 저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  if (lines === null) return <Skeleton className="h-40" />;

  const totalAllocated = lines.reduce((sum, line) => sum + line.allocated, 0);
  const totalExecuted = lines.reduce((sum, line) => sum + line.executed, 0);

  return (
    <Panel
      title="비목별 잔여 한도"
      action={
        editing ? (
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setEditing(false); void load(); }}>취소</Button>
            <Button size="sm" loading={saving} onClick={() => void save()}>저장</Button>
          </div>
        ) : (
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            {lines.length ? "배정액 수정" : "배정액 등록"}
          </Button>
        )
      }
    >
      {error && <div className="mb-3"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}

      {editing ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORY_IDS.map((category) => (
            <Field key={category} label={CATEGORIES[category].name}>
              <input
                type="number"
                min={0}
                step={1_000_000}
                value={draft[category] ?? ""}
                onChange={(event) => setDraft((current) => ({ ...current, [category]: event.target.value }))}
                placeholder="0"
                className={inputClass}
              />
            </Field>
          ))}
          <p className="text-xs leading-5 text-[#94A3B8] sm:col-span-2">
            협약서의 비목별 배정액을 그대로 입력하세요. 기관 확정본과 다르면 검토 단계에서 걸러집니다.
          </p>
        </div>
      ) : lines.length === 0 ? (
        <EmptyState
          title="등록된 배정액이 없습니다"
          description="협약서의 비목별 배정액을 등록하면 집행 전에 한도 초과를 잡아냅니다."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-[#475569]">
            총 배정 <strong className="tabular-nums text-[#0F172A]">{won(totalAllocated)}원</strong> · 집행{" "}
            <strong className="tabular-nums text-[#0F172A]">{won(totalExecuted)}원</strong> · 잔여{" "}
            <strong className="tabular-nums text-[#0F172A]">{won(totalAllocated - totalExecuted)}원</strong>
          </p>
          {lines.map((line) => {
            const share = line.allocated > 0 ? Math.min(100, Math.round((line.executed / line.allocated) * 100)) : 0;
            const over = line.remaining < 0;
            return (
              <div key={line.category}>
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-semibold text-[#0F172A]">{CATEGORIES[line.category as ExpenseCategory]?.name ?? line.category}</span>
                  <span className={cn("shrink-0 tabular-nums", over ? "font-bold text-[#DC2626]" : "text-[#475569]")}>
                    잔여 {won(line.remaining)}원 / {won(line.allocated)}원
                  </span>
                </div>
                <ProgressBar value={share} />
                {over && (
                  <p className="mt-1 text-xs font-semibold text-[#DC2626]">
                    배정액을 {won(Math.abs(line.remaining))}원 초과했습니다.
                  </p>
                )}
              </div>
            );
          })}
          <StatusBadge tone="slate">집행 누계는 반려되지 않은 제출 건 기준</StatusBadge>
        </div>
      )}
    </Panel>
  );
}
