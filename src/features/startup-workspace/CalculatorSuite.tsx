"use client";

import { useEffect, useState } from "react";
import { Mail } from "lucide-react";
import { calculateInsurance, calculateTotalLaborCost, compareBusinessTax } from "./rules";
import { captureLead } from "@/lib/services/WorkspaceService";
import { Button, ChoiceChip, Field, Notice, Panel, StatusBadge, inputClass } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

const won = (value: number) => new Intl.NumberFormat("ko-KR").format(Math.round(value));

/** 업종별로 다른 산재보험료율. 평균값을 기본으로 두고 직접 고칠 수 있게 합니다. */
const DEFAULT_ACCIDENT_RATE = 0.007;

const TABS = [
  { id: "insurance", label: "4대보험 실부담액", hint: "직원 1명을 뽑으면 사업주가 매달 얼마를 더 내는지" },
  { id: "labor", label: "인건비 총부담액", hint: "급여·보험·퇴직금을 합친 실제 지출" },
  { id: "tax", label: "법인 vs 개인 세금", hint: "같은 이익에서 어느 형태가 세금이 적은지" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const INSURANCE_LABELS: Record<string, string> = {
  nationalPension: "국민연금",
  healthInsurance: "건강보험",
  longTermCare: "장기요양",
  employmentInsurance: "고용보험",
  accidentInsurance: "산재보험",
};

function Bars({ items }: { items: Array<{ label: string; value: number; max: number }> }) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-[#0F172A]">{item.label}</span>
            <span className="shrink-0 tabular-nums text-[#475569]">{won(item.value)}원</span>
          </div>
          <div className="h-2.5 rounded-full bg-[#EFF6FF]">
            <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(100, (item.value / Math.max(1, item.max)) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function NumberField({ label, value, onChange, step = 100_000, hint }: { label: string; value: number; onChange: (value: number) => void; step?: number; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        min={0}
        step={step}
        value={value || ""}
        onChange={(event) => onChange(Math.max(0, Number(event.target.value)))}
        className={inputClass}
      />
    </Field>
  );
}

function InsuranceCalculator({ salary, people, accidentRate }: { salary: number; people: number; accidentRate: number }) {
  const result = calculateInsurance({ monthlySalary: salary, people, accidentRate });
  return (
    <div className="space-y-5">
      <Panel title="사업주 월 부담" action={<StatusBadge tone="blue">참고용 추정</StatusBadge>}>
        <strong className="block text-3xl font-bold tabular-nums text-[#0F172A]">{won(result.employerTotal)}원</strong>
        <div className="mt-5">
          <Bars items={Object.entries(result.employer).map(([key, value]) => ({ label: INSURANCE_LABELS[key] ?? key, value, max: result.employerTotal }))} />
        </div>
      </Panel>
      <Panel title="근로자 월 공제">
        <strong className="block text-2xl font-bold tabular-nums text-[#0F172A]">{won(result.workerTotal)}원</strong>
        <p className="mt-2 text-sm text-[#475569]">
          실수령액 추정 <strong className="tabular-nums text-[#0F172A]">{won(Math.max(0, salary * people - result.workerTotal))}원</strong>
        </p>
      </Panel>
    </div>
  );
}

function LaborCostCalculator({ salary, people, accidentRate }: { salary: number; people: number; accidentRate: number }) {
  const [includeSeverance, setIncludeSeverance] = useState(true);
  const result = calculateTotalLaborCost({ monthlySalary: salary, people, accidentRate, includeSeverance });

  return (
    <div className="space-y-5">
      <Panel
        title="월 총부담액"
        action={
          <ChoiceChip selected={includeSeverance} onClick={() => setIncludeSeverance((value) => !value)}>
            퇴직급여 적립 {includeSeverance ? "포함" : "제외"}
          </ChoiceChip>
        }
      >
        <strong className="block text-3xl font-bold tabular-nums text-[#0F172A]">{won(result.monthlyTotal)}원</strong>
        <p className="mt-2 text-sm text-[#475569]">
          급여 1원당 실제 지출 <strong className="tabular-nums text-[#0F172A]">{result.burdenRatio.toFixed(3)}원</strong>
        </p>
        <div className="mt-5">
          <Bars
            items={[
              { label: "급여", value: result.grossSalary, max: result.monthlyTotal },
              { label: "사업주 4대보험", value: result.employerInsurance, max: result.monthlyTotal },
              ...(includeSeverance ? [{ label: "퇴직급여 적립", value: result.severanceReserve, max: result.monthlyTotal }] : []),
            ]}
          />
        </div>
      </Panel>
      <Panel title="연 환산">
        <strong className="block text-2xl font-bold tabular-nums text-[#0F172A]">{won(result.yearlyTotal)}원</strong>
        <p className="mt-2 text-sm leading-6 text-[#475569]">
          퇴직급여는 1년 이상 근속 시 30일분 이상을 지급해야 하므로 월 급여의 1/12을 적립분으로 잡았습니다(근로자퇴직급여보장법 제8조).
        </p>
      </Panel>
    </div>
  );
}

function TaxCompareCalculator() {
  const [annualProfit, setAnnualProfit] = useState(120_000_000);
  const [ownerSalary, setOwnerSalary] = useState(60_000_000);
  const result = compareBusinessTax({ annualProfit, ownerSalary });
  const cheaperLabel = result.cheaper === "equal" ? "동일" : result.cheaper === "sole" ? "개인사업자" : "법인";

  return (
    <div className="space-y-5">
      <Panel title="입력">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="연 이익 (매출 − 필요경비)" value={annualProfit} onChange={setAnnualProfit} step={10_000_000} />
          <NumberField
            label="법인일 때 대표 연 급여"
            value={ownerSalary}
            onChange={setOwnerSalary}
            step={10_000_000}
            hint="법인 비용으로 빠지고 대표 근로소득이 됩니다"
          />
        </div>
      </Panel>

      <Panel title="비교 결과" action={<StatusBadge tone={result.cheaper === "equal" ? "slate" : "green"}>{cheaperLabel}이(가) 유리</StatusBadge>}>
        <p className="text-sm text-[#475569]">
          세부담 차이 <strong className="tabular-nums text-[#0F172A]">{won(result.difference)}원</strong>
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className={cn("rounded-xl border p-4", result.cheaper === "sole" ? "border-[#16A34A] bg-[#F0FDF4]" : "border-[#E2E8F0]")}>
            <strong className="block text-sm font-bold text-[#475569]">개인사업자</strong>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-[#0F172A]">{won(result.sole.total)}원</span>
            <dl className="mt-3 space-y-1 text-xs text-[#475569]">
              <div className="flex justify-between"><dt>종합소득세</dt><dd className="tabular-nums">{won(result.sole.incomeTax)}원</dd></div>
              <div className="flex justify-between"><dt>지방소득세</dt><dd className="tabular-nums">{won(result.sole.localTax)}원</dd></div>
            </dl>
          </div>
          <div className={cn("rounded-xl border p-4", result.cheaper === "corporate" ? "border-[#16A34A] bg-[#F0FDF4]" : "border-[#E2E8F0]")}>
            <strong className="block text-sm font-bold text-[#475569]">법인</strong>
            <span className="mt-1 block text-2xl font-bold tabular-nums text-[#0F172A]">{won(result.corporate.total)}원</span>
            <dl className="mt-3 space-y-1 text-xs text-[#475569]">
              <div className="flex justify-between"><dt>법인세</dt><dd className="tabular-nums">{won(result.corporate.corporateTax)}원</dd></div>
              <div className="flex justify-between"><dt>법인 지방소득세</dt><dd className="tabular-nums">{won(result.corporate.corporateLocalTax)}원</dd></div>
              <div className="flex justify-between"><dt>대표 근로소득세</dt><dd className="tabular-nums">{won(result.corporate.salaryIncomeTax)}원</dd></div>
              <div className="flex justify-between"><dt>대표 지방소득세</dt><dd className="tabular-nums">{won(result.corporate.salaryLocalTax)}원</dd></div>
            </dl>
          </div>
        </div>
        <p className="mt-4 rounded-xl bg-[#FEF2F2] p-3 text-[13px] font-semibold leading-6 text-[#DC2626]">
          각종 공제·감면과 성실신고 요건을 반영하지 않은 참고용 추정입니다. 배당·4대보험까지 포함한 실제 유불리는 세무 전문가 확인이 필요합니다.
        </p>
      </Panel>
    </div>
  );
}

function EmailCaptureCard({ source }: { source: string }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      await captureLead(email, source);
      setDone(true);
      setOpen(false);
    } catch (reason) {
      setError(toMessage(reason, "저장하지 못했습니다."));
    } finally {
      setSaving(false);
    }
  };

  if (done) {
    return (
      <Notice tone="success" onDismiss={() => setDone(false)}>
        받는 주소를 등록했습니다. 새 계산기와 자료실 업데이트를 보내드립니다.
      </Notice>
    );
  }

  return (
    <>
      <Button variant="secondary" icon={<Mail size={14} />} onClick={() => setOpen(true)}>
        업데이트 소식 받기
      </Button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[rgba(15,23,42,0.45)] p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-bold text-[#0F172A]">업데이트 소식 받기</h2>
            {/* 발송 수단이 붙기 전까지 "결과를 보내드립니다"라고 쓰지 않습니다. 지키지 못할 약속입니다. */}
            <p className="mt-2 text-sm leading-6 text-[#475569]">
              계산 결과는 이 화면에서 바로 확인하실 수 있습니다. 주소를 남기시면 새 계산기와 자료실이 추가될 때 알려드립니다.
            </p>
            <div className="mt-4">
              <Field label="이메일">
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className={inputClass} />
              </Field>
            </div>
            {error && <div className="mt-3"><Notice tone="error">{error}</Notice></div>}
            <p className="mt-3 text-xs leading-5 text-[#94A3B8]">
              수신 동의 후 저장되며, 언제든 수신 거부할 수 있습니다.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setOpen(false)}>취소</Button>
              <Button loading={saving} disabled={!email.trim()} onClick={() => void submit()}>등록</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * 계산기 3종. 로그인 없이 동작합니다.
 *
 * 검색으로 들어온 방문자가 첫 화면에서 값을 얻는 것이 이 페이지의 목적이라
 * 세션 게이트를 두지 않습니다. 저장되는 것은 이메일을 직접 남긴 경우뿐입니다.
 */
export function CalculatorSuite() {
  const [tab, setTab] = useState<TabId>("insurance");
  const [salary, setSalary] = useState(3_000_000);
  const [people, setPeople] = useState(1);
  const [accidentRate, setAccidentRate] = useState(DEFAULT_ACCIDENT_RATE);
  const needsPayroll = tab !== "tax";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {TABS.map((item) => (
          <ChoiceChip key={item.id} selected={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </ChoiceChip>
        ))}
      </div>
      <p className="text-sm text-[#475569]">{TABS.find((item) => item.id === tab)?.hint}</p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {needsPayroll ? (
          <Panel title="입력">
            <div className="grid gap-4 sm:grid-cols-2">
              <NumberField label="월 급여 (1인)" value={salary} onChange={setSalary} />
              <NumberField label="인원" value={people} onChange={(value) => setPeople(Math.max(1, value))} step={1} />
            </div>
            <div className="mt-4">
              <Field label="산재보험료율 (%)" hint="업종별로 다릅니다. 근로복지공단 고시 요율을 확인하세요.">
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={Number((accidentRate * 100).toFixed(2))}
                  onChange={(event) => setAccidentRate(Math.max(0, Number(event.target.value)) / 100)}
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="mt-3 text-sm text-[#475569]">
              과세 대상 급여 총액 <strong className="tabular-nums text-[#0F172A]">{won(salary * people)}원</strong>
            </p>
            <p className="mt-4 rounded-xl bg-[#FEF2F2] p-3 text-[13px] font-semibold leading-6 text-[#DC2626]">
              참고용 추정입니다. 실제 신고 전 세무 전문가 확인이 필요합니다.
            </p>
            <div className="mt-4"><EmailCaptureCard source={`calc_${tab}`} /></div>
          </Panel>
        ) : (
          <div />
        )}

        <div className={cn(!needsPayroll && "lg:col-span-2")}>
          {tab === "insurance" && <InsuranceCalculator salary={salary} people={people} accidentRate={accidentRate} />}
          {tab === "labor" && <LaborCostCalculator salary={salary} people={people} accidentRate={accidentRate} />}
          {tab === "tax" && (
            <div className="space-y-5">
              <TaxCompareCalculator />
              <EmailCaptureCard source="calc_tax" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
