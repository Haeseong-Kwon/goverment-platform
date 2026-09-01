-- 기업 제안을 운영진 전용으로 좁힙니다. 019 다음에 실행합니다.
--
-- 016에서는 "과목 구성원이면 누구나" 올릴 수 있게 두고, 기업 담당자가 직접 쓰는 대신
-- 조교·교수가 대신 올리는 형태가 될 거라고 적어 두었습니다. 그 형태로 확정합니다.
--
-- 수강생이 하는 일은 **댓글로 신청**하는 것입니다. 댓글 정책(016)은 그대로 두므로
-- 학생은 제안을 읽고 댓글을 다는 데 아무 제약이 없습니다. 글 자체만 운영진이 씁니다.
--
-- 수정·삭제를 작성자 본인이 아니라 운영진 전체에게 여는 이유는 공지와 같습니다 —
-- 교수님이 올린 제안의 마감일을 조교가 못 고치면 곤란합니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 제안 글

DROP POLICY IF EXISTS "Authenticated users can create corporate proposals" ON corporate_proposals;
CREATE POLICY "Authenticated users can create corporate proposals" ON corporate_proposals
  FOR INSERT WITH CHECK (auth.uid() = created_by AND is_course_staff());

DROP POLICY IF EXISTS "Authors update their corporate proposals" ON corporate_proposals;
CREATE POLICY "Authors update their corporate proposals" ON corporate_proposals
  FOR UPDATE USING (is_course_staff());

DROP POLICY IF EXISTS "Authors delete their corporate proposals" ON corporate_proposals;
CREATE POLICY "Authors delete their corporate proposals" ON corporate_proposals
  FOR DELETE USING (is_course_staff());

-- ---------------------------------------------------------------- 2) 첨부

-- 018은 "그 제안을 올린 사람만" 첨부할 수 있게 했습니다. 이제 제안 자체가 운영진
-- 전용이므로 첨부도 같은 기준으로 맞춥니다. 그러지 않으면 조교가 교수님 제안에
-- 빠진 과업지시서를 붙일 수 없습니다.
DROP POLICY IF EXISTS "Proposal authors add files" ON proposal_files;
CREATE POLICY "Proposal authors add files" ON proposal_files
  FOR INSERT WITH CHECK (created_by = auth.uid() AND is_course_staff());

DROP POLICY IF EXISTS "Proposal authors delete files" ON proposal_files;
CREATE POLICY "Proposal authors delete files" ON proposal_files
  FOR DELETE USING (is_course_staff());

-- 스토리지도 같이 좁힙니다. 지금 `course` 버킷에 올라가는 것은 제안 첨부뿐입니다.
DROP POLICY IF EXISTS "course members upload course objects" ON storage.objects;
CREATE POLICY "course members upload course objects" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'course' AND is_course_staff());

-- 삭제도 `owner = auth.uid()`(올린 사람 본인)에서 운영진 전체로 바꿉니다.
-- 위 proposal_files 삭제 정책과 기준이 어긋나면 목록에서는 지워졌는데 파일은
-- 버킷에 남는 상태가 됩니다.
DROP POLICY IF EXISTS "uploaders delete course objects" ON storage.objects;
CREATE POLICY "uploaders delete course objects" ON storage.objects
  FOR DELETE USING (bucket_id = 'course' AND is_course_staff());

NOTIFY pgrst, 'reload schema';
