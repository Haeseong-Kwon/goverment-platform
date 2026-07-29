import { FRAUD_WARNING, REASON_CODES, RULESET_VERSION } from "./ruleset";
import type { ExpenseVerdict, Finding, ReasonCode } from "./types";

export interface RejectionInput {
  teamName: string;
  submissionTitle: string;
  managerName: string;
  institutionName: string;
  reasonCodes: ReasonCode[];
  findings: Finding[];
  extraComment?: string;
}

const bullet = (finding: Finding, index: number) =>
  [
    `${index + 1}. [${finding.reasonCode} ${REASON_CODES[finding.reasonCode]}] ${finding.message}`,
    `   · 근거: ${finding.clause}`,
    `   · 조치: ${finding.fix}`,
  ].join("\n");

/**
 * 반려 사유코드와 검증 결과로 지침 조항을 인용한 안내문을 만듭니다.
 * 매니저가 확인·수정한 뒤 발송하며, 발송 기록이 감사 대응 근거로 남습니다.
 */
export function composeRejectionNotice(input: RejectionInput) {
  const cited = input.findings.filter((finding) => input.reasonCodes.includes(finding.reasonCode));
  const listed = cited.length ? cited : input.findings.filter((finding) => finding.severity !== "info");
  const hasFraudRisk = input.findings.some((finding) => finding.code === "COM-04");

  const body = [
    `${input.teamName} 담당자님, 안녕하세요. ${input.institutionName} ${input.managerName}입니다.`,
    "",
    `제출하신 「${input.submissionTitle}」 정산 건은 아래 사유로 보완이 필요하여 반려 처리되었습니다.`,
    "",
    listed.length ? listed.map(bullet).join("\n\n") : "· 상세 사유는 담당 매니저에게 문의해 주세요.",
    "",
    input.extraComment?.trim() ? `[담당자 코멘트]\n${input.extraComment.trim()}\n` : "",
    hasFraudRisk ? `※ ${FRAUD_WARNING}\n` : "",
    "보완 후 워크스페이스에서 다시 검토 요청해 주시면 확인하겠습니다. 감사합니다.",
    "",
    `— ${input.institutionName} ${input.managerName} · 적용 룰셋 ${RULESET_VERSION}`,
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject: `[${input.institutionName}] ${input.submissionTitle} 정산 보완 요청`, body, citedCount: listed.length };
}

/** 반려 사유코드 선택지 — 검증 결과가 있으면 실제 발견된 코드를 우선 노출합니다. */
export function getReasonCodeOptions(verdict?: ExpenseVerdict) {
  const detected = new Set((verdict?.findings ?? []).filter((finding) => finding.severity !== "info").map((finding) => finding.reasonCode));
  return (Object.keys(REASON_CODES) as ReasonCode[])
    .map((code) => ({ code, label: REASON_CODES[code], detected: detected.has(code) }))
    .sort((a, b) => Number(b.detected) - Number(a.detected));
}

/** 기간별 반려 사유 분포 — 매니저 리포트용. */
export function summarizeRejectionReasons(reasonCodes: ReasonCode[]) {
  const counts = reasonCodes.reduce<Record<string, number>>((acc, code) => ({ ...acc, [code]: (acc[code] ?? 0) + 1 }), {});
  const total = reasonCodes.length;
  return (Object.keys(counts) as ReasonCode[])
    .map((code) => ({ code, label: REASON_CODES[code], count: counts[code], share: total ? Math.round((counts[code] / total) * 100) : 0 }))
    .sort((a, b) => b.count - a.count);
}
