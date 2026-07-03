import Link from "next/link";
import { Check, ChevronRight, FileText, Settings, ShieldCheck, Upload, AlertTriangle } from "lucide-react";

const journey = [
  [FileText, "사업계획서 입력", "업로드하거나 붙여넣으면", "AI가 바로 분석합니다"],
  [Settings, "필요서류 자동 도출", "비목을 추정해 서류", "체크리스트를 만듭니다"],
  [ShieldCheck, "제출·이중검증", "회계사·매니저 이중", "게이트로 검토"],
  [Check, "정산완료", "집행부터 완료까지 상태를", "실시간 추적"],
] as const;
const features = [
  ["01", "창업자", "서류 자동 도출", "사업계획서만 넣으면 필요한 서류와 표준양식을 자동으로 정리해 드립니다."],
  ["02", "창업자", "비목 사전검증", "부적합 비목·한도 초과·증빙 누락을 제출 전에 인라인으로 잡아줍니다."],
  ["03", "창업자", "상태 트래커", "초안부터 정산완료까지 파이프라인으로 한눈에 추적합니다."],
  ["04", "매니저", "통합 대시보드", "담당하는 수십 개 팀의 진행·반려·지연을 하나의 화면에서 관리합니다."],
  ["05", "매니저", "반려사유 통계", "반려가 왜 반복되는지 유형별로 분석해 보육 품질을 높입니다."],
] as const;

export function LandingPage() {
  return <div className="simulator-shell landing">
    <header className="landing-nav"><Link href="/" className="brand"><span><Check /></span>행정 시뮬레이터</Link><nav><a>서비스</a><a>지원 프로그램</a><a>요금</a><a>고객센터</a></nav><div><button>로그인</button><Link href="/onboarding">무료로 시작</Link></div></header>
    <main>
      <section className="landing-hero">
        <div><span className="hero-badge">K-Startup 예비창업패키지 대응</span><h1>예창패 서류,<br />제출 전에 <em>예행연습</em>하세요</h1><p>AI가 필요한 서류를 자동으로 찾아주고, 반려로 이어질 문제를 제출 전에 미리 잡아드립니다.</p><div className="hero-actions"><Link href="/onboarding">무료로 시뮬레이션 시작</Link><Link href="/manager">매니저이신가요? →</Link></div></div>
        <div className="hero-check-card"><div className="check-head"><strong>필요 서류 체크리스트</strong><span>자동 생성</span></div>
          {[["사업자등록증 사본","완료","done"],["견적서 2부 (기계구입비)","준비중","wait"],["4대보험 가입자명부","대기","idle"]].map(([name,state,kind])=><div className="hero-check" key={name}><i className={kind}>{kind==="done"&&<Check />}</i><strong>{name}</strong><span className={kind}>{state}</span></div>)}
          <div className="hero-alert"><AlertTriangle size={16}/>반려 위험 2건 — 제출 전 확인하세요</div><div className="floating-risk"><small>예상 반려 사유</small><strong>증빙 누락 · 한도 초과</strong></div>
        </div>
      </section>
      <section className="stats-band">{[["6종","사전 차단하는 반려 유형"],["3단계","서류 자동 도출 온보딩"],["2중","회계사·매니저 검증 게이트"]].map(([v,l])=><div key={v}><strong>{v}</strong><span>{l}</span></div>)}</section>
      <section className="landing-section journey"><span className="section-label">서비스 여정</span><h2>입력부터 정산완료까지, 한 흐름으로</h2><div className="journey-grid">{journey.map(([Icon,title,a,b],i)=><div className="journey-step" key={title}><span><Icon /></span><strong>{title}</strong><p>{a}<br/>{b}</p>{i<3&&<ChevronRight className="journey-arrow"/>}</div>)}</div></section>
      <section className="landing-section feature-section"><span className="section-label">핵심 기능</span><h2>창업자와 매니저, 양방향으로</h2><div className="feature-grid">{features.map(([n,r,t,d])=><article key={n}><div><b>{n}</b><span className={r==="매니저"?"manager":""}>{r}</span></div><h3>{t}</h3><p>{d}</p><a>자세히 →</a></article>)}<article className="feature-expand"><Upload/><h3>지원 프로그램 확장 중</h3><p>예비창업패키지를 시작으로 초기창업패키지·디딤돌 등으로 넓혀갑니다.</p><a>프로그램 보기 →</a></article></div></section>
      <section className="trust-section"><div><span className="section-label">누구를 위한 서비스인가</span><h2>대학 창업지원단과<br/>스타트업파크를 위한 행정 인프라</h2><p>카톡·이메일로 흩어진 서류 검토를 하나의 파이프라인으로 모읍니다. 반려는 줄이고, 검토 시간은 아낍니다.</p></div><div>{[["표준양식 기반 안내","기관 지침에 맞춘 서류·양식을 자동 매칭"],["이중 검증 게이트","회계사 1차·매니저 2차로 정산 신뢰도 확보"],["데이터 기반 보육","반려사유 통계로 지원 품질을 지속 개선"]].map(([t,d])=><div className="trust-row" key={t}><i><Check/></i><div><strong>{t}</strong><p>{d}</p></div></div>)}</div></section>
      <section className="cta-band"><h2>반려 없는 첫 정산, 지금 시작하세요</h2><p>가입 즉시 사업계획서를 넣고 필요 서류를 자동으로 받아보세요.</p><div><Link href="/onboarding">무료로 시뮬레이션 시작</Link><button>도입 문의</button></div></section>
    </main>
    <footer className="landing-footer"><div className="footer-grid"><div><div className="brand brand--dark"><span><Check/></span>행정 시뮬레이터</div><p>예비창업패키지 서류를 제출 전에 예행연습시키는 AI 행정 시뮬레이터.</p><div className="socials"><i>in</i><i>f</i><i>유</i></div></div><div><strong>서비스</strong><a>AI 시뮬레이터</a><a>정산 관리</a><a>매니저 대시보드</a><a>요금 안내</a></div><div><strong>지원 프로그램</strong><a>예비창업패키지</a><a>초기창업패키지</a><a>창업도약패키지</a></div><div><strong>고객센터</strong><b>1600-0000</b><p>평일 10:00–18:00 (점심 12–13시)<br/>주말·공휴일 휴무</p></div></div><div className="footer-bottom"><span>(주)행정시뮬레이터 · 대표 홍길동 · 사업자등록번호 000-00-00000 · 서울특별시 강남구 테헤란로 000</span><span>© 2026 행정 시뮬레이터. All rights reserved.</span></div></footer>
  </div>;
}

