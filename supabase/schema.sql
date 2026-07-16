-- Enable RLS
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS semester_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS recruitment_post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS team_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS corporate_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS videos ENABLE ROW LEVEL SECURITY;

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

INSERT INTO programs (id, name, year, ruleset_version, requires_no_business_registration, blocks_prior_benefit)
VALUES
  ('yechang-2026', '2026 예비창업패키지', 2026, 'v1', true, true),
  ('chocang-2026', '2026 초기창업패키지', 2026, 'v1', false, true),
  ('modu-2026', '2026 모두의창업', 2026, 'v1', false, false)
ON CONFLICT (id) DO NOTHING;

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
