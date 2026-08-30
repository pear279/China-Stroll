#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

for executable in docker supabase; do
  if ! command -v "$executable" >/dev/null 2>&1; then
    echo "$executable is required for local database verification" >&2
    exit 1
  fi
done

if ! docker info >/dev/null 2>&1; then
  echo "Docker is unavailable; start OrbStack before running this command" >&2
  exit 1
fi

project_id="$(awk -F'"' '/^project_id = / { print $2; exit }' supabase/config.toml)"
if [[ -z "$project_id" ]]; then
  echo "supabase/config.toml does not declare project_id" >&2
  exit 1
fi

db_container="supabase_db_${project_id}"

supabase start >/dev/null
supabase db reset

if ! docker inspect "$db_container" >/dev/null 2>&1; then
  echo "Supabase database container $db_container was not found" >&2
  exit 1
fi

for sql_file in \
  supabase/tests/mvp_business_schema.sql \
  supabase/tests/mvp_trip_commands.sql
do
  echo "Running $sql_file"
  docker exec -i "$db_container" \
    psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 \
    < "$sql_file"
done

residue_state="$(docker exec "$db_container" \
  psql --username postgres --dbname postgres --tuples-only --no-align \
  --command "select not exists (select 1 from auth.users where id in ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444')) and not exists (select 1 from public.places where id = 'command-test-draft-place') and not exists (select 1 from public.trips where owner_id = '44444444-4444-4444-8444-444444444444');")"

if [[ "$residue_state" != "t" ]]; then
  echo "SQL rollback tests left fixture data behind" >&2
  exit 1
fi

supabase db reset

docker exec -i "$db_container" \
  psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 <<'SQL'
do $$
declare
  published_place_count integer;
  published_localization_count integer;
  published_visit_count integer;
begin
  if to_regclass('public.trips') is null
    or to_regclass('public.trip_days') is null
    or to_regclass('public.trip_stops') is null
    or to_regprocedure('public.create_mvp_trip(uuid,uuid,text,date,text)') is null
    or to_regprocedure('public.apply_mvp_trip_changes(uuid,uuid,bigint,uuid,jsonb,text)') is null
    or to_regprocedure('public.confirm_mvp_agent_suggestion(uuid,uuid,uuid,bigint,uuid)') is null
    or to_regprocedure('public.add_mvp_trip_day(uuid,uuid,bigint,uuid,date,text)') is null
  then
    raise exception 'core MVP schema objects are missing after the second reset';
  end if;

  select count(*) into published_place_count
  from public.places
  where status = 'published'
    and coordinate_system = 'WGS84'
    and coordinates_checked_at is not null;

  select count(*) into published_localization_count
  from public.place_localizations
  where review_status = 'published';

  select count(*) into published_visit_count
  from public.place_visit_information
  where status = 'published'
    and checked_at is not null
    and review_due_at is not null;

  if published_place_count <> 20
    or published_localization_count <> 40
    or published_visit_count <> 40
  then
    raise exception 'curated place counts are invalid: places %, localizations %, visit information %',
      published_place_count, published_localization_count, published_visit_count;
  end if;

  if exists (
    select 1
    from public.place_visit_information visit
    where visit.status = 'published'
      and not exists (
        select 1
        from public.place_visit_information_sources source_link
        where source_link.place_id = visit.place_id
          and source_link.locale = visit.locale
      )
  ) then
    raise exception 'published visit information is missing a source link';
  end if;
end;
$$;

set role anon;
do $$
begin
  if (select count(*) from public.places) <> 20
    or (select count(*) from public.place_localizations) <> 40
    or (select count(*) from public.place_visit_information) <> 40
  then
    raise exception 'anonymous role cannot read the complete curated place set';
  end if;
end;
$$;
reset role;
SQL

echo "Local Supabase migrations and rollback tests passed"
