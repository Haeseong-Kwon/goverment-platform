"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, CheckCircle2, Info } from "lucide-react";
import { validateExpense } from "./engine";
import { CATEGORIES, CATEGORY_LIST, FRAUD_WARNING, ITEM_FLAG_LABELS, REASON_CODES } from "./ruleset";
import type { ExpenseCategory, ExpenseInput, ExpenseVerdict, ItemFlag, Severity } from "./types";
import { getAuthHeaders } from "@/lib/services/WorkspaceService";
import { Button, ChoiceChip, Field, Notice, Panel, StatusBadge, inputClass, textareaClass, type StatusTone } from "../startup-workspace/ui";
import { RelatedCaseLine } from "../startup-workspace/RelatedCases";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

interface AiJudgement {
  category: ExpenseCategory;
  itemFlags: ItemFlag[];
  rationale: string;
  correction: string;
  categoryMismatch: boolean;
}

const severityTone: Record<Severity, StatusTone> = { block: "red", warn: "amber", info: "blue" };
const severityLabel: Record<Severity, string> = { block: "위반", warn: "확인 권고", info: "안내" };
const verdictTone: Record<ExpenseVerdict["verdict"], StatusTone> = { pass: "green", review: "amber", fail: "red" };
// 배지 색이 이미 심각도를 전달합니다. 이모지는 플랫폼마다 다르게 그려져 색과 어긋납니다.
const verdictLabel: Record<ExpenseVerdict["verdict"], string> = { pass: "검증 통과", review: "보완 권장", fail: "제출 불가" };

/** 비목별로 노출할 항목 특성 체크박스. 전부 보여주면 창업자가 읽지 않습니다. */
const FLAGS_BY_CATEGORY: Record<ExpenseCategory, ItemFlag[]> = {
  material: ["office_supply", "office_furniture", "precious_material", "imported_with_customs", "unrelated_to_item"],
  outsourcing: ["mass_production_mold", "penalty_or_damages", "deliverable_not_working", "unrelated_to_item"],
  equipment: ["general_software", "office_furniture", "communication_device", "used_item", "used_from_individual", "camera_for_promotion_only"],
  ip: ["success_fee", "invention_compensation"],
  labor: ["retirement_reserve", "prepaid_before_work", "kickback_suspected"],
  fee: ["vehicle_rental", "office_deposit_or_maintenance", "residential_space", "sublease_contract", "event_outside_agreement", "invention_compensation"],
  travel: ["unrelated_to_item"],
  training: ["self_paid_portion", "refunded_course"],
  advertising: ["giveaway_or_uniform", "prepaid_emoney", "unrelated_to_item"],
};

const OPTIONAL_EVIDENCE = ["비교견적서", "선급금보증보험증권", "각서", "4대 보험가입자명부", "사전승인 회신"];

const emptyExpense = (agreementStart: string, agreementEnd: string): ExpenseInput => ({
  category: "material",
  title: "",
  amount: 0,
  agreementStart,
  agreementEnd,
  evidence: [],
  itemFlags: [],
  vendor: { type: "business" },
});

function FindingRow({ finding, context = "" }: { finding: ExpenseVerdict["findings"][number]; context?: string }) {
  const Icon = finding.severity === "block" ? AlertTriangle : finding.severity === "warn" ? Info : CheckCircle2;
  return (
    <li className="rounded-xl border border-[#E2E8F0] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge tone={severityTone[finding.severity]}>{severityLabel[finding.severity]}</StatusBadge>
        <StatusBadge tone="slate">{finding.reasonCode} {REASON_CODES[finding.reasonCode]}</StatusBadge>
        <span className="text-xs font-bold text-[#94A3B8]">{finding.code}</span>
      </div>
      <p className="mt-3 flex gap-2 text-sm font-semibold text-[#0F172A]">
        <Icon size={16} className="mt-0.5 shrink-0" />
        {finding.message}
      </p>
      <p className="mt-2 border-l-2 border-[#CBD5E1] pl-3 text-sm leading-6 text-[#475569]">근거 · {finding.clause}</p>
      <p className="mt-2 rounded-lg bg-[#EFF6FF] p-3 text-sm font-semibold text-[#2563EB]">수정 방법 · {finding.fix}</p>
      {/* 확인 권고 건에만 답니다. 위반은 규정으로 끝나고, 안내는 사례까지 볼 일이 아닙니다. */}
      {finding.severity === "warn" && (
        <RelatedCaseLine text={`${finding.message} ${finding.fix} ${context}`} className="mt-3 border-t border-dashed border-[#E2E8F0] pt-3" />
      )}
    </li>
  );
}

export function VerdictReport({
  verdict,
  ai,
  onRequestReview,
  requestPending = false,
  context = "",
}: {
  verdict: ExpenseVerdict;
  ai?: AiJudgement | null;
  onRequestReview?: () => void;
  requestPending?: boolean;
  /** 집행 건 제목. 판정문에 없는 맥락(결제 수단 등)까지 보고 관련 사례를 찾습니다. */
  context?: string;
}) {
  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge tone={verdictTone[verdict.verdict]}>{verdictLabel[verdict.verdict]}</StatusBadge>
          <StatusBadge tone="slate">{verdict.categoryName}</StatusBadge>
          {verdict.preApprovalRequired && <StatusBadge tone="amber">사전승인 필요</StatusBadge>}
        </div>
        <p className="mt-3 text-sm font-semibold leading-6 text-[#475569]">{verdict.summary}</p>
        {/* requestPending: 전송 중 재클릭을 막습니다. 두 번 누르면 매니저 큐에 같은 건이 두 번 쌓입니다. */}
        {onRequestReview && (
          <Button onClick={onRequestReview} loading={requestPending} disabled={verdict.verdict === "fail" || requestPending} className="mt-4">
            {verdict.verdict === "fail" ? "위반 항목을 먼저 수정하세요" : "매니저에게 검토 요청"}
          </Button>
        )}
      </Panel>

      {ai && (
        <Panel title="AI 비목 판정">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="blue"><BrainCircuit size={12} className="mr-1 inline" />AI 추정</StatusBadge>
            <StatusBadge tone={ai.categoryMismatch ? "red" : "green"}>
              {ai.categoryMismatch ? `비목 오분류 의심 → ${CATEGORIES[ai.category].name}` : `비목 일치 · ${CATEGORIES[ai.category].name}`}
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#475569]">{ai.rationale}</p>
          <p className="mt-3 rounded-lg bg-[#F8FAFC] p-3 text-sm font-semibold text-[#0F172A]">수정 제안 · {ai.correction}</p>
          {ai.itemFlags.length > 0 && (
            <p className="mt-3 text-xs font-semibold text-[#94A3B8]">감지된 항목 특성: {ai.itemFlags.map((flag) => ITEM_FLAG_LABELS[flag]).join(" · ")}</p>
          )}
        </Panel>
      )}

      {verdict.findings.length > 0 && (
        <Panel title={`규정 판정 ${verdict.findings.length}건`}>
          <ul className="space-y-3">
            {verdict.findings.map((finding) => <FindingRow key={finding.code} finding={finding} context={context} />)}
          </ul>
        </Panel>
      )}

      {(verdict.missingEvidence.length > 0 || verdict.unchecked.length > 0) && (
        <Panel title="보완할 항목">
          {verdict.missingEvidence.length > 0 && (
            <div>
              <p className="text-sm font-bold text-[#0F172A]">누락 증빙</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {verdict.missingEvidence.map((name) => <li key={name}><StatusBadge tone="amber">{name}</StatusBadge></li>)}
              </ul>
            </div>
          )}
          {verdict.unchecked.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-bold text-[#0F172A]">아직 확인하지 못한 데이터</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {verdict.unchecked.map((name) => <li key={name}><StatusBadge tone="slate">{name}</StatusBadge></li>)}
              </ul>
            </div>
          )}
        </Panel>
      )}

      <p className="text-[13px] font-medium text-[#94A3B8]">
        본 판정은 「사업비 비목 해설」 룰셋 기반 사전검증이며 참고용입니다. 승인·반려의 최종 결정은 주관기관 담당자에게 있습니다. {FRAUD_WARNING}
      </p>
    </div>
  );
}

/** 협약 기간 기본값. 대부분의 사업이 당해 연도 안에서 끝나므로 올해 기준으로 채우고, 사용자가 고칠 수 있게 둡니다. */
const currentYear = () => new Date().getFullYear();

export function ExpenseValidator({
  agreementStart = `${currentYear()}-04-01`,
  agreementEnd = `${currentYear()}-12-31`,
  onRequestReview,
  requestPending = false,
  budgetLines = [],
}: {
  agreementStart?: string;
  agreementEnd?: string;
  onRequestReview?: (input: ExpenseInput, verdict: ExpenseVerdict) => void;
  requestPending?: boolean;
  /** 비목별 배정·집행 누계. 있으면 한도 초과를 함께 판정합니다. */
  budgetLines?: Array<{ category: string; allocated: number; executed: number }>;
}) {
  const [expense, setExpense] = useState<ExpenseInput>(() => emptyExpense(agreementStart, agreementEnd));
  const [description, setDescription] = useState("");
  const [remote, setRemote] = useState<{ verdict: ExpenseVerdict; ai: AiJudgement | null; aiError: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spec = CATEGORIES[expense.category];
  // 선택한 비목의 배정액을 입력에 얹어 판정합니다. 등록된 배정이 없으면 한도 판정은 건너뜁니다.
  const withBudget = useMemo(() => {
    const line = budgetLines.find((item) => item.category === expense.category);
    return line ? { ...expense, budget: { allocated: line.allocated, executed: line.executed } } : expense;
  }, [expense, budgetLines]);
  const localVerdict = useMemo(() => validateExpense(withBudget), [withBudget]);
  const shown = remote?.verdict ?? localVerdict;

  const patch = (changes: Partial<ExpenseInput>) => {
    setRemote(null);
    setExpense((current) => ({ ...current, ...changes }));
  };

  const toggle = <T extends string>(list: T[] | undefined, value: T) =>
    (list ?? []).includes(value) ? (list ?? []).filter((item) => item !== value) : [...(list ?? []), value];

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/workspace/expenses/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({ expense: withBudget, description }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "검증에 실패했습니다.");
      setRemote({ verdict: data.verdict, ai: data.ai, aiError: data.aiError });
    } catch (reason) {
      setError(toMessage(reason, "검증에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  };

  const evidenceOptions = Array.from(new Set([...spec.requiredEvidence, ...OPTIONAL_EVIDENCE]));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
      <div className="space-y-5">
        <Panel title="집행 내역 입력">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="비목">
              <select value={expense.category} onChange={(event) => patch({ category: event.target.value as ExpenseCategory, itemFlags: [] })} className={inputClass}>
                {CATEGORY_LIST.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </Field>
            <Field label="건명">
              <input value={expense.title ?? ""} onChange={(event) => patch({ title: event.target.value })} placeholder="예) 시제품 PCB 발주" className={inputClass} />
            </Field>
            <Field label="집행 금액 (부가세 포함)">
              <input type="number" min={0} value={expense.amount || ""} onChange={(event) => patch({ amount: Number(event.target.value) })} className={inputClass} />
            </Field>
            <Field label="선급금" hint="분할지급이 아니면 비워두세요">
              <input type="number" min={0} value={expense.advancePayment ?? ""} onChange={(event) => patch({ advancePayment: event.target.value ? Number(event.target.value) : undefined })} className={inputClass} />
            </Field>
            <Field label="집행일">
              <input type="date" value={expense.executionDate ?? ""} onChange={(event) => patch({ executionDate: event.target.value })} className={inputClass} />
            </Field>
            <Field label="납품·완료일">
              <input type="date" value={expense.deliveryDate ?? ""} onChange={(event) => patch({ deliveryDate: event.target.value })} className={inputClass} />
            </Field>
            <Field label="협약 시작일">
              <input type="date" value={expense.agreementStart} onChange={(event) => patch({ agreementStart: event.target.value })} className={inputClass} />
            </Field>
            <Field label="협약 종료일">
              <input type="date" value={expense.agreementEnd} onChange={(event) => patch({ agreementEnd: event.target.value })} className={inputClass} />
            </Field>
            <Field label="거래처 유형">
              <select
                value={expense.vendor?.type ?? "unknown"}
                onChange={(event) => patch({ vendor: { ...expense.vendor, type: event.target.value as NonNullable<ExpenseInput["vendor"]>["type"] } })}
                className={inputClass}
              >
                <option value="business">사업자등록 업체</option>
                <option value="individual">개인(프리랜서)</option>
                <option value="platform">중계 플랫폼(크몽·위시켓 등)</option>
                <option value="unknown">확인 안 됨</option>
              </select>
            </Field>
            <Field label="과업·업종 연관성">
              <select
                value={expense.vendor?.industryRelated === true ? "yes" : expense.vendor?.industryRelated === false ? "no" : ""}
                onChange={(event) => patch({ vendor: { ...expense.vendor, industryRelated: event.target.value === "" ? null : event.target.value === "yes" } })}
                className={inputClass}
              >
                <option value="">확인 필요</option>
                <option value="yes">일치함</option>
                <option value="no">일치하지 않음</option>
              </select>
            </Field>
            <Field label="주관기관 사전승인">
              <select
                value={expense.hasPriorApproval === true ? "yes" : expense.hasPriorApproval === false ? "no" : ""}
                onChange={(event) => patch({ hasPriorApproval: event.target.value === "" ? null : event.target.value === "yes" })}
                className={inputClass}
              >
                <option value="">해당 없음 / 미확인</option>
                <option value="yes">승인 받음</option>
                <option value="no">받지 않음</option>
              </select>
            </Field>
          </div>

          {expense.category === "labor" && (
            <div className="mt-4 grid gap-4 rounded-xl bg-[#F8FAFC] p-4 sm:grid-cols-2">
              {([
                ["대표자 인건비", "isRepresentative"],
                ["창업자 친족", "isRelative"],
                ["4대보험 가입", "insuranceEnrolled"],
                ["타 정부지원 자기부담 등재", "fundedByOtherProgram"],
              ] as const).map(([label, key]) => (
                <Field key={key} label={label}>
                  <select
                    value={expense.labor?.[key] === true ? "yes" : expense.labor?.[key] === false ? "no" : ""}
                    onChange={(event) => patch({ labor: { ...expense.labor, [key]: event.target.value === "" ? null : event.target.value === "yes" } })}
                    className={inputClass}
                  >
                    <option value="">확인 필요</option>
                    <option value="yes">예</option>
                    <option value="no">아니오</option>
                  </select>
                </Field>
              ))}
              <Field label="채용일">
                <input type="date" value={expense.labor?.hiredAt ?? ""} onChange={(event) => patch({ labor: { ...expense.labor, hiredAt: event.target.value } })} className={inputClass} />
              </Field>
            </div>
          )}

          {expense.category === "travel" && (
            <div className="mt-4 grid gap-4 rounded-xl bg-[#F8FAFC] p-4 sm:grid-cols-2">
              <Field label="국외 출장 여부">
                <select
                  value={expense.travel?.isOverseas === true ? "yes" : expense.travel?.isOverseas === false ? "no" : ""}
                  onChange={(event) => patch({ travel: { ...expense.travel, isOverseas: event.target.value === "" ? null : event.target.value === "yes" } })}
                  className={inputClass}
                >
                  <option value="">확인 필요</option>
                  <option value="yes">국외</option>
                  <option value="no">국내</option>
                </select>
              </Field>
              <Field label="항공 좌석 등급">
                <select value={expense.travel?.seatClass ?? "economy"} onChange={(event) => patch({ travel: { ...expense.travel, seatClass: event.target.value as "economy" } })} className={inputClass}>
                  <option value="economy">Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First</option>
                </select>
              </Field>
              {/* TRV-03·TRV-04가 요구하는 입력입니다. 없으면 여비는 영구히 '확인 필요'에 머뭅니다. */}
              <Field label="대중교통 이용 여부">
                <select
                  value={expense.travel?.isPublicTransport === true ? "yes" : expense.travel?.isPublicTransport === false ? "no" : ""}
                  onChange={(event) => patch({ travel: { ...expense.travel, isPublicTransport: event.target.value === "" ? null : event.target.value === "yes" } })}
                  className={inputClass}
                >
                  <option value="">확인 필요</option>
                  <option value="yes">대중교통</option>
                  <option value="no">자가용 등</option>
                </select>
              </Field>
              <Field label="출장자 4대보험 가입 여부">
                <select
                  value={expense.labor?.insuranceEnrolled === true ? "yes" : expense.labor?.insuranceEnrolled === false ? "no" : ""}
                  onChange={(event) => patch({ labor: { ...expense.labor, insuranceEnrolled: event.target.value === "" ? null : event.target.value === "yes" } })}
                  className={inputClass}
                >
                  <option value="">확인 필요</option>
                  <option value="yes">가입</option>
                  <option value="no">미가입</option>
                </select>
              </Field>
            </div>
          )}

          {expense.category === "training" && (
            <div className="mt-4 grid gap-4 rounded-xl bg-[#F8FAFC] p-4 sm:grid-cols-2">
              {/* TRN-01이 요구하는 입력입니다. */}
              <Field label="교육 대상자 4대보험 가입 여부">
                <select
                  value={expense.labor?.insuranceEnrolled === true ? "yes" : expense.labor?.insuranceEnrolled === false ? "no" : ""}
                  onChange={(event) => patch({ labor: { ...expense.labor, insuranceEnrolled: event.target.value === "" ? null : event.target.value === "yes" } })}
                  className={inputClass}
                >
                  <option value="">확인 필요</option>
                  <option value="yes">가입</option>
                  <option value="no">미가입</option>
                </select>
              </Field>
            </div>
          )}

          {expense.category === "fee" && (
            <div className="mt-4 grid gap-4 rounded-xl bg-[#F8FAFC] p-4 sm:grid-cols-2">
              <Field label="멘토링 1인 1일 지급액">
                <input type="number" min={0} value={expense.mentoring?.perPersonPerDay ?? ""} onChange={(event) => patch({ mentoring: { ...expense.mentoring, perPersonPerDay: event.target.value ? Number(event.target.value) : undefined } })} className={inputClass} />
              </Field>
              <Field label="시간당 단가">
                <input type="number" min={0} value={expense.mentoring?.hourlyRate ?? ""} onChange={(event) => patch({ mentoring: { ...expense.mentoring, hourlyRate: event.target.value ? Number(event.target.value) : undefined } })} className={inputClass} />
              </Field>
            </div>
          )}

          {expense.category === "ip" && (
            <div className="mt-4 grid gap-4 rounded-xl bg-[#F8FAFC] p-4 sm:grid-cols-2">
              <Field label="출원일">
                <input type="date" value={expense.ip?.filedAt ?? ""} onChange={(event) => patch({ ip: { ...expense.ip, filedAt: event.target.value } })} className={inputClass} />
              </Field>
              <Field label="출원인이 창업기업 본인">
                <select
                  value={expense.ip?.applicantIsSelf === true ? "yes" : expense.ip?.applicantIsSelf === false ? "no" : ""}
                  onChange={(event) => patch({ ip: { ...expense.ip, applicantIsSelf: event.target.value === "" ? null : event.target.value === "yes" } })}
                  className={inputClass}
                >
                  <option value="">확인 필요</option>
                  <option value="yes">예</option>
                  <option value="no">아니오</option>
                </select>
              </Field>
            </div>
          )}
        </Panel>

        <Panel title="항목 특성" action={<StatusBadge tone="slate">해당되는 항목만 체크</StatusBadge>}>
          <div className="flex flex-wrap gap-2">
            {FLAGS_BY_CATEGORY[expense.category].map((flag) => (
              <ChoiceChip
                key={flag}
                tone="red"
                selected={(expense.itemFlags ?? []).includes(flag)}
                onClick={() => patch({ itemFlags: toggle(expense.itemFlags, flag) })}
              >
                {ITEM_FLAG_LABELS[flag]}
              </ChoiceChip>
            ))}
          </div>
        </Panel>

        <Panel title="첨부 증빙" action={<StatusBadge tone="amber">필수 {spec.requiredEvidence.length}종</StatusBadge>}>
          <div className="flex flex-wrap gap-2">
            {evidenceOptions.map((name) => {
              const active = (expense.evidence ?? []).includes(name);
              const required = spec.requiredEvidence.includes(name);
              return (
                <ChoiceChip
                  key={name}
                  tone="green"
                  selected={active}
                  onClick={() => patch({ evidence: toggle(expense.evidence, name) })}
                  className={cn(!active && required && "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] hover:border-[#F59E0B]")}
                >
                  {active ? "✓ " : required ? "! " : "+ "}{name}
                </ChoiceChip>
              );
            })}
          </div>
        </Panel>

        <Panel title="집행 내역 설명" action={<StatusBadge tone="blue"><BrainCircuit size={12} className="mr-1 inline" />AI 비목 판정</StatusBadge>}>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="예) 시제품 외관 목업 제작을 A사에 의뢰했고 계약금 절반을 먼저 지급했습니다. 업체는 3D 프린팅 전문 사업자입니다."
            className={cn(textareaClass, "min-h-32")}
          />
          <Button onClick={() => void run()} loading={loading} className="mt-3">
            {loading ? "판정 중…" : "AI 사전검증 실행"}
          </Button>
          {error && <div className="mt-3"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}
          {remote?.aiError && (
            <div className="mt-3">
              <Notice tone="warning">AI 판정은 실패했지만 규정 검증 결과는 아래에 표시됩니다. ({remote.aiError})</Notice>
            </div>
          )}
          <p className="mt-3 text-xs font-medium text-[#94A3B8]">설명을 비워두어도 아래 규정 검증 결과는 입력값 기준으로 실시간 갱신됩니다.</p>
        </Panel>
      </div>

      <div className="space-y-5">
        <VerdictReport verdict={shown} ai={remote?.ai} context={expense.title} requestPending={requestPending} onRequestReview={onRequestReview ? () => onRequestReview(expense, shown) : undefined} />
        <Panel title={`${spec.name} 규정 요약`}>
          <p className="text-sm leading-6 text-[#475569]">{spec.definition}</p>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[#475569]">
            {spec.cautions.map((caution) => <li key={caution} className="border-l-2 border-[#CBD5E1] pl-3">{caution}</li>)}
          </ul>
          <p className="mt-4 text-sm font-bold text-[#0F172A]">자주 나오는 위반사례</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {spec.violations.map((violation) => <li key={violation}><StatusBadge tone="red">{violation}</StatusBadge></li>)}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
