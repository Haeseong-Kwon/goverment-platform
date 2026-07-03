"use client";
import { useState } from "react";
import { AlertTriangle, Ban, Check, Upload } from "lucide-react";
import { Card, PageHeader, ProgressBar, SimButton } from "../components/ui";
import { evidenceByAccount, limits } from "../data";
import { validateSettlement } from "../logic";
import type { AccountKey } from "../types";

const labels:Record<AccountKey,string>={promo:"홍보비",machine:"기계장치·도구 구입비",labor:"인건비"};
export function NewSettlementPage(){
 const [account,setAccount]=useState<AccountKey>("promo");
 const [attached,setAttached]=useState<Record<AccountKey,Set<number>>>(()=>({
  promo:new Set(evidenceByAccount.promo.flatMap((item,index)=>item.attached?[index]:[])),
  machine:new Set(evidenceByAccount.machine.flatMap((item,index)=>item.attached?[index]:[])),
  labor:new Set(evidenceByAccount.labor.flatMap((item,index)=>item.attached?[index]:[])),
 }));
 const evidence=evidenceByAccount[account].map((item,index)=>({...item,attached:attached[account].has(index)})); const validation=validateSettlement({evidence,limits});
 const attachFile=(index:number)=>setAttached(current=>({...current,[account]:new Set([...current[account],index])}));
 return <main className="sim-page settlement-new"><div className="sim-container sim-container--1200"><PageHeader role="창업자" title="정산 제출" description="지출 내용을 입력하면 부적합 비목·증빙 누락을 제출 전에 잡아드립니다."/><div className="settlement-layout"><div className="settlement-main">
  <Card className="form-card"><h2>지출 입력</h2><div className="expense-grid"><div className="field"><label>지출 내용</label><input defaultValue="네이버 검색광고 3월 집행분"/></div><div className="field"><label>금액 (원)</label><input className="amount-input" defaultValue="1,800,000"/></div></div><div className="account-label">비목 선택</div><div className="account-chips">{(Object.keys(labels) as AccountKey[]).map(k=><button className={account===k?"is-active":""} key={k} onClick={()=>setAccount(k)}>{labels[k]}</button>)}<button disabled data-tip="본 과제 비목 계획에 포함되지 않은 항목입니다"><Ban/>임차료</button><button disabled data-tip="여비는 사업비 편성 계획에 없어 신청할 수 없습니다"><Ban/>여비</button></div></Card>
  <Card className="evidence-card"><div className="evidence-head"><h2>증빙 체크리스트</h2><span>{evidence.filter(v=>v.attached).length} / {evidence.length} 첨부</span></div><div className="evidence-list">{evidence.map((item,index)=><div className={`evidence-row ${item.attached?"is-attached":"is-missing"}`} key={item.name}><i>{item.attached?<Check/>:null}</i><div><strong>{item.name}</strong>{item.file&&<small>{item.file}</small>}</div>{item.attached?<b>첨부완료</b>:<button onClick={()=>attachFile(index)}><Upload/>＋ 파일 업로드</button>}</div>)}</div></Card>
 </div><aside><Card className="limits-card"><h2>비목별 잔여 한도</h2>{limits.map(limit=><div className="limit-row" key={limit.label}><div><strong>{limit.label}</strong><b className={`tone-${limit.state}`}>{limit.badge}</b></div><ProgressBar percent={limit.percent} tone={limit.state}/><p>{limit.caption}</p></div>)}</Card><Card className="validation-card"><h2>제출 전 검증</h2>{validation.messages.map(m=><p key={m}><AlertTriangle/>{m}</p>)}<SimButton variant={validation.canSubmit?"primary":"disabled"} disabled={!validation.canSubmit}>{validation.buttonLabel}</SimButton></Card></aside></div></div></main>;
}
