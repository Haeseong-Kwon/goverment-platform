-- StartUp Pilot — 최초 1회 시드 및 매니저 계정 승격.
--
-- 실행 전에 아래 DECLARE 블록의 3개 값만 바꾸세요.
-- 매니저로 쓸 계정은 먼저 앱 회원가입(/signup)을 마쳐야 합니다. 가입 시 어떤 역할을
-- 골랐든 003의 트리거가 pre_founder로 내려앉히므로, 승격은 여기서만 일어납니다.

DO $$
DECLARE
  -- ▼▼▼ 여기만 수정 ▼▼▼
  institution_name TEXT := '인하대학교 창업지원단';
  institution_domain TEXT := 'inha.ac.kr';
  manager_email TEXT := 'manager@example.com';
  -- ▲▲▲ 여기만 수정 ▲▲▲

  target_institution UUID;
  target_manager UUID;
  generated_code TEXT;
BEGIN
  -- 1) 기관 등록
  INSERT INTO institutions (name, domain)
  VALUES (institution_name, institution_domain)
  ON CONFLICT (domain) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO target_institution;

  IF target_institution IS NULL THEN
    SELECT id INTO target_institution FROM institutions WHERE domain = institution_domain;
  END IF;

  -- 2) 매니저 승격 (가입이 끝난 계정이어야 합니다)
  SELECT id INTO target_manager FROM auth.users WHERE email = manager_email;
  IF target_manager IS NULL THEN
    RAISE EXCEPTION '가입되지 않은 이메일입니다: %. /signup 에서 먼저 가입하세요.', manager_email;
  END IF;

  INSERT INTO startup_profiles (id, role, institution_id, onboarding_complete)
  VALUES (target_manager, 'manager', target_institution, true)
  ON CONFLICT (id) DO UPDATE
    SET role = 'manager', institution_id = target_institution, onboarding_complete = true, updated_at = now();

  -- 3) 지원사업 마감일. 자동 마일스톤 TODO는 deadline이 있어야 생성됩니다.
  --    실제 공고 마감일을 아는 경우 이 UPDATE 대신 값을 직접 넣으세요.
  UPDATE programs SET deadline = (current_date + interval '30 days')::date, announcement_date = current_date
  WHERE deadline IS NULL;

  -- 4) 합격 전환 코드 1개 발급 (창업자가 /founder/convert 에서 입력)
  generated_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  INSERT INTO conversion_codes (institution_id, program_id, code, expires_at, max_uses, created_by)
  VALUES (target_institution, 'modu-2026', generated_code, now() + interval '90 days', 50, target_manager);

  RAISE NOTICE '기관 ID: %', target_institution;
  RAISE NOTICE '매니저 ID: %', target_manager;
  RAISE NOTICE '합격 전환 코드: %  (창업자에게 전달)', generated_code;
END;
$$;

-- 발급된 전환 코드를 다시 확인하려면:
--   SELECT code, expires_at, use_count, max_uses FROM conversion_codes ORDER BY created_at DESC;
