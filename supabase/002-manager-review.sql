-- StartUp Pilot — 매니저 검토 처리 백엔드 보강.
-- schema.sql 적용 이후 1회 실행합니다. 재실행해도 안전합니다.

-- 1) 승인·반려는 "검토 기록 저장 + 제출 상태 변경" 두 쓰기가 함께 성공해야 합니다.
--    supabase-js는 다중 문장 트랜잭션을 쓸 수 없으므로 convert_prep_team과 동일하게
--    SECURITY DEFINER 함수로 묶고, 매니저 권한은 함수 안에서 직접 검증합니다.
--    (RLS UPDATE가 막혀도 supabase-js는 성공을 반환하기 때문에, 정책만 여는 방식은
--     실패가 조용히 묻힙니다. 여기서는 대상이 없으면 예외를 던집니다.)
CREATE OR REPLACE FUNCTION review_settlement_submission(
  input_submission_id UUID,
  input_decision TEXT,
  input_reason_code TEXT,
  input_feedback TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_institution UUID;
  new_review UUID;
BEGIN
  IF input_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'DECISION_INVALID';
  END IF;
  IF input_decision = 'rejected' AND coalesce(trim(input_reason_code), '') = '' THEN
    RAISE EXCEPTION 'REASON_CODE_REQUIRED';
  END IF;

  SELECT f.institution_id INTO target_institution
  FROM settlement_submissions s
  JOIN founder_teams f ON f.id = s.founder_team_id
  WHERE s.id = input_submission_id
    AND s.status IN ('validated', 'in_review')
  FOR UPDATE OF s;

  IF NOT FOUND THEN RAISE EXCEPTION 'SUBMISSION_NOT_REVIEWABLE'; END IF;
  IF NOT is_institution_manager(target_institution) THEN RAISE EXCEPTION 'MANAGER_ROLE_REQUIRED'; END IF;

  INSERT INTO submission_reviews (submission_id, manager_id, decision, reason_code, feedback)
  VALUES (input_submission_id, auth.uid(), input_decision, nullif(trim(input_reason_code), ''), input_feedback)
  RETURNING id INTO new_review;

  UPDATE settlement_submissions
  SET status = input_decision, updated_at = now()
  WHERE id = input_submission_id;

  RETURN new_review;
END;
$$;

REVOKE ALL ON FUNCTION review_settlement_submission(UUID, TEXT, TEXT, TEXT) FROM public;
GRANT EXECUTE ON FUNCTION review_settlement_submission(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- 2) 검토 큐에 팀명을 표시하기 위해, 자기 기관과 협약 전환이 끝난 팀에 한해
--    prep_teams 행 조회를 허용합니다. 전환 전 준비 팀은 계속 비공개입니다.
--    (RLS는 행 단위라 해당 행의 item_summary·industry도 함께 열립니다.
--     이름만 노출하려면 founder_teams에 team_name을 비정규화하는 편이 낫습니다.)
DROP POLICY IF EXISTS "managers read converted institution teams" ON prep_teams;
CREATE POLICY "managers read converted institution teams" ON prep_teams
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM founder_teams f WHERE f.prep_team_id = prep_teams.id AND is_institution_manager(f.institution_id)));

-- 3) institutions는 RLS만 켜져 있고 정책이 하나도 없어 아무도 읽지 못합니다.
--    소속 기관명을 화면에 표시하려면 최소 읽기 권한이 필요합니다.
DROP POLICY IF EXISTS "members read own institution" ON institutions;
CREATE POLICY "members read own institution" ON institutions
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM startup_profiles p WHERE p.id = auth.uid() AND p.institution_id = institutions.id));

-- 4) 검토 큐·리포트 조회 경로 인덱스.
CREATE INDEX IF NOT EXISTS settlement_submissions_team_status_idx
  ON settlement_submissions (founder_team_id, status, created_at);
CREATE INDEX IF NOT EXISTS submission_reviews_decision_idx
  ON submission_reviews (decision, created_at);
