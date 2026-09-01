-- 결과물 첨부파일. 023 다음에 실행합니다.
--
-- 중간·기말 산출물은 링크만으로 끝나지 않습니다. 발표자료 PDF, 보고서, 시연 영상
-- 캡처처럼 파일로 내야 하는 것이 있고, 지금은 외부 링크에 얹는 수밖에 없어서
-- 학기가 끝나고 그 링크가 죽으면 결과물이 남지 않습니다.
--
-- 첨부 주인이 셋이 됩니다(제안·안내·결과물). 표는 계속 하나입니다 — 021에서 만든
-- exclusive arc에 컬럼 하나를 더합니다.
--
-- **권한이 앞의 둘과 다릅니다.** 제안·안내는 운영진이 쓰지만 결과물은 팀장이 씁니다.
-- 그래서 첨부 정책을 주인별로 갈라야 합니다. 021의 정책을 그대로 두면 팀장이 자기
-- 팀 결과물에 파일을 못 붙입니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 주인 추가

ALTER TABLE course_files ADD COLUMN IF NOT EXISTS deliverable_id UUID
  REFERENCES team_deliverables(id) ON DELETE CASCADE;

ALTER TABLE course_files DROP CONSTRAINT IF EXISTS course_files_one_owner;
ALTER TABLE course_files ADD CONSTRAINT course_files_one_owner
  CHECK (num_nonnulls(proposal_id, guide_id, deliverable_id) = 1);

CREATE INDEX IF NOT EXISTS course_files_deliverable_idx ON course_files (deliverable_id, created_at);

-- ---------------------------------------------------------------- 2) 주인별 권한

/*
 * 이 결과물이 내 팀 것인가.
 *
 * 정책 안에 이 조인을 두 번(INSERT·DELETE) 적는 대신 함수로 뺍니다.
 * SECURITY DEFINER가 아닙니다 — 읽는 표가 전부 공개 읽기라 호출자 권한으로 충분하고,
 * 굳이 권한을 올릴 이유가 없습니다.
 */
CREATE OR REPLACE FUNCTION is_my_team_deliverable(target UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM team_deliverables d
    JOIN team_registrations t ON t.id = d.team_id
    WHERE d.id = target AND t.leader_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION is_my_team_deliverable(UUID) TO authenticated;

-- 붙이기: 제안·안내는 운영진, 결과물은 그 팀의 팀장.
DROP POLICY IF EXISTS "Staff add course files" ON course_files;
CREATE POLICY "Staff add course files" ON course_files
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND CASE
      WHEN deliverable_id IS NOT NULL THEN is_my_team_deliverable(deliverable_id)
      ELSE is_course_staff()
    END
  );

-- 지우기: 운영진은 무엇이든, 팀장은 자기 팀 결과물 첨부만.
DROP POLICY IF EXISTS "Staff delete course files" ON course_files;
CREATE POLICY "Staff delete course files" ON course_files
  FOR DELETE USING (
    is_course_staff()
    OR (deliverable_id IS NOT NULL AND is_my_team_deliverable(deliverable_id))
  );

-- ---------------------------------------------------------------- 3) 스토리지

-- 020에서 `course` 버킷 쓰기를 운영진으로 좁혔습니다. 결과물 첨부가 생겼으니
-- 과목 구성원까지 넓히되, 어느 글에 붙일 수 있는지는 위 course_files 정책이 가립니다
-- (파일만 올리고 목록에 못 적으면 업로드는 앱이 되돌립니다).
DROP POLICY IF EXISTS "course members upload course objects" ON storage.objects;
CREATE POLICY "course members upload course objects" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'course' AND is_course_member());

DROP POLICY IF EXISTS "uploaders delete course objects" ON storage.objects;
CREATE POLICY "uploaders delete course objects" ON storage.objects
  FOR DELETE USING (bucket_id = 'course' AND (is_course_staff() OR owner = auth.uid()));

NOTIFY pgrst, 'reload schema';
