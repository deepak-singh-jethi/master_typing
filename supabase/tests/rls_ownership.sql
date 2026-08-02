-- Run against a disposable/staging database after migrations.
-- It seeds two temporary learner scopes, verifies account isolation across every
-- user-data table, and rolls the entire test back.

begin;

-- The fixture UUIDs intentionally do not create Auth accounts. Disabling FK
-- triggers locally keeps this test isolated from Supabase Auth internals; the
-- transaction rollback guarantees that no learner rows survive.
set local session_replication_role = replica;

insert into public.profiles (user_id, display_name) values
  ('00000000-0000-4000-8000-000000000001', 'RLS owner A'),
  ('00000000-0000-4000-8000-000000000002', 'RLS owner B');
insert into public.user_settings (user_id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.user_progress (user_id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002');
insert into public.lesson_mastery (user_id, lesson_id) values
  ('00000000-0000-4000-8000-000000000001', 'rls-test'),
  ('00000000-0000-4000-8000-000000000002', 'rls-test');
insert into public.session_summaries (user_id, client_session_id, mode, completed_at) values
  ('00000000-0000-4000-8000-000000000001', 'rls-test-a', 'test', now()),
  ('00000000-0000-4000-8000-000000000002', 'rls-test-b', 'test', now());
insert into public.daily_activity (user_id, activity_date) values
  ('00000000-0000-4000-8000-000000000001', date '2000-01-01'),
  ('00000000-0000-4000-8000-000000000002', date '2000-01-01');
insert into public.skill_aggregates (user_id, skill_type, skill_key) values
  ('00000000-0000-4000-8000-000000000001', 'key', 'a'),
  ('00000000-0000-4000-8000-000000000002', 'key', 'a');
insert into public.sync_state (user_id, device_id) values
  ('00000000-0000-4000-8000-000000000001', 'rls-test-device'),
  ('00000000-0000-4000-8000-000000000002', 'rls-test-device');

do $$
declare
  table_name text;
begin
  foreach table_name in array array['profiles','user_settings','user_progress','lesson_mastery','session_summaries','daily_activity','skill_aggregates','sync_state'] loop
    if not (select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=table_name) then
      raise exception 'RLS is disabled on public.%', table_name;
    end if;
    if (select count(*) from pg_policies where schemaname='public' and tablename=table_name and roles @> array['authenticated']::name[]) <> 1 then
      raise exception 'Expected exactly one authenticated ownership policy on public.%', table_name;
    end if;
  end loop;

  if has_function_privilege('anon','public.sync_typing_session(jsonb,jsonb,jsonb,jsonb)','execute') then
    raise exception 'Anonymous role can execute sync_typing_session';
  end if;
  if not has_function_privilege('authenticated','public.sync_typing_session(jsonb,jsonb,jsonb,jsonb)','execute') then
    raise exception 'Authenticated role cannot execute sync_typing_session';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select 1 / case when
  (select count(*) from public.profiles) = 1 and
  (select count(*) from public.user_settings) = 1 and
  (select count(*) from public.user_progress) = 1 and
  (select count(*) from public.lesson_mastery) = 1 and
  (select count(*) from public.session_summaries) = 1 and
  (select count(*) from public.daily_activity) = 1 and
  (select count(*) from public.skill_aggregates) = 1 and
  (select count(*) from public.sync_state) = 1
then 1 else 0 end as owner_a_isolated;
reset role;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select 1 / case when
  (select count(*) from public.profiles) = 1 and
  (select count(*) from public.user_settings) = 1 and
  (select count(*) from public.user_progress) = 1 and
  (select count(*) from public.lesson_mastery) = 1 and
  (select count(*) from public.session_summaries) = 1 and
  (select count(*) from public.daily_activity) = 1 and
  (select count(*) from public.skill_aggregates) = 1 and
  (select count(*) from public.sync_state) = 1
then 1 else 0 end as owner_b_isolated;
reset role;

select 1 / case when not has_table_privilege('anon','public.profiles','select') then 1 else 0 end as anonymous_isolated;

rollback;
