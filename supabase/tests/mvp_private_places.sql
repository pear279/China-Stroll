begin;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000201', 'authenticated', 'authenticated', 'pp-owner@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000202', 'authenticated', 'authenticated', 'pp-editor@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000203', 'authenticated', 'authenticated', 'pp-viewer@example.invalid', now(), now());

do $$
declare
  v_owner constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000201';
  v_editor constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000202';
  v_viewer constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000203';
  v_trip uuid;
  v_place_id uuid;
  v_rejected boolean;
begin
  if has_function_privilege('authenticated', 'public.create_mvp_private_place(uuid,uuid,uuid,jsonb)', 'execute') then
    raise exception 'authenticated must not execute create_mvp_private_place';
  end if;
  if has_function_privilege('authenticated', 'public.add_mvp_private_stop(uuid,uuid,bigint,uuid,uuid,integer)', 'execute') then
    raise exception 'authenticated must not execute add_mvp_private_stop';
  end if;

  v_trip := (
    public.create_mvp_trip(v_owner, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000201', 'Private place test trip', current_date, 'en') ->> 'tripId'
  )::uuid;

  insert into public.trip_members (trip_id, user_id, role, status, invited_by, joined_at)
  values
    (v_trip, v_editor, 'editor', 'active', v_owner, now()),
    (v_trip, v_viewer, 'viewer', 'active', v_owner, now());

  -- Viewer cannot create a private place.
  v_rejected := false;
  begin
    perform public.create_mvp_private_place(v_viewer, v_trip, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000202', jsonb_build_object('name', 'Sneaky hotel', 'type', 'hotel'));
  exception when others then
    v_rejected := sqlerrm like '%FORBIDDEN trip edit%';
  end;
  if not v_rejected then
    raise exception 'a viewer must not create a private place';
  end if;

  -- Editor creates a coordinate-less private place.
  v_place_id := (
    public.create_mvp_private_place(v_editor, v_trip, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000203',
      jsonb_build_object('name', 'Courtyard Hotel', 'type', 'hotel', 'address', 'Dongcheng', 'notes', 'Near the east gate')
    ) #>> '{privatePlace,id}'
  )::uuid;

  if not exists (
    select 1 from public.private_places where id = v_place_id and trip_id = v_trip and type = 'hotel'
  ) then
    raise exception 'create_mvp_private_place must persist the private place';
  end if;

  -- A partial coordinate is rejected.
  v_rejected := false;
  begin
    perform public.create_mvp_private_place(v_owner, v_trip, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000204',
      jsonb_build_object('name', 'Broken pin', 'type', 'other', 'latitude', 39.9));
  exception when others then
    v_rejected := sqlerrm like '%VALIDATION_FAILED partial private place coordinate%';
  end;
  if not v_rejected then
    raise exception 'a partial coordinate must be rejected';
  end if;

  -- Add the private place to day one as a stop (version 1 -> 2).
  perform public.add_mvp_private_stop(v_editor, v_trip, 1, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000205', v_place_id, 1);

  if not exists (
    select 1 from public.trip_stops
    where trip_id = v_trip and private_place_id = v_place_id and snapshot_name = 'Courtyard Hotel' and place_id is null
  ) then
    raise exception 'add_mvp_private_stop must add a stop for the private place';
  end if;

  -- A duplicate command id returns the first result.
  if public.add_mvp_private_stop(v_editor, v_trip, 1, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000205', v_place_id, 1)
     <> public.add_mvp_private_stop(v_editor, v_trip, 1, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000205', v_place_id, 1) then
    raise exception 'a duplicate private stop command must return the first result';
  end if;

  if (select version from public.trips where id = v_trip) <> 2 then
    raise exception 'the duplicate private stop command must not apply twice';
  end if;
end;
$$;

-- RLS: an active member reads trip private places; a removed member does not.
do $$
declare
  v_viewer constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000203';
  v_trip uuid;
begin
  select id into v_trip from public.trips limit 1;

  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if (select count(*) from public.private_places where trip_id = v_trip) = 0 then
    raise exception 'an active member must read trip private places';
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;
