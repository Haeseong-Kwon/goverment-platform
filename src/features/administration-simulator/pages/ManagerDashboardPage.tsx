import Link from "next/link";
import { Card, DonutChart, PageHeader, SimButton, StatCard, StatusPill } from "../components/ui";
import { teams } from "../data";

export function ManagerDashboardPage(){
 const legends=[["#DC2626","증빙 누락","47%"],["#F59E0B","한도 초과","21%"],["#2563EB","비목 부적합","18%"],["#7C3AED","서명·날인 누락","8%"],["#94A3B8","기타","6%"]];
 return <main className="sim-page manager-dashboard"><div className="sim-container sim-container--1320"><PageHeader role="매니저" title="통합 대시보드" description="내가 담당하는 20개 팀 · 예비창업패키지 2026 · 카톡·이메일 없이 한눈에." actions={<><SimButton variant="outline">이번 분기 ▾</SimButton><SimButton>리포트 내보내기</SimButton></>}/><div className="grid-4 kpi-grid"><StatCard label="제출률" value="82%" detail={<><b className="success-text">▲ 6%p</b> · 지난주 대비</>}/><StatCard label="반려율" value="19%" tone="warn" detail={<><b className="success-text">▼ 3%p</b> · 개선</>}/><StatCard label="평균 검토 소요" value="1.8일" detail="목표 2일 이내"/><StatCard label="지연 팀" value="4팀" tone="danger" detail={<span className="danger-text">48시간+ 대기</span>}/></div>
 <div className="dashboard-bottom"><Card className="reason-card"><div><h2>반려 사유 분포</h2><span>최근 30일 · 총 142건</span></div><DonutChart size={172} inset={24} gradient="conic-gradient(#DC2626 0 47%,#F59E0B 47% 68%,#2563EB 68% 86%,#7C3AED 86% 94%,#94A3B8 94% 100%)" value="142" label="반려 건수" ariaLabel="반려 사유 분포, 증빙 누락 47%, 한도 초과 21%, 비목 부적합 18%, 서명 날인 누락 8%, 기타 6%"/><div className="legend">{legends.map(([c,l,v])=><div key={l}><i style={{background:c}}/><span>{l}</span><strong>{v}</strong></div>)}</div></Card>
 <Card className="team-table"><div className="table-title"><h2>팀별 진행 현황</h2><Link href="/manager/review">전체 20팀 보기 →</Link></div><div className="team-row team-head"><span>팀명</span><span>현재 단계</span><span>대기시간</span><span>상태</span></div>{teams.map(([team,stage,wait,status])=><div className="team-row" key={team}><strong>{team}</strong><span>{stage}</span><span className={status==="지연"?"danger-text":""}>{wait}</span><span><StatusPill status={status}/></span></div>)}</Card></div></div></main>;
}

