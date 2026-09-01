-- 댓글 수정. 022 다음에 실행합니다.
--
-- 지금 댓글은 지우는 것만 됩니다(016). 오타 하나를 고치려면 지우고 다시 써야 하는데,
-- 모집글에서는 댓글이 곧 지원이라 순서가 뒤엉키고 답글 맥락이 끊깁니다.
--
-- 수정 시각을 따로 남깁니다. 표시 없이 조용히 바뀌면, 그 댓글을 근거로 이야기하던
-- 대화가 어긋납니다("아까는 백엔드라면서요"). 화면은 이 값이 작성 시각보다 나중일 때
-- "수정됨"을 붙입니다.
--
-- 재실행해도 안전합니다.

ALTER TABLE course_comments
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 본문만 고칠 수 있습니다. board·target_id를 바꾸면 댓글이 다른 글로 옮겨 가는데,
-- 그건 수정이 아니라 위조입니다. WITH CHECK로 대상이 그대로인지 확인합니다.
DROP POLICY IF EXISTS "Authors update their course comments" ON course_comments;
CREATE POLICY "Authors update their course comments" ON course_comments
  FOR UPDATE
  USING (auth.uid() = author_id AND is_course_member())
  WITH CHECK (auth.uid() = author_id);

NOTIFY pgrst, 'reload schema';
