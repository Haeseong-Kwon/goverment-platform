# 인증 메일 템플릿

Supabase 기본 템플릿은 영문 한 줄("Follow this link to confirm your user")이라 제품과 어긋납니다.
이 폴더의 템플릿은 앱과 같은 색·서체·문구 규칙을 씁니다.

메일 템플릿은 코드가 아니라 **Supabase 프로젝트 설정**에 저장됩니다. 배포로 반영되지 않으므로
아래 절차대로 한 번 붙여 넣어야 합니다.

## 두 제품이 템플릿 하나를 나눠 씁니다

템플릿은 프로젝트당 종류별로 **하나뿐**인데, 이 프로젝트에는 StartUp Pilot과
SW창업캡스톤디자인(과목)이 함께 들어 있습니다. 그래서 본문에서 가입 경로를 보고 가릅니다.

```
{{ if .Data.course }}  ...과목 문구...  {{ else }}  ...파일럿 문구...  {{ end }}
```

`course` 키는 과목 가입(`/course/signup` → `signUpViewer`)이 `user_metadata`에 남기는
표식입니다. 파일럿 가입에는 없으므로 자동으로 갈립니다. 메일 도메인으로 가르지 않는 이유는
한양대 메일을 쓰는 창업자가 파일럿에 가입할 수 있기 때문입니다.

**제목은 분기되지 않습니다.** 제목은 템플릿이 아니라 별도 설정값이라 Go Template이 돌지
않습니다. 그래서 양쪽에 다 맞는 중립 문구를 씁니다(아래 표).

## 적용 절차

Dashboard → **Authentication → Emails → Templates** 에서 해당 탭을 열고,
`Message body`를 파일 내용으로 교체한 뒤 제목을 아래와 같이 맞춥니다.

| 템플릿 | 파일 | 제목 |
|--------|------|------|
| Confirm signup | `confirm-signup.html` | `이메일 인증을 완료해 주세요` |
| Reset password | `reset-password.html` | `비밀번호 재설정 링크` |
| Change email address | `change-email.html` | `[StartUp Pilot] 이메일 주소 변경 확인` |

제목에 제품명을 넣지 않은 것은 실수가 아닙니다 — 위에 적었듯 제목은 분기되지 않아서,
`[StartUp Pilot]`을 붙이면 과목 학생의 받은편지함에도 그대로 찍힙니다. 제품명은 본문
첫 줄이 대신 말합니다. 이메일 주소 변경은 과목에서 쓰지 않아 파일럿 제목 그대로 둡니다.

앱이 보내지 않는 템플릿(Magic Link, Invite user, Reauthentication)은 건드리지 않아도 됩니다.

## 같이 확인해야 하는 설정 (이게 틀리면 메일은 예뻐도 링크가 깨집니다)

Dashboard → **Authentication → URL Configuration**

- **Site URL**: 배포 주소 (예: `https://startup-pilot.example.com`). `.env`의 `NEXT_PUBLIC_SITE_URL`과 같아야 합니다.
- **Redirect URLs**: 아래 두 경로가 허용목록에 있어야 합니다. 없으면 Supabase가 링크를
  Site URL 루트로 되돌려 보내고, 인증·재설정 흐름이 중간에 끊깁니다.
  - `https://<배포주소>/auth/callback` — 파일럿 가입 인증 (`signUp`의 `emailRedirectTo`)
  - `https://<배포주소>/auth/reset` — 비밀번호 재설정 (`resetPasswordForEmail`의 `redirectTo`)
  - `https://<배포주소>/course/auth/callback` — **과목 가입 인증** (`signUpViewer`의 `emailRedirectTo`).
    이게 빠지면 학생이 인증 링크를 눌러도 Site URL 루트로 튕겨 가입이 끝나지 않습니다.
  - 로컬 테스트가 필요하면 `http://localhost:3000/auth/callback`,
    `http://localhost:3000/auth/reset`, `http://localhost:3000/course/auth/callback` 도 추가합니다.

## 템플릿에서 쓴 변수

Supabase가 채워 주는 값입니다. 다른 이름을 쓰면 빈칸으로 렌더링됩니다.

| 변수 | 내용 |
|------|------|
| `{{ .ConfirmationURL }}` | 인증·재설정 링크 (redirect 설정이 반영된 최종 URL) |
| `{{ .Email }}` | 수신자 이메일 |
| `{{ .NewEmail }}` | 변경할 이메일 (Change email 전용) |
| `{{ .Data.full_name }}` | 가입 시 넘긴 이름. `signUp`의 `options.data.full_name`에서 옵니다 |
| `{{ .Data.course }}` | 과목 가입 표식(학기 키). 과목으로 가입한 계정에만 있습니다 → 본문 분기에 씁니다 |

`.Data`는 `auth.users.user_metadata`를 그대로 읽습니다. 조건문은 Go Template 문법이라
`{{ if .Data.course }}` · `{{ else }}` · `{{ end }}`가 그대로 동작합니다.

## 작성 규칙

메일 클라이언트는 웹과 다릅니다. 고쳐 쓸 때 아래를 지켜 주세요.

- **스타일은 전부 인라인.** Gmail·Outlook은 `<style>` 블록과 외부 CSS를 지웁니다.
- **레이아웃은 `<table>`.** flex·grid는 Outlook에서 무너집니다.
- **이미지 금지.** 이미지 차단이 기본인 환경에서 빈 칸만 남습니다. 로고도 텍스트로 씁니다.
- **버튼 옆에 전체 URL을 그대로 노출.** 버튼이 안 열리는 클라이언트가 있습니다.
- **만료 시간과 "요청하지 않았다면" 문장을 남깁니다.** 피싱 의심을 줄이고 오조작을 막습니다.
- 본문 폭은 560px. 모바일에서 가로 스크롤이 생기지 않는 상한입니다.
