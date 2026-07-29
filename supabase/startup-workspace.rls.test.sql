begin;

-- Run with two fixture users in a disposable Supabase project. The manager must
-- never obtain preparation tasks, diagnostic details, or vault records.
select plan(6);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.workspace_tasks), 0::bigint, 'manager cannot read preparation tasks');
select is((select count(*) from public.diagnosis_reports), 0::bigint, 'manager cannot read preparation diagnoses');
select is((select count(*) from public.vault_documents), 0::bigint, 'manager cannot read preparation vault documents');

-- 002-manager-review.sql: the manager sees converted teams only, and can never
-- change a submission except through the audited review RPC.
select is(
  (select count(*) from public.prep_teams t where not exists (select 1 from public.founder_teams f where f.prep_team_id = t.id)),
  0::bigint,
  'manager cannot read prep teams that never converted'
);
select is(
  (select count(*) from public.settlement_submissions where status = 'draft'),
  0::bigint,
  'manager cannot read draft submissions'
);
-- RLS blocks an UPDATE by matching zero rows rather than raising, so assert on
-- the affected-row count. This is exactly the failure mode the review RPC exists
-- to remove: a silent no-op that the client would otherwise report as success.
select is(
  (with updated as (
     update public.settlement_submissions set status = 'approved' where status = 'validated' returning 1
   ) select count(*) from updated),
  0::bigint,
  'manager cannot approve by direct update; review_settlement_submission is the only path'
);

select * from finish();
rollback;
