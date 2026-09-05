-- 가입 자격을 "메일 인증 완료"에서 "학교 메일 주소"로 바꿉니다. 026 다음에 실행합니다.
--
-- 왜 바꾸는가
-- -----------
-- Supabase 기본 SMTP는 **프로젝트 전체** 시간당 2통입니다. 수강생 수십 명이 학기 초에
-- 몰리면 대부분이 인증 메일을 받지 못해 가입 자체가 막힙니다(실제로 하루 동안 가입이
-- 시간당 한 건씩만 성사됐습니다). 수업 시작을 메일 한도에 맡길 수는 없습니다.
--
-- 무엇을 잃는가 — 분명히 적어 둡니다
-- ----------------------------------
-- 인증 메일은 "이 사람이 그 한양대 메일함을 실제로 가지고 있다"는 유일한 증거였습니다.
-- 이제 남의 @hanyang.ac.kr 주소를 적어도 가입이 됩니다. 사전 차단은 사라지고,
-- 남는 것은 사후 조치입니다 — 수강생 명단(025)에서 확인하고 강퇴(course_bans)합니다.
--
-- 되돌리려면: Supabase Authentication에서 Confirm email을 다시 켜고,
-- 아래 함수에 `AND email_confirmed_at IS NOT NULL` 한 줄을 되살리면 됩니다.
--
-- 재실행해도 안전합니다.

/*
 * 인증 여부를 보지 않습니다.
 *
 * Confirm email을 끄면 GoTrue가 가입 시점에 email_confirmed_at을 채워 주지만,
 * 그 동작에 정책을 걸어 두면 설정 하나가 바뀌는 순간 전원이 글을 못 쓰게 됩니다.
 * 판정 근거를 설정이 아니라 **메일 주소**라는 눈에 보이는 값으로 옮깁니다.
 *
 * 차단(025)은 그대로입니다. 이제 이것이 유일한 쓰기 차단 수단입니다.
 */
CREATE OR REPLACE FUNCTION is_course_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email ~* '^[^@\s]+@([a-z0-9-]+\.)*hanyang\.ac\.kr$'
  )
  AND (is_course_staff() OR NOT EXISTS (SELECT 1 FROM course_bans WHERE user_id = auth.uid()));
$$;

/*
 * 명단도 같은 기준으로 봅니다.
 *
 * 지금까지 조건이 "인증을 마친 계정 전부"라, 인증을 끄면 명단이 비고 켜 두면
 * 과목과 무관한 StartUp Pilot 계정까지 섞여 있었습니다. 둘 다 틀린 명단입니다.
 * 이 과목의 수강생은 학교 메일로 들어온 사람입니다.
 */
CREATE OR REPLACE FUNCTION course_members(target_semester TEXT)
RETURNS TABLE (
  user_id UUID,
  email TEXT,
  full_name TEXT,
  major TEXT,
  status TEXT,
  joined_at TIMESTAMPTZ,
  has_profile BOOLEAN,
  is_staff BOOLEAN,
  is_banned BOOLEAN,
  ban_reason TEXT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT is_course_staff() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING HINT = '과목 운영진만 조회할 수 있습니다.';
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    u.email::TEXT,
    -- 이름은 학기 프로필 > 계정 프로필 > 메일 아이디 순으로 찾습니다.
    COALESCE(NULLIF(trim(sp.full_name), ''), NULLIF(trim(p.full_name), ''), split_part(u.email, '@', 1))::TEXT,
    COALESCE(sp.major, '')::TEXT,
    COALESCE(sp.status, '')::TEXT,
    u.created_at,
    sp.id IS NOT NULL,
    st.email IS NOT NULL,
    b.user_id IS NOT NULL,
    COALESCE(b.reason, '')::TEXT
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN semester_profiles sp ON sp.user_id = u.id AND sp.semester_key = target_semester
  LEFT JOIN course_staff st ON st.email = lower(trim(u.email))
  LEFT JOIN course_bans b ON b.user_id = u.id
  WHERE u.email ~* '^[^@\s]+@([a-z0-9-]+\.)*hanyang\.ac\.kr$'
  -- 차단된 사람을 위로 올려 조치 결과가 바로 보이게 합니다. 그다음 최근 가입순.
  ORDER BY (b.user_id IS NOT NULL) DESC, u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION course_members(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
