# 마이그레이션 검증 하네스

운영 DB에 손대기 전에, 일회용 Postgres에 마이그레이션 전체를 적용하고
RPC·RLS가 의도대로 동작하는지 확인합니다.

Supabase 인스턴스가 필요 없습니다. Docker만 있으면 됩니다.

## 실행

```bash
docker run -d --name pgcheck -e POSTGRES_PASSWORD=x -e POSTGRES_DB=app postgres:16-alpine

# 초기화가 끝나기를 기다립니다. pg_isready만 보면 init 단계의 임시 서버에 붙어
# 적용한 스키마가 재시작과 함께 사라집니다.
until docker logs pgcheck 2>&1 | grep -q "database system is ready to accept connections"; do sleep 1; done
until docker logs pgcheck 2>&1 | grep -q "init process complete"; do sleep 1; done
until docker exec pgcheck pg_isready -U postgres -d app >/dev/null 2>&1; do sleep 1; done

for f in verify/00-supabase-shim.sql schema.sql 002-manager-review.sql 003-profile-role-lock.sql \
         005-vault-and-team.sql 006-submission-evidence.sql 007-onboarding-team-read.sql \
         008-completion.sql verify/01-scenario.sql; do
  docker cp "supabase/$f" pgcheck:/tmp/
  echo "=== $f ==="
  docker exec pgcheck psql -U postgres -d app -v ON_ERROR_STOP=1 -f "/tmp/$(basename $f)"
done

docker rm -f pgcheck
```

`ERROR`가 하나도 없고 시나리오 13개가 기대값을 내면 통과입니다.

## 무엇을 확인하나

`00-supabase-shim.sql` — Supabase가 기본 제공하는 것들(`auth.users`, `auth.uid()`,
`auth.role()`, `storage.*`, `authenticated`/`anon` 롤)의 최소 대역품입니다.
동작을 흉내 내지 않고, 마이그레이션이 참조하는 이름만 채웁니다.

`01-scenario.sql` — 실제 사용자 역할로 전환해 가며 13가지를 검사합니다.

| # | 검사 | 기대 |
|---|---|---|
| 1 | 매니저가 전환 코드 발급 | 8자 코드 |
| 2 | 창업자가 전환 코드 발급 | `MANAGER_ROLE_REQUIRED` 거부 |
| 3 | 매니저가 검토 착수 | `validated` → `in_review` |
| 4 | 검토 착수 두 번 | 멱등, 상태 유지 |
| 5 | 외부인이 검토 착수 | 거부 |
| 6 | 팀원이 비목 배정액 등록·조회 | 성공 |
| 7 | 외부인이 남의 배정액 조회 | 0건 |
| 8 | 해당 기관 매니저가 배정액 조회 | 1건 |
| 9 | 비로그인이 자료실 조회 | 7건 |
| 10 | 비로그인이 동의 후 리드 남김 | 성공 |
| 11 | 동의 없이 리드 | 거부 |
| 12 | 팀원이 담당자 지정·코멘트 | 성공 |
| 13 | 매니저가 팀 할 일·코멘트 조회 | **0건** (준비 데이터 비공개) |

13번이 이 제품의 핵심 약속입니다. 값이 0이 아니면 RLS가 새고 있는 것이므로
배포하지 마세요.

## 주의

시나리오는 테스트 데이터를 만듭니다. **일회용 컨테이너에서만 실행하세요.**
운영 DB에 절대 돌리지 마세요.
