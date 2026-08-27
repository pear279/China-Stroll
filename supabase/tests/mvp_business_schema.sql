begin;

create temporary table mvp_schema_test_results (
  test_name text primary key,
  passed boolean not null,
  detail text not null
);

grant select, insert on table mvp_schema_test_results to authenticated;

insert into auth.users (
  id,
  aud,
  role,
  email,
  created_at,
  updated_at
)
values
  (
    '11111111-1111-4111-8111-111111111111',
    'authenticated',
    'authenticated',
    'mvp-owner@example.invalid',
    now(),
    now()
  ),
  (
    '22222222-2222-4222-8222-222222222222',
    'authenticated',
    'authenticated',
    'mvp-editor@example.invalid',
    now(),
    now()
  ),
  (
    '33333333-3333-4333-8333-333333333333',
    'authenticated',
    'authenticated',
    'mvp-outsider@example.invalid',
    now(),
    now()
  );

insert into public.trips (
  id,
  owner_id,
  name,
  locale
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '11111111-1111-4111-8111-111111111111',
  'Beijing family trip',
  'en'
);

insert into public.trip_members (
  trip_id,
  user_id,
  role,
  status,
  invited_by,
  joined_at
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '22222222-2222-4222-8222-222222222222',
  'editor',
  'active',
  '11111111-1111-4111-8111-111111111111',
  now()
);

insert into public.trip_days (
  trip_id,
  day_number,
  day_date,
  title
)
values (
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  1,
  current_date,
  'Arrival day'
);

insert into public.trip_stops (
  trip_id,
  trip_day_id,
  snapshot_name,
  snapshot_latitude,
  snapshot_longitude,
  source,
  created_by
)
select
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  trip_days.id,
  'Manual test place',
  39.9163,
  116.3972,
  'manual',
  '11111111-1111-4111-8111-111111111111'
from public.trip_days
where trip_days.trip_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into mvp_schema_test_results
select
  'owner membership trigger',
  count(*) = 1,
  'A new trip must create one active owner membership'
from public.trip_members
where trip_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  and user_id = '11111111-1111-4111-8111-111111111111'
  and role = 'owner'
  and status = 'active';

insert into mvp_schema_test_results
select
  'authenticated trip writes blocked',
  not has_table_privilege('authenticated', 'public.trips', 'insert')
    and not has_table_privilege('authenticated', 'public.trips', 'update')
    and not has_table_privilege('authenticated', 'public.trips', 'delete'),
  'Trip mutations must go through the Worker';

insert into mvp_schema_test_results
select
  'invitation table hidden',
  not has_table_privilege('authenticated', 'public.trip_invitations', 'select'),
  'Invitation token hashes must remain server only';

update public.trips
set version = version + 1
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

insert into mvp_schema_test_results
select
  'trip version increments once',
  version = 2,
  'Every accepted trip command must increase the version by one'
from public.trips
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select set_config(
  'request.jwt.claim.sub',
  '11111111-1111-4111-8111-111111111111',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',
  true
);
set local role authenticated;

insert into mvp_schema_test_results
select
  'owner can read trip',
  count(*) = 1,
  'The owner must read the owned trip'
from public.trips;

insert into mvp_schema_test_results
select
  'owner can read members',
  count(*) = 2,
  'The owner must read active trip members'
from public.trip_members;

insert into mvp_schema_test_results
select
  'owner can read stops',
  count(*) = 1,
  'The owner must read stops in the trip'
from public.trip_stops;

insert into public.user_profiles (
  user_id,
  display_name,
  interface_locale,
  content_locale
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Test owner',
  'en',
  'en'
);

insert into public.place_library_items (
  user_id,
  custom_name,
  latitude,
  longitude,
  source
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Saved manual place',
  39.9163,
  116.3972,
  'manual'
);

insert into mvp_schema_test_results
select
  'owner profile and library write',
  (
    select count(*) = 1
    from public.user_profiles
  )
  and
  (
    select count(*) = 1
    from public.place_library_items
  ),
  'A user must maintain only their own profile and library';

reset role;

select set_config(
  'request.jwt.claim.sub',
  '22222222-2222-4222-8222-222222222222',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}',
  true
);
set local role authenticated;

insert into mvp_schema_test_results
select
  'editor can read trip',
  count(*) = 1,
  'An active editor must read the shared trip'
from public.trips;

insert into mvp_schema_test_results
select
  'editor cannot read owner profile',
  count(*) = 0,
  'Profiles stay private to their owner'
from public.user_profiles;

insert into mvp_schema_test_results
select
  'editor cannot read owner library',
  count(*) = 0,
  'Libraries stay private to their owner'
from public.place_library_items;

reset role;

select set_config(
  'request.jwt.claim.sub',
  '33333333-3333-4333-8333-333333333333',
  true
);
select set_config(
  'request.jwt.claims',
  '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}',
  true
);
set local role authenticated;

insert into mvp_schema_test_results
select
  'outsider cannot read trip',
  count(*) = 0,
  'A non-member must not read the trip'
from public.trips;

insert into mvp_schema_test_results
select
  'outsider cannot read children',
  (
    select count(*) = 0
    from public.trip_members
  )
  and
  (
    select count(*) = 0
    from public.trip_days
  )
  and
  (
    select count(*) = 0
    from public.trip_stops
  ),
  'A non-member must not read members, days, or stops';

reset role;

insert into mvp_schema_test_results
select
  'business tables use rls',
  count(*) = 12 and bool_and(relrowsecurity),
  'Every exposed business table must enable RLS'
from pg_class
where oid in (
  'public.place_visit_information'::regclass,
  'public.place_visit_information_sources'::regclass,
  'public.user_profiles'::regclass,
  'public.trips'::regclass,
  'public.trip_members'::regclass,
  'public.trip_invitations'::regclass,
  'public.trip_days'::regclass,
  'public.trip_stops'::regclass,
  'public.place_library_items'::regclass,
  'public.reservations'::regclass,
  'public.agent_suggestions'::regclass,
  'public.trip_change_log'::regclass
);

do $$
declare
  failed_tests text;
begin
  select string_agg(test_name || '  ' || detail, E'\n' order by test_name)
  into failed_tests
  from mvp_schema_test_results
  where not passed;

  if failed_tests is not null then
    raise exception 'MVP schema tests failed% %', E'\n', failed_tests;
  end if;
end;
$$;

rollback;
