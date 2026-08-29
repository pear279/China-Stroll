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
end;
$$;
SQL

echo "Local Supabase migrations and rollback tests passed"
