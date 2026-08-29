# Local Supabase Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a repeatable local PostgreSQL 17 Supabase environment that rebuilds the schema twice, runs both SQL rollback suites, and proves the suites leave no test data behind.

**Architecture:** OrbStack provides the local Docker engine and the Homebrew-installed Supabase CLI owns the service lifecycle. A repository shell script is the single validation entry point: it resets the database, runs self-contained SQL suites inside the Supabase database container, checks rollback residue, resets again, and verifies core schema objects.

**Tech Stack:** OrbStack, Docker CLI, Supabase CLI, PostgreSQL 17, `psql`, Bash, npm scripts

**Spec:** `docs/superpowers/specs/2026-08-29-local-supabase-validation-design.md`

## Global Constraints

- Do not run `supabase link`, `supabase db push`, or any command that connects to or changes the remote Supabase project.
- Keep PostgreSQL major version `17` and the ports already declared in `supabase/config.toml`.
- Do not terminate processes occupying configured ports; report the conflict and stop.
- Run every SQL suite with `ON_ERROR_STOP=1`.
- SQL fixtures must be created inside the suite transaction and disappear at its final `rollback`.
- `supabase/seed.sql` intentionally contains no location rows; successful execution, not a location count, is the seed acceptance criterion.

---

### Task 1: Prepare and verify the local container toolchain

**Files:**
- No repository files change in this task.

**Interfaces:**
- Consumes: macOS application `/Applications/OrbStack.app`, Homebrew, repository `supabase/config.toml`
- Produces: a running Docker engine, a working `supabase` executable, and free local ports `54320` through `54324`

- [ ] **Step 1: Confirm the current preconditions**

Run:

```bash
command -v brew
test -d /Applications/OrbStack.app
command -v docker
if command -v supabase >/dev/null 2>&1; then supabase --version; else echo "supabase CLI is not installed"; fi
```

Expected: Homebrew, OrbStack, and Docker are present; Supabase CLI reports missing until Step 4 if it was not already installed.

- [ ] **Step 2: Check the configured ports before starting services**

Run:

```bash
for port in 54320 54321 54322 54323 54324; do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN; then
    echo "port $port is already occupied"
    exit 1
  fi
done
```

Expected: no listener and exit code 0. If a listener exists, report its process and stop without terminating it.

- [ ] **Step 3: Start OrbStack and confirm the Docker server**

Run:

```bash
open -a OrbStack
docker info --format '{{.ServerVersion}}'
```

Expected: the second command prints the OrbStack Docker server version. If OrbStack is still starting, retry `docker info` until the application reports ready.

- [ ] **Step 4: Install the Supabase CLI through its Homebrew tap**

Run:

```bash
brew install supabase/tap/supabase
supabase --version
```

Expected: Homebrew installs the CLI and `supabase --version` prints a version. If the formula is already installed, Homebrew reports that no upgrade is needed.

- [ ] **Step 5: Start the repository's local Supabase services**

Run:

```bash
supabase start
supabase status
docker ps --filter name=supabase_ --format 'table {{.Names}}\t{{.Status}}'
```

Expected: Supabase reports local API and database URLs; the database container is named `supabase_db_china-stroll_new` and is healthy.

### Task 2: Make the SQL command suite self-contained

**Files:**
- Modify: `supabase/tests/mvp_trip_commands.sql`

**Interfaces:**
- Consumes: `public.places`, `public.place_localizations`, and `public.apply_mvp_trip_changes(...)` created by migrations
- Produces: a published and coordinate-reviewed `forbidden-city` fixture that exists only inside the test transaction

- [ ] **Step 1: Rebuild the database from repository state**

Run:

```bash
supabase db reset
```

Expected: every migration and `supabase/seed.sql` applies successfully to a fresh PostgreSQL 17 database.

- [ ] **Step 2: Run the current command test to demonstrate the missing fixture**

Run:

```bash
docker exec -i supabase_db_china-stroll_new psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 < supabase/tests/mvp_trip_commands.sql
```

Expected before the fixture is added: FAIL while adding `forbidden-city`, because the local seed contains no location rows.

- [ ] **Step 3: Add the published reviewed location fixture inside the test transaction**

Insert this block after the test user insert and before the first `do $$` block in `supabase/tests/mvp_trip_commands.sql`:

```sql
insert into public.places (
  id,
  category_code,
  latitude,
  longitude,
  recommended_duration_minutes,
  coordinate_system,
  coordinates_checked_at,
  status
)
values (
  'forbidden-city',
  'historic',
  39.9172757,
  116.3907694,
  240,
  'WGS84',
  now(),
  'published'
)
on conflict (id) do update
set latitude = excluded.latitude,
    longitude = excluded.longitude,
    coordinate_system = excluded.coordinate_system,
    coordinates_checked_at = excluded.coordinates_checked_at,
    status = excluded.status;

insert into public.place_localizations (
  place_id,
  locale,
  name,
  short_intro,
  history,
  visitor_tips,
  practical_notes,
  photo_spot_notes,
  review_status
)
values (
  'forbidden-city',
  'en',
  'The Palace Museum',
  'Published command-test fixture.',
  'Published command-test fixture history.',
  'Published command-test fixture tips.',
  'Published command-test fixture practical notes.',
  'Published command-test fixture photo notes.',
  'published'
)
on conflict (place_id, locale) do update
set name = excluded.name,
    review_status = excluded.review_status;
```

- [ ] **Step 4: Run both SQL suites against the clean database**

Run:

```bash
docker exec -i supabase_db_china-stroll_new psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 < supabase/tests/mvp_business_schema.sql
docker exec -i supabase_db_china-stroll_new psql --username postgres --dbname postgres --set ON_ERROR_STOP=1 < supabase/tests/mvp_trip_commands.sql
```

Expected: both commands exit 0 and end with `ROLLBACK`.

- [ ] **Step 5: Commit the self-contained test fixture**

Run:

```bash
git add supabase/tests/mvp_trip_commands.sql
git commit -m "test: make trip command SQL self-contained"
```

Expected: one commit containing only the SQL test fixture.

### Task 3: Add the repeatable database verification command

**Files:**
- Create: `scripts/verify-local-database.sh`
- Modify: `package.json`
- Test: `scripts/verify-local-database.sh` executed through `npm run db:verify`

**Interfaces:**
- Consumes: `supabase/config.toml`, `supabase/migrations/*.sql`, `supabase/seed.sql`, and both `supabase/tests/*.sql` files
- Produces: executable command `npm run db:verify` with exit code 0 only when both resets, both SQL suites, rollback residue checks, and schema integrity checks pass

- [ ] **Step 1: Confirm the repository has no single database verification command**

Run:

```bash
npm run db:verify
```

Expected before implementation: FAIL with `Missing script: "db:verify"`.

- [ ] **Step 2: Create the verification script**

Create `scripts/verify-local-database.sh` with this content:

```bash
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

supabase start
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
```

- [ ] **Step 3: Expose the script through npm**

Add this entry to the `scripts` object in `package.json` after `build:worker`:

```json
"db:verify": "bash scripts/verify-local-database.sh",
```

- [ ] **Step 4: Run the complete repeatable validation**

Run:

```bash
npm run db:verify
```

Expected: two successful database resets, both SQL files ending in `ROLLBACK`, a successful residue query, a successful core-object `DO` block, and the final line `Local Supabase migrations and rollback tests passed`.

- [ ] **Step 5: Commit the verification entry point**

Run:

```bash
git add package.json scripts/verify-local-database.sh
git commit -m "test: automate local database validation"
```

Expected: one commit containing the script and npm entry point.

### Task 4: Document the verified local workflow and result

**Files:**
- Modify: `README.md`
- Modify: `references/MVP首条功能开发记录.md`
- Modify: `references/开发规划.md`

**Interfaces:**
- Consumes: the actual `supabase --version`, Docker server version, and successful `npm run db:verify` output from Tasks 1–3
- Produces: developer instructions and a dated record that local validation passed while online migrations remain unapplied

- [ ] **Step 1: Record the exact installed tool versions**

Run:

```bash
supabase --version
docker info --format '{{.ServerVersion}}'
```

Expected: one Supabase CLI version and one OrbStack Docker server version. Copy these exact values into the dated development record.

- [ ] **Step 2: Add the database verification command to README**

Under `## 检查命令`, after the existing command block, add:

````markdown
本地数据库验证需要 Supabase CLI 和正在运行的 OrbStack。命令会从空库应用全部迁移与种子文件，执行两套事务回滚测试，检查测试数据没有残留，再重建一次数据库：

```bash
npm run db:verify
```

该命令只操作本地 Supabase，不会连接或更新线上项目。
````

- [ ] **Step 3: Update the development record with measured results**

Add a dated subsection to `references/MVP首条功能开发记录.md` that states all of the following facts using the exact versions captured in Step 1:

1. OrbStack and Supabase CLI now provide the local PostgreSQL 17 environment.
2. Every migration and the intentionally empty `supabase/seed.sql` applied successfully twice.
3. `mvp_business_schema.sql` and `mvp_trip_commands.sql` both passed with rollback.
4. The fixed test users, draft location, and trip did not remain in the database.
5. The command suite now creates its own reviewed `forbidden-city` fixture instead of depending on remote data.
6. No migration was applied to the online project.

- [ ] **Step 4: Update the development plan status**

In `references/开发规划.md`, replace the statement that local SQL tests cannot run because Docker or Podman is missing. Record that the local PostgreSQL 17 environment and repeatable command now pass, while online migration application is still pending.

- [ ] **Step 5: Run repository-wide verification**

Run:

```bash
npm run db:verify
npm run typecheck
npm run lint
npm test
npm run build:web
npm run build:functions
npm run build:worker
git diff --check
```

Expected: database verification passes; 51 existing Vitest tests pass; typecheck, lint, web build, Pages Functions build, Worker dry-run build, and whitespace validation all pass.

- [ ] **Step 6: Commit the verified documentation**

Run:

```bash
git add README.md references/MVP首条功能开发记录.md references/开发规划.md docs/superpowers/specs/2026-08-29-local-supabase-validation-design.md
git commit -m "docs: record local database verification"
```

Expected: one commit containing the corrected design statement and measured verification results.
