import { Check, ShieldCheck } from "lucide-react";
import { Card, DonutChart, PageHeader, SimButton, StatusPill } from "../components/ui";

const stages=[["초안","done"],["제출","done"],["회계사 검토","gate1"],["매니저 검토","current"],["집행","idle"],["정산완료","idle"]];
export function SettlementTrackerPage(){
 return <main className="sim-page tracker"><div className="sim-container sim-container--1100"><PageHeader role="창업자" title="정산 상태 트래커" description="회계사·매니저 이중 게이트를 거쳐 집행됩니다. 반려 건은 맨 위에 고정됩니다."/>
 <section className="rejected-banner"><div className="rejected-head"><div><StatusPill status="반려" dot/><strong>정산 #2026-0417 · 홍보비 180만원</strong></div><SimButton variant="danger">재작성 →</SimButton></div><div className="rejected-info"><div><small>사유코드</small><strong>E-102 증빙누락</strong></div><div><small>매니저 코멘트</small><p>세금계산서의 공급받는자 사업자번호가 계좌와 불일치합니다. 정정 후 재첨부해 주세요.</p></div></div></section>
 <Card className="pipeline-card"><div className="pipeline-head"><strong>정산 #2026-0431 · 기계장치 구입비 1,200만원</strong><StatusPill status="진행중"/></div><div className="pipeline">{stages.map(([label,state],i)=><div className={`pipeline-step ${state}`} key={label}><div className="pipeline-node">{state==="done"?<Check/>:state==="gate1"||state==="current"?<ShieldCheck/>:i+1}</div><strong>{label}</strong>{state==="gate1"&&<small>✓ 게이트1 통과</small>}{state==="current"&&<small>게이트2 · 대기중</small>}{i<stages.length-1&&<i className={`line line-${state}`}/>}</div>)}</div></Card>
 <div className="tracker-bottom"><Card className="recent-card"><h2>최근 정산건</h2>{[["#2026-0428 · 외주용역비 300만","회계사 검토 · 대기 6시간","진행중"],["#2026-0405 · 인건비 400만","집행 완료 · 3.28","정산완료"],["#2026-0391 · 홍보비 120만","집행 완료 · 3.15","정산완료"]].map(([t,d,s])=><div className="recent-row" key={t}><div><strong>{t}</strong><small>{d}</small></div><StatusPill status={s}/></div>)}</Card><Card className="execution-card"><h2>팀 전체 집행률</h2><DonutChart gradient="conic-gradient(#2563EB 0 62%,#E2E8F0 62% 100%)" value="62%" label="집행률" ariaLabel="팀 전체 집행률 62%"/><p>집행 3,720만 / 총 6,000만</p><strong>잔여 집행기한 D-84</strong></Card></div>
 </div></main>;
}

