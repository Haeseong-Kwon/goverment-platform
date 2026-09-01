-- 게시판별 안내. 020 다음에 실행합니다.
--
-- 각 게시판 맨 위에 "이 게시판은 이렇게 쓰세요"를 붙입니다. 지금은 게시판 설명이
-- 코드 상수라 학기 중에 바꿀 수 없고, 제출 형식이나 마감이 바뀌면 공지에 한 번 올리고
-- 끝입니다 — 정작 글을 쓰러 온 학생은 그 공지를 다시 찾아가지 않습니다.
--
-- 게시판당 한 장입니다. 여러 개 쌓이면 그건 안내가 아니라 공지 목록이고, 그건
-- 수업게시판(019)이 이미 합니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 안내

CREATE TABLE IF NOT EXISTS course_board_guides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_key TEXT NOT NULL,
  board TEXT NOT NULL CHECK (board IN ('notice', 'intro', 'recruit', 'proposal', 'team', 'showcase')),
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  updated_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  -- 게시판당 한 장. 두 번째 저장은 새 글이 아니라 갱신이어야 합니다.
  UNIQUE (semester_key, board)
);

ALTER TABLE course_board_guides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public board guides are viewable by everyone" ON course_board_guides;
CREATE POLICY "Public board guides are viewable by everyone" ON course_board_guides
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff write board guides" ON course_board_guides;
CREATE POLICY "Staff write board guides" ON course_board_guides
  FOR INSERT WITH CHECK (updated_by = auth.uid() AND is_course_staff());

DROP POLICY IF EXISTS "Staff update board guides" ON course_board_guides;
CREATE POLICY "Staff update board guides" ON course_board_guides
  FOR UPDATE USING (is_course_staff());

DROP POLICY IF EXISTS "Staff delete board guides" ON course_board_guides;
CREATE POLICY "Staff delete board guides" ON course_board_guides
  FOR DELETE USING (is_course_staff());

-- ---------------------------------------------------------------- 2) 첨부 일반화

-- 018의 `proposal_files`를 안내도 쓸 수 있게 넓힙니다.
--
-- 표를 하나 더 만들지 않는 이유: 첨부는 파일명·경로·크기·올린 사람으로 모양이 같고,
-- 표를 나누면 정책 두 벌·업로드 경로 두 벌을 계속 맞춰 줘야 합니다. 대신 주인이
-- 둘이 되므로, **둘 중 정확히 하나만** 채워지도록 제약을 겁니다(exclusive arc).
-- 이렇게 하면 외래키가 살아 있어 제안이나 안내가 지워질 때 첨부도 함께 사라집니다.
ALTER TABLE proposal_files RENAME TO course_files;

ALTER TABLE course_files ALTER COLUMN proposal_id DROP NOT NULL;
ALTER TABLE course_files ADD COLUMN IF NOT EXISTS guide_id UUID
  REFERENCES course_board_guides(id) ON DELETE CASCADE;

ALTER TABLE course_files DROP CONSTRAINT IF EXISTS course_files_one_owner;
ALTER TABLE course_files ADD CONSTRAINT course_files_one_owner
  CHECK (num_nonnulls(proposal_id, guide_id) = 1);

CREATE INDEX IF NOT EXISTS course_files_guide_idx ON course_files (guide_id, created_at);

-- 정책 이름도 표를 따라갑니다. 예전 이름으로 남으면 다음 사람이 어느 표의 정책인지 헷갈립니다.
DROP POLICY IF EXISTS "Public proposal files are viewable by everyone" ON course_files;
DROP POLICY IF EXISTS "Proposal authors add files" ON course_files;
DROP POLICY IF EXISTS "Proposal authors delete files" ON course_files;

DROP POLICY IF EXISTS "Public course files are viewable by everyone" ON course_files;
CREATE POLICY "Public course files are viewable by everyone" ON course_files
  FOR SELECT USING (true);

-- 제안도 안내도 운영진 게시판입니다(020·021). 첨부 기준을 같이 둡니다.
DROP POLICY IF EXISTS "Staff add course files" ON course_files;
CREATE POLICY "Staff add course files" ON course_files
  FOR INSERT WITH CHECK (created_by = auth.uid() AND is_course_staff());

DROP POLICY IF EXISTS "Staff delete course files" ON course_files;
CREATE POLICY "Staff delete course files" ON course_files
  FOR DELETE USING (is_course_staff());

NOTIFY pgrst, 'reload schema';
