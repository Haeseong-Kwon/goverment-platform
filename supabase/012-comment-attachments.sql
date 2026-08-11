-- 일정 코멘트에 붙는 파일 첨부.
--
-- 지금까지 코멘트는 글자만 남길 수 있어서 "사업계획서 3판 검토 부탁드립니다" 다음에
-- 정작 그 파일이 어디 있는지는 카톡·메일로 흩어졌습니다. 코멘트가 붙은 업무 옆에
-- 파일도 함께 남겨 한 곳에서 끝냅니다.
--
-- 새 버킷을 만들지 않고 `vault`를 그대로 씁니다. vault의 storage 정책은 경로의 첫
-- 세그먼트가 팀 UUID인지로 접근을 가릅니다(005). 첨부 경로를
-- `{prep_team_id}/comments/{comment_id}/{파일명}`으로 두면 같은 정책이 그대로 적용돼
-- 팀 밖 사람은 서명 링크조차 만들지 못합니다.
--
-- vault_documents에 얹지 않는 이유: 그 테이블은 folder가 세 값으로 고정된 보관함이고,
-- 버전 유니크 제약(팀·폴더·파일명·버전)이 걸려 있습니다. 코멘트 첨부는 버전 관리 대상이
-- 아니라 그 코멘트에 종속된 부속물이라, 코멘트가 지워지면 함께 사라져야 합니다.
CREATE TABLE IF NOT EXISTS task_comment_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (char_length(trim(file_name)) > 0),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 코멘트 스레드는 항상 "이 코멘트의 첨부 전부"로 읽습니다.
CREATE INDEX IF NOT EXISTS task_comment_files_comment_idx ON task_comment_files (comment_id);

ALTER TABLE task_comment_files ENABLE ROW LEVEL SECURITY;

-- 권한은 코멘트가 달린 업무의 팀 소속으로 판단합니다. 코멘트 본문 정책과 같은 기준이라
-- "코멘트는 보이는데 첨부만 안 보이는" 어긋남이 생기지 않습니다.
DROP POLICY IF EXISTS "team members read comment files" ON task_comment_files;
CREATE POLICY "team members read comment files" ON task_comment_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_comments c
      JOIN workspace_tasks t ON t.id = c.task_id
      WHERE c.id = comment_id AND is_prep_team_member(t.prep_team_id)
    )
  );

DROP POLICY IF EXISTS "team members create comment files" ON task_comment_files;
CREATE POLICY "team members create comment files" ON task_comment_files
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_comments c
      JOIN workspace_tasks t ON t.id = c.task_id
      WHERE c.id = comment_id AND is_prep_team_member(t.prep_team_id)
    )
  );

-- PostgREST는 테이블 관계를 캐시해 두고 씁니다. 새 테이블을 만들어도 캐시를 갱신하지
-- 않으면 코멘트 스레드가 아래 오류로 통째로 실패합니다(첨부만 빠지는 게 아닙니다):
--   Could not find a relationship between 'task_comments' and 'task_comment_files'
--   in the schema cache
-- 자동 갱신은 몇 분 걸릴 수 있어 명시적으로 알립니다.
NOTIFY pgrst, 'reload schema';
