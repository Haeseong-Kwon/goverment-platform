# Administration Simulator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 제품 명세서의 행정 시뮬레이터 7개 화면과 상태·검증 로직을 기존 Next.js 프로젝트에 동일하게 이식한다.

**Architecture:** `(simulator)` route group과 전용 feature module을 사용해 기존 AOP 화면을 보존한다. 명세 데이터와 상태 계산을 UI에서 분리하고 전용 CSS 변수로 스타일 충돌을 막는다.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Lucide React, Vitest

---

### Task 1: 테스트 기반과 순수 도메인 로직

**Files:**
- Modify: `package.json`
- Create: `src/features/administration-simulator/logic.ts`
- Create: `src/features/administration-simulator/logic.test.ts`
- Create: `src/features/administration-simulator/types.ts`
- Create: `src/features/administration-simulator/data.ts`

- [ ] Vitest를 설치하고 `test` 스크립트를 등록한다.
- [ ] 제출 검증, 큐 매핑, 게이트 사유코드 테스트를 먼저 작성한다.
- [ ] 테스트가 구현 부재로 실패하는지 확인한다.
- [ ] 최소 구현과 명세의 typed mock data를 작성한다.
- [ ] 테스트 통과를 확인한다.

### Task 2: 전용 셸과 디자인 토큰

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/components/layout/Navbar.tsx`
- Modify: `src/components/layout/Footer.tsx`
- Modify: `src/app/globals.css`
- Create: `src/app/(simulator)/layout.tsx`
- Create: `src/features/administration-simulator/simulator.css`

- [ ] 기존 셸에 simulator 경로 제외 규칙을 추가한다.
- [ ] Pretendard CDN, §1 컬러·타입·간격·반경·그림자 토큰을 등록한다.
- [ ] max-width와 1440/1024/768/390 반응형 기반을 구성한다.

### Task 3: 공통 UI 컴포넌트

**Files:**
- Create: `src/features/administration-simulator/components/ui.tsx`

- [ ] Card와 버튼 변형을 구현한다.
- [ ] StatusPill과 RoleBadge를 부록 A 매핑으로 구현한다.
- [ ] StatCard, DonutChart, DocRow, ProgressBar, Stepper를 구현한다.
- [ ] 키보드 포커스, aria label, disabled 동작을 확인한다.

### Task 4: A 랜딩

**Files:**
- Move: `src/app/page.tsx` → `src/app/(simulator)/page.tsx`
- Create: `src/features/administration-simulator/pages/LandingPage.tsx`

- [ ] 헤더, 히어로, 통계, 여정, 기능, 신뢰, CTA, 푸터를 §3 문구와 픽셀값으로 구현한다.
- [ ] CTA를 명세 라우트에 연결한다.

### Task 5: B 온보딩

**Files:**
- Create: `src/app/(simulator)/onboarding/page.tsx`
- Create: `src/features/administration-simulator/pages/OnboardingPage.tsx`

- [ ] 3단계 스텝 상태와 직접 이동을 구현한다.
- [ ] 각 단계의 드롭존, 파싱 결과, 체크리스트를 §4 그대로 구현한다.
- [ ] 마지막 CTA를 `/settlements/new`로 연결한다.

### Task 6: C 정산 제출

**Files:**
- Create: `src/app/(simulator)/settlements/new/page.tsx`
- Create: `src/features/administration-simulator/pages/NewSettlementPage.tsx`

- [ ] 비목 선택과 증빙 목록 전환을 구현한다.
- [ ] 임차료·여비 disabled 툴팁을 정확한 문구로 구현한다.
- [ ] 누락 수와 한도 초과에 따른 검증 메시지 및 제출 버튼을 동적 계산한다.

### Task 7: D 상태 트래커

**Files:**
- Create: `src/app/(simulator)/settlements/page.tsx`
- Create: `src/features/administration-simulator/pages/SettlementTrackerPage.tsx`

- [ ] 반려 배너, 6단계 파이프라인, 최근 정산, 62% 도넛을 구현한다.
- [ ] 게이트1→게이트2 순서를 시각적으로 표시한다.

### Task 8: E 매니저 대시보드

**Files:**
- Create: `src/app/(simulator)/manager/page.tsx`
- Create: `src/features/administration-simulator/pages/ManagerDashboardPage.tsx`

- [ ] KPI 4개, 반려 분포 도넛, 7개 팀 표를 §7 데이터로 구현한다.
- [ ] 전체 20팀 도메인 데이터와 표시 데이터의 관계를 유지한다.

### Task 9: F 검토 큐

**Files:**
- Create: `src/app/(simulator)/manager/review/page.tsx`
- Create: `src/features/administration-simulator/pages/ManagerReviewPage.tsx`

- [ ] q1~q4 선택과 상세 매핑을 구현한다.
- [ ] E-101~E-104 셀렉트, 코멘트, 게이트2 승인/반려 규칙을 구현한다.

### Task 10: G 회계사 제한 뷰

**Files:**
- Create: `src/app/(simulator)/accountant/page.tsx`
- Create: `src/features/administration-simulator/pages/AccountantPage.tsx`

- [ ] 배정 3건과 활성 검증 카드를 구현한다.
- [ ] E-102/E-104/E-105 및 게이트1 승인/반려만 제공한다.
- [ ] 대시보드·통계·팀 관리 기능이 없음을 확인한다.

### Task 11: 전체 검증과 명세 대조

**Files:**
- Modify: 필요한 simulator 파일만

- [ ] `npm test`, `npm run lint`, `npm run build`를 실행한다.
- [ ] 7개 경로를 1440/768/390px에서 브라우저로 확인한다.
- [ ] B/C/F 상호작용, 툴팁, disabled, 사유코드를 확인한다.
- [ ] §10.6 체크리스트를 대조하고 남은 미충족 항목을 기록한다.
