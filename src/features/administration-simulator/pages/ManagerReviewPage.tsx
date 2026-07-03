"use client";
import { useState } from "react";
import { FileText } from "lucide-react";
import { Card, PageHeader, SimButton, StatusPill } from "../components/ui";
import { queue } from "../data";
import { getGateReasonCodes, getReviewDetail } from "../logic";
import type { QueueId } from "../types";

export function ManagerReviewPage(){
 const [selected,setSelected]=useState<QueueId>("q1"); const detail=getReviewDetail(selected); const [reason,setReason]=useState(""); const [comment,setComment]=useState("");
 const canReject=Boolean(reason&&comment.trim());
 return <main className="sim-page review-page"><div className="sim-container sim-container--1320"><PageHeader role="매니저" title="검토 큐" description="여러 팀의 제출 건을 한 리스트에서. 우측에서 증빙 확인 후 바로 승인·반려하세요."/><div className="filter-bar">{["전체 12건","팀 ▾","비목 ▾","금액 ▾","대기시간 ↓"].map((v,i)=><button className={i===0?"active":""} key={v}>{v}</button>)}</div><div className="review-layout"><Card className="queue-card">{queue.map(item=><button className={`queue-row ${selected===item.id?"selected":""}`} onClick={()=>setSelected(item.id)} key={item.id}><div><strong>{item.team} · {item.account} <b>{item.amount}</b></strong><small>{item.detail}</small></div><div><b className={item.danger?"danger-text":""}>{item.wait} 대기</b><small>증빙 {item.evidence}건</small></div></button>)}</Card>
 <Card className="review-detail"><div className="review-title"><h2>{detail.title}</h2><StatusPill status="검토 대기" dot/></div><div className="detail-meta"><div><small>금액</small><strong>{detail.amount}</strong></div><div><small>비목</small><strong>{detail.account}</strong></div></div><label>증빙 뷰어</label><div className="doc-viewer"><FileText/><span>세금계산서_인벤티_3월.pdf</span></div><div className="doc-tabs"><button className="active">세금계산서</button><button>이체확인증</button><button>근로계약서</button></div><label>반려 사유코드 <b>*</b></label><select className="sim-select" value={reason} onChange={e=>setReason(e.target.value)}><option value="">선택하세요</option>{getGateReasonCodes("manager").map(v=><option key={v.code} value={v.code}>{v.code} {v.label}</option>)}</select><textarea placeholder="코멘트 입력 (반려 시 필수)" value={comment} onChange={e=>setComment(e.target.value)}/><div className="review-actions"><SimButton variant="danger" disabled={!canReject}>반려</SimButton><SimButton variant="success">승인 (게이트2 통과)</SimButton></div></Card></div></div></main>;
}

