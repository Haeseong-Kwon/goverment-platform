-- 1. Profiles Table (Students/Users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'Student',
  major TEXT,
  bio TEXT,
  tech_stack TEXT[],
  github_url TEXT,
  portfolio_url TEXT,
  avatar_url TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 1-1. Semester Profiles Table (semester-scoped self introductions)
CREATE TABLE IF NOT EXISTS semester_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  semester_key TEXT NOT NULL,
  academic_year INTEGER NOT NULL,
  academic_term TEXT NOT NULL,
  course_track TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT DEFAULT 'Student',
  major TEXT,
  bio TEXT,
  tech_stack TEXT[],
  github_url TEXT,
  portfolio_url TEXT,
  avatar_url TEXT,
  status TEXT DEFAULT 'LOOKING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE (user_id, semester_key)
);

-- 2. Recruitment Posts Table
CREATE TABLE IF NOT EXISTS recruitment_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  semester_key TEXT,
  academic_year INTEGER,
  academic_term TEXT,
  course_track TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags TEXT[],
  project_phase TEXT DEFAULT 'IDEA',
  course_badge TEXT DEFAULT 'CAPSTONE_1',
  recruiting_roles JSONB,
  status TEXT DEFAULT 'Recruiting',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2-1. Recruitment Post Comments Table
CREATE TABLE IF NOT EXISTS recruitment_post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES recruitment_posts(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2-2. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  post_id UUID REFERENCES recruitment_posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES recruitment_post_comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Team Registrations Table
CREATE TABLE IF NOT EXISTS team_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_key TEXT,
  academic_year INTEGER,
  academic_term TEXT,
  course_track TEXT,
  team_name TEXT NOT NULL,
  project_item TEXT NOT NULL,
  members JSONB, -- Changed from TEXT[] to support {role, name} objects
  leader_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'Activities',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Corporate Proposals Table
CREATE TABLE IF NOT EXISTS corporate_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  semester_key TEXT,
  academic_year INTEGER,
  academic_term TEXT,
  course_track TEXT,
  company_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT[],
  deadline DATE,
  thumbnail_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Videos Table
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  instructor TEXT,
  duration TEXT,
  view_count INTEGER DEFAULT 0,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE IF EXISTS recruitment_posts ADD COLUMN IF NOT EXISTS semester_key TEXT;
ALTER TABLE IF EXISTS recruitment_posts ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE IF EXISTS recruitment_posts ADD COLUMN IF NOT EXISTS academic_term TEXT;
ALTER TABLE IF EXISTS recruitment_posts ADD COLUMN IF NOT EXISTS course_track TEXT;
ALTER TABLE IF EXISTS recruitment_posts ADD COLUMN IF NOT EXISTS project_phase TEXT DEFAULT 'IDEA';
ALTER TABLE IF EXISTS recruitment_posts ADD COLUMN IF NOT EXISTS course_badge TEXT DEFAULT 'CAPSTONE_1';

ALTER TABLE IF EXISTS team_registrations ADD COLUMN IF NOT EXISTS semester_key TEXT;
ALTER TABLE IF EXISTS team_registrations ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE IF EXISTS team_registrations ADD COLUMN IF NOT EXISTS academic_term TEXT;
ALTER TABLE IF EXISTS team_registrations ADD COLUMN IF NOT EXISTS course_track TEXT;

ALTER TABLE IF EXISTS corporate_proposals ADD COLUMN IF NOT EXISTS semester_key TEXT;
ALTER TABLE IF EXISTS corporate_proposals ADD COLUMN IF NOT EXISTS academic_year INTEGER;
ALTER TABLE IF EXISTS corporate_proposals ADD COLUMN IF NOT EXISTS academic_term TEXT;
ALTER TABLE IF EXISTS corporate_proposals ADD COLUMN IF NOT EXISTS course_track TEXT;
ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS instructor TEXT;
ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE IF EXISTS videos ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- RLS는 반드시 CREATE TABLE **뒤에** 켭니다.
--
-- 원래 이 블록은 파일 맨 위에 `ALTER TABLE IF EXISTS ...` 형태로 있었습니다.
-- 새 프로젝트에서는 그 시점에 테이블이 없어 `IF EXISTS`가 조용히 넘어갔고,
-- 뒤이어 만들어진 테이블 8개는 RLS가 꺼진 채 남았습니다 — 아래 정책들이 전부
-- 무효가 되어, 브라우저 번들에 들어 있는 anon 키만으로 남의 이름으로 글을 쓰고
-- 지울 수 있는 상태였습니다. 이미 배포된 프로젝트는 015가 고칩니다.
--
-- `IF EXISTS`를 쓰지 않습니다. 순서가 어긋나면 조용히 넘어가는 대신 실패해야 합니다.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE semester_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recruitment_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE corporate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Public Semester profiles are viewable by everyone" ON semester_profiles;
DROP POLICY IF EXISTS "Authenticated users can create semester profiles" ON semester_profiles;
DROP POLICY IF EXISTS "Users can update their own semester profiles" ON semester_profiles;
DROP POLICY IF EXISTS "Public Recruitment posts are viewable by everyone" ON recruitment_posts;
DROP POLICY IF EXISTS "Authenticated users can create recruitment posts" ON recruitment_posts;
DROP POLICY IF EXISTS "Public Recruitment post comments are viewable by everyone" ON recruitment_post_comments;
DROP POLICY IF EXISTS "Authenticated users can create recruitment post comments" ON recruitment_post_comments;
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Public Team registrations are viewable by everyone" ON team_registrations;
DROP POLICY IF EXISTS "Authenticated users can register teams" ON team_registrations;
DROP POLICY IF EXISTS "Public Corporate proposals are viewable by everyone" ON corporate_proposals;
DROP POLICY IF EXISTS "Authenticated users can create corporate proposals" ON corporate_proposals;
DROP POLICY IF EXISTS "Public Videos are viewable by everyone" ON videos;
DROP POLICY IF EXISTS "Authenticated users can create videos" ON videos;

-- Basic RLS Policies (Public Read, Authenticated Write)
CREATE POLICY "Public Profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can create their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public Semester profiles are viewable by everyone" ON semester_profiles FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create semester profiles" ON semester_profiles FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);
CREATE POLICY "Users can update their own semester profiles" ON semester_profiles FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Public Recruitment posts are viewable by everyone" ON recruitment_posts FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create recruitment posts" ON recruitment_posts FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public Recruitment post comments are viewable by everyone" ON recruitment_post_comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create recruitment post comments" ON recruitment_post_comments FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = author_id);

CREATE POLICY "Users can view their own notifications" ON notifications FOR SELECT USING (auth.uid() = recipient_id);
CREATE POLICY "Authenticated users can create notifications" ON notifications FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = actor_id);
CREATE POLICY "Users can update their own notifications" ON notifications FOR UPDATE USING (auth.uid() = recipient_id);

CREATE POLICY "Public Team registrations are viewable by everyone" ON team_registrations FOR SELECT USING (true);
CREATE POLICY "Authenticated users can register teams" ON team_registrations FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Public Corporate proposals are viewable by everyone" ON corporate_proposals FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create corporate proposals" ON corporate_proposals FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Public Videos are viewable by everyone" ON videos FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create videos" ON videos FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Startup workspace: founder preparation data is private to its team. Institution
-- users only receive validated settlement submissions through dedicated policies.
CREATE TABLE IF NOT EXISTS institutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS startup_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'pre_founder' CHECK (role IN ('pre_founder', 'founder', 'manager')),
  position TEXT,
  team_building_intent BOOLEAN NOT NULL DEFAULT false,
  desired_positions TEXT[] NOT NULL DEFAULT '{}',
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  institution_id UUID REFERENCES institutions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS programs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  year INTEGER NOT NULL,
  announcement_date DATE,
  deadline DATE,
  ruleset_version TEXT,
  requires_no_business_registration BOOLEAN NOT NULL DEFAULT false,
  blocks_prior_benefit BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- deadline은 채우지 않습니다.
--
-- 예전에는 임시값(current_date + 30일 등)을 넣어 두었습니다. 그 날짜는 어떤 공고문에도
-- 없는 값이라, 대시보드가 존재하지 않는 마감을 D-day로 띄우고 그 날짜를 기준으로
-- 자동 마일스톤까지 만들어 냈습니다. 화면에 뜨는 모든 마감은 근거가 있어야 합니다.
--
-- 일정은 `kstartup_announcements`(K-Startup 공개 API 캐시)에서 사업명으로 찾아 씁니다.
-- 접수 중인 공고가 없으면 화면은 날짜를 지어내는 대신 "접수 중인 공고 없음"으로 말합니다.
-- 이 테이블은 자격 판정 룰셋(requires_no_business_registration 등)만 담당합니다.
INSERT INTO programs (id, name, year, ruleset_version, requires_no_business_registration, blocks_prior_benefit)
VALUES
  ('yechang-2026', '예비창업패키지', 2026, 'v1', true, true),
  ('chocang-2026', '초기창업패키지', 2026, 'v1', false, true),
  ('modu-2026', '창업도약패키지', 2026, 'v1', false, false)
ON CONFLICT (id) DO NOTHING;

-- 이미 임시 마감일이 들어간 기존 DB는 이 파일이 아니라 013-real-announcement-deadlines.sql로
-- 정리합니다. schema.sql은 새 환경을 세우는 파일이라 기존 행을 고치지 않습니다.

CREATE TABLE IF NOT EXISTS prep_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  item_summary TEXT NOT NULL,
  industry TEXT,
  leader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS prep_team_members (
  prep_team_id UUID NOT NULL REFERENCES prep_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('leader', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (prep_team_id, user_id)
);

CREATE TABLE IF NOT EXISTS prep_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_team_id UUID NOT NULL REFERENCES prep_teams(id) ON DELETE CASCADE,
  program_id TEXT NOT NULL REFERENCES programs(id),
  deadline DATE,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (prep_team_id, program_id)
);

CREATE TABLE IF NOT EXISTS workspace_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_team_id UUID NOT NULL REFERENCES prep_teams(id) ON DELETE CASCADE,
  prep_project_id UUID REFERENCES prep_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  task_type TEXT NOT NULL DEFAULT 'custom' CHECK (task_type IN ('auto', 'custom')),
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  assignee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES workspace_tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS founder_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_team_id UUID NOT NULL UNIQUE REFERENCES prep_teams(id) ON DELETE RESTRICT,
  institution_id UUID NOT NULL REFERENCES institutions(id),
  program_id TEXT REFERENCES programs(id),
  converted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS vault_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_team_id UUID NOT NULL REFERENCES prep_teams(id) ON DELETE CASCADE,
  founder_team_id UUID REFERENCES founder_teams(id) ON DELETE SET NULL,
  folder TEXT NOT NULL CHECK (folder IN ('bizplan', 'evidence', 'submission_archive')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (prep_team_id, folder, file_name, version)
);

CREATE TABLE IF NOT EXISTS diagnosis_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_team_id UUID NOT NULL REFERENCES prep_teams(id) ON DELETE CASCADE,
  document_id UUID REFERENCES vault_documents(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('eligibility', 'bizplan')),
  state TEXT NOT NULL DEFAULT 'review',
  score INTEGER CHECK (score BETWEEN 0 AND 100),
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS diagnosis_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credit_type TEXT NOT NULL CHECK (credit_type IN ('monthly_free', 'invite_bonus', 'debit', 'refund')),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS conversion_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  program_id TEXT REFERENCES programs(id),
  code TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  max_uses INTEGER NOT NULL DEFAULT 1 CHECK (max_uses > 0),
  use_count INTEGER NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS settlement_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  founder_team_id UUID NOT NULL REFERENCES founder_teams(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  requested_amount NUMERIC(14, 0) NOT NULL CHECK (requested_amount >= 0),
  validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending', 'passed', 'failed')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'validated', 'in_review', 'approved', 'rejected')),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS submission_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES settlement_submissions(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES auth.users(id),
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  reason_code TEXT,
  feedback TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  source TEXT NOT NULL,
  consented_at TIMESTAMPTZ NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS waitlist_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab TEXT NOT NULL CHECK (tab IN ('team_building', 'mentor', 'investment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, tab)
);

CREATE TABLE IF NOT EXISTS workspace_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prep_team_id UUID REFERENCES prep_teams(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE OR REPLACE FUNCTION is_prep_team_member(team_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM prep_team_members WHERE prep_team_id = team_id AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION is_institution_manager(target_institution_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM startup_profiles WHERE id = auth.uid() AND role = 'manager' AND institution_id = target_institution_id);
$$;

ALTER TABLE institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE startup_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE prep_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE founder_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE diagnosis_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlement_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users read own startup profile" ON startup_profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "users create own startup profile" ON startup_profiles FOR INSERT WITH CHECK (id = auth.uid());
CREATE POLICY "users update own startup profile" ON startup_profiles FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "authenticated users read active programs" ON programs FOR SELECT USING (auth.role() = 'authenticated' AND is_active);
CREATE POLICY "team members read preparation teams" ON prep_teams FOR SELECT USING (is_prep_team_member(id));
CREATE POLICY "leaders create preparation teams" ON prep_teams FOR INSERT WITH CHECK (leader_id = auth.uid());
CREATE POLICY "team members read members" ON prep_team_members FOR SELECT USING (is_prep_team_member(prep_team_id));
CREATE POLICY "leaders add members" ON prep_team_members FOR INSERT WITH CHECK (is_prep_team_member(prep_team_id) OR user_id = auth.uid());
CREATE POLICY "team members read projects" ON prep_projects FOR SELECT USING (is_prep_team_member(prep_team_id));
CREATE POLICY "team members manage projects" ON prep_projects FOR ALL USING (is_prep_team_member(prep_team_id)) WITH CHECK (is_prep_team_member(prep_team_id));
CREATE POLICY "team members manage tasks" ON workspace_tasks FOR ALL USING (is_prep_team_member(prep_team_id)) WITH CHECK (is_prep_team_member(prep_team_id));
CREATE POLICY "team members read task comments" ON task_comments FOR SELECT USING (EXISTS (SELECT 1 FROM workspace_tasks t WHERE t.id = task_id AND is_prep_team_member(t.prep_team_id)));
CREATE POLICY "team members create task comments" ON task_comments FOR INSERT WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM workspace_tasks t WHERE t.id = task_id AND is_prep_team_member(t.prep_team_id)));
CREATE POLICY "team members manage vault documents" ON vault_documents FOR ALL USING (is_prep_team_member(prep_team_id)) WITH CHECK (is_prep_team_member(prep_team_id));
CREATE POLICY "team members manage diagnosis reports" ON diagnosis_reports FOR ALL USING (is_prep_team_member(prep_team_id)) WITH CHECK (is_prep_team_member(prep_team_id));
CREATE POLICY "users read own diagnosis credits" ON diagnosis_credits FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users read own waitlist entries" ON waitlist_entries FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "users join own waitlist" ON waitlist_entries FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "users read own events" ON workspace_events FOR SELECT USING (user_id = auth.uid() OR is_prep_team_member(prep_team_id));
CREATE POLICY "users create own events" ON workspace_events FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "founders read own founder teams" ON founder_teams FOR SELECT USING (is_prep_team_member(prep_team_id));
CREATE POLICY "managers read own institution founder teams" ON founder_teams FOR SELECT USING (is_institution_manager(institution_id));
CREATE POLICY "founders read own submissions" ON settlement_submissions FOR SELECT USING (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id)));
CREATE POLICY "founders create own submissions" ON settlement_submissions FOR INSERT WITH CHECK (submitted_by = auth.uid() AND EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id)));
CREATE POLICY "founders update own submissions" ON settlement_submissions FOR UPDATE USING (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id))) WITH CHECK (EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_prep_team_member(f.prep_team_id)));
CREATE POLICY "managers read validated institution submissions" ON settlement_submissions FOR SELECT USING (status IN ('validated', 'in_review', 'approved', 'rejected') AND EXISTS (SELECT 1 FROM founder_teams f WHERE f.id = founder_team_id AND is_institution_manager(f.institution_id)));
CREATE POLICY "managers read institution codes" ON conversion_codes FOR SELECT USING (is_institution_manager(institution_id));
CREATE POLICY "managers create institution codes" ON conversion_codes FOR INSERT WITH CHECK (created_by = auth.uid() AND is_institution_manager(institution_id));
CREATE POLICY "managers read institution reviews" ON submission_reviews FOR SELECT USING (EXISTS (SELECT 1 FROM settlement_submissions s JOIN founder_teams f ON f.id = s.founder_team_id WHERE s.id = submission_id AND is_institution_manager(f.institution_id)));
CREATE POLICY "managers create institution reviews" ON submission_reviews FOR INSERT WITH CHECK (manager_id = auth.uid() AND EXISTS (SELECT 1 FROM settlement_submissions s JOIN founder_teams f ON f.id = s.founder_team_id WHERE s.id = submission_id AND is_institution_manager(f.institution_id)));
CREATE POLICY "authenticated users create consented leads" ON leads FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND consented_at IS NOT NULL);

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
  UPDATE startup_profiles SET role = 'founder', updated_at = now() WHERE id = auth.uid();
  INSERT INTO workspace_events (user_id, prep_team_id, event_name, payload) VALUES (auth.uid(), source_team.id, 'convert_completed', jsonb_build_object('founder_team_id', new_founder_team, 'institution_id', code_row.institution_id));
  RETURN new_founder_team;
END;
$$;

-- K-Startup 지원사업 공고 캐시.
--
-- 출처: 공공데이터포털 `창업진흥원_K-Startup(사업소개,사업공고,콘텐츠 등)_조회서비스`
--       (dataset 15125364) / `getAnnouncementInformation01`. 갱신 주기는 일 1회입니다.
--
-- 왜 `programs` 테이블에 넣지 않는가:
--   `programs`는 자격 진단 룰셋(ruleset_version)과 prep_projects·conversion_codes의
--   외래키가 걸린 축입니다. 매일 수백 건이 들어오고 사라지는 외부 공고를 같은 테이블에
--   섞으면 룰셋 없는 행이 진단 화면에 뜨고, 동기화가 지우는 순간 참조가 끊깁니다.
--   공고 목록은 읽기 전용 캐시로 분리하고, 자격 룰셋은 기존 `programs`가 계속 담당합니다.

CREATE TABLE IF NOT EXISTS kstartup_announcements (
  -- K-Startup 공고 일련번호. 원문 URL의 pbancSn과 같은 값이라 그대로 기본키로 씁니다.
  pbanc_sn BIGINT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  start_date DATE,
  end_date DATE,
  support_field TEXT,
  -- 다중값 컬럼은 쉼표 문자열 대신 배열로 저장합니다. ILIKE '%경남%'은
  -- '전남광주' 같은 이웃 토큰을 잘못 집어내지만, 배열 겹침(&&)은 토큰 단위로 정확합니다.
  regions TEXT[] NOT NULL DEFAULT '{}',
  biz_ages TEXT[] NOT NULL DEFAULT '{}',
  applicant_types TEXT[] NOT NULL DEFAULT '{}',
  target_ages TEXT[] NOT NULL DEFAULT '{}',
  organizer TEXT,
  supervising_institution TEXT,
  department TEXT,
  contact TEXT,
  apply_target TEXT,
  exclude_target TEXT,
  apply_methods JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  detail_url TEXT,
  guide_url TEXT,
  is_integrated BOOLEAN NOT NULL DEFAULT false,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 기본 정렬(마감 임박순)과 "마감 지난 공고 숨기기"가 모두 이 컬럼을 봅니다.
CREATE INDEX IF NOT EXISTS kstartup_announcements_end_date_idx ON kstartup_announcements (end_date);

-- ponytail: 배열 필터는 인덱스 없이 순차 스캔입니다. 동기화 창이 "접수 중" 수백 건이라
-- 지금은 즉시 응답합니다. 보관 기간을 늘려 수천 건이 되면 regions/applicant_types에
-- GIN 인덱스를 추가하세요.

ALTER TABLE kstartup_announcements ENABLE ROW LEVEL SECURITY;

-- 정부 공개 데이터입니다. 로그인 여부와 무관하게 읽히고, 쓰기는 service_role
-- (RLS 우회)로 도는 동기화 라우트만 합니다. 여기에 쓰기 정책을 두지 않는 것이
-- 곧 "아무 사용자도 공고를 수정할 수 없다"는 뜻입니다.
DROP POLICY IF EXISTS "anyone reads kstartup announcements" ON kstartup_announcements;
CREATE POLICY "anyone reads kstartup announcements" ON kstartup_announcements FOR SELECT USING (true);

-- 캘린더에 담은 K-Startup 공고를 팀 일정과 구분하기 위한 연결 고리.
--
-- 지금까지 "캘린더에 추가"는 공고를 그냥 할 일 한 줄로 만들었습니다. 그래서 캘린더에서
-- 공고 마감과 팀이 직접 만든 일정이 같은 색·같은 모양으로 섞였고, 원문 링크·접수 기간
-- 같은 공고 고유 정보는 제목 문자열 말고는 남지 않았습니다. 공고 일련번호를 함께 저장해
-- 캘린더가 둘을 구분하고 공고 정보를 다시 붙일 수 있게 합니다.
--
-- 외래키를 걸지 않습니다. 동기화 라우트가 마감 14일이 지난 공고를 지우는데, FK가 있으면
-- 그 삭제가 막히거나(RESTRICT) 팀이 만들어 둔 일정이 함께 사라집니다(CASCADE).
-- 팀 일정은 공고 캐시보다 오래 살아야 합니다. 공고가 정리된 뒤에도 일련번호만 있으면
-- 원문 URL은 그대로 조립되므로 화면은 깨지지 않습니다.
ALTER TABLE workspace_tasks ADD COLUMN IF NOT EXISTS announcement_sn BIGINT;

COMMENT ON COLUMN workspace_tasks.announcement_sn IS
  'K-Startup 공고 일련번호(kstartup_announcements.pbanc_sn). 공고에서 담은 일정만 값이 있으며, 의도적으로 FK를 걸지 않습니다.';

-- 같은 공고를 두 번 담지 못하게 합니다. 눌린 줄 모르고 다시 누르면 같은 마감이 두 줄로
-- 쌓여 캘린더가 지저분해집니다(화면의 "캘린더에 있음" 표시는 새로고침하면 사라집니다).
CREATE UNIQUE INDEX IF NOT EXISTS workspace_tasks_team_announcement_key
  ON workspace_tasks (prep_team_id, announcement_sn)
  WHERE announcement_sn IS NOT NULL;
-- 일정 코멘트에 붙는 파일 첨부.
--
-- 지금까지 코멘트는 글자만 남길 수 있어서 "사업계획서 3판 검토 부탁드립니다" 다음에
-- 정작 그 파일이 어디 있는지는 카톡·메일로 흩어졌습니다. 코멘트가 붙은 업무 옆에
-- 파일도 함께 남겨 한 곳에서 끝냅니다.
--
-- 새 버킷을 만들지 않고 `vault`를 그대로 씁니다. vault의 storage 정책은 경로의 첫
-- 세그먼트가 팀 UUID인지로 접근을 가릅니다(005). 첨부 경로를
-- `{prep_team_id}/comments/{comment_id}/{파일명}`으로 두면 같은 정책이 그대로 적용돼
-- 팀 밖 사람은 서명 링크조차 만들지 못합니다.
--
-- vault_documents에 얹지 않는 이유: 그 테이블은 folder가 세 값으로 고정된 보관함이고,
-- 버전 유니크 제약(팀·폴더·파일명·버전)이 걸려 있습니다. 코멘트 첨부는 버전 관리 대상이
-- 아니라 그 코멘트에 종속된 부속물이라, 코멘트가 지워지면 함께 사라져야 합니다.
CREATE TABLE IF NOT EXISTS task_comment_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES task_comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL CHECK (char_length(trim(file_name)) > 0),
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 코멘트 스레드는 항상 "이 코멘트의 첨부 전부"로 읽습니다.
CREATE INDEX IF NOT EXISTS task_comment_files_comment_idx ON task_comment_files (comment_id);

ALTER TABLE task_comment_files ENABLE ROW LEVEL SECURITY;

-- 권한은 코멘트가 달린 업무의 팀 소속으로 판단합니다. 코멘트 본문 정책과 같은 기준이라
-- "코멘트는 보이는데 첨부만 안 보이는" 어긋남이 생기지 않습니다.
DROP POLICY IF EXISTS "team members read comment files" ON task_comment_files;
CREATE POLICY "team members read comment files" ON task_comment_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM task_comments c
      JOIN workspace_tasks t ON t.id = c.task_id
      WHERE c.id = comment_id AND is_prep_team_member(t.prep_team_id)
    )
  );

DROP POLICY IF EXISTS "team members create comment files" ON task_comment_files;
CREATE POLICY "team members create comment files" ON task_comment_files
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM task_comments c
      JOIN workspace_tasks t ON t.id = c.task_id
      WHERE c.id = comment_id AND is_prep_team_member(t.prep_team_id)
    )
  );
