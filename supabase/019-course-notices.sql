-- 수업게시판(공지). 018 다음에 실행합니다.
--
-- 지금까지 "3주차 팀 확정 마감", "중간발표 순서" 같은 안내를 올릴 자리가 없어서
-- 카톡으로 흩어졌습니다. 게시판을 다섯 개 만들어 둔 의미가 반감되는 지점이었습니다.
--
-- 다른 게시판과 다른 점은 하나뿐입니다 — **쓰는 사람이 정해져 있습니다.**
-- 읽기는 다른 게시판과 같이 공개입니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 운영진

-- 함수 안에 메일 주소를 박지 않고 테이블로 둡니다. 학기 중에 조교가 추가되는 일이
-- 흔한데, 그때마다 마이그레이션을 쓰는 대신 대시보드에서 한 줄 넣으면 끝나야 합니다.
CREATE TABLE IF NOT EXISTS course_staff (
  email TEXT PRIMARY KEY CHECK (email = lower(trim(email))),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE course_staff ENABLE ROW LEVEL SECURITY;

-- 명단 자체는 공개하지 않습니다. 누가 운영진인지는 공지 작성자 이름으로 드러나면 충분하고,
-- 목록을 열어 두면 메일 주소가 그대로 수집됩니다. 추가·삭제는 대시보드에서만 합니다.
DROP POLICY IF EXISTS "nobody reads staff list" ON course_staff;

INSERT INTO course_staff (email, note)
VALUES ('kumslim@hanyang.ac.kr', '담당 교수')
ON CONFLICT (email) DO NOTHING;

/*
 * 이 계정이 과목 운영진인가.
 *
 * `is_course_member()`(016)와 같은 방식입니다 — auth.users는 anon에게 보이지 않으므로
 * SECURITY DEFINER로 읽고, 메일 인증을 마친 계정만 인정합니다. 인증을 함께 보지 않으면
 * 교수님 메일 주소를 적어 가입한 사람이 공지를 올릴 수 있습니다.
 *
 * 대소문자를 접어서 비교합니다. 가입할 때 대문자로 입력하면 명단과 어긋납니다.
 */
CREATE OR REPLACE FUNCTION is_course_staff()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN course_staff s ON s.email = lower(trim(u.email))
    WHERE u.id = auth.uid() AND u.email_confirmed_at IS NOT NULL
  );
$$;

-- 화면이 "왜 공지 쓰기 버튼이 없는지"를 설명할 수 있어야 합니다.
GRANT EXECUTE ON FUNCTION is_course_staff() TO anon, authenticated;

-- ---------------------------------------------------------------- 2) 공지

CREATE TABLE IF NOT EXISTS course_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_key TEXT NOT NULL,
  academic_year INTEGER,
  academic_term TEXT,
  course_track TEXT,
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  -- 마감·발표 순서처럼 학기 내내 위에 있어야 하는 공지가 있습니다.
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS course_notices_semester_idx
  ON course_notices (semester_key, is_pinned DESC, created_at DESC);

ALTER TABLE course_notices ENABLE ROW LEVEL SECURITY;

-- 공지는 읽으라고 있는 것이라 로그인 없이 열립니다.
DROP POLICY IF EXISTS "Public notices are viewable by everyone" ON course_notices;
CREATE POLICY "Public notices are viewable by everyone" ON course_notices
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Staff write notices" ON course_notices;
CREATE POLICY "Staff write notices" ON course_notices
  FOR INSERT WITH CHECK (created_by = auth.uid() AND is_course_staff());

-- 수정·삭제는 운영진이면 누구나 가능합니다. 작성자 본인으로 묶지 않는 이유는,
-- 교수님이 올린 공지의 오타를 조교가 고칠 수 없으면 곤란하기 때문입니다.
DROP POLICY IF EXISTS "Staff update notices" ON course_notices;
CREATE POLICY "Staff update notices" ON course_notices
  FOR UPDATE USING (is_course_staff());

DROP POLICY IF EXISTS "Staff delete notices" ON course_notices;
CREATE POLICY "Staff delete notices" ON course_notices
  FOR DELETE USING (is_course_staff());

-- ---------------------------------------------------------------- 3) 댓글

-- 공지에도 질문이 달립니다("발표 순서 바뀌었나요?").
ALTER TABLE course_comments DROP CONSTRAINT IF EXISTS course_comments_board_check;
ALTER TABLE course_comments ADD CONSTRAINT course_comments_board_check
  CHECK (board IN ('notice', 'intro', 'recruit', 'proposal', 'team', 'showcase'));

DROP TRIGGER IF EXISTS course_notices_delete_comments ON course_notices;
CREATE TRIGGER course_notices_delete_comments AFTER DELETE ON course_notices
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('notice');

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------- 4) 조교 추가하는 법
--
-- 학기 중에 조교가 생기면 아래 한 줄이면 됩니다. 메일은 소문자로 넣어 주세요.
--
--   INSERT INTO course_staff (email, note) VALUES ('조교메일@hanyang.ac.kr', '조교')
--   ON CONFLICT (email) DO NOTHING;
--
-- 빼는 것도 한 줄입니다. 이미 올린 공지는 남습니다.
--
--   DELETE FROM course_staff WHERE email = '조교메일@hanyang.ac.kr';
