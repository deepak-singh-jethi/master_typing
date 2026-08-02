create or replace function public.sync_typing_session(
  p_session jsonb,
  p_key_stats jsonb default '{}'::jsonb,
  p_bigram_stats jsonb default '{}'::jsonb,
  p_word_errors jsonb default '{}'::jsonb
) returns boolean
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_inserted_id uuid;
  v_completed_at timestamptz := coalesce((p_session ->> 'completed_at')::timestamptz, now());
  v_activity_date date := coalesce((p_session ->> 'activity_date')::date, v_completed_at::date);
  v_duration integer := greatest(0, coalesce((p_session ->> 'duration_seconds')::integer, 0));
  v_characters integer := greatest(0, coalesce((p_session ->> 'typed_characters')::integer, 0));
  v_accuracy numeric := least(100, greatest(0, coalesce((p_session ->> 'keystroke_accuracy')::numeric, 0)));
  v_net_wpm numeric := greatest(0, coalesce((p_session ->> 'net_wpm')::numeric, 0));
  v_mode text := coalesce(nullif(p_session ->> 'mode', ''), 'practice');
  v_stat record;
  v_confusion record;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if nullif(p_session ->> 'client_session_id', '') is null then raise exception 'Client session ID is required'; end if;
  if pg_column_size(p_session) > 262144 or pg_column_size(p_key_stats) > 262144
    or pg_column_size(p_bigram_stats) > 262144 or pg_column_size(p_word_errors) > 262144 then
    raise exception 'Session payload is too large';
  end if;

  insert into public.session_summaries (
    user_id, client_session_id, mode, purpose, content_type, lesson_id,
    duration_seconds, active_duration_seconds, net_wpm, gross_wpm,
    keystroke_accuracy, final_text_accuracy, consistency, burst_wpm, correction_rate,
    typed_characters, correct_characters, error_count, corrected_errors,
    valid_benchmark, personal_best_eligible, focus_keys, difficult_bigrams,
    mistake_words, metadata, started_at, completed_at
  ) values (
    v_user_id, left(p_session ->> 'client_session_id', 200), left(v_mode, 40),
    nullif(left(p_session ->> 'purpose', 60), ''), nullif(left(p_session ->> 'content_type', 60), ''),
    nullif(left(p_session ->> 'lesson_id', 120), ''), v_duration,
    greatest(0, coalesce((p_session ->> 'active_duration_seconds')::integer, v_duration)),
    v_net_wpm, greatest(0, coalesce((p_session ->> 'gross_wpm')::numeric, 0)), v_accuracy,
    least(100, greatest(0, coalesce((p_session ->> 'final_text_accuracy')::numeric, v_accuracy))),
    least(100, greatest(0, coalesce((p_session ->> 'consistency')::numeric, 0))),
    greatest(0, coalesce((p_session ->> 'burst_wpm')::numeric, 0)),
    least(100, greatest(0, coalesce((p_session ->> 'correction_rate')::numeric, 0))),
    v_characters, greatest(0, coalesce((p_session ->> 'correct_characters')::integer, 0)),
    greatest(0, coalesce((p_session ->> 'error_count')::integer, 0)),
    greatest(0, coalesce((p_session ->> 'corrected_errors')::integer, 0)),
    coalesce((p_session ->> 'valid_benchmark')::boolean, false),
    coalesce((p_session ->> 'personal_best_eligible')::boolean, false),
    coalesce(array(select left(value, 8) from jsonb_array_elements_text(coalesce(p_session -> 'focus_keys', '[]')) limit 32), '{}'),
    coalesce(array(select left(value, 16) from jsonb_array_elements_text(coalesce(p_session -> 'difficult_bigrams', '[]')) limit 32), '{}'),
    coalesce(array(select left(value, 80) from jsonb_array_elements_text(coalesce(p_session -> 'mistake_words', '[]')) limit 64), '{}'),
    coalesce(p_session -> 'metadata', '{}'), nullif(p_session ->> 'started_at', '')::timestamptz, v_completed_at
  ) on conflict (user_id, client_session_id) do nothing returning id into v_inserted_id;

  if v_inserted_id is null then return false; end if;

  insert into public.daily_activity (
    user_id, activity_date, practice_seconds, sessions_count, characters_typed,
    best_wpm, average_accuracy, lesson_seconds, review_seconds, test_seconds
  ) values (
    v_user_id, v_activity_date, v_duration, 1, v_characters, v_net_wpm, v_accuracy,
    case when v_mode = 'lesson' then v_duration else 0 end,
    case when coalesce((p_session ->> 'review_attempt')::boolean, false) then v_duration else 0 end,
    case when v_mode in ('test','diagnostic') then v_duration else 0 end
  ) on conflict (user_id, activity_date) do update set
    practice_seconds = public.daily_activity.practice_seconds + excluded.practice_seconds,
    sessions_count = public.daily_activity.sessions_count + 1,
    characters_typed = public.daily_activity.characters_typed + excluded.characters_typed,
    best_wpm = greatest(public.daily_activity.best_wpm, excluded.best_wpm),
    average_accuracy = round(((public.daily_activity.average_accuracy * public.daily_activity.sessions_count) + excluded.average_accuracy) / (public.daily_activity.sessions_count + 1), 2),
    lesson_seconds = public.daily_activity.lesson_seconds + excluded.lesson_seconds,
    review_seconds = public.daily_activity.review_seconds + excluded.review_seconds,
    test_seconds = public.daily_activity.test_seconds + excluded.test_seconds,
    updated_at = now();

  for v_stat in select key, value from jsonb_each(coalesce(p_key_stats, '{}')) loop
    if length(v_stat.key) <= 8 then
      insert into public.skill_aggregates (user_id, skill_type, skill_key, attempts, errors, corrected_errors, total_latency_ms, last_seen_at)
      values (v_user_id, 'key', v_stat.key,
        greatest(0, coalesce((v_stat.value ->> 'attempts')::integer, 0)),
        greatest(0, coalesce((v_stat.value ->> 'errors')::integer, 0)),
        greatest(0, coalesce((v_stat.value ->> 'correctedErrors')::integer, 0)),
        greatest(0, round(coalesce(nullif(v_stat.value ->> 'totalLatencyMs','')::numeric, 0))::bigint), v_completed_at)
      on conflict (user_id, skill_type, skill_key) do update set
        attempts = public.skill_aggregates.attempts + excluded.attempts,
        errors = public.skill_aggregates.errors + excluded.errors,
        corrected_errors = public.skill_aggregates.corrected_errors + excluded.corrected_errors,
        total_latency_ms = public.skill_aggregates.total_latency_ms + excluded.total_latency_ms,
        last_seen_at = greatest(public.skill_aggregates.last_seen_at, excluded.last_seen_at), updated_at = now();

      for v_confusion in select key, value from jsonb_each(coalesce(v_stat.value -> 'confusions', '{}')) loop
        v_count := greatest(0, coalesce((v_confusion.value #>> '{}')::integer, 0));
        if v_count > 0 and length(v_confusion.key) <= 8 then
          insert into public.skill_aggregates (user_id, skill_type, skill_key, attempts, errors, last_seen_at)
          values (v_user_id, 'confusion', v_stat.key || '→' || v_confusion.key, v_count, v_count, v_completed_at)
          on conflict (user_id, skill_type, skill_key) do update set
            attempts = public.skill_aggregates.attempts + excluded.attempts,
            errors = public.skill_aggregates.errors + excluded.errors,
            last_seen_at = greatest(public.skill_aggregates.last_seen_at, excluded.last_seen_at), updated_at = now();
        end if;
      end loop;
    end if;
  end loop;

  for v_stat in select key, value from jsonb_each(coalesce(p_bigram_stats, '{}')) loop
    if length(v_stat.key) <= 16 then
      insert into public.skill_aggregates (user_id, skill_type, skill_key, attempts, errors, corrected_errors, total_latency_ms, last_seen_at)
      values (v_user_id, 'bigram', v_stat.key,
        greatest(0, coalesce((v_stat.value ->> 'attempts')::integer, 0)),
        greatest(0, coalesce((v_stat.value ->> 'errors')::integer, 0)),
        greatest(0, coalesce((v_stat.value ->> 'correctedErrors')::integer, 0)),
        greatest(0, round(coalesce(nullif(v_stat.value ->> 'totalLatencyMs','')::numeric, 0))::bigint), v_completed_at)
      on conflict (user_id, skill_type, skill_key) do update set
        attempts = public.skill_aggregates.attempts + excluded.attempts,
        errors = public.skill_aggregates.errors + excluded.errors,
        corrected_errors = public.skill_aggregates.corrected_errors + excluded.corrected_errors,
        total_latency_ms = public.skill_aggregates.total_latency_ms + excluded.total_latency_ms,
        last_seen_at = greatest(public.skill_aggregates.last_seen_at, excluded.last_seen_at), updated_at = now();
    end if;
  end loop;

  for v_stat in select key, value from jsonb_each(coalesce(p_word_errors, '{}')) loop
    v_count := greatest(0, coalesce((v_stat.value #>> '{}')::integer, 0));
    if v_count > 0 and length(v_stat.key) <= 80 then
      insert into public.skill_aggregates (user_id, skill_type, skill_key, attempts, errors, last_seen_at)
      values (v_user_id, 'word', lower(v_stat.key), v_count, v_count, v_completed_at)
      on conflict (user_id, skill_type, skill_key) do update set
        attempts = public.skill_aggregates.attempts + excluded.attempts,
        errors = public.skill_aggregates.errors + excluded.errors,
        last_seen_at = greatest(public.skill_aggregates.last_seen_at, excluded.last_seen_at), updated_at = now();
    end if;
  end loop;

  return true;
end;
$$;

revoke all on function public.sync_typing_session(jsonb,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.sync_typing_session(jsonb,jsonb,jsonb,jsonb) to authenticated;
