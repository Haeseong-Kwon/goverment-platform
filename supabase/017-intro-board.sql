-- 자기소개 게시판. 016 다음에 실행합니다.
--
-- 새 테이블이 없습니다. 자기소개는 이미 `semester_profiles`에 있고(014·016에서 정책까지
-- 정리했습니다), 지금까지 본인 워크스페이스에서만 보이던 것을 게시판으로 여는 일입니다.
-- 팀빌딩은 양방향입니다 — 모집글은 "팀이 사람을 찾는" 쪽이고, 자기소개는 "사람이 팀을
-- 찾는" 쪽입니다. 한쪽만 있으면 아직 아이디어가 없는 학생은 올릴 곳이 없습니다.
--
-- 그래서 이 파일이 하는 일은 두 가지뿐입니다.
--   1) 댓글이 자기소개에도 달릴 수 있게 board 값에 'intro' 추가
--   2) 자기소개가 지워지면 달린 댓글도 함께 지우는 트리거
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 댓글 대상 확장

-- CHECK 제약은 값 목록을 바꿀 때 통째로 갈아 끼웁니다. 기존 행은 네 값 중 하나이므로
-- 새 제약(다섯 값)을 어기지 않습니다 — 검증 실패 없이 지나갑니다.
ALTER TABLE course_comments DROP CONSTRAINT IF EXISTS course_comments_board_check;
ALTER TABLE course_comments ADD CONSTRAINT course_comments_board_check
  CHECK (board IN ('intro', 'recruit', 'proposal', 'team', 'showcase'));

-- ---------------------------------------------------------------- 2) 삭제 연동

-- target_id에는 외래키를 걸 수 없어(대상 테이블이 다섯) 014와 같은 방식으로 트리거가
-- ON DELETE CASCADE 역할을 합니다. 이게 없으면 자기소개를 지운 뒤 댓글이 주인 없이 남고,
-- 나중에 같은 UUID가 재사용될 일은 없지만 조회할 때마다 세는 대상이 됩니다.
DROP TRIGGER IF EXISTS semester_profiles_delete_comments ON semester_profiles;
CREATE TRIGGER semester_profiles_delete_comments AFTER DELETE ON semester_profiles
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('intro');

NOTIFY pgrst, 'reload schema';
