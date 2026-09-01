\set ON_ERROR_STOP on

create extension if not exists dblink with schema extensions;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000011', 'authenticated', 'authenticated', 'accept-owner@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'authenticated', 'authenticated', 'accept-recipient-1@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000013', 'authenticated', 'authenticated', 'accept-recipient-2@example.invalid', now(), now());

select (
  public.create_mvp_trip(
    'aaaaaaaa-aaaa-4aaa-8aaa-000000000011',
    'bbbbbbbb-bbbb-4bbb-8bbb-000000000011',
    'Invitation accept race trip',
    current_date,
    'en'
  ) ->> 'tripId'
)::uuid as trip_id
\gset

select (
  public.create_mvp_trip_invitation(
    'aaaaaaaa-aaaa-4aaa-8aaa-000000000011',
    :'trip_id',
    'cccccccc-cccc-4ccc-8ccc-000000000021',
    repeat('e', 64),
    'editor',
    24
  ) #>> '{invitation,id}'
)::uuid as invitation_id
\gset

select extensions.dblink_connect(
  'accept_first',
  'host=' || :'db_host' || ' port=5432 dbname=' || current_database() || ' user=postgres password=postgres'
);
select extensions.dblink_connect(
  'accept_second',
  'host=' || :'db_host' || ' port=5432 dbname=' || current_database() || ' user=postgres password=postgres'
);

select extensions.dblink_exec('accept_first', 'begin');

-- First session accepts and holds the invitation row lock in an open transaction.
select *
from extensions.dblink(
  'accept_first',
  format(
    'select public.accept_mvp_trip_invitation(%L::uuid, %L, %L::uuid)',
    'aaaaaaaa-aaaa-4aaa-8aaa-000000000012',
    repeat('e', 64),
    'cccccccc-cccc-4ccc-8ccc-000000000022'
  )
) as first_accept(result jsonb);

-- Second session attempts the same single-use invitation concurrently.
select extensions.dblink_send_query(
  'accept_second',
  format(
    'select public.accept_mvp_trip_invitation(%L::uuid, %L, %L::uuid)',
    'aaaaaaaa-aaaa-4aaa-8aaa-000000000013',
    repeat('e', 64),
    'cccccccc-cccc-4ccc-8ccc-000000000023'
  )
);

select pg_catalog.pg_sleep(0.1);

do $$
begin
  if extensions.dblink_is_busy('accept_second') <> 1 then
    raise exception 'concurrent acceptance must wait for the in-flight acceptance';
  end if;
end;
$$;

select extensions.dblink_exec('accept_first', 'commit');

select *
from extensions.dblink_get_result('accept_second', false) as second_accept(result text);

do $$
begin
  if (select use_count from public.trip_invitations where token_hash = repeat('e', 64)) <> 1 then
    raise exception 'a single-use invitation must be consumed exactly once';
  end if;

  if (select count(*) from public.trip_members
      where trip_id = (select id from public.trips where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000011')
        and user_id in ('aaaaaaaa-aaaa-4aaa-8aaa-000000000012', 'aaaaaaaa-aaaa-4aaa-8aaa-000000000013')
        and status = 'active') <> 1 then
    raise exception 'concurrent acceptance must create exactly one active membership';
  end if;

  if not exists (
    select 1 from public.trip_members
    where trip_id = (select id from public.trips where owner_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000011')
      and user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-000000000012'
      and status = 'active'
  ) then
    raise exception 'the first acceptance must win the single-use invitation';
  end if;
end;
$$;

select extensions.dblink_disconnect('accept_first');
select extensions.dblink_disconnect('accept_second');

delete from public.trips where id = :'trip_id'::uuid;

delete from auth.users
where id in (
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000011',
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000012',
  'aaaaaaaa-aaaa-4aaa-8aaa-000000000013'
);
