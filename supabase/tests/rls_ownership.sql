-- Run against a disposable/staging database after migrations.
-- It verifies the structural ownership contract and uses two JWT identities
-- without creating or modifying learner rows.

begin;

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

select set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
set local role authenticated;
select 1 / case when count(*) = 0 then 1 else 0 end as second_account_isolated from public.profiles;
reset role;

select set_config('request.jwt.claim.sub', coalesce((select user_id::text from public.profiles limit 1), gen_random_uuid()::text), true);
set local role authenticated;
select 1 / case when count(*) <= 1 then 1 else 0 end as owner_scope_is_bounded from public.profiles;
reset role;

select 1 / case when not has_table_privilege('anon','public.profiles','select') then 1 else 0 end as anonymous_isolated;

rollback;
