-- 팀등록 확정 + Q&A 게시판. 025 다음에 실행합니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 팀 확정

-- 팀번호는 확정할 때 붙입니다. 등록 순서로 미리 매기면 중간에 취소하는 팀 때문에
-- 번호가 비고, 명단을 뽑을 때마다 달라집니다.
ALTER TABLE team_registrations ADD COLUMN IF NOT EXISTS team_no INTEGER;
ALTER TABLE team_registrations ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;
ALTER TABLE team_registrations ADD COLUMN IF NOT EXISTS confirmed_by UUID REFERENCES auth.users(id);

-- 같은 학기 안에서 번호가 겹치면 명단이 뒤엉킵니다.
CREATE UNIQUE INDEX IF NOT EXISTS team_registrations_no_idx
  ON team_registrations (semester_key, team_no) WHERE team_no IS NOT NULL;

/*
 * 확정.
 *
 * 번호는 그 학기의 다음 번호를 붙입니다. 이미 확정된 팀을 다시 부르면 번호를
 * 그대로 두고 넘어갑니다 — 재확정으로 번호가 바뀌면 이미 배포한 명단과 어긋납니다.
 *
 * SECURITY DEFINER인 이유: 번호를 매기려면 다른 팀의 번호를 읽어야 하는데,
 * 그 판단을 클라이언트에 맡기면 두 사람이 동시에 확정할 때 같은 번호가 나옵니다.
 */
CREATE OR REPLACE FUNCTION confirm_team(target UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  existing INTEGER;
  next_no INTEGER;
  team_semester TEXT;
BEGIN
  IF NOT is_course_staff() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = '과목 운영진만 확정할 수 있습니다.';
  END IF;

  SELECT team_no, semester_key INTO existing, team_semester
  FROM team_registrations WHERE id = target FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TEAM_NOT_FOUND';
  END IF;
  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  SELECT COALESCE(MAX(team_no), 0) + 1 INTO next_no
  FROM team_registrations WHERE semester_key = team_semester;

  UPDATE team_registrations
  SET team_no = next_no, confirmed_at = now(), confirmed_by = auth.uid(), updated_at = now()
  WHERE id = target;

  RETURN next_no;
END;
$$;

GRANT EXECUTE ON FUNCTION confirm_team(UUID) TO authenticated;

/*
 * 확정 해제. 번호를 비웁니다.
 *
 * 비운 번호는 다시 쓰지 않습니다(MAX+1로 매기므로). 명단을 이미 배포한 뒤에
 * 번호가 재사용되면 같은 번호의 다른 팀이 생깁니다.
 */
CREATE OR REPLACE FUNCTION unconfirm_team(target UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT is_course_staff() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = '과목 운영진만 해제할 수 있습니다.';
  END IF;
  UPDATE team_registrations
  SET team_no = NULL, confirmed_at = NULL, confirmed_by = NULL, updated_at = now()
  WHERE id = target;
END;
$$;

GRANT EXECUTE ON FUNCTION unconfirm_team(UUID) TO authenticated;

-- 확정된 팀은 학생이 못 고칩니다. 확정의 의미가 "이 명단으로 간다"인데
-- 그 뒤에도 팀장이 팀원을 바꿀 수 있으면 교수님이 뽑은 파일과 어긋납니다.
-- 운영진은 계속 고칠 수 있습니다(오탈자 정정).
DROP POLICY IF EXISTS "Leaders update their team registrations" ON team_registrations;
CREATE POLICY "Leaders update their team registrations" ON team_registrations
  FOR UPDATE USING (
    is_course_staff()
    OR (auth.uid() = leader_id AND is_course_member() AND confirmed_at IS NULL)
  );

DROP POLICY IF EXISTS "Leaders delete their team registrations" ON team_registrations;
CREATE POLICY "Leaders delete their team registrations" ON team_registrations
  FOR DELETE USING (
    is_course_staff()
    OR (auth.uid() = leader_id AND is_course_member() AND confirmed_at IS NULL)
  );

-- ---------------------------------------------------------------- 2) Q&A

-- 학생이 묻고 운영진·다른 학생이 답합니다. 답변은 댓글이 그대로 맡습니다 —
-- 질문마다 답변 표를 따로 두면 이미 있는 댓글과 두 벌이 됩니다.
CREATE TABLE IF NOT EXISTS course_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_key TEXT NOT NULL,
  academic_year INTEGER,
  academic_term TEXT,
  course_track TEXT,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  -- 운영진이 답을 달고 나면 표시합니다. 목록에서 "아직 답 없는 질문"을 골라내는 값입니다.
  answered_at TIMESTAMPTZ,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS course_questions_semester_idx
  ON course_questions (semester_key, created_at DESC);

ALTER TABLE course_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public questions are viewable by everyone" ON course_questions;
CREATE POLICY "Public questions are viewable by everyone" ON course_questions
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Members ask questions" ON course_questions;
CREATE POLICY "Members ask questions" ON course_questions
  FOR INSERT WITH CHECK (author_id = auth.uid() AND is_course_member());

-- 질문자는 자기 질문을 고치고 지울 수 있고, 운영진은 답변 표시를 위해 갱신할 수 있습니다.
DROP POLICY IF EXISTS "Authors update questions" ON course_questions;
CREATE POLICY "Authors update questions" ON course_questions
  FOR UPDATE USING (is_course_staff() OR (auth.uid() = author_id AND is_course_member()));

DROP POLICY IF EXISTS "Authors delete questions" ON course_questions;
CREATE POLICY "Authors delete questions" ON course_questions
  FOR DELETE USING (is_course_staff() OR (auth.uid() = author_id AND is_course_member()));

-- 댓글이 답변입니다.
ALTER TABLE course_comments DROP CONSTRAINT IF EXISTS course_comments_board_check;
ALTER TABLE course_comments ADD CONSTRAINT course_comments_board_check
  CHECK (board IN ('notice', 'qna', 'intro', 'recruit', 'proposal', 'team', 'showcase'));

DROP TRIGGER IF EXISTS course_questions_delete_comments ON course_questions;
CREATE TRIGGER course_questions_delete_comments AFTER DELETE ON course_questions
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('qna');

-- 안내도 Q&A에 붙을 수 있게 합니다(021의 목록과 맞춰 둡니다).
ALTER TABLE course_board_guides DROP CONSTRAINT IF EXISTS course_board_guides_board_check;
ALTER TABLE course_board_guides ADD CONSTRAINT course_board_guides_board_check
  CHECK (board IN ('notice', 'qna', 'intro', 'recruit', 'proposal', 'team', 'showcase'));

NOTIFY pgrst, 'reload schema';
