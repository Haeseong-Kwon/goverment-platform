"use client";

import { useMemo, useState } from "react";
import { ClipboardCopy, FileSpreadsheet } from "lucide-react";
import { validateExpense } from "./engine";
import { parsePlanRows, type PlanRow } from "./planImport";
import { composeRejectionNotice, getReasonCodeOptions } from "./rejection";
import { CATEGORIES } from "./ruleset";
import type { ExpenseVerdict, ReasonCode } from "./types";
import { Button, ChoiceChip, Field, Panel, StatusBadge, inputClass, textareaClass, type StatusTone } from "../startup-workspace/ui";
import { cn } from "@/lib/utils";

const verdictTone: Record<ExpenseVerdict["verdict"], StatusTone> = { pass: "green", review: "amber", fail: "red" };
const verdictLabel: Record<ExpenseVerdict["verdict"], string> = { pass: "적합", review: "확인 필요", fail: "조정 요청" };

const SAMPLE = [
  "인벤티\t외주용역비\t시제품 목업 제작\t25000000\t2026-06-01\t2026-07-15",
  "그린루프\t재료비\t사무용 멀티탭·키보드\t320000\t2026-05-02\t2026-05-10",
  "로지스원\t기계장치비\t개발용 서버\t12000000\t2026-11-20\t2026-12-20",
].join("\n");

type ReviewedRow = PlanRow & { verdict?: ExpenseVerdict };

/** 협약 초기 선정팀 사업비 집행 계획 일괄 검토. */
export function PlanReviewBoard() {
  const [text, setText] = useState("");
  const [start, setStart] = useState(`${new Date().getFullYear()}-04-01`);
  const [end, setEnd] = useState(`${new Date().getFullYear()}-12-31`);
  const [copied, setCopied] = useState(false);

  const rows: ReviewedRow[] = useMemo(() => {
    if (!text.trim()) return [];
    return parsePlanRows(text, { start, end }).map((row) => ({ ...row, verdict: row.expense ? validateExpense(row.expense) : undefined }));
  }, [text, start, end]);

  const stats = useMemo(() => ({
    total: rows.length,
    fail: rows.filter((row) => row.verdict?.verdict === "fail").length,
    review: rows.filter((row) => row.verdict?.verdict === "review").length,
    invalid: rows.filter((row) => row.error).length,
  }), [rows]);

  const adjustmentComment = useMemo(() => {
    const problems = rows.filter((row) => row.verdict && row.verdict.verdict !== "pass");
    if (!problems.length) return "";
    return [
      "[사업비 집행 계획 조정 요청]",
      "",
      ...problems.map((row) => {
        const blocking = row.verdict!.findings.filter((finding) => finding.severity !== "info");
        const lines = blocking.length
          ? blocking.map((finding) => `   · ${finding.message} (${finding.reasonCode}) → ${finding.fix}`)
          : [`   · 증빙 보완 필요: ${row.verdict!.missingEvidence.join(", ") || "확인 필요 항목 있음"}`];
        return [`${row.team ?? "팀 미상"} / ${row.expense?.title ?? row.raw}`, ...lines].join("\n");
      }),
      "",
      "위 항목을 조정하여 재제출 부탁드립니다.",
    ].join("\n");
  }, [rows]);

  const copy = async () => {
    await navigator.clipboard.writeText(adjustmentComment);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      <Panel title="사업비 계획 일괄 검토" action={<StatusBadge tone="blue"><FileSpreadsheet size={12} className="mr-1 inline" />붙여넣기 검토</StatusBadge>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="협약 시작일"><input type="date" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} /></Field>
          <Field label="협약 종료일"><input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} /></Field>
        </div>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={`팀명, 비목, 건명, 금액, 집행일, 납품일 순으로 붙여넣으세요.\n\n${SAMPLE}`}
          className={cn(textareaClass, "mt-4 min-h-44 font-mono text-xs")}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setText(SAMPLE)}>예시 채우기</Button>
          <Button variant="ghost" size="sm" onClick={() => setText("")} disabled={!text}>비우기</Button>
        </div>
      </Panel>

      {rows.length > 0 && (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            {[["검토 건수", `${stats.total}건`], ["조정 요청", `${stats.fail}건`], ["확인 필요", `${stats.review}건`], ["형식 오류", `${stats.invalid}건`]].map(([label, value], index) => (
              <div key={label} className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-5", index === 1 && stats.fail > 0 && "border-l-4 border-l-[#DC2626]")}>
                <p className="text-sm text-[#475569]">{label}</p>
                <strong className="mt-2 block text-2xl tabular-nums">{value}</strong>
              </div>
            ))}
          </section>

          <Panel title="건별 판정">
            <div className="space-y-3">
              {rows.map((row) => (
                <article key={row.line} className="rounded-xl border border-[#E2E8F0] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="text-sm font-bold text-[#0F172A]">{row.team ?? "팀 미상"}</strong>
                    <span className="text-sm text-[#475569]">{row.expense?.title ?? row.raw}</span>
                    {row.expense && <StatusBadge tone="slate">{CATEGORIES[row.expense.category].name}</StatusBadge>}
                    {row.verdict && <StatusBadge tone={verdictTone[row.verdict.verdict]}>{verdictLabel[row.verdict.verdict]}</StatusBadge>}
                    {row.error && <StatusBadge tone="red">형식 오류</StatusBadge>}
                  </div>
                  {row.error && <p className="mt-2 text-sm font-semibold text-[#DC2626]">{row.error}</p>}
                  {row.verdict?.findings.filter((finding) => finding.severity !== "info").map((finding) => (
                    <p key={finding.code} className="mt-2 border-l-2 border-[#FECACA] pl-3 text-sm text-[#475569]">
                      <strong className="text-[#DC2626]">{finding.reasonCode}</strong> {finding.message}
                      <span className="mt-1 block text-[#2563EB]">→ {finding.fix}</span>
                    </p>
                  ))}
                  {row.verdict && row.verdict.missingEvidence.length > 0 && (
                    <p className="mt-2 text-xs font-semibold text-[#B45309]">증빙 미비: {row.verdict.missingEvidence.join(", ")}</p>
                  )}
                </article>
              ))}
            </div>
          </Panel>

          {adjustmentComment && (
            <Panel title="조정 요청 코멘트" action={
              <Button variant="secondary" size="sm" onClick={() => void copy()} icon={<ClipboardCopy size={13} />}>
                {copied ? "복사됨" : "복사"}
              </Button>
            }>
              <pre className="whitespace-pre-wrap rounded-xl bg-[#F8FAFC] p-4 text-sm leading-6 text-[#475569]">{adjustmentComment}</pre>
            </Panel>
          )}
        </>
      )}
    </div>
  );
}

/** 반려 사유 선택 → 지침 조항을 인용한 안내문 자동 작성. */
export function RejectionComposer({
  teamName,
  submissionTitle,
  verdict,
  managerName = "담당 매니저",
  institutionName = "주관기관",
  onSubmit,
}: {
  teamName: string;
  submissionTitle: string;
  verdict?: ExpenseVerdict;
  managerName?: string;
  institutionName?: string;
  onSubmit?: (decision: "approved" | "rejected", payload: { reasonCodes: ReasonCode[]; feedback: string }) => void;
}) {
  const [selected, setSelected] = useState<ReasonCode[]>([]);
  const [comment, setComment] = useState("");
  const [copied, setCopied] = useState(false);
  const options = getReasonCodeOptions(verdict);

  const notice = useMemo(
    () =>
      composeRejectionNotice({
        teamName,
        submissionTitle,
        managerName,
        institutionName,
        reasonCodes: selected,
        findings: verdict?.findings ?? [],
        extraComment: comment,
      }),
    [teamName, submissionTitle, managerName, institutionName, selected, comment, verdict],
  );

  const toggle = (code: ReasonCode) =>
    setSelected((current) => (current.includes(code) ? current.filter((item) => item !== code) : [...current, code]));

  const copy = async () => {
    await navigator.clipboard.writeText(notice.body);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Panel title="반려 안내 자동 작성">
      <p className="text-sm font-bold text-[#475569]">반려 사유코드 <span className="text-[#DC2626]">*</span></p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => (
          <ChoiceChip
            key={option.code}
            tone="red"
            selected={selected.includes(option.code)}
            onClick={() => toggle(option.code)}
            className={cn(!selected.includes(option.code) && option.detected && "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309] hover:border-[#F59E0B]")}
          >
            {option.code} {option.label}{option.detected ? " · 검증 감지" : ""}
          </ChoiceChip>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="담당자 코멘트 (선택)"
        className={cn(textareaClass, "mt-4 min-h-20")}
      />

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#0F172A]">발송 예정 안내문</p>
          <Button variant="secondary" size="sm" onClick={() => void copy()} icon={<ClipboardCopy size={12} />}>
            {copied ? "복사됨" : "복사"}
          </Button>
        </div>
        <p className="mt-2 text-xs font-semibold text-[#94A3B8]">{notice.subject}</p>
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-[#F8FAFC] p-4 text-sm leading-6 text-[#475569]">{notice.body}</pre>
      </div>

      {onSubmit && (
        <div className="mt-4 flex gap-2">
          <Button
            variant="danger"
            className="flex-1"
            disabled={selected.length === 0}
            title={selected.length === 0 ? "반려하려면 사유코드를 1개 이상 선택하세요" : undefined}
            onClick={() => onSubmit("rejected", { reasonCodes: selected, feedback: notice.body })}
          >
            반려하고 안내문 발송
          </Button>
          <Button className="flex-1" onClick={() => onSubmit("approved", { reasonCodes: [], feedback: comment })}>
            승인
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs font-medium text-[#94A3B8]">모든 판정은 지침 조항 원문을 근거로 기록되며, 승인·반려의 최종 결정은 매니저에게 있습니다.</p>
    </Panel>
  );
}
