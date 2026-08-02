-- Complete reproducible baseline for Typing Master.
-- Safe on a clean Supabase project; later migrations evolve this baseline.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Learner',
  onboarding_completed boolean not null default false,
  skill_stage text not null default 'beginner' check (skill_stage in ('beginner','hunt_and_peck','touch_typist','advanced')),
  typing_goal text not null default 'accuracy' check (typing_goal in ('accuracy','speed','practical')),
  daily_goal_minutes smallint not null default 10 check (daily_goal_minutes between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'system' check (theme in ('system','light','dark')),
  keyboard_visible boolean not null default true,
  backspace_mode text not null default 'allowed' check (backspace_mode in ('allowed','errors_only','disabled')),
  sound_enabled boolean not null default false,
  text_size text not null default 'medium' check (text_size in ('small','medium','large')),
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data_version integer not null default 1 check (data_version >= 1),
  active_course_id text not null default 'touch-typing-path',
  active_lesson_id text not null default 'home-f-j',
  completed_lessons text[] not null default '{}',
  total_practice_seconds integer not null default 0 check (total_practice_seconds >= 0),
  total_sessions integer not null default 0 check (total_sessions >= 0),
  total_characters bigint not null default 0 check (total_characters >= 0),
  total_correct_characters bigint not null default 0 check (total_correct_characters >= 0),
  best_wpm numeric not null default 0 check (best_wpm >= 0),
  average_wpm numeric not null default 0 check (average_wpm >= 0),
  average_accuracy numeric not null default 0 check (average_accuracy between 0 and 100),
  average_consistency numeric not null default 0 check (average_consistency between 0 and 100),
  current_streak integer not null default 0 check (current_streak >= 0),
  longest_streak integer not null default 0 check (longest_streak >= 0),
  last_practice_date date,
  onboarding jsonb not null default '{}',
  adaptive jsonb not null default '{}',
  personal_bests jsonb not null default '{}',
  last_practice_config jsonb not null default '{}',
  saved_custom_texts jsonb not null default '[]',
  practice_content_history jsonb not null default '[]',
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  status text not null default 'learning' check (status in ('locked','learning','practising','mastered','review_due','placement_credit')),
  mastery_score numeric not null default 0 check (mastery_score between 0 and 100),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  best_accuracy numeric not null default 0 check (best_accuracy between 0 and 100),
  best_wpm numeric not null default 0 check (best_wpm >= 0),
  last_practiced_at timestamptz,
  mastered_at timestamptz,
  review_due_at timestamptz,
  review_interval_days integer not null default 0 check (review_interval_days >= 0),
  review_count integer not null default 0 check (review_count >= 0),
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  passed_exercises text[] not null default '{}',
  primary key (user_id, lesson_id)
);

create table if not exists public.session_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_session_id text not null,
  mode text not null,
  purpose text,
  content_type text,
  lesson_id text,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  active_duration_seconds integer not null default 0 check (active_duration_seconds >= 0),
  net_wpm numeric not null default 0 check (net_wpm >= 0),
  gross_wpm numeric not null default 0 check (gross_wpm >= 0),
  keystroke_accuracy numeric not null default 0 check (keystroke_accuracy between 0 and 100),
  final_text_accuracy numeric not null default 0 check (final_text_accuracy between 0 and 100),
  consistency numeric not null default 0 check (consistency between 0 and 100),
  burst_wpm numeric not null default 0 check (burst_wpm >= 0),
  correction_rate numeric not null default 0 check (correction_rate between 0 and 100),
  typed_characters integer not null default 0 check (typed_characters >= 0),
  correct_characters integer not null default 0 check (correct_characters >= 0),
  error_count integer not null default 0 check (error_count >= 0),
  corrected_errors integer not null default 0 check (corrected_errors >= 0),
  valid_benchmark boolean not null default false,
  personal_best_eligible boolean not null default false,
  focus_keys text[] not null default '{}',
  difficult_bigrams text[] not null default '{}',
  mistake_words text[] not null default '{}',
  metadata jsonb not null default '{}',
  started_at timestamptz,
  completed_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (user_id, client_session_id)
);

create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  practice_seconds integer not null default 0 check (practice_seconds >= 0),
  sessions_count integer not null default 0 check (sessions_count >= 0),
  characters_typed integer not null default 0 check (characters_typed >= 0),
  best_wpm numeric not null default 0 check (best_wpm >= 0),
  average_accuracy numeric not null default 0 check (average_accuracy between 0 and 100),
  lesson_seconds integer not null default 0 check (lesson_seconds >= 0),
  review_seconds integer not null default 0 check (review_seconds >= 0),
  test_seconds integer not null default 0 check (test_seconds >= 0),
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);

create table if not exists public.skill_aggregates (
  user_id uuid not null references auth.users(id) on delete cascade,
  skill_type text not null check (skill_type in ('key','bigram','confusion','word')),
  skill_key text not null,
  attempts integer not null default 0 check (attempts >= 0),
  errors integer not null default 0 check (errors >= 0),
  corrected_errors integer not null default 0 check (corrected_errors >= 0),
  total_latency_ms bigint not null default 0 check (total_latency_ms >= 0),
  last_seen_at timestamptz,
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, skill_type, skill_key)
);

create table if not exists public.sync_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  client_data_version integer not null default 1 check (client_data_version >= 1),
  local_revision bigint not null default 0 check (local_revision >= 0),
  server_revision bigint not null default 0 check (server_revision >= 0),
  last_synced_at timestamptz,
  metadata jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (user_id, device_id)
);

create index if not exists session_summaries_user_completed_idx on public.session_summaries (user_id, completed_at desc);
create index if not exists session_summaries_user_mode_completed_idx on public.session_summaries (user_id, mode, completed_at desc);
create index if not exists session_summaries_user_lesson_idx on public.session_summaries (user_id, lesson_id) where lesson_id is not null;
create index if not exists lesson_mastery_user_review_due_idx on public.lesson_mastery (user_id, review_due_at) where review_due_at is not null;
create index if not exists skill_aggregates_user_type_errors_idx on public.skill_aggregates (user_id, skill_type, errors desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data ->> 'display_name',''), nullif(split_part(coalesce(new.email,''),'@',1),''), 'Learner'))
  on conflict (user_id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','user_settings','user_progress','lesson_mastery','daily_activity','skill_aggregates','sync_state'] loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','user_settings','user_progress','lesson_mastery','session_summaries','daily_activity','skill_aggregates','sync_state'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists %I_own_rows on public.%I', table_name, table_name);
    execute format('create policy %I_own_rows on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name, table_name);
    execute format('revoke all on public.%I from anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
  end loop;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
