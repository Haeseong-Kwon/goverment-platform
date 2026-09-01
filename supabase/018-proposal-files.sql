-- 기업 제안 첨부파일. 017 다음에 실행합니다.
--
-- 기업이 제안을 올릴 때 과업지시서·데이터 명세 같은 문서를 함께 주는 일이 많습니다.
-- 지금은 본문에 링크를 붙여 넣는 수밖에 없어서, 링크가 만료되면 제안만 남고 내용이 사라집니다.
--
-- 왜 `vault` 버킷을 쓰지 않는가
-- ---------------------------
-- vault의 storage 정책은 경로 첫 세그먼트가 창업팀 UUID인지로 접근을 가릅니다(005).
-- 과목에는 그 팀 개념이 없어 정책이 통째로 어긋납니다. 새 버킷을 따로 둡니다.
--
-- 왜 공개 버킷인가
-- ---------------
-- 기업 제안 게시판은 로그인 없이 읽히는 공개 게시판입니다. 첨부만 비공개로 두면
-- 로그인하지 않은 학생에게는 "파일 있음"만 보이고 열리지 않습니다. 게시판이 공개인
-- 이상 그 첨부도 공개입니다 — 화면에서도 올리기 전에 그렇게 안내합니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 버킷

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('course', 'course', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760;

-- 올리기는 과목 구성원만. 016의 판정을 그대로 씁니다.
DROP POLICY IF EXISTS "course members upload course objects" ON storage.objects;
CREATE POLICY "course members upload course objects" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'course' AND is_course_member());

-- 지우는 것은 올린 사람만. `owner`는 업로드한 계정이 자동으로 박힙니다.
-- 이걸 `is_course_member()`만으로 두면 수강생 누구나 남의 첨부를 지울 수 있습니다.
DROP POLICY IF EXISTS "uploaders delete course objects" ON storage.objects;
CREATE POLICY "uploaders delete course objects" ON storage.objects
  FOR DELETE USING (bucket_id = 'course' AND owner = auth.uid());

-- ---------------------------------------------------------------- 2) 첨부 목록

-- 스토리지에는 파일만 있고 "어느 제안의 몇 번째 첨부인지"가 없습니다. 그 연결과
-- 원래 파일명(스토리지 경로는 한글·공백 때문에 그대로 못 씁니다)을 여기 둡니다.
--
-- course_comments처럼 board/target_id로 두지 않고 외래키를 겁니다. 지금 첨부가 붙는
-- 곳은 기업 제안 하나뿐이고, 외래키를 걸면 제안이 지워질 때 목록도 함께 지워집니다
-- (댓글 쪽은 대상 테이블이 넷이라 외래키를 걸 수 없어 트리거를 썼습니다).
CREATE TABLE IF NOT EXISTS proposal_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES corporate_proposals(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (char_length(trim(file_name)) > 0),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS proposal_files_proposal_idx ON proposal_files (proposal_id, created_at);

ALTER TABLE proposal_files ENABLE ROW LEVEL SECURITY;

-- 목록은 게시판과 같이 공개입니다.
DROP POLICY IF EXISTS "Public proposal files are viewable by everyone" ON proposal_files;
CREATE POLICY "Public proposal files are viewable by everyone" ON proposal_files
  FOR SELECT USING (true);

-- 첨부는 그 제안을 올린 사람만 답니다. 남의 제안에 파일을 붙일 수 있으면 안 됩니다.
DROP POLICY IF EXISTS "Proposal authors add files" ON proposal_files;
CREATE POLICY "Proposal authors add files" ON proposal_files
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_course_member()
    AND EXISTS (SELECT 1 FROM corporate_proposals p WHERE p.id = proposal_id AND p.created_by = auth.uid())
  );

DROP POLICY IF EXISTS "Proposal authors delete files" ON proposal_files;
CREATE POLICY "Proposal authors delete files" ON proposal_files
  FOR DELETE USING (created_by = auth.uid());

-- PostgREST는 테이블 관계를 캐시합니다. 갱신하지 않으면 새 테이블 조회가
-- "Could not find the table 'public.proposal_files' in the schema cache"로 실패합니다.
NOTIFY pgrst, 'reload schema';
