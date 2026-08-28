begin;

insert into auth.users (
  id,
  aud,
  role,
  email,
  created_at,
  updated_at
)
values (
  '44444444-4444-4444-8444-444444444444',
  'authenticated',
  'authenticated',
  'mvp-command-owner@example.invalid',
  now(),
  now()
);

do $$
declare
  v_create_result jsonb;
  v_add_result jsonb;
  v_duplicate_result jsonb;
  v_confirm_result jsonb;
  v_duplicate_confirm_result jsonb;
  v_trip_id uuid;
  v_stop_id uuid;
  v_suggestion_id uuid;
  v_version bigint;
  v_status text;
  v_conflict_seen boolean := false;
begin
  if has_function_privilege(
    'authenticated',
    'public.create_mvp_trip(uuid,uuid,text,date,text)',
    'execute'
  ) then
    raise exception 'authenticated must not execute create_mvp_trip';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.apply_mvp_trip_changes(uuid,uuid,bigint,uuid,jsonb,text)',
    'execute'
  ) then
    raise exception 'authenticated must not execute apply_mvp_trip_changes';
  end if;

  v_create_result := public.create_mvp_trip(
    '44444444-4444-4444-8444-444444444444',
    '55555555-5555-4555-8555-555555555551',
    'Command test trip',
    current_date,
    'en'
  );
  v_trip_id := (v_create_result ->> 'tripId')::uuid;

  if (v_create_result ->> 'version')::bigint <> 1 then
    raise exception 'new trip must start at version 1';
  end if;

  if not exists (
    select 1 from public.trip_days where trip_id = v_trip_id and day_number = 1
  ) then
    raise exception 'new trip must include day one';
  end if;

  v_add_result := public.apply_mvp_trip_changes(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    1,
    '55555555-5555-4555-8555-555555555552',
    '[{"op":"add_stop","placeId":"forbidden-city","dayNumber":1}]'::jsonb
  );

  if (v_add_result ->> 'version')::bigint <> 2 then
    raise exception 'adding a stop must create version 2';
  end if;

  select id into v_stop_id
  from public.trip_stops
  where trip_id = v_trip_id and place_id = 'forbidden-city';

  if v_stop_id is null then
    raise exception 'add_stop must create the selected place';
  end if;

  v_duplicate_result := public.apply_mvp_trip_changes(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    1,
    '55555555-5555-4555-8555-555555555552',
    '[{"op":"add_stop","placeId":"forbidden-city","dayNumber":1}]'::jsonb
  );

  select version into v_version from public.trips where id = v_trip_id;
  if v_duplicate_result <> v_add_result or v_version <> 2 then
    raise exception 'duplicate command must return the first result without another write';
  end if;

  begin
    perform public.apply_mvp_trip_changes(
      '44444444-4444-4444-8444-444444444444',
      v_trip_id,
      1,
      '55555555-5555-4555-8555-555555555553',
      jsonb_build_array(jsonb_build_object('op', 'remove_stop', 'stopId', v_stop_id))
    );
  exception when others then
    v_conflict_seen := sqlerrm like '%VERSION_CONFLICT%';
  end;

  if not v_conflict_seen then
    raise exception 'stale version must be rejected';
  end if;

  insert into public.agent_suggestions (
    id,
    trip_id,
    base_version,
    requested_by,
    intent,
    reason,
    changes,
    risks,
    expires_at
  )
  values (
    '66666666-6666-4666-8666-666666666666',
    v_trip_id,
    2,
    '44444444-4444-4444-8444-444444444444',
    'Set the first visit time',
    'Start at nine in the morning',
    jsonb_build_array(
      jsonb_build_object(
        'op', 'update_stop',
        'stopId', v_stop_id,
        'startTime', '09:00',
        'durationMinutes', 240,
        'sortOrder', 0
      )
    ),
    '[]'::jsonb,
    now() + interval '30 minutes'
  )
  returning id into v_suggestion_id;

  v_confirm_result := public.confirm_mvp_agent_suggestion(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    v_suggestion_id,
    2,
    '55555555-5555-4555-8555-555555555554'
  );

  select status into v_status
  from public.agent_suggestions
  where id = v_suggestion_id;

  if (v_confirm_result ->> 'version')::bigint <> 3 or v_status <> 'applied' then
    raise exception 'confirming a suggestion must apply it as version 3';
  end if;

  v_duplicate_confirm_result := public.confirm_mvp_agent_suggestion(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    v_suggestion_id,
    2,
    '55555555-5555-4555-8555-555555555554'
  );

  select version into v_version from public.trips where id = v_trip_id;
  if v_duplicate_confirm_result <> v_confirm_result or v_version <> 3 then
    raise exception 'duplicate suggestion confirmation must return the first result';
  end if;

  if not exists (
    select 1
    from public.trip_stops
    where id = v_stop_id and start_time = '09:00'::time
  ) then
    raise exception 'confirmed suggestion must update the stop';
  end if;
end;
$$;

-- 放开接口枚举后，add_stop 必须自己拒绝未发布和未审核坐标的地点。
do $$
declare
  v_trip_id uuid;
  v_rejected boolean;
begin
  insert into public.places (
    id,
    category_code,
    latitude,
    longitude,
    recommended_duration_minutes,
    status
  )
  values (
    'command-test-draft-place',
    'historic',
    39.9,
    116.4,
    90,
    'draft'
  );

  insert into public.place_localizations (
    place_id,
    locale,
    name,
    short_intro,
    history,
    visitor_tips,
    practical_notes,
    photo_spot_notes,
    review_status
  )
  values (
    'command-test-draft-place',
    'en',
    'Command test draft place',
    'Draft content that must never reach a trip.',
    'Draft history.',
    'Draft tips.',
    'Draft notes.',
    'Draft photo notes.',
    'published'
  );

  v_trip_id := (
    public.create_mvp_trip(
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555561',
      'Place gate test trip',
      current_date,
      'en'
    ) ->> 'tripId'
  )::uuid;

  v_rejected := false;
  begin
    perform public.apply_mvp_trip_changes(
      '44444444-4444-4444-8444-444444444444',
      v_trip_id,
      1,
      '55555555-5555-4555-8555-555555555562',
      '[{"op":"add_stop","placeId":"command-test-draft-place","dayNumber":1}]'::jsonb
    );
  exception when others then
    v_rejected := sqlerrm like '%NOT_FOUND%';
  end;

  if not v_rejected then
    raise exception 'add_stop must reject a place that is not published';
  end if;

  update public.places
  set status = 'published'
  where id = 'command-test-draft-place';

  v_rejected := false;
  begin
    perform public.apply_mvp_trip_changes(
      '44444444-4444-4444-8444-444444444444',
      v_trip_id,
      1,
      '55555555-5555-4555-8555-555555555563',
      '[{"op":"add_stop","placeId":"command-test-draft-place","dayNumber":1}]'::jsonb
    );
  exception when others then
    v_rejected := sqlerrm like '%NOT_FOUND%';
  end;

  if not v_rejected then
    raise exception 'add_stop must reject a place without a reviewed coordinate';
  end if;

  update public.places
  set coordinate_system = 'WGS84',
      coordinates_checked_at = now()
  where id = 'command-test-draft-place';

  perform public.apply_mvp_trip_changes(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    1,
    '55555555-5555-4555-8555-555555555564',
    '[{"op":"add_stop","placeId":"command-test-draft-place","dayNumber":1}]'::jsonb
  );

  if not exists (
    select 1
    from public.trip_stops
    where trip_id = v_trip_id
      and place_id = 'command-test-draft-place'
  ) then
    raise exception 'add_stop must accept a published place with a reviewed coordinate';
  end if;
end;
$$;

rollback;
