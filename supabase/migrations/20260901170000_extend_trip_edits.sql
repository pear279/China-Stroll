-- Extend itinerary editing: update_stop gains transport_mode and notes, and a
-- new versioned update_mvp_trip_day command edits day date/title/notes.

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
        and places.status = 'published'
        and places.coordinate_system = 'WGS84'
        and places.coordinates_checked_at is not null
        and places.latitude is not null
        and places.longitude is not null
        and place_localizations.review_status = 'published'
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
        transport_mode = case when v_change ? 'transportMode' then nullif(v_change ->> 'transportMode', '') else transport_mode end,
        notes = case when v_change ? 'notes' then coalesce(v_change ->> 'notes', '') else notes end,
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

create or replace function public.update_mvp_trip_day(
  p_actor_id uuid,
  p_trip_id uuid,
  p_expected_version bigint,
  p_command_id uuid,
  p_day_number integer,
  p_input jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_version bigint;
  v_day_id bigint;
  v_date date;
  v_title text;
  v_notes text;
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

  select version into v_version
  from public.trips
  where id = p_trip_id
  for update;

  if v_version is null then
    raise exception 'NOT_FOUND trip';
  end if;

  if v_version <> p_expected_version then
    raise exception 'VERSION_CONFLICT current=%', v_version;
  end if;

  select id into v_day_id
  from public.trip_days
  where trip_id = p_trip_id
    and day_number = p_day_number;

  if v_day_id is null then
    raise exception 'NOT_FOUND trip day';
  end if;

  v_title := p_input ->> 'title';
  v_notes := coalesce(p_input ->> 'notes', '');
  v_date := nullif(p_input ->> 'date', '')::date;

  if v_title is not null and length(btrim(v_title)) not between 1 and 120 then
    raise exception 'VALIDATION_FAILED day title';
  end if;

  if length(v_notes) > 4000 then
    raise exception 'VALIDATION_FAILED day notes';
  end if;

  update public.trip_days
  set
    day_date = case when p_input ? 'date' then v_date else day_date end,
    title = case when p_input ? 'title' then btrim(v_title) else title end,
    notes = case when p_input ? 'notes' then v_notes else notes end
  where id = v_day_id;

  update public.trips
  set version = v_version + 1
  where id = p_trip_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_version + 1,
    'commandId', p_command_id,
    'changed', jsonb_build_array(
      jsonb_build_object('type', 'trip_day', 'id', v_day_id, 'dayNumber', p_day_number)
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
    v_version + 1,
    p_command_id,
    p_actor_id,
    'update_trip_day',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.update_mvp_trip_day(uuid, uuid, bigint, uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.update_mvp_trip_day(uuid, uuid, bigint, uuid, integer, jsonb) to service_role;
