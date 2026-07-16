begin;

-- Run with two fixture users in a disposable Supabase project. The manager must
-- never obtain preparation tasks, diagnostic details, or vault records.
select plan(3);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select is((select count(*) from public.workspace_tasks), 0::bigint, 'manager cannot read preparation tasks');
select is((select count(*) from public.diagnosis_reports), 0::bigint, 'manager cannot read preparation diagnoses');
select is((select count(*) from public.vault_documents), 0::bigint, 'manager cannot read preparation vault documents');

select * from finish();
rollback;
