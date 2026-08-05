-- StartUp Pilot — 기능 감사에서 발견된 결손 보강.
-- 007 이후에 실행합니다. 재실행해도 안전합니다.
--
-- 담는 것:
--   1) programs.deadline 기본값 — 없으면 자동 마일스톤과 캘린더가 통째로 비어 있었습니다.
--   2) 검토 착수(in_review) RPC — 도달 불가능한 상태였습니다.
--   3) 전환 코드 재발급 RPC — 만료 후 UI로 새 코드를 만들 방법이 없었습니다.
--   4) 무료 자료실 테이블 — 스펙 P6 절반이 구현되지 않았습니다.
--   5) 법무 상담 신청 테이블 — 스펙 P9의 리드 생성 경로가 없었습니다.
--   6) 비로그인 리드 수집 — 계산기를 검색 착지 페이지로 열기 위해 필요합니다.

-- ---------------------------------------------------------------- 1) 공고 마감일

-- 사업마다 다른 날짜여야 "복수 지원사업의 마감 충돌"을 볼 수 있습니다.
-- 고정 날짜를 박으면 적용 시점이 지나는 순간 전부 과거가 되어, 신규 가입자가
-- "이미 지남"으로 빨갛게 찬 보드를 받습니다. 적용 시점 기준 미래로 잡습니다.
-- 실제 공고가 나오면 이 값을 공고문 마감일로 갱신하세요.
UPDATE programs SET deadline = (current_date + INTERVAL '30 days')::date WHERE id = 'yechang-2026' AND deadline IS NULL;
UPDATE programs SET deadline = (current_date + INTERVAL '55 days')::date WHERE id = 'chocang-2026' AND deadline IS NULL;
UPDATE programs SET deadline = (current_date + INTERVAL '80 days')::date WHERE id = 'modu-2026'    AND deadline IS NULL;

-- 새로 추가되는 사업이 마감일 없이 들어와 조용히 빈 보드를 만드는 일을 막습니다.
UPDATE programs SET deadline = (current_date + INTERVAL '60 days')::date WHERE deadline IS NULL;

-- ---------------------------------------------------------------- 2) 검토 착수

-- 매니저는 settlement_submissions를 UPDATE할 수 없으므로(RLS 설계 의도) 상태 전이는 함수로만 엽니다.
CREATE OR REPLACE FUNCTION claim_settlement_submission(input_submission_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_institution UUID;
BEGIN
  SELECT f.institution_id INTO target_institution
  FROM settlement_submissions s
  JOIN founder_teams f ON f.id = s.founder_team_id
  WHERE s.id = input_submission_id
    AND s.status = 'validated'
  FOR UPDATE OF s;

  -- 이미 검토 중이거나 판정이 끝난 건은 조용히 넘어갑니다. 착수는 멱등해야 합니다.
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT is_institution_manager(target_institution) THEN RAISE EXCEPTION 'MANAGER_ROLE_REQUIRED'; END IF;

  UPDATE settlement_submissions SET status = 'in_review', updated_at = now() WHERE id = input_submission_id;
END;
$$;

REVOKE ALL ON FUNCTION claim_settlement_submission(UUID) FROM public;
GRANT EXECUTE ON FUNCTION claim_settlement_submission(UUID) TO authenticated;

-- ---------------------------------------------------------------- 3) 전환 코드 재발급

CREATE OR REPLACE FUNCTION issue_conversion_code(input_program_id TEXT, input_max_uses INTEGER DEFAULT 100)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_institution UUID;
  new_code TEXT;
BEGIN
  SELECT institution_id INTO target_institution FROM startup_profiles WHERE id = auth.uid();
  IF target_institution IS NULL OR NOT is_institution_manager(target_institution) THEN
    RAISE EXCEPTION 'MANAGER_ROLE_REQUIRED';
  END IF;
  IF input_max_uses IS NULL OR input_max_uses < 1 OR input_max_uses > 1000 THEN
    RAISE EXCEPTION 'MAX_USES_OUT_OF_RANGE';
  END IF;

  -- 혼동하기 쉬운 0/O/1/I를 뺀 32자 알파벳. 구두·수기 전달 오류를 줄입니다.
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', (floor(random() * 32) + 1)::int, 1), '')
    INTO new_code FROM generate_series(1, 8);

  INSERT INTO conversion_codes (institution_id, program_id, code, expires_at, max_uses, created_by)
  VALUES (target_institution, input_program_id, new_code, now() + INTERVAL '90 days', input_max_uses, auth.uid());

  RETURN new_code;
END;
$$;

REVOKE ALL ON FUNCTION issue_conversion_code(TEXT, INTEGER) FROM public;
GRANT EXECUTE ON FUNCTION issue_conversion_code(TEXT, INTEGER) TO authenticated;

-- ---------------------------------------------------------------- 4) 무료 자료실

-- 감수·출처가 표기된 표준 양식만 올립니다. 사용자 업로드 대상이 아니라 운영자 큐레이션 테이블입니다.
CREATE TABLE IF NOT EXISTS library_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('contract', 'ir', 'hr', 'gov')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL,
  source_url TEXT,
  storage_path TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE library_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads active library documents" ON library_documents;
-- 비로그인 방문자도 목록을 봅니다. 자료실은 검색 유입의 착지점입니다.
CREATE POLICY "anyone reads active library documents" ON library_documents FOR SELECT USING (is_active);

INSERT INTO library_documents (slug, category, title, description, source_label, source_url, sort_order) VALUES
  ('cofounder-agreement', 'contract', '동업계약서 표준안', '지분·역할·이탈 시 처리를 정하는 공동창업 계약서. 지분 분쟁의 90%는 이 문서 부재에서 시작합니다.', '중소벤처기업부 표준계약서', 'https://www.mss.go.kr', 10),
  ('kvca-investment', 'contract', 'KVCA 표준투자계약서', '한국벤처캐피탈협회가 배포하는 표준 투자계약서. 상환전환우선주(RCPS) 조건의 기준선입니다.', '한국벤처캐피탈협회', 'https://www.kvca.or.kr', 20),
  ('nda', 'contract', '비밀유지계약서(NDA)', '외주·투자 검토 전 아이디어와 데이터를 보호하는 최소 문서.', '공정거래위원회 표준약관', 'https://www.ftc.go.kr', 30),
  ('outsourcing-agreement', 'contract', '외주용역 계약서 표준안', '과업 범위·검수 기준·대금 지급 조건. 사업비 외주용역 사전심의 합본의 필수 서류입니다.', '중소벤처기업부 표준계약서', 'https://www.mss.go.kr', 40),
  ('ir-deck', 'ir', 'IR 피치덱 템플릿', 'PSST 구조에 맞춘 10장 구성. 사업계획서 AI 진단의 4축과 같은 순서입니다.', '자체 제작 · 창업진흥원 양식 참고', NULL, 50),
  ('employment-contract', 'hr', '근로계약서 표준양식', '4대보험·수습·근로시간 기재. 인건비 정산 증빙의 기초 서류입니다.', '고용노동부 표준근로계약서', 'https://www.moel.go.kr', 60),
  ('expense-checklist', 'gov', '사업비 집행 증빙 체크리스트', '비목별 필수 증빙을 한 장으로 정리. 정산 사전검증의 "증빙 누락" 항목과 같은 기준입니다.', '자체 제작 · 사업비 관리기준 기반', NULL, 70)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------- 5) 법무 상담 신청

-- 변호사법 제34조상 소개 대가를 받을 수 없으므로 중개가 아니라 "광고형 신청 접수"만 보관합니다.
CREATE TABLE IF NOT EXISTS consultation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  topic TEXT NOT NULL CHECK (topic IN ('incorporation', 'contract', 'ip', 'labor')),
  contact_email TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  consented_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users create own consultation requests" ON consultation_requests;
CREATE POLICY "users create own consultation requests" ON consultation_requests
  FOR INSERT WITH CHECK (consented_at IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

DROP POLICY IF EXISTS "users read own consultation requests" ON consultation_requests;
CREATE POLICY "users read own consultation requests" ON consultation_requests
  FOR SELECT USING (user_id = auth.uid());

-- ---------------------------------------------------------------- 6) 비로그인 리드 수집

-- 계산기·자료실은 검색 유입형 착지 페이지라 로그인 전 방문자가 대상입니다.
-- 기존 정책은 authenticated만 허용해 리드 채널이 통째로 닫혀 있었습니다.
-- 동의 시각은 그대로 필수이며, 익명 행은 user_id가 NULL이어야 합니다.
DROP POLICY IF EXISTS "authenticated users create consented leads" ON leads;
DROP POLICY IF EXISTS "anyone creates consented leads" ON leads;
CREATE POLICY "anyone creates consented leads" ON leads
  FOR INSERT WITH CHECK (
    consented_at IS NOT NULL
    AND (
      (auth.role() = 'authenticated' AND (user_id IS NULL OR user_id = auth.uid()))
      OR (auth.role() = 'anon' AND user_id IS NULL)
    )
  );

-- ---------------------------------------------------------------- 7) 비목별 사업비 배정

-- 반려 사유 2위가 "한도 초과"인데 비교할 배정액이 없어 판정 자체가 불가능했습니다.
-- 협약 시 확정된 비목별 배정액을 여기에 두고, 집행 누계와 비교합니다.
CREATE TABLE IF NOT EXISTS budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_team_id UUID NOT NULL REFERENCES founder_teams(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('material','outsourcing','equipment','ip','labor','fee','travel','training','advertising')),
  allocated_amount BIGINT NOT NULL CHECK (allocated_amount >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (founder_team_id, category)
);

ALTER TABLE budget_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "founders read own allocations" ON budget_allocations;
CREATE POLICY "founders read own allocations" ON budget_allocations FOR SELECT
  USING (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id)));

DROP POLICY IF EXISTS "founders manage own allocations" ON budget_allocations;
-- 배정액은 협약서 값을 팀이 옮겨 적습니다. 기관 확정본과 다르면 검토에서 걸러집니다.
CREATE POLICY "founders manage own allocations" ON budget_allocations FOR ALL
  USING (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id)));

DROP POLICY IF EXISTS "managers read institution allocations" ON budget_allocations;
CREATE POLICY "managers read institution allocations" ON budget_allocations FOR SELECT
  USING (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_institution_manager(f.institution_id)));

CREATE INDEX IF NOT EXISTS budget_allocations_team_idx ON budget_allocations (founder_team_id, category);
CREATE INDEX IF NOT EXISTS diagnosis_reports_team_type_idx ON diagnosis_reports (prep_team_id, report_type, created_at);
CREATE INDEX IF NOT EXISTS task_comments_task_idx ON task_comments (task_id, created_at);
CREATE INDEX IF NOT EXISTS library_documents_active_idx ON library_documents (is_active, category, sort_order);
