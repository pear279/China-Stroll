-- Onboarding captures a party size and a start/end range for the trip.
-- `traveler_count` is a bounded trip-level planning field; actual trip members
-- remain the source of truth for sharing and permissions.

alter table public.trips
  add column if not exists traveler_count integer not null default 1;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'trips_traveler_count_check'
  ) then
    alter table public.trips
      add constraint trips_traveler_count_check check (traveler_count between 1 and 50);
  end if;
end $$;

drop function if exists public.create_mvp_trip(uuid, uuid, text, date, text);

create or replace function public.create_mvp_trip(
  p_actor_id uuid,
  p_command_id uuid,
  p_name text,
  p_start_date date default null,
  p_locale text default 'en',
  p_end_date date default null,
  p_traveler_count integer default 1
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_trip_id uuid;
  v_existing jsonb;
begin
  select summary into v_existing
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id;

  if v_existing is not null then
    return v_existing;
  end if;

  if length(btrim(p_name)) not between 1 and 120 then
    raise exception 'VALIDATION_FAILED trip name';
  end if;

  if p_traveler_count < 1 or p_traveler_count > 50 then
    raise exception 'VALIDATION_FAILED traveler count';
  end if;

  if p_start_date is not null and p_end_date is not null and p_end_date < p_start_date then
    raise exception 'VALIDATION_FAILED trip dates';
  end if;

  insert into public.trips (owner_id, name, start_date, end_date, traveler_count, locale)
  values (
    p_actor_id,
    btrim(p_name),
    p_start_date,
    coalesce(p_end_date, p_start_date),
    p_traveler_count,
    p_locale
  )
  returning id into v_trip_id;

  insert into public.trip_days (trip_id, day_number, day_date, title)
  values (v_trip_id, 1, p_start_date, 'Day 1');

  v_existing := jsonb_build_object(
    'tripId', v_trip_id,
    'version', 1,
    'commandId', p_command_id,
    'changed', jsonb_build_array(jsonb_build_object('type', 'trip', 'id', v_trip_id))
  );

  insert into public.trip_change_log (
    trip_id,
    version,
    command_id,
    actor_user_id,
    change_type,
    summary
  )
  values (v_trip_id, 1, p_command_id, p_actor_id, 'create_trip', v_existing);

  return v_existing;
end;
$$;

revoke all on function public.create_mvp_trip(uuid, uuid, text, date, text, date, integer) from public, anon, authenticated;
grant execute on function public.create_mvp_trip(uuid, uuid, text, date, text, date, integer) to service_role;
