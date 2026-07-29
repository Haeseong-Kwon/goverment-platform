# StartUp Pilot

정부 창업지원사업의 행정 전 과정을 다루는 이원화 SaaS입니다. 창업자에게는 준비부터 정산까지, 주관기관에는 검토·정산 관리 대시보드를 제공하며, 양쪽이 같은 규정 룰 엔진을 공유합니다.

## 화면 구조

| 영역 | 경로 | 역할 |
|------|------|------|
| 공개 소개 | `/`, `/manager/landing`, `/workspace-entry` | 창업자·주관기관 랜딩과 역할 선택 |
| 인증 | `/login`, `/signup`, `/auth/callback`, `/auth/reset` | 이메일 로그인, 인증 메일 콜백, 비밀번호 재설정 |
| 창업자 준비 (`pre_founder`) | `/onboarding`, `/founder/*` | 팀 TODO, 마감 캘린더, AI 진단, 계산기, 법인 설립, 보관함 |
| 협약 수행 (`founder`) | `/workspace/*` | 정산 사전검증, 사전심의 합본, 상태 트래커, 보관함 |
| 주관기관 (`manager`) | `/manager/*` | 검토 큐, 사업비 계획 검토, 팀 관리, 리포트 |

`pre_founder → founder` 전환은 기관 전환 코드로 단방향으로만 이뤄집니다(`/founder/convert`).

## 데이터 접근 규칙

- 창업자의 준비 데이터(연습 진단, 초안, 팀 TODO)는 주관기관에 노출되지 않습니다.
- 매니저는 사전검증을 통과해 **검토 요청된** 정산 건과 그 증빙만 열람합니다(`canManagerSeeReviewItem`).
- 증빙 파일은 Supabase Storage 만료형 서명 링크(기본 5분)로만 열립니다.
- 접근 통제의 실제 경계는 Supabase RLS입니다. 화면의 진입 판단은 다음 행동을 안내하는 UX 장치입니다.

## 개발 환경

```bash
npm install
cp .env.example .env.local   # 값 채우기
npm run dev
```

### 개발용 진입 모드

`.env.local`에 `NEXT_PUBLIC_DEV_BYPASS=1`을 두면 로그인 없이 로그인 이후 화면을 예시 데이터로 열 수 있습니다.
사이드바 아래 전환기로 창업자 준비 / 선정 팀 / 주관기관 세 화면을 오갑니다.

- 역할은 주소에서 읽습니다(`/founder` · `/workspace` · `/manager`). 별도 상태가 없어 어긋날 일이 없습니다.
- 예시 데이터는 `src/lib/dev/`에 있고 브라우저 localStorage에만 저장됩니다. 할 일 완료, 검토 승인·반려 같은 변경이 실제로 반영됩니다.
- 사업비 판정은 예시 입력을 **실제 룰 엔진**(`validateExpense`)에 통과시켜 만듭니다. 화면에서 보는 지적 사항이 제품이 내리는 판정과 같습니다.
- `next build`(production)에서는 플래그 값과 무관하게 항상 꺼지며, 관련 코드는 지연 로드 청크로 분리되어 배포 페이지에서 요청되지 않습니다.

필수 환경변수는 `.env.example`에 정리되어 있습니다. `NEXT_PUBLIC_*`만 브라우저에 노출되며,
`SUPABASE_SERVICE_ROLE_KEY`는 RLS를 우회하므로 절대 `NEXT_PUBLIC_` 접두사를 붙이지 마세요.

`MANAGER_EMAILS`가 비어 있으면 기관 계정 부트스트랩 API(`/api/admin/bootstrap-manager`)가 404로 완전히 꺼집니다.

## 검증

```bash
npm test          # vitest — 룰 엔진과 대시보드 집계 로직
npm run lint      # eslint
npm run build     # next build
```

## 데이터베이스

`supabase/` 아래 스키마와 마이그레이션이 순서대로 있습니다.

```
schema.sql → 002-manager-review.sql → 003-profile-role-lock.sql → 004-seed.sql → 005-vault-and-team.sql
```

`startup-workspace.rls.test.sql`은 역할별 접근 분리를 검증합니다.

## 판정의 성격

자격 진단·사업비 판정·계산기 결과는 모두 **참고용**입니다. 최종 기준은 각 사업 공고문과 관리지침이며,
승인·반려의 최종 결정 권한은 주관기관 담당자에게 있습니다. 화면의 모든 판정에는 근거 조항을 함께 표시합니다.
