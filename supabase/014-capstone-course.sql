-- 한양대학교 ERICA「SW창업캡스톤디자인」과목 게시판.
--
-- 새 테이블을 최소로만 만듭니다. 팀빌딩 모집(recruitment_posts), 기업제안
-- 프로젝트(corporate_proposals), 확정 팀(team_registrations)은 schema.sql에 이미
-- 있고 semester_key·academic_year·academic_term·course_track까지 갖춰져 있어
-- 그대로 씁니다. 여기서 더하는 것은 세 가지입니다.
--
--   1) 결과물 게시판(team_deliverables) — 중간/기말 산출물
--   2) 네 게시판이 공유하는 댓글(course_comments)
--   3) 글쓴이 본인만 수정·삭제할 수 있게 하는 정책
--
-- 3번은 기능이 아니라 구멍 메우기입니다. 기존 INSERT 정책이
-- `auth.role() = 'authenticated'`만 봐서, 로그인만 하면 author_id·leader_id에
-- 남의 UUID를 적어 남의 이름으로 글을 올릴 수 있었습니다. 학생들이 서로의
-- 모집글을 대신 쓸 수 있는 상태로 열 수는 없습니다.
--
-- 댓글 테이블을 게시판마다 두지 않고 하나로 둔 이유: 네 게시판의 댓글은 형태가
-- 같고(작성자·본문·시각), 화면도 한 컴포넌트를 씁니다. 테이블을 넷으로 쪼개면
-- 같은 정책 네 벌을 계속 맞춰 줘야 합니다. 대신 target_id에는 외래키를 걸 수
-- 없으므로(대상 테이블이 넷), 원본이 지워질 때 댓글을 지우는 일은 아래 트리거가
-- 대신합니다.
--
-- schema.sql의 recruitment_post_comments는 건드리지 않고 남겨 둡니다. 비어 있는
-- 옛 테이블이고, 지우는 것은 이 마이그레이션의 일이 아닙니다.

-- ---------------------------------------------------------------- 1) 소유자 컬럼

-- 기업제안은 학생이 아니라 기업·조교가 올립니다. 누가 올렸는지 남아야 수정·삭제를
-- 그 사람에게만 열 수 있습니다.
ALTER TABLE corporate_proposals ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);
-- 제안을 보고 연락할 곳이 없으면 게시판이 공고문 낭독에서 끝납니다.
ALTER TABLE corporate_proposals ADD COLUMN IF NOT EXISTS contact TEXT;

-- 모집글이 닫힌 이유를 상태 하나로만 두면 "마감"과 "팀 결성 완료"가 구분되지 않습니다.
ALTER TABLE recruitment_posts ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE team_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());
ALTER TABLE corporate_proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now());

-- 학기 목록은 항상 "이번 학기 것만" 읽습니다. 학기가 쌓일수록 전체 스캔이 됩니다.
CREATE INDEX IF NOT EXISTS recruitment_posts_semester_idx ON recruitment_posts (semester_key, created_at DESC);
CREATE INDEX IF NOT EXISTS team_registrations_semester_idx ON team_registrations (semester_key, created_at DESC);
CREATE INDEX IF NOT EXISTS corporate_proposals_semester_idx ON corporate_proposals (semester_key, created_at DESC);

-- ---------------------------------------------------------------- 2) 결과물 게시판

-- 중간·기말 산출물. 팀당 단계별로 한 건이며, 발표가 다가올수록 같은 행을 고쳐 씁니다.
-- 새 행을 계속 쌓게 두면 어느 것이 최종본인지 보는 사람이 알 수 없습니다.
CREATE TABLE IF NOT EXISTS team_deliverables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES team_registrations(id) ON DELETE CASCADE,
  semester_key TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('midterm', 'final')),
  title TEXT NOT NULL CHECK (char_length(trim(title)) > 0),
  summary TEXT NOT NULL DEFAULT '',
  tech_stack TEXT[],
  demo_url TEXT,
  repo_url TEXT,
  deck_url TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (team_id, phase)
);

CREATE INDEX IF NOT EXISTS team_deliverables_semester_idx ON team_deliverables (semester_key, phase, created_at DESC);

ALTER TABLE team_deliverables ENABLE ROW LEVEL SECURITY;

-- 결과물은 과목 전체가 서로 보는 것이 목적입니다. 읽기는 로그인 없이 열립니다.
DROP POLICY IF EXISTS "Public deliverables are viewable by everyone" ON team_deliverables;
CREATE POLICY "Public deliverables are viewable by everyone" ON team_deliverables
  FOR SELECT USING (true);

-- 등록은 그 팀의 팀장만. 남의 팀 결과물을 올릴 수 있으면 게시판이 아니라 낙서장이 됩니다.
DROP POLICY IF EXISTS "Team leaders create deliverables" ON team_deliverables;
CREATE POLICY "Team leaders create deliverables" ON team_deliverables
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM team_registrations t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team leaders update deliverables" ON team_deliverables;
CREATE POLICY "Team leaders update deliverables" ON team_deliverables
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM team_registrations t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team leaders delete deliverables" ON team_deliverables;
CREATE POLICY "Team leaders delete deliverables" ON team_deliverables
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM team_registrations t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

-- ---------------------------------------------------------------- 3) 공용 댓글

CREATE TABLE IF NOT EXISTS course_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board TEXT NOT NULL CHECK (board IN ('recruit', 'proposal', 'team', 'showcase')),
  target_id UUID NOT NULL,
  author_id UUID NOT NULL REFERENCES auth.users(id),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 상세 화면은 언제나 "이 글의 댓글 전부, 오래된 순"으로 읽습니다.
CREATE INDEX IF NOT EXISTS course_comments_target_idx ON course_comments (board, target_id, created_at);

ALTER TABLE course_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public course comments are viewable by everyone" ON course_comments;
CREATE POLICY "Public course comments are viewable by everyone" ON course_comments
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Authenticated users write course comments" ON course_comments;
CREATE POLICY "Authenticated users write course comments" ON course_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete their course comments" ON course_comments;
CREATE POLICY "Authors delete their course comments" ON course_comments
  FOR DELETE USING (auth.uid() = author_id);

-- 원본 글이 사라지면 댓글도 사라져야 합니다. target_id에는 외래키를 걸 수 없어
-- (대상 테이블이 넷) ON DELETE CASCADE 대신 트리거로 같은 일을 합니다.
CREATE OR REPLACE FUNCTION delete_course_comments()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM course_comments WHERE board = TG_ARGV[0] AND target_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS recruitment_posts_delete_comments ON recruitment_posts;
CREATE TRIGGER recruitment_posts_delete_comments AFTER DELETE ON recruitment_posts
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('recruit');

DROP TRIGGER IF EXISTS corporate_proposals_delete_comments ON corporate_proposals;
CREATE TRIGGER corporate_proposals_delete_comments AFTER DELETE ON corporate_proposals
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('proposal');

DROP TRIGGER IF EXISTS team_registrations_delete_comments ON team_registrations;
CREATE TRIGGER team_registrations_delete_comments AFTER DELETE ON team_registrations
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('team');

DROP TRIGGER IF EXISTS team_deliverables_delete_comments ON team_deliverables;
CREATE TRIGGER team_deliverables_delete_comments AFTER DELETE ON team_deliverables
  FOR EACH ROW EXECUTE FUNCTION delete_course_comments('showcase');

-- ---------------------------------------------------------------- 4) 글쓴이 정책

-- 기존 정책은 로그인 여부만 봤습니다. author_id·leader_id·created_by에 남의 UUID를
-- 적어 넣는 것을 막지 못해, 학생 A가 학생 B의 이름으로 모집글을 올릴 수 있었습니다.
DROP POLICY IF EXISTS "Authenticated users can create recruitment posts" ON recruitment_posts;
CREATE POLICY "Authenticated users can create recruitment posts" ON recruitment_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors update their recruitment posts" ON recruitment_posts;
CREATE POLICY "Authors update their recruitment posts" ON recruitment_posts
  FOR UPDATE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors delete their recruitment posts" ON recruitment_posts;
CREATE POLICY "Authors delete their recruitment posts" ON recruitment_posts
  FOR DELETE USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authenticated users can register teams" ON team_registrations;
CREATE POLICY "Authenticated users can register teams" ON team_registrations
  FOR INSERT WITH CHECK (auth.uid() = leader_id);

DROP POLICY IF EXISTS "Leaders update their team registrations" ON team_registrations;
CREATE POLICY "Leaders update their team registrations" ON team_registrations
  FOR UPDATE USING (auth.uid() = leader_id);

DROP POLICY IF EXISTS "Leaders delete their team registrations" ON team_registrations;
CREATE POLICY "Leaders delete their team registrations" ON team_registrations
  FOR DELETE USING (auth.uid() = leader_id);

DROP POLICY IF EXISTS "Authenticated users can create corporate proposals" ON corporate_proposals;
CREATE POLICY "Authenticated users can create corporate proposals" ON corporate_proposals
  FOR INSERT WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authors update their corporate proposals" ON corporate_proposals;
CREATE POLICY "Authors update their corporate proposals" ON corporate_proposals
  FOR UPDATE USING (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authors delete their corporate proposals" ON corporate_proposals;
CREATE POLICY "Authors delete their corporate proposals" ON corporate_proposals
  FOR DELETE USING (auth.uid() = created_by);

-- 학기 프로필(자기소개)은 이미 본인만 쓰도록 되어 있습니다. 지우는 길만 없었습니다.
DROP POLICY IF EXISTS "Users delete their own semester profiles" ON semester_profiles;
CREATE POLICY "Users delete their own semester profiles" ON semester_profiles
  FOR DELETE USING (auth.uid() = user_id);

-- PostgREST는 테이블 관계를 캐시합니다. 갱신하지 않으면 새 테이블 조회가
-- "Could not find the table 'public.team_deliverables' in the schema cache"로 실패합니다.
NOTIFY pgrst, 'reload schema';
