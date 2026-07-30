-- StartUp Pilot — 온보딩이 첫 팀을 만들지 못하던 문제 수정.
-- 006 이후에 실행합니다. 재실행해도 안전합니다.
--
-- 증상: 가입 후 팀 정보를 모두 입력하고 마지막 버튼을 누르면 실패했습니다.
--
-- 원인: prep_teams의 SELECT 정책이 `is_prep_team_member(id)` 하나뿐이었습니다.
--   온보딩은 (1) 팀 INSERT → (2) 멤버 INSERT 순서로 진행되므로, (1)의 시점에는
--   아직 멤버가 아니어서 방금 만든 행을 읽을 수 없습니다.
--   PostgreSQL은 INSERT ... RETURNING 에 SELECT 정책까지 적용하기 때문에,
--   앱의 `.insert(...).select("id").single()` 가 항상 거부되었습니다.
--   (RETURNING 없는 INSERT는 통과했으므로 쓰기 권한 문제가 아니었습니다.)
--
-- 수정: 팀을 만든 리더는 멤버 행이 생기기 전에도 자기 팀을 읽을 수 있어야 합니다.
--   leader_id는 리더 자신이므로 열람 범위가 넓어지지 않습니다.
--   멤버 행이 유실된 팀도 리더가 다시 찾을 수 있어, 온보딩을 재시도할 때
--   빈 팀이 계속 쌓이지 않습니다.
DROP POLICY IF EXISTS "leaders read own preparation teams" ON prep_teams;
CREATE POLICY "leaders read own preparation teams" ON prep_teams
  FOR SELECT USING (leader_id = auth.uid());

-- prep_teams에는 UPDATE 정책이 아예 없어, 리더도 팀 이름·아이템 소개를 고칠 수 없었습니다.
-- 온보딩을 다시 완료할 때 방금 입력한 값이 조용히 무시되던 이유이기도 합니다.
-- 범위는 자기 팀으로 한정하고, leader_id는 옮기지 못하게 막아 팀 탈취를 방지합니다.
DROP POLICY IF EXISTS "leaders update own preparation teams" ON prep_teams;
CREATE POLICY "leaders update own preparation teams" ON prep_teams
  FOR UPDATE USING (leader_id = auth.uid()) WITH CHECK (leader_id = auth.uid());
