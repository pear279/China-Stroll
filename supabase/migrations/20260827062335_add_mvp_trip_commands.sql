create or replace function private.apply_mvp_changes(
  p_trip_id uuid,
  p_actor_id uuid,
  p_changes jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_change jsonb;
  v_operation text;
  v_day_id bigint;
  v_stop_id uuid;
  v_place record;
  v_locale text;
  v_changed jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) = 0 then
    raise exception 'VALIDATION_FAILED changes must be a non-empty array';
  end if;

  select locale into v_locale
  from public.trips
  where id = p_trip_id;

  for v_change in select value from jsonb_array_elements(p_changes)
  loop
    v_operation := v_change ->> 'op';

    if v_operation = 'add_stop' then
      select
        places.id,
        places.latitude,
        places.longitude,
        places.recommended_duration_minutes,
        place_localizations.name,
        places.category_code
      into v_place
      from public.places
      join public.place_localizations
        on place_localizations.place_id = places.id
      where places.id = v_change ->> 'placeId'
        and place_localizations.locale in (v_locale, 'en', 'zh-CN')
      order by
        (place_localizations.locale = v_locale) desc,
        (place_localizations.locale = 'en') desc
      limit 1;

      if v_place.id is null then
        raise exception 'NOT_FOUND place';
      end if;

      if exists (
        select 1
        from public.trip_stops
        where trip_id = p_trip_id
          and place_id = v_place.id
      ) then
        raise exception 'VALIDATION_FAILED place is already in the trip';
      end if;

      select id into v_day_id
      from public.trip_days
      where trip_id = p_trip_id
        and day_number = coalesce((v_change ->> 'dayNumber')::integer, 1);

      if v_day_id is null then
        raise exception 'NOT_FOUND trip day';
      end if;

      insert into public.trip_stops (
        trip_id,
        trip_day_id,
        place_id,
        snapshot_name,
        snapshot_latitude,
        snapshot_longitude,
        category_code,
        duration_minutes,
        sort_order,
        source,
        created_by
      )
      values (
        p_trip_id,
        v_day_id,
        v_place.id,
        v_place.name,
        v_place.latitude,
        v_place.longitude,
        v_place.category_code,
        v_place.recommended_duration_minutes,
        coalesce(
          (v_change ->> 'sortOrder')::integer,
          (select coalesce(max(sort_order), -1) + 1 from public.trip_stops where trip_id = p_trip_id and trip_day_id = v_day_id)
        ),
        'product',
        p_actor_id
      )
      returning id into v_stop_id;

    elsif v_operation = 'update_stop' then
      update public.trip_stops
      set
        start_time = case when v_change ? 'startTime' then (v_change ->> 'startTime')::time else start_time end,
        duration_minutes = case when v_change ? 'durationMinutes' then (v_change ->> 'durationMinutes')::integer else duration_minutes end,
        sort_order = case when v_change ? 'sortOrder' then (v_change ->> 'sortOrder')::integer else sort_order end
      where id = (v_change ->> 'stopId')::uuid
        and trip_id = p_trip_id
      returning id into v_stop_id;

      if v_stop_id is null then
        raise exception 'NOT_FOUND trip stop';
      end if;

    elsif v_operation = 'move_stop' then
      select id into v_day_id
      from public.trip_days
      where trip_id = p_trip_id
        and day_number = (v_change ->> 'dayNumber')::integer;

      if v_day_id is null then
        raise exception 'NOT_FOUND trip day';
      end if;

      update public.trip_stops
      set
        trip_day_id = v_day_id,
        sort_order = (v_change ->> 'sortOrder')::integer
      where id = (v_change ->> 'stopId')::uuid
        and trip_id = p_trip_id
      returning id into v_stop_id;

      if v_stop_id is null then
        raise exception 'NOT_FOUND trip stop';
      end if;

    elsif v_operation = 'remove_stop' then
      delete from public.trip_stops
      where id = (v_change ->> 'stopId')::uuid
        and trip_id = p_trip_id
      returning id into v_stop_id;

      if v_stop_id is null then
        raise exception 'NOT_FOUND trip stop';
      end if;

    else
      raise exception 'VALIDATION_FAILED unsupported operation';
    end if;

    v_changed := v_changed || jsonb_build_array(
      jsonb_build_object('type', 'trip_stop', 'id', v_stop_id, 'operation', v_operation)
    );
  end loop;

  return v_changed;
end;
$$;

revoke all on function private.apply_mvp_changes(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function private.apply_mvp_changes(uuid, uuid, jsonb) to service_role;

create or replace function public.create_mvp_trip(
  p_actor_id uuid,
  p_command_id uuid,
  p_name text,
  p_start_date date default null,
  p_locale text default 'en'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_existing jsonb;
begin
  select summary into v_existing
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id;

  if v_existing is not null then
    return v_existing;
  end if;

  if length(btrim(p_name)) not between 1 and 120 then
    raise exception 'VALIDATION_FAILED trip name';
  end if;

  insert into public.trips (owner_id, name, start_date, end_date, locale)
  values (p_actor_id, btrim(p_name), p_start_date, p_start_date, p_locale)
  returning id into v_trip_id;

  insert into public.trip_days (trip_id, day_number, day_date, title)
  values (v_trip_id, 1, p_start_date, 'Day 1');

  v_existing := jsonb_build_object(
    'tripId', v_trip_id,
    'version', 1,
    'commandId', p_command_id,
    'changed', jsonb_build_array(jsonb_build_object('type', 'trip', 'id', v_trip_id))
  );

  insert into public.trip_change_log (
    trip_id,
    version,
    command_id,
    actor_user_id,
    change_type,
    summary
  )
  values (v_trip_id, 1, p_command_id, p_actor_id, 'create_trip', v_existing);

  return v_existing;
end;
$$;

revoke all on function public.create_mvp_trip(uuid, uuid, text, date, text) from public, anon, authenticated;
grant execute on function public.create_mvp_trip(uuid, uuid, text, date, text) to service_role;

create or replace function public.apply_mvp_trip_changes(
  p_actor_id uuid,
  p_trip_id uuid,
  p_expected_version bigint,
  p_command_id uuid,
  p_changes jsonb,
  p_change_type text default 'trip_command'
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_current_version bigint;
  v_changed jsonb;
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

  v_changed := private.apply_mvp_changes(p_trip_id, p_actor_id, p_changes);

  update public.trips
  set version = v_current_version + 1
  where id = p_trip_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_current_version + 1,
    'commandId', p_command_id,
    'changed', v_changed
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
    p_change_type,
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.apply_mvp_trip_changes(uuid, uuid, bigint, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.apply_mvp_trip_changes(uuid, uuid, bigint, uuid, jsonb, text) to service_role;

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
    update public.agent_suggestions
    set status = 'expired', decided_at = now()
    where id = p_suggestion_id;
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
