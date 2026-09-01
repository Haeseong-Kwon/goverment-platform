-- 운영진 한 명 추가 + 화면에서 운영진을 알아볼 수 있게 합니다. 021 다음에 실행합니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 명단 추가

INSERT INTO course_staff (email, note) VALUES
  ('damage555@hanyang.ac.kr', '운영·개발')
ON CONFLICT (email) DO NOTHING;

-- ---------------------------------------------------------------- 2) 운영진 식별

/*
 * 운영진의 사용자 id 목록.
 *
 * `is_course_staff()`는 "나는 운영진인가"만 답합니다. 화면에서 "이 글을 쓴 사람이
 * 운영진인가"를 표시하려면 남에 대한 판정이 필요합니다.
 *
 * **메일 주소는 돌려주지 않습니다.** id만 있으면 뱃지를 붙이는 데 충분하고,
 * 명단을 열면 교수·조교 메일 주소가 그대로 수집됩니다(course_staff에 SELECT 정책을
 * 두지 않은 것과 같은 이유입니다).
 *
 * 게시판이 로그인 없이 열리므로 anon도 부를 수 있어야 합니다 — 비로그인 방문자에게도
 * 공지 작성자가 교수자로 보여야 합니다.
 */
CREATE OR REPLACE FUNCTION course_staff_ids()
RETURNS TABLE (user_id UUID) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT u.id
  FROM auth.users u
  JOIN course_staff s ON s.email = lower(trim(u.email))
  WHERE u.email_confirmed_at IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION course_staff_ids() TO anon, authenticated;

NOTIFY pgrst, 'reload schema';
