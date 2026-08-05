-- 008 기능 시나리오 검증. 실제 사용자 역할로 RLS와 RPC를 통과시켜 봅니다.
\set ON_ERROR_STOP on
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT ON leads TO anon;
GRANT SELECT ON library_documents TO anon;

-- 등장인물
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-4111-8111-111111111111', 'founder@test.local'),
  ('22222222-2222-4222-8222-222222222222', 'manager@test.local'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@test.local')
ON CONFLICT DO NOTHING;

INSERT INTO institutions (id, name) VALUES ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '테스트 주관기관') ON CONFLICT DO NOTHING;

-- 003 트리거가 role을 잠그므로 직접 UPDATE로 매니저를 만듭니다(운영에서는 004/부트스트랩이 함).
INSERT INTO startup_profiles (id, role, onboarding_complete) VALUES
  ('11111111-1111-4111-8111-111111111111', 'pre_founder', true),
  ('22222222-2222-4222-8222-222222222222', 'pre_founder', true),
  ('33333333-3333-4333-8333-333333333333', 'pre_founder', true)
ON CONFLICT (id) DO NOTHING;
UPDATE startup_profiles SET role='manager', institution_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  WHERE id='22222222-2222-4222-8222-222222222222';
UPDATE startup_profiles SET role='founder' WHERE id='11111111-1111-4111-8111-111111111111';

INSERT INTO prep_teams (id, name, item_summary, industry, leader_id) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '테스트 팀', '테스트 아이템', 'SaaS', '11111111-1111-4111-8111-111111111111') ON CONFLICT DO NOTHING;
INSERT INTO prep_team_members (prep_team_id, user_id, member_role) VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 'leader') ON CONFLICT DO NOTHING;
INSERT INTO founder_teams (id, prep_team_id, institution_id, program_id) VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'modu-2026') ON CONFLICT DO NOTHING;
INSERT INTO settlement_submissions (id, founder_team_id, title, requested_amount, validation_status, status, submitted_by) VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '테스트 집행', 1000000, 'passed', 'validated', '11111111-1111-4111-8111-111111111111')
ON CONFLICT DO NOTHING;

\echo ''
\echo '### 1. 전환 코드 발급 — 매니저는 성공해야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT length(issue_conversion_code('modu-2026', 50)) AS 발급된_코드_길이;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 2. 전환 코드 발급 — 매니저가 아니면 거부되어야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
DO $$ BEGIN
  PERFORM issue_conversion_code('modu-2026', 10);
  RAISE EXCEPTION '❌ 창업자가 코드를 발급했습니다 — 권한 검사 실패';
EXCEPTION WHEN sqlstate 'P0001' THEN
  IF SQLERRM LIKE '%MANAGER_ROLE_REQUIRED%' THEN RAISE NOTICE '✓ 거부됨: %', SQLERRM;
  ELSE RAISE; END IF;
END $$;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 3. 검토 착수 — 매니저가 열면 validated → in_review'
SET role authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT claim_settlement_submission('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;
SELECT status AS 착수후_상태 FROM settlement_submissions WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

\echo ''
\echo '### 4. 검토 착수 — 두 번 눌러도 안전(멱등)해야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT claim_settlement_submission('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;
SELECT status AS 재착수후_상태 FROM settlement_submissions WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';

\echo ''
\echo '### 5. 검토 착수 — 무관한 사람은 거부되어야 한다'
UPDATE settlement_submissions SET status='validated' WHERE id='dddddddd-dddd-4ddd-8ddd-dddddddddddd';
SET role authenticated;
SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
DO $$ BEGIN
  PERFORM claim_settlement_submission('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  RAISE EXCEPTION '❌ 외부인이 검토에 착수했습니다';
EXCEPTION WHEN sqlstate 'P0001' THEN
  IF SQLERRM LIKE '%MANAGER_ROLE_REQUIRED%' THEN RAISE NOTICE '✓ 거부됨: %', SQLERRM;
  ELSE RAISE; END IF;
END $$;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 6. 비목 배정액 — 팀원은 쓰고 읽을 수 있어야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
INSERT INTO budget_allocations (founder_team_id, category, allocated_amount)
  VALUES ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'material', 10000000);
SELECT category, allocated_amount AS 배정액 FROM budget_allocations;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 7. 비목 배정액 — 남의 팀 것은 보이면 안 된다'
SET role authenticated;
SET request.jwt.claim.sub = '33333333-3333-4333-8333-333333333333';
SELECT count(*) AS 외부인에게_보이는_행수 FROM budget_allocations;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 8. 비목 배정액 — 해당 기관 매니저는 읽을 수 있어야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT count(*) AS 매니저에게_보이는_행수 FROM budget_allocations;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 9. 자료실 — 비로그인도 목록을 볼 수 있어야 한다'
SET role anon;
SELECT count(*) AS 익명이_보는_자료수 FROM library_documents;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 10. 리드 수집 — 비로그인도 동의 후 남길 수 있어야 한다'
SET role anon;
SET request.jwt.claim.role = 'anon';
INSERT INTO leads (email, source, consented_at) VALUES ('anon@test.local', 'calc_insurance', now());
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;
SELECT count(*) AS 익명_리드수 FROM leads WHERE email='anon@test.local';

\echo ''
\echo '### 11. 리드 수집 — 동의 없으면 거부되어야 한다'
SET role anon;
SET request.jwt.claim.role = 'anon';
DO $$ BEGIN
  INSERT INTO leads (email, source, consented_at) VALUES ('nc@test.local', 'x', NULL);
  RAISE EXCEPTION '❌ 동의 없는 리드가 저장되었습니다';
EXCEPTION
  WHEN not_null_violation THEN RAISE NOTICE '✓ 거부됨 (NOT NULL)';
  WHEN insufficient_privilege THEN RAISE NOTICE '✓ 거부됨 (RLS)';
END $$;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 12. 할 일 담당자·코멘트 — 팀원은 지정하고 남길 수 있어야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '11111111-1111-4111-8111-111111111111';
INSERT INTO workspace_tasks (id, prep_team_id, title, assignee_id)
  VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '테스트 할 일', '11111111-1111-4111-8111-111111111111');
INSERT INTO task_comments (task_id, author_id, content)
  VALUES ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '11111111-1111-4111-8111-111111111111', '첫 코멘트');
SELECT t.assignee_id IS NOT NULL AS 담당자_지정됨, count(c.id) AS 코멘트수
  FROM workspace_tasks t LEFT JOIN task_comments c ON c.task_id = t.id
  WHERE t.id='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' GROUP BY t.assignee_id;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;

\echo ''
\echo '### 13. 준비 데이터 비공개 — 매니저는 팀 할 일·코멘트를 볼 수 없어야 한다'
SET role authenticated;
SET request.jwt.claim.sub = '22222222-2222-4222-8222-222222222222';
SELECT (SELECT count(*) FROM workspace_tasks) AS 매니저가_보는_할일수,
       (SELECT count(*) FROM task_comments)   AS 매니저가_보는_코멘트수;
RESET role; RESET request.jwt.claim.sub; RESET request.jwt.claim.role;
