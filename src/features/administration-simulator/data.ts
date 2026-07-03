import type { AccountKey, Evidence, Limit, QueueId } from "./types";

export const project = {
  name: "스마트 재고관리 SaaS '인벤티'",
  period: "2026.04 ~ 2026.12 (9개월)",
  budget: "6,000만원",
  budgetDetail: "정부 4,200 · 자부담 1,800",
  industry: "정보통신업 (소프트웨어 개발)",
};

export const evidenceByAccount: Record<AccountKey, Evidence[]> = {
  promo: [
    { name: "세금계산서", attached: true, file: "세금계산서_네이버.pdf" },
    { name: "계좌이체 확인증", attached: true, file: "이체확인_0312.png" },
    { name: "광고 집행 결과 리포트", attached: false },
    { name: "거래명세서", attached: false },
  ],
  machine: [
    { name: "비교 견적서 2부", attached: false },
    { name: "세금계산서", attached: false },
    { name: "현물 사진 (자산 라벨 부착)", attached: false },
  ],
  labor: [
    { name: "근로계약서", attached: true, file: "근로계약서.pdf" },
    { name: "급여 이체 증빙", attached: false },
    { name: "4대보험 완납증명서", attached: false },
  ],
};

export const limits: Limit[] = [
  { label: "인건비", requested: 400, remaining: 320, state: "danger", percent: 100, badge: "초과 80만", caption: "신청 400만 · 잔여 320만 → 한도 초과" },
  { label: "홍보비", requested: 80, remaining: 350, state: "success", percent: 23, badge: "여유", caption: "신청 80만 · 잔여 350만" },
  { label: "기계장치·도구", requested: 0, remaining: 1200, state: "neutral", percent: 0, badge: "미신청", caption: "신청 0 · 잔여 1,200만" },
];

export const queue = [
  { id: "q1" as QueueId, team: "인벤티", account: "인건비", amount: "400만원", detail: "#2026-0417 · 3월 급여 정산", wait: "52시간", danger: true, evidence: 3 },
  { id: "q2" as QueueId, team: "그린루프", account: "홍보비", amount: "180만원", detail: "#2026-0421 · 검색광고 3월분", wait: "8시간", danger: false, evidence: 4 },
  { id: "q3" as QueueId, team: "로지스원", account: "기계장치", amount: "1,200만원", detail: "#2026-0431 · 서버 장비 구입", wait: "14시간", danger: false, evidence: 5 },
  { id: "q4" as QueueId, team: "에듀박스", account: "외주용역비", amount: "300만원", detail: "#2026-0428 · UI 디자인 외주", wait: "61시간", danger: true, evidence: 3 },
];

export const teams = [
  ["인벤티", "매니저 검토", "52시간", "지연"],
  ["그린루프", "회계사 검토", "8시간", "진행중"],
  ["핀테크랩", "집행", "2시간", "승인"],
  ["메디에이드", "제출", "—", "대기"],
  ["에듀박스", "매니저 검토", "61시간", "지연"],
  ["로지스원", "회계사 검토", "14시간", "진행중"],
  ["바이오식스", "정산완료", "—", "완료"],
];

export const allTeams = [
  "인벤티", "그린루프", "핀테크랩", "메디에이드", "에듀박스", "로지스원", "바이오식스",
  "브릿지웍스", "클라우드나인", "모빌리티랩", "제로웨이스트", "헬스브릿지", "코드웨이브",
  "마켓링크", "팜테크", "에너지온", "콘텐츠랩", "로보메이트", "스페이스업", "데이터포지",
];
