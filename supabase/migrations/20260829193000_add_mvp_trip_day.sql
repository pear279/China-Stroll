create or replace function public.add_mvp_trip_day(
  p_actor_id uuid,
  p_trip_id uuid,
  p_expected_version bigint,
  p_command_id uuid,
  p_day_date date default null,
  p_title text default null
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_current_version bigint;
  v_day_id bigint;
  v_day_number integer;
  v_result jsonb;
begin
  select role into v_role
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = p_actor_id
    and status = 'active';

  if v_role not in ('owner', 'editor') or v_role is null then
    raise exception 'FORBIDDEN trip edit';
  end if;

  select summary into v_result
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id
    and trip_id = p_trip_id;

  if v_result is not null then
    return v_result;
  end if;

  select version into v_current_version
  from public.trips
  where id = p_trip_id
  for update;

  if v_current_version is null then
    raise exception 'NOT_FOUND trip';
  end if;

  if v_current_version <> p_expected_version then
    raise exception 'VERSION_CONFLICT current=%', v_current_version;
  end if;

  if p_title is not null and length(btrim(p_title)) not between 1 and 120 then
    raise exception 'VALIDATION_FAILED day title';
  end if;

  if p_day_date is not null and exists (
    select 1 from public.trip_days where trip_id = p_trip_id and day_date = p_day_date
  ) then
    raise exception 'VALIDATION_FAILED duplicate day date';
  end if;

  select coalesce(max(day_number), 0) + 1 into v_day_number
  from public.trip_days
  where trip_id = p_trip_id;

  insert into public.trip_days (trip_id, day_number, day_date, title)
  values (p_trip_id, v_day_number, p_day_date, coalesce(btrim(p_title), 'Day ' || v_day_number))
  returning id into v_day_id;

  update public.trips
  set
    version = v_current_version + 1,
    end_date = case
      when p_day_date is null then end_date
      when end_date is null then p_day_date
      else greatest(end_date, p_day_date)
    end
  where id = p_trip_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_current_version + 1,
    'commandId', p_command_id,
    'changed', jsonb_build_array(
      jsonb_build_object('type', 'trip_day', 'id', v_day_id, 'dayNumber', v_day_number)
    )
  );

  insert into public.trip_change_log (
    trip_id,
    version,
    command_id,
    actor_user_id,
    change_type,
    summary
  )
  values (
    p_trip_id,
    v_current_version + 1,
    p_command_id,
    p_actor_id,
    'add_trip_day',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.add_mvp_trip_day(uuid, uuid, bigint, uuid, date, text) from public, anon, authenticated;
grant execute on function public.add_mvp_trip_day(uuid, uuid, bigint, uuid, date, text) to service_role;
