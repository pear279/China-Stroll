begin;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000101', 'authenticated', 'authenticated', 'edit-owner@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000102', 'authenticated', 'authenticated', 'edit-editor@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000103', 'authenticated', 'authenticated', 'edit-viewer@example.invalid', now(), now());

insert into public.places (
  id, category_code, latitude, longitude, recommended_duration_minutes, coordinate_system, coordinates_checked_at, status
)
values ('forbidden-city', 'historic', 39.9172757, 116.3907694, 240, 'WGS84', now(), 'published')
on conflict (id) do update
set latitude = excluded.latitude, longitude = excluded.longitude,
    coordinate_system = excluded.coordinate_system, coordinates_checked_at = excluded.coordinates_checked_at, status = excluded.status;

insert into public.place_localizations (
  place_id, locale, name, short_intro, history, visitor_tips, practical_notes, photo_spot_notes, review_status
)
values ('forbidden-city', 'en', 'The Palace Museum', 'Fixture.', 'Fixture history.', 'Fixture tips.', 'Fixture notes.', 'Fixture photo notes.', 'published')
on conflict (place_id, locale) do update set name = excluded.name, review_status = excluded.review_status;

do $$
declare
  v_owner constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000101';
  v_editor constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000102';
  v_viewer constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000103';
  v_trip uuid;
  v_stop_id uuid;
  v_rejected boolean;
begin
  if has_function_privilege('authenticated', 'public.update_mvp_trip_day(uuid,uuid,bigint,uuid,integer,jsonb)', 'execute') then
    raise exception 'authenticated must not execute update_mvp_trip_day';
  end if;

  v_trip := (
    public.create_mvp_trip(v_owner, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000101', 'Edit test trip', current_date, 'en') ->> 'tripId'
  )::uuid;

  insert into public.trip_members (trip_id, user_id, role, status, invited_by, joined_at)
  values
    (v_trip, v_editor, 'editor', 'active', v_owner, now()),
    (v_trip, v_viewer, 'viewer', 'active', v_owner, now());

  perform public.apply_mvp_trip_changes(
    v_owner, v_trip, 1, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000102',
    '[{"op":"add_stop","placeId":"forbidden-city","dayNumber":1}]'::jsonb
  );

  select id into v_stop_id
  from public.trip_stops
  where trip_id = v_trip and place_id = 'forbidden-city';

  -- update_stop applies transport mode and notes (version 2 -> 3).
  perform public.apply_mvp_trip_changes(
    v_owner, v_trip, 2, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000103',
    jsonb_build_array(jsonb_build_object(
      'op', 'update_stop', 'stopId', v_stop_id, 'startTime', '09:00',
      'durationMinutes', 240, 'sortOrder', 0, 'transportMode', 'transit', 'notes', 'Meet at the east gate'
    ))
  );

  if not exists (
    select 1 from public.trip_stops
    where id = v_stop_id and transport_mode = 'transit' and notes = 'Meet at the east gate'
  ) then
    raise exception 'update_stop must persist transport mode and notes';
  end if;

  -- An invalid transport mode is rejected by the table constraint (stays version 3).
  v_rejected := false;
  begin
    perform public.apply_mvp_trip_changes(
      v_owner, v_trip, 3, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000104',
      jsonb_build_array(jsonb_build_object(
        'op', 'update_stop', 'stopId', v_stop_id, 'startTime', '10:00',
        'durationMinutes', 240, 'sortOrder', 0, 'transportMode', 'teleport'
      ))
    );
  exception when others then
    v_rejected := true;
  end;
  if not v_rejected then
    raise exception 'an invalid transport mode must be rejected';
  end if;

  -- Owner edits the day date, title, and notes (3 -> 4).
  perform public.update_mvp_trip_day(
    v_owner, v_trip, 3, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000105', 1,
    jsonb_build_object('date', current_date + 1, 'title', 'Museum morning', 'notes', 'Rent an audio guide')
  );

  if not exists (
    select 1 from public.trip_days
    where trip_id = v_trip and day_number = 1 and title = 'Museum morning' and notes = 'Rent an audio guide'
  ) then
    raise exception 'update_mvp_trip_day must persist date, title, and notes';
  end if;

  -- Editor can edit a day (4 -> 5).
  perform public.update_mvp_trip_day(
    v_editor, v_trip, 4, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000106', 1,
    jsonb_build_object('title', 'Morning at the palace')
  );

  -- Viewer cannot edit a day.
  v_rejected := false;
  begin
    perform public.update_mvp_trip_day(
      v_viewer, v_trip, 5, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000107', 1,
      jsonb_build_object('title', 'Sneaky title')
    );
  exception when others then
    v_rejected := sqlerrm like '%FORBIDDEN trip edit%';
  end;
  if not v_rejected then
    raise exception 'a viewer must not edit a trip day';
  end if;

  -- Stale version is rejected.
  v_rejected := false;
  begin
    perform public.update_mvp_trip_day(
      v_owner, v_trip, 4, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000108', 1,
      jsonb_build_object('title', 'Stale title')
    );
  exception when others then
    v_rejected := sqlerrm like '%VERSION_CONFLICT%';
  end;
  if not v_rejected then
    raise exception 'a stale day edit must be rejected';
  end if;

  -- An invalid day title is rejected (stays version 5).
  v_rejected := false;
  begin
    perform public.update_mvp_trip_day(
      v_owner, v_trip, 5, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000109', 1,
      jsonb_build_object('title', '')
    );
  exception when others then
    v_rejected := sqlerrm like '%VALIDATION_FAILED day title%';
  end;
  if not v_rejected then
    raise exception 'an empty day title must be rejected';
  end if;

  -- Duplicate command id returns the first result (5 -> 6, then idempotent).
  if public.update_mvp_trip_day(
    v_owner, v_trip, 5, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000110', 1,
    jsonb_build_object('title', 'Final title')
  ) <> public.update_mvp_trip_day(
    v_owner, v_trip, 5, 'bbbbbbbb-bbbb-4bbb-8bbb-000000000110', 1,
    jsonb_build_object('title', 'Final title')
  ) then
    raise exception 'a duplicate day command must return the first result';
  end if;

  if (select version from public.trips where id = v_trip) <> 6 then
    raise exception 'the duplicate day command must not apply twice';
  end if;
end;
$$;

rollback;
