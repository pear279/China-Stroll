create or replace function public.confirm_mvp_agent_suggestion(
  p_actor_id uuid,
  p_trip_id uuid,
  p_suggestion_id uuid,
  p_expected_version bigint,
  p_command_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_suggestion public.agent_suggestions%rowtype;
  v_result jsonb;
begin
  select summary into v_result
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id
    and trip_id = p_trip_id;

  if v_result is not null then
    return v_result;
  end if;

  select * into v_suggestion
  from public.agent_suggestions
  where id = p_suggestion_id
    and trip_id = p_trip_id
  for update;

  if v_suggestion.id is null then
    raise exception 'NOT_FOUND suggestion';
  end if;

  if v_suggestion.status <> 'proposed' then
    raise exception 'VALIDATION_FAILED suggestion is not pending';
  end if;

  if v_suggestion.expires_at <= now() then
    raise exception 'SUGGESTION_EXPIRED';
  end if;

  if v_suggestion.base_version <> p_expected_version then
    raise exception 'VERSION_CONFLICT suggestion base=%', v_suggestion.base_version;
  end if;

  update public.agent_suggestions
  set status = 'confirmed', confirmed_by = p_actor_id, decided_at = now()
  where id = p_suggestion_id;

  v_result := public.apply_mvp_trip_changes(
    p_actor_id,
    p_trip_id,
    p_expected_version,
    p_command_id,
    v_suggestion.changes,
    'agent_suggestion'
  );

  update public.agent_suggestions
  set
    status = 'applied',
    applied_at = now(),
    result_version = (v_result ->> 'version')::bigint
  where id = p_suggestion_id;

  return v_result;
end;
$$;

revoke all on function public.confirm_mvp_agent_suggestion(uuid, uuid, uuid, bigint, uuid) from public, anon, authenticated;
grant execute on function public.confirm_mvp_agent_suggestion(uuid, uuid, uuid, bigint, uuid) to service_role;
