-- 放开地点标识的接口枚举后，add_stop 需要自己守住内容与坐标门槛。
-- 原实现只按 places.id 匹配，未过滤发布状态和坐标复核状态。
-- 在只有三个已审核样本时不会暴露，地点扩到 20 个后，
-- 用户或 AI 建议可以把未发布、未审核坐标的地点写进行程，
-- 导致地图落点错误且绕过内容审核。

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
