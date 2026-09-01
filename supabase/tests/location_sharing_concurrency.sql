\set ON_ERROR_STOP on

create extension if not exists dblink with schema extensions;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'authenticated',
  'authenticated',
  'location-race@example.invalid',
  now(),
  now()
);

select (
  public.create_mvp_trip(
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    'Location race regression trip',
    current_date,
    'en'
  ) ->> 'tripId'
)::uuid as trip_id
\gset

select public.set_mvp_location_sharing(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'trip_id',
  true
);
select public.upsert_mvp_current_location(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  :'trip_id',
  39.9163,
  116.3972
);

select extensions.dblink_connect(
  'location_revoke',
  'host=' || :'db_host' || ' port=5432 dbname=' || current_database() || ' user=postgres password=postgres'
);
select extensions.dblink_connect(
  'location_upload',
  'host=' || :'db_host' || ' port=5432 dbname=' || current_database() || ' user=postgres password=postgres'
);
select extensions.dblink_exec('location_revoke', 'begin');

-- Hold the same transaction lock used by both commands, revoke inside that
-- transaction, then start an upload from a second session. The upload must wait
-- until revocation commits and must then fail because the preference is gone.
select *
from extensions.dblink(
  'location_revoke',
  format(
    'select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(%L, 0))',
    :'trip_id' || ':aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  )
) as held_lock(result text);

select *
from extensions.dblink(
  'location_revoke',
  format(
    'select public.set_mvp_location_sharing(%L::uuid, %L::uuid, false)',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    :'trip_id'
  )
) as revoked(result jsonb);

select extensions.dblink_send_query(
  'location_upload',
  format(
    'select public.upsert_mvp_current_location(%L::uuid, %L::uuid, 39.9170, 116.3980)',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    :'trip_id'
  )
);

select pg_catalog.pg_sleep(0.1);

do $$
begin
  if extensions.dblink_is_busy('location_upload') <> 1 then
    raise exception 'concurrent upload must wait for an in-flight revoke';
  end if;
end;
$$;

select extensions.dblink_exec('location_revoke', 'commit');
select *
from extensions.dblink_get_result('location_upload', false) as upload_result(result jsonb);

do $$
begin
  if exists (
    select 1
    from public.trip_location_sharing_preferences
    where trip_id = (
        select id from public.trips
        where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      )
      and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'concurrent revoke must remove the sharing preference';
  end if;

  if exists (
    select 1
    from public.trip_member_locations
    where trip_id = (
        select id from public.trips
        where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
      )
      and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ) then
    raise exception 'concurrent revoke must not leave a current location';
  end if;
end;
$$;

select extensions.dblink_disconnect('location_revoke');
select extensions.dblink_disconnect('location_upload');

delete from public.trips
where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

delete from auth.users
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
