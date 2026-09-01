-- Private trip-scoped places: hotels, restaurants, meeting points, and other
-- user-created stops. They are a separate trust class from reviewed places and
-- are never returned by public place APIs.

create table public.private_places (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  created_by uuid references auth.users(id) on delete set null,
  name text not null,
  type text not null default 'other',
  address text,
  latitude double precision,
  longitude double precision,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(name)) between 1 and 200),
  check (type in ('hotel', 'restaurant', 'meeting_point', 'other')),
  check (
    (latitude is null and longitude is null)
    or (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  check (address is null or length(btrim(address)) between 1 and 400),
  check (length(notes) <= 4000)
);

create index private_places_trip_idx on public.private_places (trip_id, created_at desc);
create index private_places_created_by_idx on public.private_places (created_by) where created_by is not null;

create trigger private_places_set_updated_at
before update on public.private_places
for each row execute function private.set_updated_at();

alter table public.private_places enable row level security;

revoke all on table public.private_places from public, anon, authenticated;
grant select on table public.private_places to authenticated;
grant all on table public.private_places to service_role;

create policy "active members can read trip private places"
on public.private_places
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

alter table public.trip_stops
  add column private_place_id uuid references public.private_places(id) on delete restrict;

alter table public.reservations
  add column private_place_id uuid references public.private_places(id) on delete restrict;

alter table public.trip_stops
  add constraint trip_stops_single_place_check
  check (place_id is null or private_place_id is null);

alter table public.reservations
  add constraint reservations_single_place_check
  check (place_id is null or private_place_id is null);

create or replace function public.create_mvp_private_place(
  p_actor_id uuid,
  p_trip_id uuid,
  p_command_id uuid,
  p_input jsonb
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_result jsonb;
  v_place_id uuid;
  v_name text;
  v_type text;
  v_latitude double precision;
  v_longitude double precision;
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

  v_name := btrim(coalesce(p_input ->> 'name', ''));
  v_type := coalesce(p_input ->> 'type', 'other');
  v_latitude := nullif(p_input ->> 'latitude', '')::double precision;
  v_longitude := nullif(p_input ->> 'longitude', '')::double precision;

  if length(v_name) not between 1 and 200 then
    raise exception 'VALIDATION_FAILED private place name';
  end if;

  if v_type not in ('hotel', 'restaurant', 'meeting_point', 'other') then
    raise exception 'VALIDATION_FAILED private place type';
  end if;

  if (v_latitude is null) <> (v_longitude is null) then
    raise exception 'VALIDATION_FAILED partial private place coordinate';
  end if;

  insert into public.private_places (trip_id, created_by, name, type, address, latitude, longitude, notes)
  values (
    p_trip_id,
    p_actor_id,
    v_name,
    v_type,
    nullif(btrim(coalesce(p_input ->> 'address', '')), ''),
    v_latitude,
    v_longitude,
    coalesce(p_input ->> 'notes', '')
  )
  returning id into v_place_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'commandId', p_command_id,
    'privatePlace', jsonb_build_object('id', v_place_id)
  );

  perform private.record_mvp_membership_audit(
    p_trip_id, p_actor_id, p_command_id, 'private_place_create', v_result
  );

  return v_result;
end;
$$;

revoke all on function public.create_mvp_private_place(uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_mvp_private_place(uuid, uuid, uuid, jsonb) to service_role;

create or replace function public.add_mvp_private_stop(
  p_actor_id uuid,
  p_trip_id uuid,
  p_expected_version bigint,
  p_command_id uuid,
  p_private_place_id uuid,
  p_day_number integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_version bigint;
  v_place record;
  v_day_id bigint;
  v_stop_id uuid;
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

  if v_version is null then raise exception 'NOT_FOUND trip'; end if;
  if v_version <> p_expected_version then raise exception 'VERSION_CONFLICT current=%', v_version; end if;

  select name, latitude, longitude into v_place
  from public.private_places
  where id = p_private_place_id
    and trip_id = p_trip_id;

  if v_place.name is null then
    raise exception 'NOT_FOUND private place';
  end if;

  select id into v_day_id
  from public.trip_days
  where trip_id = p_trip_id
    and day_number = p_day_number;

  if v_day_id is null then
    raise exception 'NOT_FOUND trip day';
  end if;

  insert into public.trip_stops (
    trip_id, trip_day_id, private_place_id, snapshot_name, snapshot_latitude, snapshot_longitude,
    duration_minutes, sort_order, source, created_by
  )
  values (
    p_trip_id, v_day_id, p_private_place_id, v_place.name, v_place.latitude, v_place.longitude,
    null,
    (select coalesce(max(sort_order), -1) + 1 from public.trip_stops where trip_id = p_trip_id and trip_day_id = v_day_id),
    'manual',
    p_actor_id
  )
  returning id into v_stop_id;

  update public.trips set version = v_version + 1 where id = p_trip_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_version + 1,
    'commandId', p_command_id,
    'changed', jsonb_build_array(jsonb_build_object('type', 'trip_stop', 'id', v_stop_id, 'operation', 'add_private_stop'))
  );

  insert into public.trip_change_log (trip_id, version, command_id, actor_user_id, change_type, summary)
  values (p_trip_id, v_version + 1, p_command_id, p_actor_id, 'add_private_stop', v_result);

  return v_result;
end;
$$;

revoke all on function public.add_mvp_private_stop(uuid, uuid, bigint, uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.add_mvp_private_stop(uuid, uuid, bigint, uuid, uuid, integer) to service_role;
