create table public.trip_location_sharing_preferences (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  enabled_at timestamptz,
  expires_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id),
  check (expires_at > updated_at)
);

create table public.trip_member_locations (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (trip_id, user_id),
  check (expires_at > updated_at)
);

create index trip_member_locations_active_expiry_idx
  on public.trip_member_locations (trip_id, expires_at)
  where sharing_enabled;

create trigger trip_location_sharing_preferences_set_updated_at
before update on public.trip_location_sharing_preferences
for each row execute function private.set_updated_at();

alter table public.trip_location_sharing_preferences enable row level security;
alter table public.trip_member_locations enable row level security;

revoke all on table public.trip_location_sharing_preferences from public, anon, authenticated;
revoke all on table public.trip_member_locations from public, anon, authenticated;

grant select on table public.trip_location_sharing_preferences to authenticated;
grant select on table public.trip_member_locations to authenticated;
grant all on table public.trip_location_sharing_preferences to service_role;
grant all on table public.trip_member_locations to service_role;

create policy "members can read their sharing preference"
on public.trip_location_sharing_preferences
for select
to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.trip_members
    where trip_members.trip_id = trip_location_sharing_preferences.trip_id
      and trip_members.user_id = (select auth.uid())
      and trip_members.status = 'active'
  )
);

create policy "active members can read current trip locations"
on public.trip_member_locations
for select
to authenticated
using (
  sharing_enabled
  and expires_at > now()
  and exists (
    select 1
    from public.trip_members as requesting_member
    where requesting_member.trip_id = trip_member_locations.trip_id
      and requesting_member.user_id = (select auth.uid())
      and requesting_member.status = 'active'
  )
  and exists (
    select 1
    from public.trip_members as sharing_member
    where sharing_member.trip_id = trip_member_locations.trip_id
      and sharing_member.user_id = trip_member_locations.user_id
      and sharing_member.status = 'active'
  )
);

create function public.set_mvp_location_sharing(
  p_actor_id uuid,
  p_trip_id uuid,
  p_enabled boolean
)
returns jsonb
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.trip_members
    where trip_members.trip_id = p_trip_id
      and trip_members.user_id = p_actor_id
      and trip_members.status = 'active'
  ) then
    raise exception 'FORBIDDEN trip membership';
  end if;

  if not p_enabled then
    delete from public.trip_member_locations
    where trip_id = p_trip_id
      and user_id = p_actor_id;

    delete from public.trip_location_sharing_preferences
    where trip_id = p_trip_id
      and user_id = p_actor_id;

    return jsonb_build_object('tripId', p_trip_id, 'enabled', false);
  end if;

  insert into public.trip_location_sharing_preferences (
    trip_id,
    user_id,
    enabled,
    enabled_at,
    expires_at
  )
  values (p_trip_id, p_actor_id, true, now(), now() + interval '10 minutes')
  on conflict (trip_id, user_id) do update
  set
    enabled = true,
    enabled_at = now(),
    expires_at = now() + interval '10 minutes';

  return jsonb_build_object('tripId', p_trip_id, 'enabled', true);
end;
$$;

create function public.upsert_mvp_current_location(
  p_actor_id uuid,
  p_trip_id uuid,
  p_latitude double precision,
  p_longitude double precision
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_expires_at timestamptz := now() + interval '10 minutes';
begin
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'VALIDATION_FAILED WGS84 coordinate';
  end if;

  if not exists (
    select 1
    from public.trip_members
    where trip_members.trip_id = p_trip_id
      and trip_members.user_id = p_actor_id
      and trip_members.status = 'active'
  ) then
    raise exception 'FORBIDDEN trip membership';
  end if;

  if not exists (
    select 1
    from public.trip_location_sharing_preferences
    where trip_location_sharing_preferences.trip_id = p_trip_id
      and trip_location_sharing_preferences.user_id = p_actor_id
      and trip_location_sharing_preferences.enabled
      and trip_location_sharing_preferences.expires_at > now()
  ) then
    raise exception 'FORBIDDEN location sharing disabled';
  end if;

  insert into public.trip_member_locations (
    trip_id,
    user_id,
    latitude,
    longitude,
    sharing_enabled,
    updated_at,
    expires_at
  )
  values (
    p_trip_id,
    p_actor_id,
    p_latitude,
    p_longitude,
    true,
    now(),
    v_expires_at
  )
  on conflict (trip_id, user_id) do update
  set
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    sharing_enabled = true,
    updated_at = excluded.updated_at,
    expires_at = excluded.expires_at;

  update public.trip_location_sharing_preferences
  set expires_at = v_expires_at
  where trip_id = p_trip_id
    and user_id = p_actor_id;

  return jsonb_build_object('tripId', p_trip_id, 'enabled', true, 'expiresAt', v_expires_at);
end;
$$;

revoke all on function public.set_mvp_location_sharing(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.upsert_mvp_current_location(uuid, uuid, double precision, double precision) from public, anon, authenticated;
grant execute on function public.set_mvp_location_sharing(uuid, uuid, boolean) to service_role;
grant execute on function public.upsert_mvp_current_location(uuid, uuid, double precision, double precision) to service_role;
