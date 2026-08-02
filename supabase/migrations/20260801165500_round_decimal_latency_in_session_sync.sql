do $$
declare
  v_definition text;
  v_before_count integer;
begin
  select pg_get_functiondef(
    'public.sync_typing_session(jsonb,jsonb,jsonb,jsonb)'::regprocedure
  ) into v_definition;

  v_before_count := (
    length(v_definition)
    - length(replace(v_definition, 'coalesce((v_stat.value ->> ''totalLatencyMs'')::bigint, 0)', ''))
  ) / length('coalesce((v_stat.value ->> ''totalLatencyMs'')::bigint, 0)');

  if v_before_count = 2 then
    v_definition := replace(
      v_definition,
      'coalesce((v_stat.value ->> ''totalLatencyMs'')::bigint, 0)',
      'round(coalesce(nullif(v_stat.value ->> ''totalLatencyMs'', '''')::numeric, 0))::bigint'
    );
    execute v_definition;
  elsif v_before_count <> 0 then
    raise exception 'Expected 0 or 2 direct bigint latency casts, found %', v_before_count;
  end if;
end;
$$;

revoke all on function public.sync_typing_session(jsonb, jsonb, jsonb, jsonb) from public;
revoke all on function public.sync_typing_session(jsonb, jsonb, jsonb, jsonb) from anon;
grant execute on function public.sync_typing_session(jsonb, jsonb, jsonb, jsonb) to authenticated;
