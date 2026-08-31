-- 과목 게시판 쓰기 권한을 한양대 메일 인증 계정으로 제한합니다. 015 다음에 실행합니다.
--
-- 왜 폼 검사로는 안 되는가
-- ------------------------
-- 가입은 브라우저가 anon 키로 `supabase.auth.signUp`을 직접 부르는 호출입니다.
-- 회원가입 화면에서 도메인을 검사해도 개발자 도구를 연 사람에게는 아무 의미가 없고,
-- 애초에 StartUp Pilot 쪽 `/signup`으로 아무 메일이나 가입해 그 계정으로 과목
-- 게시판에 글을 쓸 수도 있습니다(지금 정책은 `auth.uid() = author_id`만 봅니다).
--
-- 그래서 경계를 "가입"이 아니라 "쓰기"에 둡니다. 어떤 경로로 만든 계정이든,
-- 한양대 메일로 **인증까지 마친** 계정만 과목 데이터를 쓸 수 있습니다.
--
-- 읽기는 그대로 열어 둡니다. 게시판은 로그인 없이 둘러볼 수 있어야 하고,
-- 그것이 이 과목 페이지가 공개 페이지인 이유입니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 자격 판정

/*
 * 이 계정이 과목 구성원인가.
 *
 * `auth.users`는 anon 역할에게 보이지 않으므로 SECURITY DEFINER로 읽습니다.
 * STABLE이라 한 쿼리 안에서 정책이 여러 번 참조해도 한 번만 계산합니다.
 *
 * 도메인 판정은 "hanyang.ac.kr로 끝나는가"가 아니라 "@ 또는 . 로 끊긴 뒤
 * hanyang.ac.kr로 끝나는가"입니다. 전자로 두면 `evil-hanyang.ac.kr`이 통과합니다.
 * 프런트엔드(src/features/course/course.ts의 isCourseEmail)와 같은 규칙입니다.
 *
 * 패턴을 `^`로 시작해 잠급니다. `@(...)$`로만 두면 Postgres 정규식이 문자열
 * 아무 곳에서나 맞춰 보므로 `a@evil.com@hanyang.ac.kr`의 **두 번째** @에 붙어
 * 통과합니다. 지금은 GoTrue가 그런 주소를 애초에 거절하지만, 두 겹의 방어가
 * 서로 다른 규칙을 쓰고 있을 이유는 없습니다.
 *
 * `email_confirmed_at`을 함께 봅니다. 이것이 없으면 남의 한양대 주소를 적어
 * 가입한 사람이 메일을 받아 보지도 않고 글을 쓸 수 있어, 도메인 제한이
 * 사실상 이름표에 그칩니다.
 */
CREATE OR REPLACE FUNCTION is_course_member()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email_confirmed_at IS NOT NULL
      AND email ~* '^[^@\s]+@([a-z0-9-]+\.)*hanyang\.ac\.kr$'
  );
$$;

-- 화면이 "왜 글쓰기 버튼이 안 열리지"를 설명할 수 있어야 합니다. 정책에서 조용히
-- 거절만 하면 사용자는 이유를 모릅니다. anon도 부를 수 있게 실행 권한을 엽니다
-- (자기 자신에 대한 판정만 돌려주므로 남의 정보가 새지 않습니다).
GRANT EXECUTE ON FUNCTION is_course_member() TO anon, authenticated;

-- ---------------------------------------------------------------- 2) 팀빌딩 모집

DROP POLICY IF EXISTS "Authenticated users can create recruitment posts" ON recruitment_posts;
CREATE POLICY "Authenticated users can create recruitment posts" ON recruitment_posts
  FOR INSERT WITH CHECK (auth.uid() = author_id AND is_course_member());

DROP POLICY IF EXISTS "Authors update their recruitment posts" ON recruitment_posts;
CREATE POLICY "Authors update their recruitment posts" ON recruitment_posts
  FOR UPDATE USING (auth.uid() = author_id AND is_course_member());

DROP POLICY IF EXISTS "Authors delete their recruitment posts" ON recruitment_posts;
CREATE POLICY "Authors delete their recruitment posts" ON recruitment_posts
  FOR DELETE USING (auth.uid() = author_id AND is_course_member());

-- ---------------------------------------------------------------- 3) 확정 팀

DROP POLICY IF EXISTS "Authenticated users can register teams" ON team_registrations;
CREATE POLICY "Authenticated users can register teams" ON team_registrations
  FOR INSERT WITH CHECK (auth.uid() = leader_id AND is_course_member());

DROP POLICY IF EXISTS "Leaders update their team registrations" ON team_registrations;
CREATE POLICY "Leaders update their team registrations" ON team_registrations
  FOR UPDATE USING (auth.uid() = leader_id AND is_course_member());

DROP POLICY IF EXISTS "Leaders delete their team registrations" ON team_registrations;
CREATE POLICY "Leaders delete their team registrations" ON team_registrations
  FOR DELETE USING (auth.uid() = leader_id AND is_course_member());

-- ---------------------------------------------------------------- 4) 기업 제안

-- 기업 담당자가 직접 올리는 것이 자연스러운 게시판이지만, 지금은 과목 구성원만
-- 쓸 수 있습니다("가입 가능한 메일은 한양대 주소만"이라는 규칙을 그대로 따릅니다).
-- 실무에서는 조교·교수가 기업에게 받아 대신 올리는 형태가 됩니다.
-- 기업 계정을 따로 열려면 도메인 화이트리스트 테이블이 필요하며, 그때 이 정책만 바꿉니다.
DROP POLICY IF EXISTS "Authenticated users can create corporate proposals" ON corporate_proposals;
CREATE POLICY "Authenticated users can create corporate proposals" ON corporate_proposals
  FOR INSERT WITH CHECK (auth.uid() = created_by AND is_course_member());

DROP POLICY IF EXISTS "Authors update their corporate proposals" ON corporate_proposals;
CREATE POLICY "Authors update their corporate proposals" ON corporate_proposals
  FOR UPDATE USING (auth.uid() = created_by AND is_course_member());

DROP POLICY IF EXISTS "Authors delete their corporate proposals" ON corporate_proposals;
CREATE POLICY "Authors delete their corporate proposals" ON corporate_proposals
  FOR DELETE USING (auth.uid() = created_by AND is_course_member());

-- ---------------------------------------------------------------- 5) 결과물

DROP POLICY IF EXISTS "Team leaders create deliverables" ON team_deliverables;
CREATE POLICY "Team leaders create deliverables" ON team_deliverables
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND is_course_member()
    AND EXISTS (SELECT 1 FROM team_registrations t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team leaders update deliverables" ON team_deliverables;
CREATE POLICY "Team leaders update deliverables" ON team_deliverables
  FOR UPDATE USING (
    is_course_member()
    AND EXISTS (SELECT 1 FROM team_registrations t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

DROP POLICY IF EXISTS "Team leaders delete deliverables" ON team_deliverables;
CREATE POLICY "Team leaders delete deliverables" ON team_deliverables
  FOR DELETE USING (
    is_course_member()
    AND EXISTS (SELECT 1 FROM team_registrations t WHERE t.id = team_id AND t.leader_id = auth.uid())
  );

-- ---------------------------------------------------------------- 6) 댓글

DROP POLICY IF EXISTS "Authenticated users write course comments" ON course_comments;
CREATE POLICY "Authenticated users write course comments" ON course_comments
  FOR INSERT WITH CHECK (auth.uid() = author_id AND is_course_member());

DROP POLICY IF EXISTS "Authors delete their course comments" ON course_comments;
CREATE POLICY "Authors delete their course comments" ON course_comments
  FOR DELETE USING (auth.uid() = author_id AND is_course_member());

-- ---------------------------------------------------------------- 7) 수강생 프로필

-- schema.sql의 정책은 `auth.role() = 'authenticated'`만 봤습니다. 학기 프로필은
-- 곧 "이 과목 수강생 명단"이라 같은 자격을 요구합니다.
DROP POLICY IF EXISTS "Authenticated users can create semester profiles" ON semester_profiles;
CREATE POLICY "Authenticated users can create semester profiles" ON semester_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id AND is_course_member());

DROP POLICY IF EXISTS "Users can update their own semester profiles" ON semester_profiles;
CREATE POLICY "Users can update their own semester profiles" ON semester_profiles
  FOR UPDATE USING (auth.uid() = user_id AND is_course_member());

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------- 8) 규칙 확인
--
-- 아래를 함께 실행하면 도메인 판정이 프런트엔드(course.test.ts)와 같은 답을 내는지
-- 눈으로 확인할 수 있습니다. ok 열이 전부 true여야 합니다.
--
--   SELECT addr, expected,
--          (addr ~* '^[^@\s]+@([a-z0-9-]+\.)*hanyang\.ac\.kr$') AS actual,
--          (addr ~* '^[^@\s]+@([a-z0-9-]+\.)*hanyang\.ac\.kr$') = expected AS ok
--   FROM (VALUES
--     ('hana@hanyang.ac.kr',            true),
--     ('hana@office.hanyang.ac.kr',     true),
--     ('HANA@HANYANG.AC.KR',            true),
--     ('hana@gmail.com',                false),
--     ('hana@evil-hanyang.ac.kr',       false),
--     ('hana@hanyang.ac.kr.evil.com',   false),
--     ('hana@evil.com@hanyang.ac.kr',   false),
--     ('hana @hanyang.ac.kr',           false)
--   ) AS t(addr, expected);
