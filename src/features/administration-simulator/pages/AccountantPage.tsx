"use client";
import { useState } from "react";
import { Card, EvidenceFile, PageHeader, SimButton, StatusPill } from "../components/ui";
import { getGateReasonCodes } from "../logic";

export function AccountantPage(){
 const [reason,setReason]=useState("");
 return <main className="sim-page accountant-page"><div className="sim-container sim-container--760"><PageHeader role="회계사" title="제한 검증" description="배정된 검증 요청만 표시됩니다. 1차 승인·반려 외 다른 관리 기능은 없습니다."/><div className="assigned">배정 요청 <span>3건</span></div><Card className="accountant-card"><div className="accountant-head"><div><small>정산건</small><h2>로지스원 · #2026-0431</h2></div><StatusPill status="검증 대기" dot/></div><div className="accountant-meta"><div><small>비목</small><strong>기계장치·도구 구입비</strong></div><div><small>금액</small><strong>12,000,000원</strong></div><div><small>집행일</small><strong>2026.03.22</strong></div></div><label>증빙 (5건)</label><div className="accountant-files">{["세금계산서.pdf","비교 견적서 2부.pdf","계좌이체 확인증.png"].map(v=><EvidenceFile name={v} key={v}/>)}</div><label>1차 검증 결과</label><select className="sim-select" value={reason} onChange={e=>setReason(e.target.value)}><option value="">사유코드 선택 (반려 시)</option>{getGateReasonCodes("accountant").map(v=><option key={v.code} value={v.code}>{v.code} {v.label}</option>)}</select><div className="review-actions"><SimButton variant="danger" disabled={!reason}>반려</SimButton><SimButton variant="success">1차 승인 (게이트1 통과)</SimButton></div></Card><div className="accountant-wait">{["그린루프 · #2026-0421 · 홍보비 180만","에듀박스 · #2026-0428 · 외주용역비 300만"].map(v=><div key={v}><i/><strong>{v}</strong><span>대기</span></div>)}</div></div></main>;
}
