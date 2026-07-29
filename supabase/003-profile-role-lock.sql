-- StartUp Pilot — 권한 상승 차단.
--
-- 문제: "users update own startup profile" 정책은 자기 행 전체를 수정하게 허용하므로
--       일반 사용자가 role을 'manager'로, institution_id를 임의 기관으로 바꿀 수 있습니다.
--       RLS는 행 단위라 정책만으로는 특정 컬럼을 잠글 수 없어 트리거로 막습니다.
--
-- 이 파일 적용 후 role·institution_id는 (a) SQL 편집기/service_role 같은 관리자 경로와
-- (b) 아래에서 다시 정의하는 convert_prep_team RPC 를 통해서만 바뀝니다.

-- SECURITY DEFINER를 쓰면 current_user가 함수 소유자(postgres)로 잡혀 검사가 무력화됩니다.
-- 트리거는 OLD/NEW만 보므로 INVOKER(기본값)로 두어야 호출자 롤이 그대로 보입니다.
CREATE OR REPLACE FUNCTION lock_startup_profile_privileges()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- 관리자 경로(SQL 편집기의 postgres, service_role 키)는 그대로 통과시킵니다.
  -- RLS가 적용되는 앱 요청만 authenticated/anon 롤로 들어옵니다.
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;
  END IF;

  -- 승인된 전환 RPC가 트랜잭션 안에서 세운 플래그일 때만 허용합니다.
  IF coalesce(current_setting('app.allow_privilege_change', true), 'off') = 'on' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role OR NEW.institution_id IS DISTINCT FROM OLD.institution_id THEN
    RAISE EXCEPTION 'PROFILE_PRIVILEGE_IMMUTABLE';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS startup_profiles_privilege_lock ON startup_profiles;
CREATE TRIGGER startup_profiles_privilege_lock
  BEFORE UPDATE ON startup_profiles
  FOR EACH ROW EXECUTE FUNCTION lock_startup_profile_privileges();

-- 신규 가입 시 role은 서버가 정합니다. 가입 폼에서 'manager'를 골라도 pre_founder로
-- 내려앉히고, 매니저 계정은 004 시드의 관리자 절차로만 승격합니다.
CREATE OR REPLACE FUNCTION force_self_signup_role()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NEW.role <> 'pre_founder' THEN
    NEW.role := 'pre_founder';
    NEW.institution_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS startup_profiles_signup_role ON startup_profiles;
CREATE TRIGGER startup_profiles_signup_role
  BEFORE INSERT ON startup_profiles
  FOR EACH ROW EXECUTE FUNCTION force_self_signup_role();

-- convert_prep_team은 합격 전환에서 role을 founder로 올려야 하므로, 위 잠금을
-- 통과하도록 트랜잭션 스코프 플래그를 세우는 버전으로 교체합니다.
-- (schema.sql 원본과 나머지 로직은 동일합니다.)
CREATE OR REPLACE FUNCTION convert_prep_team(input_code TEXT)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  code_row conversion_codes%ROWTYPE;
  source_team prep_teams%ROWTYPE;
  new_founder_team UUID;
BEGIN
  SELECT * INTO code_row FROM conversion_codes WHERE code = input_code FOR UPDATE;
  IF NOT FOUND OR code_row.expires_at <= now() OR code_row.use_count >= code_row.max_uses THEN
    RAISE EXCEPTION 'CONVERSION_CODE_INVALID';
  END IF;
  SELECT t.* INTO source_team FROM prep_teams t JOIN prep_team_members m ON m.prep_team_id = t.id WHERE m.user_id = auth.uid() AND m.member_role = 'leader' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'PREP_TEAM_NOT_FOUND'; END IF;
  INSERT INTO founder_teams (prep_team_id, institution_id, program_id) VALUES (source_team.id, code_row.institution_id, code_row.program_id) RETURNING id INTO new_founder_team;
  UPDATE vault_documents SET founder_team_id = new_founder_team WHERE prep_team_id = source_team.id;
  UPDATE conversion_codes SET use_count = use_count + 1 WHERE id = code_row.id;

  PERFORM set_config('app.allow_privilege_change', 'on', true);
  UPDATE startup_profiles SET role = 'founder', updated_at = now() WHERE id = auth.uid();
  PERFORM set_config('app.allow_privilege_change', 'off', true);

  INSERT INTO workspace_events (user_id, prep_team_id, event_name, payload) VALUES (auth.uid(), source_team.id, 'convert_completed', jsonb_build_object('founder_team_id', new_founder_team, 'institution_id', code_row.institution_id));
  RETURN new_founder_team;
END;
$$;
