create or replace function private.apply_mvp_reservation_change(
  p_trip_id uuid,
  p_actor_id uuid,
  p_operation text,
  p_reservation_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_day_id bigint;
  v_reservation_id uuid;
  v_category text;
  v_title text;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_status text;
begin
  if p_operation = 'delete' then
    delete from public.reservations where id = p_reservation_id and trip_id = p_trip_id returning id into v_reservation_id;
    if v_reservation_id is null then raise exception 'NOT_FOUND reservation'; end if;
    return jsonb_build_array(jsonb_build_object('type', 'reservation', 'id', v_reservation_id, 'operation', 'delete'));
  end if;

  v_category := p_input ->> 'category';
  v_title := btrim(coalesce(p_input ->> 'title', ''));
  v_status := p_input ->> 'status';
  v_starts_at := nullif(p_input ->> 'startsAt', '')::timestamptz;
  v_ends_at := nullif(p_input ->> 'endsAt', '')::timestamptz;
  if v_category not in ('accommodation', 'transport', 'restaurant', 'attraction', 'activity')
    or length(v_title) not between 1 and 200
    or v_status not in ('planned', 'confirmed', 'cancelled', 'completed')
    or (v_starts_at is not null and v_ends_at is not null and v_ends_at < v_starts_at) then
    raise exception 'VALIDATION_FAILED reservation';
  end if;
  if p_input ->> 'dayNumber' is not null then
    select id into v_day_id from public.trip_days where trip_id = p_trip_id and day_number = (p_input ->> 'dayNumber')::integer;
    if v_day_id is null then raise exception 'NOT_FOUND trip day'; end if;
  end if;
  if p_input ->> 'placeId' is not null and not exists (select 1 from public.places where id = p_input ->> 'placeId') then
    raise exception 'NOT_FOUND place';
  end if;

  if p_operation = 'create' then
    insert into public.reservations (trip_id, trip_day_id, place_id, category, title, starts_at, ends_at, status, provider, confirmation_code, notes, created_by)
    values (p_trip_id, v_day_id, nullif(p_input ->> 'placeId', ''), v_category, v_title, v_starts_at, v_ends_at, v_status, nullif(p_input ->> 'provider', ''), nullif(p_input ->> 'confirmationCode', ''), coalesce(p_input ->> 'notes', ''), p_actor_id)
    returning id into v_reservation_id;
  elsif p_operation = 'update' then
    update public.reservations set trip_day_id = v_day_id, place_id = nullif(p_input ->> 'placeId', ''), category = v_category, title = v_title, starts_at = v_starts_at, ends_at = v_ends_at, status = v_status, provider = nullif(p_input ->> 'provider', ''), confirmation_code = nullif(p_input ->> 'confirmationCode', ''), notes = coalesce(p_input ->> 'notes', '')
    where id = p_reservation_id and trip_id = p_trip_id returning id into v_reservation_id;
    if v_reservation_id is null then raise exception 'NOT_FOUND reservation'; end if;
  else
    raise exception 'VALIDATION_FAILED reservation operation';
  end if;
  return jsonb_build_array(jsonb_build_object('type', 'reservation', 'id', v_reservation_id, 'operation', p_operation));
end;
$$;

create or replace function public.apply_mvp_reservation_command(
  p_actor_id uuid, p_trip_id uuid, p_expected_version bigint, p_command_id uuid,
  p_operation text, p_reservation_id uuid default null, p_input jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare v_role text; v_version bigint; v_result jsonb; v_changed jsonb;
begin
  select role into v_role from public.trip_members where trip_id = p_trip_id and user_id = p_actor_id and status = 'active';
  if v_role not in ('owner', 'editor') or v_role is null then raise exception 'FORBIDDEN trip edit'; end if;
  select summary into v_result from public.trip_change_log where trip_id = p_trip_id and actor_user_id = p_actor_id and command_id = p_command_id;
  if v_result is not null then return v_result; end if;
  select version into v_version from public.trips where id = p_trip_id for update;
  if v_version is null then raise exception 'NOT_FOUND trip'; end if;
  if v_version <> p_expected_version then raise exception 'VERSION_CONFLICT current=%', v_version; end if;
  v_changed := private.apply_mvp_reservation_change(p_trip_id, p_actor_id, p_operation, p_reservation_id, p_input);
  update public.trips set version = v_version + 1 where id = p_trip_id;
  v_result := jsonb_build_object('tripId', p_trip_id, 'version', v_version + 1, 'commandId', p_command_id, 'changed', v_changed);
  insert into public.trip_change_log (trip_id, version, command_id, actor_user_id, change_type, summary)
  values (p_trip_id, v_version + 1, p_command_id, p_actor_id, 'reservation_' || p_operation, v_result);
  return v_result;
end;
$$;

revoke all on function private.apply_mvp_reservation_change(uuid, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function private.apply_mvp_reservation_change(uuid, uuid, text, uuid, jsonb) to service_role;
revoke all on function public.apply_mvp_reservation_command(uuid, uuid, bigint, uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_mvp_reservation_command(uuid, uuid, bigint, uuid, text, uuid, jsonb) to service_role;
