-- Phase 6: least-privilege grants and bounded client-controlled identifiers.

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','user_settings','user_progress','lesson_mastery','session_summaries','daily_activity','skill_aggregates','sync_state'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end;
$$;

alter function public.set_updated_at() set search_path = '';
alter function public.handle_new_user() set search_path = '';
alter function public.sync_typing_session(jsonb,jsonb,jsonb,jsonb) set search_path = '';

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_typing_session(jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.sync_typing_session(jsonb,jsonb,jsonb,jsonb) to authenticated;

alter table public.profiles drop constraint if exists profiles_display_name_length;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) between 1 and 40);
alter table public.lesson_mastery drop constraint if exists lesson_mastery_lesson_id_length;
alter table public.lesson_mastery add constraint lesson_mastery_lesson_id_length check (char_length(lesson_id) between 1 and 120);
alter table public.session_summaries drop constraint if exists session_summaries_client_id_length;
alter table public.session_summaries add constraint session_summaries_client_id_length check (char_length(client_session_id) between 1 and 200);
alter table public.sync_state drop constraint if exists sync_state_device_id_length;
alter table public.sync_state add constraint sync_state_device_id_length check (char_length(device_id) between 1 and 200);
alter table public.skill_aggregates drop constraint if exists skill_aggregates_key_length;
alter table public.skill_aggregates add constraint skill_aggregates_key_length check (char_length(skill_key) between 1 and 80);
