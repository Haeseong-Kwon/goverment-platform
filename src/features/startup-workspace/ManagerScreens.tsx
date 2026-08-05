"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, FileText, Inbox } from "lucide-react";
import {
  bootstrapManagerAccess,
  claimSubmissionForReview,
  getManagerReviewSubmissions,
  getRejectionReasonCodes,
  issueConversionCode,
  submitReviewDecision,
  type ManagerBootstrapResult,
  type ManagerReviewSubmission,
  type SubmissionEvidenceFile,
} from "@/lib/services/WorkspaceService";
import { getConversionCodes, getInstitutionName, getVaultDownloadUrl, type ConversionCode } from "@/lib/services/FounderWorkspaceService";
import { RejectionComposer } from "@/features/expense-rules/ManagerTools";
import { PlanReviewBoard } from "@/features/expense-rules/ManagerTools";
import { summarizeRejectionReasons } from "@/features/expense-rules/rejection";
import { ITEM_FLAG_LABELS } from "@/features/expense-rules/ruleset";
import type { ExpenseInput, ReasonCode } from "@/features/expense-rules/types";
import { canManagerSeeReviewItem, getManagerDashboardSummary } from "./logic";
import { STARTUP_PROGRAMS } from "./rules";
import { RequireManagerSession, WorkspaceShell } from "./shell";
import { Button, ChoiceChip, EmptyState, LinkButton, Notice, PageHeader, Panel, ProgressBar, Skeleton, StatusBadge, focusRing, inputClass, listRow } from "./ui";
import { cn } from "@/lib/utils";
import { toMessage } from "@/lib/errors";

type Summary = ReturnType<typeof getManagerDashboardSummary>;
type ReasonDistribution = ReturnType<typeof summarizeRejectionReasons>;

const STATUS_LABEL: Record<ManagerReviewSubmission["status"], string> = {
  draft: "작성 중",
  requested: "검토 요청",
  validated: "검토 대기",
  in_review: "검토 중",
  approved: "승인",
  rejected: "반려",
};

const statusTone = (status: ManagerReviewSubmission["status"]) =>
  status === "rejected" ? "red" : status === "approved" ? "green" : "amber";

/** 검토 요청 목록을 여러 화면에서 같은 방식(로딩·오류·가시성 필터)으로 읽습니다. */
function useReviewSubmissions(enabled = true) {
  const [submissions, setSubmissions] = useState<ManagerReviewSubmission[] | null>(enabled ? null : []);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const items = await getManagerReviewSubmissions();
      setSubmissions(items.filter(canManagerSeeReviewItem));
      setError(null);
    } catch (reason) {
      setSubmissions([]);
      setError(toMessage(reason, "검토 요청을 불러오지 못했습니다."));
    }
  }, [enabled]);

  useEffect(() => { void load(); }, [load]);
  return { submissions, loading: submissions === null, error, reload: load };
}

/** 쉼표·따옴표·줄바꿈이 든 값은 감싸야 열이 밀리지 않습니다. 사유 문구는 언제든 늘어납니다. */
function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** 기관 리포트를 CSV로 내려받습니다. 상부·전담기관 보고 자료로 바로 씁니다. */
function exportManagerReport(summary: Summary, reasons: ReasonDistribution) {
  const rows = [
    ["구분", "값"],
    ["전체 검토 요청", `${summary.requestCount}건`],
    ["처리 대기", `${summary.pendingCount}건`],
    ["반려율", `${summary.rejectionRate}%`],
    ["평균 대기", `${summary.averageWaitDays}일`],
    ["3일 이상 지연", `${summary.delayedCount}건`],
    [],
    ["반려 사유코드", "사유", "건수", "비중"],
    ...reasons.map((item) => [item.code, item.label, String(item.count), `${item.share}%`]),
  ];
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `startup-pilot-report-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatTile({ label, value, hint, alert = false }: { label: string; value: string; hint?: string; alert?: boolean }) {
  return (
    <div className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-5", alert && "border-l-4 border-l-[#DC2626]")}>
      <p className="text-sm text-[#475569]">{label}</p>
      <strong className={cn("mt-2 block text-2xl font-bold tabular-nums", alert && "text-[#DC2626]")}>{value}</strong>
      {hint && <p className="mt-1 text-xs text-[#94A3B8]">{hint}</p>}
    </div>
  );
}

function StatRow({ summary, loading }: { summary: Summary; loading: boolean }) {
  if (loading) {
    return (
      <section className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-[104px]" />)}
      </section>
    );
  }
  return (
    <section className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      <StatTile label="전체 검토 요청" value={`${summary.requestCount}건`} />
      <StatTile label="처리 대기" value={`${summary.pendingCount}건`} />
      <StatTile label="평균 대기" value={`${summary.averageWaitDays}일`} hint="처리 대기 중인 건 기준" />
      <StatTile label="3일 이상 지연" value={`${summary.delayedCount}건`} alert={summary.delayedCount > 0} />
    </section>
  );
}

/** 아직 기관 계정이 아닌 경우, 실제 기관·전환 코드를 만들어 검토 큐를 돌려볼 수 있게 합니다. */
function ManagerBootstrapCard() {
  const [result, setResult] = useState<ManagerBootstrapResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await bootstrapManagerAccess());
      // 프로필 역할이 바뀌었으므로 세션 판단을 처음부터 다시 하게 합니다.
      window.location.reload();
    } catch (reason) {
      setError(toMessage(reason, "기관 계정 전환에 실패했습니다."));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <section className="mb-6 rounded-2xl border border-[#BBF7D0] bg-[#F0FDF4] p-5">
        <StatusBadge tone="green">기관 계정 활성화됨</StatusBadge>
        <h2 className="mt-3 text-xl font-bold">{result.institutionName}</h2>
        <p className="mt-2 text-sm text-[#475569]">
          창업자 계정에서 아래 코드를 <strong>합격 전환</strong>에 입력하면 이 기관의 검토 큐로 연결됩니다.
        </p>
        <p className="mt-3 inline-block rounded-lg bg-white px-4 py-2 font-mono text-lg font-bold tracking-widest text-[#16A34A]">
          {result.conversionCode}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5">
      <StatusBadge tone="amber">기관 담당자이신가요?</StatusBadge>
      <h2 className="mt-3 text-lg font-bold">기관 계정 활성화</h2>
      <p className="mt-2 text-sm leading-6 text-[#475569]">
        기관 담당자로 사전 등록된 계정만 전환됩니다. 등록되지 않은 계정은 눌러도 거절됩니다.
      </p>
      <Button className="mt-4" loading={loading} onClick={() => void run()}>기관 계정 활성화</Button>
      {error && <div className="mt-3"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}
    </section>
  );
}

export function ManagerDashboard() {
  return (
    <RequireManagerSession deniedFallback={<ManagerBootstrapCard />}>
      <ManagerDashboardBody />
    </RequireManagerSession>
  );
}

function ManagerDashboardBody() {
  const { submissions, loading, error } = useReviewSubmissions();
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);

  useEffect(() => {
    let mounted = true;
    getRejectionReasonCodes().then((codes) => { if (mounted) setReasonCodes(codes as ReasonCode[]); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const rows = submissions ?? [];
  const summary = getManagerDashboardSummary(rows);
  // 대시보드에서 곧바로 다음에 처리할 건이 보여야 합니다. 이미 받아 온 목록을 다시 쓰므로 추가 조회가 없습니다.
  const waiting = rows
    .filter((row) => !isDecided(row.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(0, 5);

  return (
    <WorkspaceShell role="manager">
      <PageHeader
        badge="주관기관 매니저"
        title="통합 관리 대시보드"
        description="사전검증을 통과해 검토 요청된 건만 표시됩니다."
        action={
          <Button
            icon={<Download size={15} />}
            disabled={loading || summary.requestCount === 0}
            onClick={() => exportManagerReport(summary, summarizeRejectionReasons(reasonCodes))}
          >
            리포트 내보내기
          </Button>
        }
      />

      <StatRow summary={summary} loading={loading} />

      {error && <div className="mt-6"><Notice tone="error">{error}</Notice></div>}
      {!loading && !error && rows.length === 0 && (
        <div className="mt-6">
          <EmptyState
            title="검토 요청이 아직 없습니다"
            description="선정 팀이 정산 사전검증을 통과해 검토를 요청하면 이곳에 쌓입니다. 요청 전에는 준비 데이터가 노출되지 않습니다."
          />
        </div>
      )}

      {waiting.length > 0 && (
        <section className="mt-6">
          <Panel
            title="가장 오래 기다린 요청"
            action={<LinkButton href="/manager/review" variant="ghost" size="sm" className="text-[#2563EB]">검토 큐 열기</LinkButton>}
          >
            <div className="space-y-2">
              {waiting.map((row) => {
                const days = waitingDays(row.createdAt);
                return (
                  <Link
                    key={row.id}
                    href="/manager/review"
                    className={cn("flex items-center gap-3 rounded-xl border border-[#E2E8F0] p-3", focusRing, "transition-colors hover:border-[#2563EB] hover:bg-[#F8FAFC]")}
                  >
                    <div className="min-w-0 flex-1">
                      <strong className="block truncate text-sm font-bold text-[#0F172A]">{row.team} · {row.title}</strong>
                      <span className="text-xs text-[#94A3B8]">{row.amount} · 증빙 파일 {row.evidenceCount}건</span>
                    </div>
                    <StatusBadge tone={days >= 3 ? "red" : "slate"}>대기 {days}일</StatusBadge>
                  </Link>
                );
              })}
            </div>
          </Panel>
        </section>
      )}

      <section className="animate-in-stagger mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/manager/review", title: "검토 큐", desc: `검증 통과 요청 ${summary.requestCount}건을 확인합니다.` },
          { href: "/manager/plan-review", title: "사업비 계획 검토", desc: "집행 계획을 붙여 넣어 비목·한도를 일괄 판정합니다." },
          { href: "/manager/teams", title: "팀 관리", desc: "제출 이력이 있는 선정 팀만 봅니다." },
          { href: "/manager/reports", title: "리포트", desc: "실제 검토 요청 기준으로 집계합니다." },
        ].map((item) => (
          <Link key={item.href} href={item.href} className={cn("group rounded-2xl border border-[#E2E8F0] bg-white p-5", focusRing, "transition-[transform,border-color,box-shadow] duration-150 hover:-translate-y-0.5 hover:border-[#2563EB] hover:shadow-[0_8px_24px_rgba(15,23,42,0.08)]")}>
            <h2 className="flex items-center gap-1.5 text-xl font-bold">
              {item.title}
              <ChevronRight size={18} className="text-[#94A3B8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#2563EB]" />
            </h2>
            <p className="mt-2 text-sm text-[#475569]">{item.desc}</p>
          </Link>
        ))}
      </section>
    </WorkspaceShell>
  );
}

const VENDOR_LABEL: Record<string, string> = {
  business: "사업자등록 업체",
  individual: "개인(프리랜서)",
  platform: "중계 플랫폼",
  unknown: "확인 안 됨",
};

const yesNo = (value: boolean | null | undefined) => (value === true ? "예" : value === false ? "아니오" : "확인 안 됨");

/**
 * 매니저가 승인·반려를 누르기 전에 무엇을 판단하는지 볼 수 있어야 합니다.
 * 창업자가 제출 시 저장한 집행 내역을 그대로 펼쳐 보여 줍니다.
 */
function ExpenseDetail({ expense, amount, files }: { expense: ExpenseInput; amount: string; files: SubmissionEvidenceFile[] }) {
  const rows: Array<[string, string]> = [
    ["집행 금액", amount],
    ["집행일", expense.executionDate || "미입력"],
    ["납품·완료일", expense.deliveryDate || "미입력"],
    ["협약 기간", `${expense.agreementStart} ~ ${expense.agreementEnd}`],
    ["거래처 유형", VENDOR_LABEL[expense.vendor?.type ?? "unknown"]],
    ["과업·업종 연관성", yesNo(expense.vendor?.industryRelated)],
    ["주관기관 사전승인", yesNo(expense.hasPriorApproval)],
  ];
  if (expense.advancePayment) rows.splice(1, 0, ["선급금", `${new Intl.NumberFormat("ko-KR").format(expense.advancePayment)}원`]);

  const flags = expense.itemFlags ?? [];
  const evidence = expense.evidence ?? [];

  return (
    <div className="rounded-xl border border-[#E2E8F0]">
      <dl className="divide-y divide-[#F1F5F9]">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm">
            <dt className="shrink-0 text-[#475569]">{label}</dt>
            <dd className="min-w-0 truncate text-right font-semibold tabular-nums text-[#0F172A]">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="border-t border-[#F1F5F9] px-4 py-3">
        <p className="text-xs font-bold text-[#475569]">팀이 신고한 증빙 유형 {evidence.length}종</p>
        {evidence.length === 0 ? (
          <p className="mt-1.5 text-sm text-[#94A3B8]">신고된 증빙 유형이 없습니다.</p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {evidence.map((name) => <li key={name}><StatusBadge tone="slate">{name}</StatusBadge></li>)}
          </ul>
        )}
      </div>

      <EvidenceFileList files={files} />

      {flags.length > 0 && (
        <div className="border-t border-[#F1F5F9] px-4 py-3">
          <p className="text-xs font-bold text-[#475569]">신고된 항목 특성</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {flags.map((flag) => <li key={flag}><StatusBadge tone="amber">{ITEM_FLAG_LABELS[flag]}</StatusBadge></li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * 첨부된 증빙 파일. 링크는 누를 때마다 새로 만들고 기본 5분 뒤 무효화되므로
 * 화면에 URL을 담아 두지 않습니다.
 */
function EvidenceFileList({ files }: { files: SubmissionEvidenceFile[] }) {
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const open = async (file: SubmissionEvidenceFile) => {
    setOpeningId(file.documentId);
    setError(null);
    try {
      const url = await getVaultDownloadUrl(file.storagePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (reason) {
      setError(toMessage(reason, "증빙 링크를 만들지 못했습니다."));
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="border-t border-[#F1F5F9] px-4 py-3">
      <p className="text-xs font-bold text-[#475569]">첨부 증빙 파일 {files.length}건</p>
      {files.length === 0 ? (
        <p className="mt-1.5 text-sm leading-6 text-[#B45309]">
          첨부된 파일이 없습니다. 유형만 신고된 상태이므로, 원본 확인이 필요하면 팀에 증빙 첨부를 요청하세요.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {files.map((file) => (
            <div key={file.documentId} className="flex items-center gap-2 rounded-lg border border-[#E2E8F0] p-2.5">
              <FileText size={15} className="shrink-0 text-[#475569]" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#0F172A]">{file.fileName}</span>
              <StatusBadge tone="slate">v{file.version}</StatusBadge>
              <Button
                variant="secondary"
                size="sm"
                loading={openingId === file.documentId}
                onClick={() => void open(file)}
                icon={<Download size={12} />}
              >
                열기
              </Button>
            </div>
          ))}
          <p className="text-[11px] font-medium text-[#94A3B8]">열람 링크는 5분 후 만료됩니다.</p>
        </div>
      )}
      {error && <div className="mt-2"><Notice tone="error" onDismiss={() => setError(null)}>{error}</Notice></div>}
    </div>
  );
}

function ReviewPanel({ submission }: { submission?: ManagerReviewSubmission }) {
  const verdict = submission?.verdict;
  const blocking = (verdict?.findings ?? []).filter((finding) => finding.severity !== "info");

  return (
    <Panel
      title={submission ? `${submission.team} · ${submission.title}` : "선택된 요청 없음"}
      action={submission && <StatusBadge tone="green">사전검증 통과</StatusBadge>}
    >
      {!submission ? (
        <div className="rounded-xl bg-[#F8FAFC] p-5 text-center text-sm text-[#94A3B8]">
          <FileText className="mx-auto mb-2" />
          검토 큐에서 요청을 선택하세요
        </div>
      ) : submission.expense ? (
        <ExpenseDetail expense={submission.expense} amount={submission.amount} files={submission.files ?? []} />
      ) : (
        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm font-semibold leading-6 text-[#B45309]">
          이 건은 집행 내역 원본이 저장되기 전에 제출되어 상세를 표시할 수 없습니다. 판정 근거만 확인한 뒤 필요하면 팀에 재제출을 요청하세요.
        </div>
      )}
      {verdict && (
        <div className="mt-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="slate">{verdict.categoryName}</StatusBadge>
            <StatusBadge tone={blocking.length ? "red" : "green"}>AI 사전검증 지적 {blocking.length}건</StatusBadge>
            {verdict.missingEvidence.length > 0 && <StatusBadge tone="amber">증빙 미비 {verdict.missingEvidence.length}건</StatusBadge>}
          </div>
          <ul className="mt-3 space-y-2">
            {blocking.map((finding) => (
              <li key={finding.code} className="rounded-lg border border-[#E2E8F0] p-3 text-sm">
                <strong className="text-[#DC2626]">{finding.reasonCode}</strong>{" "}
                <span className="font-semibold text-[#0F172A]">{finding.message}</span>
                <span className="mt-1 block text-[#475569]">근거 · {finding.clause}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const QUEUE_FILTERS = [
  { key: "pending", label: "처리 대기" },
  { key: "decided", label: "처리 완료" },
  { key: "all", label: "전체" },
] as const;

const isDecided = (status: ManagerReviewSubmission["status"]) => status === "approved" || status === "rejected";

/** 제출 후 경과 일수. 오래 기다린 건을 먼저 처리하도록 큐에서 바로 보여 줍니다. */
function waitingDays(createdAt: string) {
  return Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 86_400_000));
}

export function ManagerReviewQueuePage() {
  return (
    <RequireManagerSession deniedFallback={<ManagerBootstrapCard />}>
      <ManagerReviewQueueBody />
    </RequireManagerSession>
  );
}

function ManagerReviewQueueBody() {
  const { submissions, loading, error, reload } = useReviewSubmissions();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // 성공과 실패를 같은 상태에 담되 색을 나눕니다. 하나로 합쳐 두면 실패가 초록 성공 박스로 뜹니다.
  const [message, setMessage] = useState<{ text: string; tone: "success" | "error" } | null>(null);
  const [filter, setFilter] = useState<(typeof QUEUE_FILTERS)[number]["key"]>("pending");
  const [institution, setInstitution] = useState<string | null>(null);
  const all = submissions ?? [];
  const rows = all.filter((row) => (filter === "all" ? true : filter === "decided" ? isDecided(row.status) : !isDecided(row.status)));

  // 목록이 새로 도착하거나 필터가 바뀌면 선택을 유지하되, 사라진 건이면 첫 항목으로 옮깁니다.
  useEffect(() => {
    setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, filter]);

  useEffect(() => {
    let mounted = true;
    getInstitutionName().then((name) => { if (mounted) setInstitution(name); }).catch(() => undefined);
    return () => { mounted = false; };
  }, []);

  const selected = rows.find((item) => item.id === selectedId);
  const selectedDecided = selected ? isDecided(selected.status) : false;

  const decide = async (decision: "approved" | "rejected", payload: { reasonCodes: ReasonCode[]; feedback: string }) => {
    if (!selected) return;
    try {
      await submitReviewDecision(selected.id, decision, payload);
      setMessage({ text: decision === "approved" ? "승인 처리했습니다." : "반려 처리하고 안내문을 기록했습니다.", tone: "success" });
      await reload();
    } catch (reason) {
      setMessage({ text: toMessage(reason, "처리에 실패했습니다."), tone: "error" });
    }
  };

  // 큐에서 건을 열면 '검토 중'으로 표시해 다른 매니저가 중복으로 붙지 않게 합니다.
  // 실패해도 판정 자체에는 지장이 없으므로 조용히 넘어갑니다.
  useEffect(() => {
    if (!selected || selected.status !== "validated") return;
    void claimSubmissionForReview(selected.id).then(reload).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  return (
    <WorkspaceShell role="manager">
      <PageHeader
        badge="주관기관 매니저"
        title="검토 큐"
        description="사전검증을 통과한 검토 요청 건만 표시합니다. 오류가 이미 표시된 상태에서 판단만 하세요."
      />

      {error && <div className="mb-6"><Notice tone="error">{error}</Notice></div>}
      {message && <div className="mb-6"><Notice tone={message.tone} onDismiss={() => setMessage(null)}>{message.text}</Notice></div>}

      <div className="mb-4 flex flex-wrap gap-2">
        {QUEUE_FILTERS.map((option) => {
          const count = option.key === "all" ? all.length : all.filter((row) => (option.key === "decided" ? isDecided(row.status) : !isDecided(row.status))).length;
          return (
            <ChoiceChip key={option.key} selected={filter === option.key} onClick={() => setFilter(option.key)}>
              {option.label} {count}
            </ChoiceChip>
          );
        })}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : rows.length === 0 ? (
        <EmptyState
          title={filter === "pending" ? "처리할 검토 요청이 없습니다" : "표시할 건이 없습니다"}
          description={filter === "pending" ? "새 요청이 도착하면 이 목록에 표시됩니다. 이미 처리한 건은 '처리 완료'에서 볼 수 있습니다." : "다른 필터를 선택해 보세요."}
        />
      ) : (
        <section className="grid gap-6 xl:grid-cols-[1fr_460px]">
          <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
            <div className="grid grid-cols-[1.3fr_1.2fr_.9fr_.6fr_.6fr] border-b border-[#E2E8F0] px-5 py-3 text-xs font-bold text-[#475569]">
              <span>팀</span><span>건명</span><span>상태</span><span className="text-right">증빙 파일</span><span className="text-right">대기</span>
            </div>
            {rows.map((row) => {
              const waiting = waitingDays(row.createdAt);
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  aria-pressed={row.id === selectedId}
                  className={cn(
                    "grid min-h-14 w-full grid-cols-[1.3fr_1.2fr_.9fr_.6fr_.6fr] items-center gap-2 border-b border-[#F1F5F9] px-5 py-3 text-left text-sm transition-colors",
                    row.id === selectedId ? "bg-[#EFF6FF]" : "hover:bg-[#F8FAFC]",
                  )}
                >
                  <strong className="truncate">{row.team}</strong>
                  <span className="truncate text-[#475569]">{row.title}</span>
                  <span><StatusBadge tone={statusTone(row.status)}>{STATUS_LABEL[row.status]}</StatusBadge></span>
                  <span className={cn("text-right tabular-nums", row.evidenceCount === 0 ? "text-[#B45309]" : "text-[#475569]")}>{row.evidenceCount}건</span>
                  <span className={cn("text-right text-xs font-bold tabular-nums", !isDecided(row.status) && waiting >= 3 ? "text-[#DC2626]" : "text-[#94A3B8]")}>
                    {waiting}일
                  </span>
                </button>
              );
            })}
          </div>
          <div className="space-y-5">
            <ReviewPanel submission={selected} />
            {selectedDecided ? (
              <Panel title="처리 완료된 건">
                <p className="text-sm leading-6 text-[#475569]">
                  이미 <strong>{selected ? STATUS_LABEL[selected.status] : ""}</strong> 처리한 건이라 다시 판정할 수 없습니다. 재심이 필요하면 팀에 재제출을 요청하세요.
                </p>
              </Panel>
            ) : (
              <RejectionComposer
                teamName={selected?.team ?? "선정 팀"}
                submissionTitle={selected?.title ?? "정산 건"}
                verdict={selected?.verdict}
                institutionName={institution ?? "주관기관"}
                onSubmit={selected ? (decision, payload) => void decide(decision, payload) : undefined}
              />
            )}
          </div>
        </section>
      )}
    </WorkspaceShell>
  );
}

type ManagerFeature = "teams" | "reports" | "settings" | "plan-review";

const FEATURE_META: Record<ManagerFeature, { title: string; description: string }> = {
  teams: { title: "팀 관리", description: "검토를 요청한 이력이 있는 선정 팀만 표시합니다." },
  reports: { title: "기관 리포트", description: "실제 검토 요청과 반려 기록으로 집계합니다." },
  settings: { title: "설정", description: "기관 정보와 합격 전환 코드를 관리합니다." },
  "plan-review": { title: "사업비 계획 검토", description: "선정 팀의 집행 계획을 붙여 넣어 일괄 판정합니다." },
};

export function ManagerFeaturePage({ feature }: { feature: ManagerFeature }) {
  return (
    <RequireManagerSession deniedFallback={<ManagerBootstrapCard />}>
      <ManagerFeatureBody feature={feature} />
    </RequireManagerSession>
  );
}

/** 제출 건 목록을 팀 단위로 접습니다. 접지 않으면 한 팀이 5건 내면 팀 관리에 5행이 뜹니다. */
function groupByTeam(rows: ManagerReviewSubmission[]) {
  const byTeam = rows.reduce<Record<string, ManagerReviewSubmission[]>>(
    (acc, row) => ({ ...acc, [row.team]: [...(acc[row.team] ?? []), row] }),
    {},
  );
  return Object.entries(byTeam)
    .map(([team, items]) => {
      const sorted = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      return {
        team,
        latest: sorted[0],
        total: items.length,
        pending: items.filter((item) => !isDecided(item.status)).length,
        approved: items.filter((item) => item.status === "approved").length,
        rejected: items.filter((item) => item.status === "rejected").length,
      };
    })
    .sort((a, b) => b.pending - a.pending || b.latest.createdAt.localeCompare(a.latest.createdAt));
}

function ManagerFeatureBody({ feature }: { feature: ManagerFeature }) {
  const needsSubmissions = feature === "teams" || feature === "reports";
  const { submissions, loading, error } = useReviewSubmissions(needsSubmissions);
  const [reasonCodes, setReasonCodes] = useState<ReasonCode[]>([]);

  useEffect(() => {
    if (feature !== "reports") return;
    let mounted = true;
    getRejectionReasonCodes().then((codes) => { if (mounted) setReasonCodes(codes as ReasonCode[]); }).catch(() => undefined);
    return () => { mounted = false; };
  }, [feature]);

  const rows = submissions ?? [];
  const summary = getManagerDashboardSummary(rows);
  const reasonDistribution = summarizeRejectionReasons(reasonCodes);
  const meta = FEATURE_META[feature];

  return (
    <WorkspaceShell role="manager">
      <PageHeader badge="주관기관 매니저" title={meta.title} description={meta.description} />
      {error && <p className="mb-6 rounded-xl border border-[#FECACA] bg-[#FEF2F2] p-4 text-sm font-semibold text-[#DC2626]">{error}</p>}

      {feature === "teams" && (
        loading ? <Skeleton className="h-48" /> : rows.length === 0 ? (
          <EmptyState title="표시할 선정 팀이 없습니다" description="팀이 검토를 요청하면 제출 이력과 함께 나타납니다." />
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white">
            <div className="grid grid-cols-[1.2fr_1.2fr_.6fr_.8fr] border-b border-[#E2E8F0] px-5 py-3 text-xs font-bold text-[#475569]">
              <span>팀</span><span>최근 제출</span><span className="text-right">제출</span><span className="text-right">최근 상태</span>
            </div>
            {groupByTeam(rows).map((group) => (
              <div key={group.team} className={cn("grid min-h-14 grid-cols-[1.2fr_1.2fr_.6fr_.8fr] items-center gap-2 border-b border-[#F1F5F9] px-5 py-3 text-sm", listRow)}>
                <div className="min-w-0">
                  <strong className="block truncate">{group.team}</strong>
                  <span className="text-xs text-[#94A3B8]">
                    {group.pending > 0 ? `대기 ${group.pending}건 · ` : ""}승인 {group.approved} · 반려 {group.rejected}
                  </span>
                </div>
                <div className="min-w-0">
                  <span className="block truncate">{group.latest.title}</span>
                  <span className="text-xs text-[#94A3B8]">{group.latest.createdAt.slice(0, 10)}</span>
                </div>
                <span className="text-right tabular-nums text-[#475569]">{group.total}건</span>
                <span className="text-right"><StatusBadge tone={statusTone(group.latest.status)}>{STATUS_LABEL[group.latest.status]}</StatusBadge></span>
              </div>
            ))}
          </section>
        )
      )}

      {feature === "plan-review" && <PlanReviewBoard />}

      {feature === "reports" && (
        <section className="space-y-6">
          <StatRow summary={summary} loading={loading} />
          <Panel
            title={`반려 사유 분포 · 반려율 ${summary.rejectionRate}%`}
            action={
              <Button
                variant="secondary"
                size="sm"
                icon={<Download size={13} />}
                disabled={summary.requestCount === 0 && reasonDistribution.length === 0}
                onClick={() => exportManagerReport(summary, reasonDistribution)}
              >
                CSV 내보내기
              </Button>
            }
          >
            {reasonDistribution.length === 0 ? (
              <EmptyState title="아직 반려 기록이 없습니다" description="반려 처리한 건의 사유코드가 이곳에 비중과 함께 누적됩니다." />
            ) : (
              <div className="space-y-3">
                {reasonDistribution.map((item) => (
                  <div key={item.code}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate font-semibold text-[#0F172A]">{item.code} {item.label}</span>
                      <span className="shrink-0 tabular-nums text-[#475569]">{item.count}건 · {item.share}%</span>
                    </div>
                    <ProgressBar value={item.share} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </section>
      )}

      {feature === "settings" && <ManagerSettingsPanel />}
    </WorkspaceShell>
  );
}

function ManagerSettingsPanel() {
  const [institution, setInstitution] = useState<string | null>(null);
  const [codes, setCodes] = useState<Array<ConversionCode & { expired: boolean }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [programId, setProgramId] = useState<string>(STARTUP_PROGRAMS[0].id);

  const loadCodes = useCallback(() => {
    getConversionCodes()
      .then((rows) => {
        const now = Date.now();
        setCodes(rows.map((row) => ({ ...row, expired: new Date(row.expiresAt).getTime() <= now })));
      })
      .catch((reason) => { setCodes([]); setError(toMessage(reason, "전환 코드를 불러오지 못했습니다.")); });
  }, []);

  const issue = async () => {
    setIssuing(true);
    setError(null);
    try {
      await issueConversionCode(programId);
      loadCodes();
    } catch (reason) {
      setError(toMessage(reason, "전환 코드를 발급하지 못했습니다."));
    } finally {
      setIssuing(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    getInstitutionName().then((name) => { if (mounted) setInstitution(name); }).catch(() => undefined);
    loadCodes();
    return () => { mounted = false; };
  }, [loadCodes]);

  return (
    <div className="space-y-5">
      <Panel title="기관 정보">
        <p className="text-sm text-[#475569]">소속 기관</p>
        <strong className="mt-1 block text-lg text-[#0F172A]">{institution ?? "연결된 기관이 없습니다"}</strong>
      </Panel>

      <Panel
        title="합격 전환 코드"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select value={programId} onChange={(event) => setProgramId(event.target.value)} className={cn(inputClass, "h-9 w-auto py-0 text-sm")}>
              {STARTUP_PROGRAMS.map((program) => <option key={program.id} value={program.id}>{program.name}</option>)}
            </select>
            <Button size="sm" loading={issuing} onClick={() => void issue()}>새 코드 발급</Button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-[#475569]">
          선정 팀이 이 코드를 입력하면 기관 워크스페이스로 연결됩니다. 코드는 발급일로부터 90일간 유효합니다.
        </p>
        {error && <p className="mb-3 rounded-xl bg-[#FEF2F2] p-3 text-sm font-semibold text-[#DC2626]">{error}</p>}
        {codes === null && <Skeleton className="h-16" />}
        {codes?.length === 0 && !error && (
          <EmptyState title="발급된 코드가 없습니다" description="위에서 지원사업을 고르고 [새 코드 발급]을 누르면 만들어집니다." />
        )}
        <div className="space-y-2">
          {(codes ?? []).map((item) => (
            <div key={item.code} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#E2E8F0] p-3">
              <span className="font-mono text-lg font-bold tracking-widest text-[#2563EB]">{item.code}</span>
              <StatusBadge tone={item.expired ? "red" : "green"}>{item.expired ? "만료" : "사용 가능"}</StatusBadge>
              <span className="text-xs text-[#94A3B8]">{item.programId ?? "사업 미지정"} · {item.expiresAt.slice(0, 10)}까지</span>
              <span className="ml-auto text-sm tabular-nums text-[#475569]">{item.useCount}/{item.maxUses}팀</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="권한 규칙" action={<Inbox size={16} className="text-[#94A3B8]" />}>
        <p className="text-sm leading-6 text-[#475569]">
          창업자의 준비 데이터(연습 진단·초안·할 일)에는 접근하지 않습니다. 검토 요청된 정산 건과 그 증빙만 열람하며, 증빙 파일은 만료형 보안 링크로만 열립니다.
        </p>
      </Panel>
    </div>
  );
}
