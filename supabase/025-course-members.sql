-- 수강생 명단과 차단. 024 다음에 실행합니다.
--
-- 강퇴를 "계정 삭제"로 만들지 않습니다.
-- ------------------------------------
-- 계정을 지우면 그 사람이 올린 모집글·팀 명단·결과물·댓글이 함께 사라집니다. 팀에서
-- 빠지는 학생 하나 때문에 그 팀의 중간 결과물이 없어지는 것은 과합니다. 되돌릴 수도 없습니다.
--
-- 대신 **쓰기를 막습니다.** 남긴 글은 그대로 두고, 새로 쓰지 못하게 합니다.
-- 해제도 한 번에 됩니다(행 하나 삭제).
--
-- 읽기는 막지 않습니다 — 애초에 게시판이 로그인 없이 열리므로 막을 수가 없고,
-- 막는 척하는 기능을 두면 운영진이 잘못 믿게 됩니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 차단 명단

CREATE TABLE IF NOT EXISTS course_bans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  semester_key TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  banned_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE course_bans ENABLE ROW LEVEL SECURITY;

-- 명단은 운영진만 봅니다. 누가 차단당했는지 학생들에게 공개할 이유가 없습니다.
DROP POLICY IF EXISTS "Staff read bans" ON course_bans;
CREATE POLICY "Staff read bans" ON course_bans FOR SELECT USING (is_course_staff());

DROP POLICY IF EXISTS "Staff create bans" ON course_bans;
CREATE POLICY "Staff create bans" ON course_bans
  FOR INSERT WITH CHECK (banned_by = auth.uid() AND is_course_staff());

DROP POLICY IF EXISTS "Staff lift bans" ON course_bans;
CREATE POLICY "Staff lift bans" ON course_bans FOR DELETE USING (is_course_staff());

-- ---------------------------------------------------------------- 2) 자격 판정에 반영

/*
 * 016의 판정에 차단을 더합니다.
 *
 * 이 함수 하나만 고치면 모든 쓰기 정책(모집글·팀·결과물·댓글·자기소개)이 함께 막힙니다 —
 * 정책마다 차단 조건을 복사해 넣었다면 하나를 빠뜨렸을 것입니다.
 *
 * 운영진은 차단 대상이 아닙니다. 실수로 자기 자신을 차단해 아무도 풀 수 없게 되는
 * 상황을 막기 위해, 명단에 있어도 운영진이면 통과시킵니다.
 */
CREATE OR REPLACE FUNCTION is_course_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL
      AND email ~* '^[^@\s]+@([a-z0-9-]+\.)*hanyang\.ac\.kr$'
  )
  AND (is_course_staff() OR NOT EXISTS (SELECT 1 FROM course_bans WHERE user_id = auth.uid()));
$$;

/*
 * 화면이 상태를 한 번에 읽습니다.
 *
 * 지금까지 `is_course_member()`와 `is_course_staff()`를 따로 불렀는데, 차단이 생기면서
 * 세 번째 경우가 늘었습니다 — "인증은 했지만 차단됨". 화면은 이 셋을 구분해
 * 다른 문구를 보여 줘야 하고, 각각 왕복하면 헤더가 그만큼 늦게 확정됩니다.
 */
CREATE OR REPLACE FUNCTION course_viewer_status()
RETURNS TABLE (member BOOLEAN, staff BOOLEAN, banned BOOLEAN)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT
    is_course_member(),
    is_course_staff(),
    EXISTS (SELECT 1 FROM course_bans WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION course_viewer_status() TO anon, authenticated;

-- ---------------------------------------------------------------- 3) 명단 조회

/*
 * 전체 수강생 명단. 운영진만 부를 수 있습니다.
 *
 * `auth.users`를 읽어야 해서 SECURITY DEFINER인데, 그러면 **누가 부르든 통과**하므로
 * 함수 안에서 직접 막습니다. 이 검사를 빼면 anon 키만으로 전교생 메일 주소가 털립니다.
 *
 * 가입만 하고 자기소개를 안 쓴 학생도 나와야 합니다(그래야 명단이 실제 수강생과
 * 맞는지 볼 수 있습니다). 그래서 auth.users를 기준으로 왼쪽 조인합니다.
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
  WHERE u.email_confirmed_at IS NOT NULL
  -- 차단된 사람을 위로 올려 조치 결과가 바로 보이게 합니다. 그다음 최근 가입순.
  ORDER BY (b.user_id IS NOT NULL) DESC, u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION course_members(TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
