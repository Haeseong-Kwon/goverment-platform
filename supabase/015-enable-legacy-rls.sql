-- 레거시 테이블 8개의 RLS를 실제로 켭니다. 014 다음에 실행합니다.
--
-- 왜 필요한가
-- ------------
-- schema.sql 2~9행은 `ALTER TABLE IF EXISTS ... ENABLE ROW LEVEL SECURITY`인데,
-- 정작 그 테이블들은 12행부터 만들어집니다. 새 프로젝트에서는 ENABLE 시점에
-- 테이블이 없어 `IF EXISTS`가 조용히 넘어가고, 그 뒤 만들어진 테이블은 RLS가
-- 꺼진 채 남습니다. 아래에 정의된 정책들은 전부 무효였습니다.
--
-- 실제로 확인한 상태(anon 키, 로그인 없음):
--   - recruitment_posts / team_registrations / corporate_proposals 에
--     실존 사용자 이름으로 글 INSERT 성공
--   - 같은 행 DELETE 성공
--   - profiles 도 같은 상태 — 브라우저 번들에 들어 있는 anon 키만으로
--     아무나 남의 이름을 바꾸거나 지울 수 있었습니다
--
-- 워크스페이스 테이블(schema.sql 414~431행)은 `IF EXISTS` 없이 생성 뒤에 켜므로
-- 영향이 없습니다. 이 파일이 건드리는 것은 위 8개뿐입니다.
--
-- 재실행해도 안전합니다.

-- ---------------------------------------------------------------- 1) 프로필 생성 경로

-- RLS를 켜기 전에 이것부터 세워야 합니다.
--
-- 지금 profiles 행은 브라우저가 만듭니다(AuthService.signUp의 upsert). 그런데 이
-- 프로젝트는 이메일 인증이 켜져 있어 가입 직후에는 세션이 없고, RLS를 켜는 순간
-- `WITH CHECK (auth.uid() = id)`에 막힙니다. 그 실패는 console.error만 남기고
-- 지나가므로, 신규 가입자는 프로필 없이 남고 게시판에서 이름이 전부
-- "이름 미등록"으로 보이게 됩니다.
--
-- (같은 함정을 startup_profiles에서 이미 겪었습니다 — WorkspaceService의
--  completeOnboarding이 "프로필 행이 없을 수 있습니다"로 시작하는 이유입니다.)
--
-- 트리거는 SECURITY DEFINER로 돌아 세션과 무관하게 실행되므로, 인증 메일을
-- 누르기 전이든 후든 프로필이 반드시 생깁니다.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    -- 가입 폼이 넘기는 값입니다. 비어 있으면 이메일 아이디 부분으로 대신합니다 —
    -- 이름 없는 계정이 게시판에 "이름 미등록"으로 남는 것보다 낫습니다.
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''), split_part(NEW.email, '@', 1)),
    'Student'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 이미 가입한 사람 중 프로필이 없는 계정을 채웁니다. 이 백필이 없으면 RLS를 켠
-- 순간 기존 사용자도 이름을 새로 만들 길이 없습니다(브라우저 INSERT는 막히고,
-- 트리거는 신규 가입에만 걸리므로).
INSERT INTO profiles (id, full_name, role)
SELECT
  u.id,
  COALESCE(NULLIF(trim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1)),
  'Student'
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------- 2) RLS 켜기

-- `IF EXISTS` 없이 씁니다. 테이블이 없으면 조용히 넘어가는 대신 여기서 실패해야
-- 합니다 — 조용한 no-op이 애초에 이 구멍을 만들었습니다.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------- 3) 빠진 정책

-- videos에는 공개 읽기 정책만 있고 쓰기 정책이 로그인 여부만 봅니다. 지금 이
-- 테이블을 쓰는 화면이 없으므로 읽기만 남기고 쓰기는 닫습니다. 쓸 일이 생기면
-- 그때 소유자 컬럼과 함께 다시 엽니다.
DROP POLICY IF EXISTS "Authenticated users can create videos" ON videos;

-- profiles 삭제 정책은 두지 않습니다. 계정 삭제는 auth.users 쪽 일이고,
-- 게시판에서 프로필 행이 사라지면 남은 글의 작성자를 알 수 없게 됩니다.

-- ---------------------------------------------------------------- 4) 확인

-- 아래를 함께 실행하면 남은 구멍이 있는지 한눈에 보입니다.
-- rowsecurity가 false인 public 테이블이 하나도 없어야 합니다.
--
--   SELECT tablename, rowsecurity
--   FROM pg_tables
--   WHERE schemaname = 'public' AND NOT rowsecurity
--   ORDER BY tablename;

NOTIFY pgrst, 'reload schema';
