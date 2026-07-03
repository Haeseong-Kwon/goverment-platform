"use client";
import { useState } from "react";
import Link from "next/link";
import { Settings, Upload } from "lucide-react";
import { Card, DocRow, PageHeader, SimButton, Stepper } from "../components/ui";
import { project } from "../data";

export function OnboardingPage() {
  const [step,setStep]=useState(1);
  return <main className="sim-page onboarding"><div className="sim-container sim-container--960"><PageHeader role="창업자" title="AI 시뮬레이터 온보딩" description="제출 전 서류를 예행연습해 반려를 미리 잡아드립니다. 3단계면 끝나요."/><Stepper steps={["사업계획서 입력","AI 이해 확인","서류 체크리스트"]} current={step} onSelect={setStep}/>
    {step===1&&<Card className="onboard-card"><div className="dropzone"><span><Upload/></span><h2>사업계획서를 여기에 끌어다 놓으세요</h2><p>PDF · HWP · DOCX · 최대 20MB</p><SimButton>파일 선택</SimButton></div><div className="or"><i/>또는 텍스트 붙여넣기<i/></div><textarea placeholder="사업계획서 내용을 붙여넣으면 AI가 바로 분석합니다…"/><div className="card-actions"><SimButton variant="outline">샘플로 체험하기</SimButton><SimButton onClick={()=>setStep(2)}>분석 시작 →</SimButton></div></Card>}
    {step===2&&<Card className="onboard-card"><div className="parsed-head"><span><Settings/></span><div><h2>이렇게 이해했습니다</h2><p>틀린 부분이 있으면 눌러서 바로 수정하세요.</p></div></div><div className="parsed-grid">{[["사업명",project.name],["사업 기간",project.period],["총 사업비",project.budget],["업종",project.industry]].map(([l,v])=><div key={l}><small>{l}</small><strong>{v}</strong>{l==="총 사업비"&&<em>{project.budgetDetail}</em>}</div>)}</div><div className="accounts-box"><div><strong>필요 비목 추정</strong><span>신뢰도 상</span></div><div>{["홍보비","기계장치·도구 구입비","인건비","외주용역비"].map(v=><span key={v}>{v}</span>)}<button>+ 비목 추가</button></div></div><div className="card-actions"><SimButton variant="outline" onClick={()=>setStep(1)}>← 뒤로</SimButton><SimButton onClick={()=>setStep(3)}>확인했어요, 다음 →</SimButton></div></Card>}
    {step===3&&<Card className="onboard-card checklist-card"><div className="checklist-title"><div><h2>필요 서류 체크리스트</h2><p>확인하신 비목 기준으로 자동 생성했어요 · 6건 중 <b>2건 준비완료</b></p></div><div><small>준비 진행률</small><strong>33%</strong></div></div><div className="checklist-list">{[
      ["사업자등록증 사본","공통 · 필수","complete","준비완료"],["통장 사본 (사업비 전용 계좌)","공통 · 필수","complete","준비완료"],["견적서 2부 (기계장치 구입비)","기계장치·도구 구입비 · 500만원 이상 비교견적","preparing","준비중"],["홍보비 집행 계획서","홍보비 · 광고매체·단가 명시","idle","미시작"],["4대보험 가입자명부","인건비 · 채용 후 제출","idle","미시작"],["개인정보 수집·이용 동의서","외주용역비 · 프리랜서 계약 시","idle","미시작"]
    ].map(([n,s,k,state])=><DocRow key={n} name={n} subtitle={s} state={k as "complete"|"preparing"|"idle"} action={<><button className="template-link">표준양식 ↓</button><b className={`row-state row-state--${k}`}>{state}</b></>}/>)}</div><div className="card-actions"><SimButton variant="outline" onClick={()=>setStep(2)}>← 뒤로</SimButton><Link className="sim-button sim-button--primary" href="/settlements/new">정산 제출로 이동 →</Link></div></Card>}
  </div></main>;
}

