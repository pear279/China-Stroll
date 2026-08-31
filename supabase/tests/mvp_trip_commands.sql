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

insert into public.places (
  id,
  category_code,
  latitude,
  longitude,
  recommended_duration_minutes,
  coordinate_system,
  coordinates_checked_at,
  status
)
values (
  'forbidden-city',
  'historic',
  39.9172757,
  116.3907694,
  240,
  'WGS84',
  now(),
  'published'
)
on conflict (id) do update
set latitude = excluded.latitude,
    longitude = excluded.longitude,
    coordinate_system = excluded.coordinate_system,
    coordinates_checked_at = excluded.coordinates_checked_at,
    status = excluded.status;

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
  'forbidden-city',
  'en',
  'The Palace Museum',
  'Published command-test fixture.',
  'Published command-test fixture history.',
  'Published command-test fixture tips.',
  'Published command-test fixture practical notes.',
  'Published command-test fixture photo notes.',
  'published'
)
on conflict (place_id, locale) do update
set name = excluded.name,
    review_status = excluded.review_status;

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

do $$
declare
  v_trip_id uuid;
  v_first_result jsonb;
  v_duplicate_result jsonb;
  v_version bigint;
  v_conflict_seen boolean := false;
begin
  if has_function_privilege(
    'authenticated',
    'public.add_mvp_trip_day(uuid,uuid,bigint,uuid,date,text)',
    'execute'
  ) then
    raise exception 'authenticated must not execute add_mvp_trip_day';
  end if;

  v_trip_id := (
    public.create_mvp_trip(
      '44444444-4444-4444-8444-444444444444',
      '55555555-5555-4555-8555-555555555571',
      'Day command test trip',
      current_date,
      'en'
    ) ->> 'tripId'
  )::uuid;

  v_first_result := public.add_mvp_trip_day(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    1,
    '55555555-5555-4555-8555-555555555572',
    current_date + 1,
    'Museum day'
  );

  if (v_first_result ->> 'version')::bigint <> 2
    or (v_first_result ->> 'dayNumber')::integer <> 2 then
    raise exception 'adding a day must create day two at version 2';
  end if;

  v_duplicate_result := public.add_mvp_trip_day(
    '44444444-4444-4444-8444-444444444444',
    v_trip_id,
    1,
    '55555555-5555-4555-8555-555555555572',
    current_date + 1,
    'Museum day'
  );

  select version into v_version from public.trips where id = v_trip_id;
  if v_duplicate_result <> v_first_result or v_version <> 2 then
    raise exception 'duplicate day command must not create another write';
  end if;

  begin
    perform public.add_mvp_trip_day(
      '44444444-4444-4444-8444-444444444444',
      v_trip_id,
      1,
      '55555555-5555-4555-8555-555555555573',
      current_date + 2,
      null
    );
  exception when others then
    v_conflict_seen := sqlerrm like '%VERSION_CONFLICT%';
  end;

  if not v_conflict_seen then
    raise exception 'stale day command version must be rejected';
  end if;
end;
$$;

do $$
declare
  v_actor constant uuid := '44444444-4444-4444-8444-444444444444';
  v_peer constant uuid := '77777777-7777-4777-8777-777777777777';
  v_removed_member constant uuid := '99999999-9999-4999-8999-999999999999';
  v_outsider constant uuid := '88888888-8888-4888-8888-888888888888';
  v_trip uuid;
  v_other_trip uuid;
  v_non_member_enable_rejected boolean := false;
  v_non_member_upload_rejected boolean := false;
  v_disabled_upload_rejected boolean := false;
  v_expired_preference_upload_rejected boolean := false;
begin
  if has_function_privilege(
    'authenticated',
    'public.set_mvp_location_sharing(uuid,uuid,boolean)',
    'execute'
  ) then
    raise exception 'authenticated must not execute set_mvp_location_sharing';
  end if;

  if has_function_privilege(
    'authenticated',
    'public.upsert_mvp_current_location(uuid,uuid,double precision,double precision)',
    'execute'
  ) then
    raise exception 'authenticated must not execute upsert_mvp_current_location';
  end if;

  if has_table_privilege('authenticated', 'public.trip_member_locations', 'insert, update, delete') then
    raise exception 'authenticated must not mutate trip member locations directly';
  end if;

  insert into auth.users (id, aud, role, email, created_at, updated_at)
  values
    (v_peer, 'authenticated', 'authenticated', 'mvp-location-peer@example.invalid', now(), now()),
    (v_removed_member, 'authenticated', 'authenticated', 'mvp-location-removed@example.invalid', now(), now()),
    (v_outsider, 'authenticated', 'authenticated', 'mvp-location-outsider@example.invalid', now(), now());

  v_trip := (
    public.create_mvp_trip(
      v_actor,
      '55555555-5555-4555-8555-555555555581',
      'Location sharing test trip',
      current_date,
      'en'
    ) ->> 'tripId'
  )::uuid;

  v_other_trip := (
    public.create_mvp_trip(
      v_actor,
      '55555555-5555-4555-8555-555555555582',
      'Other location sharing test trip',
      current_date,
      'en'
    ) ->> 'tripId'
  )::uuid;

  insert into public.trip_members (trip_id, user_id, role, status, invited_by, joined_at)
  values
    (v_trip, v_peer, 'editor', 'active', v_actor, now()),
    (v_trip, v_removed_member, 'viewer', 'removed', v_actor, null);

  begin
    perform public.set_mvp_location_sharing(v_outsider, v_trip, true);
  exception when others then
    v_non_member_enable_rejected := sqlerrm like '%FORBIDDEN trip membership%';
  end;

  if not v_non_member_enable_rejected then
    raise exception 'a non-member must not enable location sharing';
  end if;

  begin
    perform public.upsert_mvp_current_location(v_outsider, v_trip, 39.9163, 116.3972);
  exception when others then
    v_non_member_upload_rejected := sqlerrm like '%FORBIDDEN trip membership%';
  end;

  if not v_non_member_upload_rejected then
    raise exception 'a non-member must not upload a current location';
  end if;

  begin
    perform public.upsert_mvp_current_location(v_actor, v_trip, 39.9163, 116.3972);
  exception when others then
    v_disabled_upload_rejected := sqlerrm like '%FORBIDDEN location sharing disabled%';
  end;

  if not v_disabled_upload_rejected then
    raise exception 'a member must not upload while location sharing is disabled';
  end if;

  perform public.set_mvp_location_sharing(v_actor, v_trip, true);
  perform public.upsert_mvp_current_location(v_actor, v_trip, 39.9163, 116.3972);

  if not exists (
    select 1
    from public.trip_member_locations
    where trip_id = v_trip
      and user_id = v_actor
      and expires_at > now()
  ) then
    raise exception 'enabled sharing must retain one unexpired current point';
  end if;

  alter table public.trip_location_sharing_preferences
  disable trigger trip_location_sharing_preferences_set_updated_at;
  update public.trip_location_sharing_preferences
  set
    updated_at = now() - interval '2 seconds',
    expires_at = now() - interval '1 second'
  where trip_id = v_trip and user_id = v_actor;
  alter table public.trip_location_sharing_preferences
  enable trigger trip_location_sharing_preferences_set_updated_at;

  begin
    perform public.upsert_mvp_current_location(v_actor, v_trip, 39.9163, 116.3972);
  exception when others then
    v_expired_preference_upload_rejected := sqlerrm like '%FORBIDDEN location sharing disabled%';
  end;

  if not v_expired_preference_upload_rejected then
    raise exception 'a member must not upload with an expired sharing preference';
  end if;

  perform public.set_mvp_location_sharing(v_actor, v_trip, true);

  perform public.set_mvp_location_sharing(v_actor, v_other_trip, true);
  perform public.upsert_mvp_current_location(v_actor, v_other_trip, 39.9164, 116.3973);

  perform set_config('request.jwt.claim.sub', v_peer::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_peer, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if (select count(*) from public.trip_member_locations where trip_id = v_trip) <> 1 then
    raise exception 'an active same-trip peer must read an enabled unexpired current point';
  end if;

  if exists (select 1 from public.trip_member_locations where trip_id = v_other_trip) then
    raise exception 'a member cannot read another trip''s location rows';
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', v_removed_member::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_removed_member, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if exists (select 1 from public.trip_member_locations) then
    raise exception 'a removed member must not read current locations';
  end if;

  reset role;
  update public.trip_member_locations
  set
    updated_at = now() - interval '2 seconds',
    expires_at = now() - interval '1 second'
  where trip_id = v_trip and user_id = v_actor;

  set local role authenticated;
  if exists (select 1 from public.trip_member_locations where trip_id = v_trip) then
    raise exception 'an expired current point must not be selected by an active peer';
  end if;

  reset role;
  perform public.upsert_mvp_current_location(v_actor, v_trip, 39.9163, 116.3972);
  perform public.set_mvp_location_sharing(v_actor, v_trip, false);

  if exists (
    select 1 from public.trip_member_locations where trip_id = v_trip and user_id = v_actor
  ) then
    raise exception 'disabling sharing must revoke the current point';
  end if;

  perform set_config('request.jwt.claim.sub', v_outsider::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if exists (select 1 from public.trip_member_locations) then
    raise exception 'a non-member must not read any trip member locations';
  end if;

  reset role;
end;
$$;

rollback;
