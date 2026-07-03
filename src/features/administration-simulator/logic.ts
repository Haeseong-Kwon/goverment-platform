import type { GateRole, QueueId, ReviewDetail } from "./types";

const reviewDetails: Record<QueueId, ReviewDetail> = {
  q1: { title: "인벤티 · #2026-0417", amount: "4,000,000원", account: "인건비" },
  q2: { title: "그린루프 · #2026-0421", amount: "1,800,000원", account: "홍보비" },
  q3: { title: "로지스원 · #2026-0431", amount: "12,000,000원", account: "기계장치·도구" },
  q4: { title: "에듀박스 · #2026-0428", amount: "3,000,000원", account: "외주용역비" },
};

const reasonCodes = {
  "E-101": "비목 부적합",
  "E-102": "증빙 누락",
  "E-103": "한도 초과",
  "E-104": "서명·날인 누락",
  "E-105": "금액 불일치",
} as const;

export function getReviewDetail(id: QueueId) {
  return reviewDetails[id];
}

export function getGateReasonCodes(role: GateRole) {
  const codes =
    role === "accountant"
      ? (["E-102", "E-104", "E-105"] as const)
      : (["E-101", "E-102", "E-103", "E-104"] as const);
  return codes.map((code) => ({ code, label: reasonCodes[code] }));
}

export function validateSettlement({
  evidence,
  limits,
}: {
  evidence: Array<{ attached: boolean }>;
  limits: Array<{ label: string; requested: number; remaining: number }>;
}) {
  const missingCount = evidence.filter((item) => !item.attached).length;
  const overLimits = limits.filter((item) => item.requested > item.remaining);
  const messages = [
    ...(missingCount ? [`증빙 ${missingCount}건이 첨부되지 않았습니다`] : []),
    ...overLimits.map((item) => `${item.label} 신청액이 잔여 한도를 초과했습니다`),
  ];
  const unmetCount = messages.length;
  return {
    missingCount,
    overLimitCount: overLimits.length,
    canSubmit: unmetCount === 0,
    messages,
    buttonLabel: unmetCount ? `제출 (${unmetCount}건 미충족)` : "제출",
  };
}
