-- StartUp Pilot — 정산 증빙 파일 첨부.
-- 005-vault-and-team.sql 이후에 실행합니다. 재실행해도 안전합니다.
--
-- 그동안 매니저 화면의 "증빙 N건"은 창업자가 체크한 증빙 *유형* 개수였고,
-- 실제 파일을 여는 경로는 없었습니다. 보관함 파일을 정산 건에 명시적으로
-- 연결하고, 검토 요청된 건에 연결된 파일만 그 기관 매니저에게 열어 줍니다.
--
-- 열람 범위는 계속 최소입니다. 연결되지 않은 보관함 파일과 준비 단계 서류는
-- 매니저에게 보이지 않습니다(startup-workspace.rls.test.sql이 이를 검증합니다).

-- 1) 연결 테이블. 감사 대응상 제출 후 증빙이 바뀌면 안 되므로
--    UPDATE·DELETE 정책을 아예 만들지 않아 불변으로 둡니다.
--    document_id는 RESTRICT로 묶어, 인용된 증빙 파일은 삭제되지 않습니다.
CREATE TABLE IF NOT EXISTS submission_evidence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES settlement_submissions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES vault_documents(id) ON DELETE RESTRICT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (submission_id, document_id)
);

CREATE INDEX IF NOT EXISTS submission_evidence_document_idx ON submission_evidence (document_id);

ALTER TABLE submission_evidence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founders attach own submission evidence" ON submission_evidence;
CREATE POLICY "founders attach own submission evidence" ON submission_evidence
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM settlement_submissions s
      JOIN founder_teams f ON f.id = s.founder_team_id
      WHERE s.id = submission_id AND is_prep_team_member(f.prep_team_id)
    )
    -- 남의 팀 파일을 자기 제출 건에 붙일 수 없습니다.
    AND EXISTS (
      SELECT 1 FROM vault_documents d
      WHERE d.id = document_id AND is_prep_team_member(d.prep_team_id)
    )
  );

DROP POLICY IF EXISTS "founders read own submission evidence" ON submission_evidence;
CREATE POLICY "founders read own submission evidence" ON submission_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM settlement_submissions s
      JOIN founder_teams f ON f.id = s.founder_team_id
      WHERE s.id = submission_id AND is_prep_team_member(f.prep_team_id)
    )
  );

DROP POLICY IF EXISTS "managers read reviewable submission evidence" ON submission_evidence;
CREATE POLICY "managers read reviewable submission evidence" ON submission_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM settlement_submissions s
      JOIN founder_teams f ON f.id = s.founder_team_id
      WHERE s.id = submission_id
        AND s.status IN ('validated', 'in_review', 'approved', 'rejected')
        AND is_institution_manager(f.institution_id)
    )
  );

-- 2) "이 파일은 내가 검토 중인 건에 첨부된 것인가". SECURITY DEFINER로 두어
--    vault_documents·storage.objects 정책이 이 함수를 불러도 정책이 다시
--    평가되지 않습니다(순환 방지). 판단 기준은 auth.uid()라 정의자 권한과 무관합니다.
CREATE OR REPLACE FUNCTION is_manager_reviewable_document(target_document_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM submission_evidence e
    JOIN settlement_submissions s ON s.id = e.submission_id
    JOIN founder_teams f ON f.id = s.founder_team_id
    WHERE e.document_id = target_document_id
      AND s.status IN ('validated', 'in_review', 'approved', 'rejected')
      AND is_institution_manager(f.institution_id)
  );
$$;

-- storage.objects는 문서 행이 아니라 경로로 매칭해야 합니다.
CREATE OR REPLACE FUNCTION is_manager_reviewable_object(target_path TEXT)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM vault_documents d
    JOIN submission_evidence e ON e.document_id = d.id
    JOIN settlement_submissions s ON s.id = e.submission_id
    JOIN founder_teams f ON f.id = s.founder_team_id
    WHERE d.storage_path = target_path
      AND s.status IN ('validated', 'in_review', 'approved', 'rejected')
      AND is_institution_manager(f.institution_id)
  );
$$;

REVOKE ALL ON FUNCTION is_manager_reviewable_document(UUID) FROM public;
REVOKE ALL ON FUNCTION is_manager_reviewable_object(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION is_manager_reviewable_document(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_manager_reviewable_object(TEXT) TO authenticated;

-- 3) 첨부된 증빙에 한해 메타데이터와 파일을 매니저에게 엽니다.
--    기존 "team members ..." 정책은 그대로 남아 팀 멤버 경로는 바뀌지 않습니다.
DROP POLICY IF EXISTS "managers read reviewable vault documents" ON vault_documents;
CREATE POLICY "managers read reviewable vault documents" ON vault_documents
  FOR SELECT USING (is_manager_reviewable_document(id));

DROP POLICY IF EXISTS "managers read reviewable vault objects" ON storage.objects;
CREATE POLICY "managers read reviewable vault objects" ON storage.objects
  FOR SELECT USING (bucket_id = 'vault' AND is_manager_reviewable_object(name));
