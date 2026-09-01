# StartUp Pilot

정부 창업지원사업의 행정 전 과정을 다루는 이원화 SaaS입니다. 창업자에게는 준비부터 정산까지, 주관기관에는 검토·정산 관리 대시보드를 제공하며, 양쪽이 같은 규정 룰 엔진을 공유합니다.

## 화면 구조

| 영역 | 경로 | 역할 |
|------|------|------|
| 공개 소개 | `/`, `/manager/landing`, `/workspace-entry` | 창업자·주관기관 랜딩과 역할 선택 |
| 대학 과목 | `/course/*` | 한양대 ERICA SW창업캡스톤디자인. StartUp Pilot과 분리된 영역이며 자체 인증(`/course/login`, `/course/signup`)과 수강생 워크스페이스(`/course/me`)를 가집니다 |
| 인증 | `/login`, `/signup`, `/auth/callback`, `/auth/reset` | 이메일 로그인, 인증 메일 콜백, 비밀번호 재설정 |
| 창업자 준비 (`pre_founder`) | `/onboarding`, `/founder/*` | 팀 TODO, 마감 캘린더, AI 진단, 계산기, 법인 설립, 보관함 |
| 협약 수행 (`founder`) | `/workspace/*` | 정산 사전검증, 사전심의 합본, 상태 트래커, 보관함 |
| 주관기관 (`manager`) | `/manager/*` | 검토 큐, 사업비 계획 검토, 팀 관리, 리포트 |

`pre_founder → founder` 전환은 기관 전환 코드로 단방향으로만 이뤄집니다(`/founder/convert`).

## 데이터 접근 규칙

- 창업자의 준비 데이터(연습 진단, 초안, 팀 TODO)는 주관기관에 노출되지 않습니다.
- 매니저는 사전검증을 통과해 **검토 요청된** 정산 건과 그 증빙만 열람합니다(`canManagerSeeReviewItem`).
- 증빙 파일은 창업자가 제출 시 **직접 고른 보관함 파일만** 매니저에게 열립니다(`submission_evidence`).
  고르지 않은 보관함 파일은 매니저에게 존재조차 보이지 않으며, 제출 후 첨부는 바꿀 수 없습니다.
- 증빙 파일은 Supabase Storage 만료형 서명 링크(기본 5분)로만 열립니다.
- AI를 호출하는 API(`/api/workspace/diagnoses/bizplan`, `/api/workspace/expenses/validate`)는 로그인 세션이 있어야 응답합니다.
  사업계획서 진단의 월 무료 횟수도 서버에서 세고 기록하므로 브라우저 우회로 늘릴 수 없습니다.
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

## 도메인 · SEO · 트래킹

서비스 도메인은 `startuppilot.co.kr`입니다.

- [docs/도메인-연결과-검색등록.md](docs/도메인-연결과-검색등록.md) — 가비아 DNS, Vercel 도메인, 검색 등록, 트래킹
- [docs/이메일-발송-설정.md](docs/이메일-발송-설정.md) — 커스텀 SMTP, SPF·DKIM·DMARC
- [supabase/email-templates/README.md](supabase/email-templates/README.md) — 인증 메일 문안

- 메타데이터·OG·sitemap·robots·JSON-LD는 모두 `src/lib/seo.ts` 한 곳을 봅니다.
- OG 카드는 `app/opengraph-image.tsx`가 빌드 시 생성합니다(한글 렌더링을 위해 Pretendard를 내려받고, 실패하면 라틴 문자로 대체).
- 로그인 이후 화면은 `robots: noindex`와 `robots.txt` 양쪽으로 막습니다.
- 트래킹은 환경변수가 있을 때만, **프로덕션 빌드에서만** 삽입됩니다. 광고용 저장소는 기본 거부입니다.
- Vercel 프리뷰 배포는 자동으로 색인 차단됩니다(중복 색인 방지).

## 데이터베이스

`supabase/` 아래 스키마와 마이그레이션이 순서대로 있습니다.

```
schema.sql → 002-manager-review.sql → 003-profile-role-lock.sql → 004-seed.sql → 005-vault-and-team.sql
           → 006-submission-evidence.sql → 007-onboarding-team-read.sql → 008-completion.sql
           → 010-kstartup-announcements.sql → 011-calendar-announcement-link.sql
           → 012-comment-attachments.sql → 013-real-announcement-deadlines.sql
           → 014-capstone-course.sql → 015-enable-legacy-rls.sql
           → 016-course-membership.sql → 017-intro-board.sql → 018-proposal-files.sql
           → 019-course-notices.sql → 020-proposals-staff-only.sql
           → 021-board-guides.sql → 022-staff-badge.sql
           → 023-comment-edit.sql → 024-deliverable-files.sql
           → 025-course-members.sql → 026-team-confirm-and-qna.sql
```

`015`는 **반드시 적용해야 합니다.** `schema.sql`의 RLS 활성화 블록이 `ALTER TABLE IF EXISTS`
형태로 `CREATE TABLE`보다 **먼저** 있어서, 새 프로젝트에서는 조용히 no-op이 되고 그 뒤 만들어진
레거시 테이블 8개(`profiles`·`semester_profiles`·`recruitment_posts`·`recruitment_post_comments`·
`notifications`·`team_registrations`·`corporate_proposals`·`videos`)가 RLS 꺼진 채 남았습니다.
그 아래 정의된 정책이 전부 무효라, 브라우저 번들에 들어 있는 anon 키만으로 남의 이름으로 글을
쓰고 지울 수 있었습니다(실측 확인). `015`가 RLS를 실제로 켭니다.

RLS를 켜면 가입 직후(이메일 인증 전, 세션 없음) 브라우저의 `profiles` INSERT가 막히므로,
`015`는 `auth.users` 트리거로 프로필 생성 경로를 먼저 세우고 기존 계정을 백필합니다.

`schema.sql`도 함께 고쳤습니다 — ENABLE 블록을 `CREATE TABLE` 뒤로 옮기고 `IF EXISTS`를 뗐습니다.
순서가 어긋나면 조용히 넘어가는 대신 실패합니다.

`014`는 과목 게시판(`/course`)을 엽니다. 팀빌딩 모집·기업 제안·확정 팀은 `schema.sql`에 이미
있던 테이블(`recruitment_posts`·`corporate_proposals`·`team_registrations`)을 그대로 쓰고,
결과물(`team_deliverables`)과 네 게시판 공용 댓글(`course_comments`)만 새로 만듭니다.
같은 파일에서 기존 INSERT 정책도 고칩니다 — 이전에는 로그인만 하면 `author_id`에 남의
UUID를 넣어 다른 학생 이름으로 글을 올릴 수 있었습니다.

`016`은 과목 데이터 **쓰기**를 한양대 메일 인증 계정으로 제한합니다(`is_course_member()`).
경계를 "가입"이 아니라 "쓰기"에 두는 이유: `supabase.auth.signUp`은 브라우저가 anon 키로
직접 부르는 호출이라 회원가입 화면의 도메인 검사는 우회할 수 있고, StartUp Pilot 쪽
`/signup`으로 아무 메일이나 가입해 그 계정을 쓸 수도 있기 때문입니다. 읽기는 계속 공개입니다.

도메인 규칙은 프런트엔드(`isCourseEmail`)와 DB(`is_course_member()`)가 같은 모양을 씁니다.
`hanyang.ac.kr`로 **끝나는지**만 보면 `evil-hanyang.ac.kr`이 통과하므로 양쪽 다 앞뒤를 잠급니다.
바꿀 때는 두 곳을 함께 고치고 `course.test.ts`의 위장 주소 케이스를 확인하세요.

`017`은 자기소개 게시판을 엽니다. 새 테이블이 없습니다 — 자기소개는 `semester_profiles`
그대로이며, 지금까지 본인 워크스페이스에서만 보이던 것을 게시판으로 여는 일입니다.
이 파일은 댓글 대상(`course_comments.board`)에 `intro`를 더하고 삭제 연동 트리거만 붙입니다.

`018`은 기업 제안에 첨부파일을 붙입니다. `course` 공개 버킷과 `proposal_files` 목록을
만듭니다. 공개 버킷인 이유는 제안 게시판이 로그인 없이 읽히기 때문입니다 — 첨부만
비공개로 두면 비로그인 학생에게는 "파일 있음"만 보이고 열리지 않습니다.
올리기는 제안 작성자만, 지우기는 올린 사람만 가능합니다.

`019`는 수업게시판(공지)을 엽니다. 다른 게시판과 다른 점은 **쓰는 사람이 정해져 있다는 것**
하나입니다 — `course_staff` 명단에 있고 메일 인증을 마친 계정만 씁니다(`is_course_staff()`).
읽기는 다른 게시판과 같이 공개입니다. 조교를 추가할 때는 마이그레이션 없이 한 줄이면 됩니다.

```sql
INSERT INTO course_staff (email, note) VALUES ('조교메일@hanyang.ac.kr', '조교')
ON CONFLICT (email) DO NOTHING;
```

`020`은 기업 제안을 운영진 전용으로 좁힙니다. 수강생은 **댓글로 신청**하며, 댓글 정책은
그대로라 읽고 쓰는 데 제약이 없습니다. 수정·삭제를 작성자 본인이 아니라 운영진 전체에게
여는 것은 공지와 같은 이유입니다 — 교수님이 올린 제안의 마감일을 조교가 못 고치면 곤란합니다.

`021`은 게시판마다 맨 위에 붙는 안내(`course_board_guides`)를 엽니다. 게시판당 한 장이고
운영진만 씁니다. 같은 파일에서 `proposal_files`를 `course_files`로 넓혀 제안과 안내가
한 표를 씁니다 — 주인이 둘이 되므로 `num_nonnulls(proposal_id, guide_id) = 1` 제약으로
정확히 하나만 채워지게 묶고, 외래키를 살려 원본이 지워질 때 첨부도 함께 사라지게 합니다.

게시판 이름표(`팀원모집`·`팀등록`)와 순서는 `course.ts`의 `BOARDS`·`BOARD_ORDER`가 정합니다.
**주소(`/course/recruit`, `/course/team`)는 이름표와 무관하게 고정입니다** — 이름이 바뀌었다고
주소까지 바꾸면 이미 공유된 링크가 전부 깨집니다.

`022`는 운영진을 화면에서 알아볼 수 있게 합니다. `is_course_staff()`는 "나는 운영진인가"만
답하므로, 남이 쓴 글에 [교수자] 뱃지를 붙이려면 `course_staff_ids()`가 따로 필요합니다.
**id만 돌려주고 메일 주소는 주지 않습니다** — 명단을 열면 교수·조교 주소가 그대로 수집됩니다.

`023`은 댓글 수정을 엽니다. `updated_at`을 따로 남기고 화면이 "수정됨"을 붙입니다 —
표시 없이 조용히 바뀌면 그 댓글을 근거로 하던 대화가 어긋납니다. UPDATE 정책에 `WITH CHECK`를
걸어 본문만 바꿀 수 있게 합니다(board·target_id를 바꾸면 댓글이 다른 글로 옮겨 갑니다).

`024`는 결과물에도 첨부를 붙입니다. 첨부 주인이 셋(제안·안내·결과물)이 되지만 표는 계속
하나이고, exclusive arc에 컬럼만 더합니다. **권한은 주인별로 갈립니다** — 제안·안내는
운영진이 쓰고 결과물은 팀장이 씁니다. 021의 정책을 그대로 두면 팀장이 자기 팀 결과물에
파일을 못 붙입니다.

`025`는 수강생 명단(`/course/members`, 운영진 전용)과 차단을 엽니다.

**강퇴를 계정 삭제로 만들지 않았습니다.** 계정을 지우면 그 사람이 올린 모집글·팀 명단·
결과물·댓글이 함께 사라지고 되돌릴 수 없습니다. 대신 `course_bans`에 넣어 **쓰기만** 막고
남긴 글은 그대로 둡니다. 판정은 `is_course_member()` 한 곳만 고쳐서, 모든 쓰기 정책이
함께 막힙니다 — 정책마다 조건을 복사했다면 하나를 빠뜨렸을 것입니다.

`course_members()`는 `auth.users`를 읽어야 해서 SECURITY DEFINER인데, 그러면 누가 부르든
통과하므로 **함수 안에서 직접 운영진인지 확인합니다.** 이 검사가 없으면 anon 키만으로
전교생 메일 주소가 털립니다.

`026`은 팀등록 확정과 Q&A 게시판을 엽니다.

**팀번호는 확정할 때 DB가 붙입니다**(`confirm_team()`). 등록 순서로 미리 매기면 취소하는 팀
때문에 번호가 비고, 두 사람이 동시에 확정하면 같은 번호가 나옵니다. 확정된 팀은 학생이 더
고칠 수 없습니다 — 확정의 의미가 "이 명단으로 간다"인데 그 뒤에도 바뀌면 뽑아 둔 파일과
어긋납니다. 운영진은 계속 고칠 수 있습니다(오탈자 정정).

명단은 **CSV로 내려받습니다**(팀번호·팀명·팀원이름·역할·학과·학번·비고). `.xlsx` 라이브러리를
들이지 않고도 엑셀이 그대로 엽니다. 다만 **BOM이 없으면 한글이 깨지므로** 파일을 만들 때 붙입니다.

Q&A 답변은 기존 댓글이 맡습니다 — 질문마다 답변 표를 따로 두면 댓글과 두 벌이 됩니다.
새 질문 알림 메일은 `/api/course/notify-question`이 보내며, `RESEND_API_KEY`가 없으면
조용히 건너뜁니다(알림 때문에 질문 등록이 실패하면 본말이 뒤집힙니다).

학기는 코드 상수 하나(`src/features/course/course.ts`의 `COURSE`)가 정합니다.
다음 학기를 열 때 이 값을 바꾸면 새 글은 새 `semester_key`로 쌓이고 지난 학기 글은 그대로 남습니다.

### 과목 영역 분리

과목 페이지는 StartUp Pilot과 섞이지 않습니다. 랜딩·푸터·역할 선택 화면에 과목 링크를 두지
않고, 인증도 `/course/login`·`/course/signup`을 따로 씁니다. `app/course/layout.tsx`가 제목
템플릿과 발행자를 과목 것으로 덮어쓰며, StartUp Pilot의 JSON-LD(`SiteStructuredData`)는 루트
레이아웃이 아니라 해당 제품의 공개 화면 다섯 곳에서만 선언합니다 — 루트에 두면 과목 페이지까지
"이 페이지는 StartUp Pilot"이라고 검색엔진에 말하게 됩니다.

`007`은 반드시 적용해야 합니다. 없으면 가입 후 온보딩 마지막 단계가 항상 실패합니다.

`009-refresh-seed-deadlines.sql`은 **폐기**되었습니다(전체 주석 처리). `013`이 임시 마감일을
없애고 일정의 출처를 K-Startup 실공고로 옮겼는데, `009`는 그 임시 날짜를 다시 채우던 스크립트입니다.

`013`은 `programs.deadline`을 비웁니다. 지원사업 마감일은 이제 `kstartup_announcements`에서
사업명으로 찾아 씁니다 — 접수 중인 공고가 없으면 날짜를 지어내지 않고 "접수 중인 공고 없음"으로 표시됩니다.
따라서 `010` 적용과 공고 동기화가 선행되어야 대시보드·캘린더에 마감이 나타납니다.

인증 메일 문안은 코드가 아니라 Supabase 프로젝트 설정에 있습니다 → `supabase/email-templates/README.md`

`startup-workspace.rls.test.sql`은 역할별 접근 분리를 검증합니다.
매니저에게 열리는 증빙은 "검토 요청된 건에 첨부된 파일"뿐이라는 불변식을 함께 확인합니다.

## 판정의 성격

자격 진단·사업비 판정·계산기 결과는 모두 **참고용**입니다. 최종 기준은 각 사업 공고문과 관리지침이며,
승인·반려의 최종 결정 권한은 주관기관 담당자에게 있습니다. 화면의 모든 판정에는 근거 조항을 함께 표시합니다.
