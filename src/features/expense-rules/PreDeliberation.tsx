"use client";

import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { POLICY } from "./ruleset";
import { Field, Panel, StatusBadge, inputClass } from "../startup-workspace/ui";
import { cn } from "@/lib/utils";

/** 사전심의 합본 구성 서류 6종. */
const DOCUMENTS = [
  { id: "request", name: "사전심의 요청 공문", note: "집행 사유와 금액을 명시" },
  { id: "contract", name: "외주용역 계약서(안)", note: "과업 범위·지급 조건 포함" },
  { id: "quotes", name: "비교견적서 2부 이상", note: "동일 과업 기준 비교" },
  { id: "scope", name: "과업지시서", note: "산출물과 검수 기준 명시" },
  { id: "vendor", name: "업체 사업자등록증", note: "업태·업종 연관성 확인용" },
  { id: "budget", name: "사업비 집행 계획 대비표", note: "비목별 잔여 한도 확인" },
] as const;

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(value);

export function PreDeliberationPanel() {
  const [amount, setAmount] = useState(0);
  const [vendor, setVendor] = useState("");
  const [title, setTitle] = useState("");
  const [checked, setChecked] = useState<string[]>([]);

  const required = amount >= POLICY.outsourcingDeliberationOver;
  const priorApproval = amount > POLICY.outsourcingPriorApprovalOver;
  const missing = useMemo(() => DOCUMENTS.filter((document) => !checked.includes(document.id)), [checked]);

  const toggle = (id: string) =>
    setChecked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <div className="space-y-5">
      <Panel title="사전심의 대상 판정">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="건명"><input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="예) 앱 개발 외주" className={inputClass} /></Field>
          <Field label="외주 업체"><input value={vendor} onChange={(event) => setVendor(event.target.value)} className={inputClass} /></Field>
          <Field label="계약 금액 (부가세 포함)"><input type="number" min={0} value={amount || ""} onChange={(event) => setAmount(Number(event.target.value))} className={inputClass} /></Field>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <StatusBadge tone={required ? "amber" : "green"}>
            {required ? `사전심의 대상 · ${won(POLICY.outsourcingDeliberationOver)}원 이상` : "사전심의 비대상"}
          </StatusBadge>
          {priorApproval && <StatusBadge tone="red">{won(POLICY.outsourcingPriorApprovalOver)}원 초과 · 주관기관 사전승인 필수</StatusBadge>}
        </div>
        <p className="mt-3 text-sm leading-6 text-[#475569]">
          협약기간 이내에 동일 외주용역업체와 계약된 총금액이 {won(POLICY.outsourcingPriorApprovalOver)}원(부가세 포함)을 초과하는 경우에도 외주용역비 집행 적정성 사전 심의가 필요합니다.
        </p>
      </Panel>

      <Panel title="합본 구비 현황" action={<StatusBadge tone={missing.length ? "amber" : "green"}>{DOCUMENTS.length - missing.length}/{DOCUMENTS.length} 구비</StatusBadge>}>
        <div className="space-y-2">
          {DOCUMENTS.map((document, index) => {
            const active = checked.includes(document.id);
            return (
              <button
                key={document.id}
                type="button"
                onClick={() => toggle(document.id)}
                className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left", active ? "border-[#16A34A] bg-[#F0FDF4]" : "border-[#E2E8F0]")}
              >
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold", active ? "bg-[#16A34A] text-white" : "bg-[#F8FAFC] text-[#94A3B8]")}>
                  {active ? "✓" : index + 1}
                </span>
                <span className="min-w-0">
                  <strong className="block text-sm font-bold text-[#0F172A]">{document.name}</strong>
                  <span className="text-xs text-[#475569]">{document.note}</span>
                </span>
              </button>
            );
          })}
        </div>
        {missing.length > 0 && (
          <p className="mt-4 rounded-xl bg-[#FFFBEB] p-3 text-sm font-semibold text-[#B45309]">
            미구비 {missing.length}종: {missing.map((document) => document.name).join(", ")}
          </p>
        )}
        <button
          onClick={() => window.print()}
          disabled={missing.length > 0 || !required}
          className="mt-4 rounded-[10px] bg-[#2563EB] px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Printer size={14} className="mr-1 inline" />
          {!required ? "사전심의 비대상 건입니다" : missing.length ? `합본 생성 (${missing.length}종 미구비)` : "합본 PDF 생성"}
        </button>
      </Panel>

      <Panel title="합본 표지 미리보기">
        <div className="rounded-xl border border-[#E2E8F0] p-6">
          <p className="text-center text-sm font-bold text-[#475569]">사업비 집행 사전심의 요청</p>
          <h3 className="mt-3 text-center text-2xl font-bold text-[#0F172A]">{title || "건명을 입력하세요"}</h3>
          <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="font-bold text-[#475569]">외주 업체</dt><dd className="mt-1 text-[#0F172A]">{vendor || "—"}</dd></div>
            <div><dt className="font-bold text-[#475569]">계약 금액</dt><dd className="mt-1 tabular-nums text-[#0F172A]">{amount ? `${won(amount)}원` : "—"}</dd></div>
            <div><dt className="font-bold text-[#475569]">심의 사유</dt><dd className="mt-1 text-[#0F172A]">{required ? "외주용역비 집행 적정성 심의" : "—"}</dd></div>
            <div><dt className="font-bold text-[#475569]">첨부 서류</dt><dd className="mt-1 text-[#0F172A]">{DOCUMENTS.length - missing.length}종</dd></div>
          </dl>
        </div>
      </Panel>
    </div>
  );
}
