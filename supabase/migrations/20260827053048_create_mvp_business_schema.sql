create schema if not exists private;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

alter table public.places
  add column external_ids jsonb not null default '{}'::jsonb,
  add column coordinate_system text,
  add column coordinates_checked_at timestamptz,
  add constraint places_external_ids_object_check
    check (jsonb_typeof(external_ids) = 'object'),
  add constraint places_coordinate_system_check
    check (
      coordinate_system is null
      or coordinate_system in ('WGS84', 'GCJ02', 'BD09')
    );

create table public.place_visit_information (
  place_id text not null,
  locale text not null,
  address text not null,
  opening_hours_text text not null,
  opening_hours jsonb not null default '{}'::jsonb,
  ticket_notes text not null default '',
  booking_required boolean,
  booking_url text,
  reservation_notes text not null default '',
  entrance_notes text not null default '',
  checked_at timestamptz,
  review_due_at timestamptz,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, locale),
  foreign key (place_id, locale)
    references public.place_localizations(place_id, locale)
    on delete cascade,
  check (locale in ('zh-CN', 'en')),
  check (jsonb_typeof(opening_hours) = 'object'),
  check (review_due_at is null or checked_at is null or review_due_at >= checked_at),
  check (status in ('draft', 'reviewed', 'published', 'archived'))
);

create table public.place_visit_information_sources (
  place_id text not null,
  locale text not null,
  source_id bigint not null references public.place_sources(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (place_id, locale, source_id),
  foreign key (place_id, locale)
    references public.place_visit_information(place_id, locale)
    on delete cascade
);

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  interface_locale text not null default 'en',
  content_locale text not null default 'en',
  country_code text,
  travel_preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (interface_locale in ('zh-CN', 'en')),
  check (content_locale in ('zh-CN', 'en')),
  check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  check (jsonb_typeof(travel_preferences) = 'object')
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  destination_code text not null default 'beijing',
  name text not null,
  start_date date,
  end_date date,
  locale text not null default 'en',
  status text not null default 'draft',
  preferences jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(btrim(name)) between 1 and 120),
  check (start_date is null or end_date is null or end_date >= start_date),
  check (locale in ('zh-CN', 'en')),
  check (status in ('draft', 'active', 'completed', 'archived')),
  check (jsonb_typeof(preferences) = 'object'),
  check (version > 0)
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null,
  status text not null default 'active',
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (trip_id, user_id),
  check (role in ('owner', 'editor', 'viewer')),
  check (status in ('active', 'removed')),
  check (role <> 'owner' or status = 'active')
);

create unique index trip_members_one_active_owner_idx
  on public.trip_members (trip_id)
  where role = 'owner' and status = 'active';

create table public.trip_invitations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete restrict,
  role text not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  use_count integer not null default 0,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  check (role in ('editor', 'viewer')),
  check (expires_at > created_at),
  check (max_uses between 1 and 20),
  check (use_count between 0 and max_uses)
);

create table public.trip_days (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null,
  day_date date,
  title text,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, day_number),
  unique (id, trip_id),
  check (day_number > 0),
  check (title is null or length(btrim(title)) between 1 and 120)
);

create unique index trip_days_trip_date_idx
  on public.trip_days (trip_id, day_date)
  where day_date is not null;

create table public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_day_id bigint,
  place_id text references public.places(id) on delete restrict,
  snapshot_name text not null,
  snapshot_latitude double precision,
  snapshot_longitude double precision,
  category_code text,
  start_time time,
  duration_minutes integer,
  transport_mode text,
  notes text not null default '',
  sort_order integer not null default 0,
  source text not null default 'product',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_day_id, trip_id)
    references public.trip_days(id, trip_id)
    on delete restrict,
  check (length(btrim(snapshot_name)) between 1 and 200),
  check (
    (snapshot_latitude is null and snapshot_longitude is null)
    or
    (
      snapshot_latitude between -90 and 90
      and snapshot_longitude between -180 and 180
    )
  ),
  check (duration_minutes is null or duration_minutes between 1 and 1440),
  check (
    transport_mode is null
    or transport_mode in ('walk', 'transit', 'taxi', 'bike', 'other')
  ),
  check (sort_order >= 0),
  check (source in ('product', 'manual', 'ai'))
);

create table public.place_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  place_id text references public.places(id) on delete cascade,
  custom_name text,
  latitude double precision,
  longitude double precision,
  source text not null default 'product',
  collection_name text,
  labels text[] not null default '{}',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (place_id is not null and custom_name is null)
    or
    (place_id is null and custom_name is not null)
  ),
  check (custom_name is null or length(btrim(custom_name)) between 1 and 200),
  check (
    (latitude is null and longitude is null)
    or
    (latitude between -90 and 90 and longitude between -180 and 180)
  ),
  check (source in ('product', 'manual', 'import'))
);

create unique index place_library_items_user_place_idx
  on public.place_library_items (user_id, place_id)
  where place_id is not null;

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  trip_day_id bigint,
  place_id text references public.places(id) on delete restrict,
  category text not null,
  title text not null,
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'planned',
  provider text,
  confirmation_code text,
  attachment_path text,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (trip_day_id, trip_id)
    references public.trip_days(id, trip_id)
    on delete restrict,
  check (category in ('accommodation', 'transport', 'restaurant', 'attraction', 'activity')),
  check (length(btrim(title)) between 1 and 200),
  check (starts_at is null or ends_at is null or ends_at >= starts_at),
  check (status in ('planned', 'confirmed', 'cancelled', 'completed'))
);

create table public.agent_suggestions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  base_version bigint not null,
  requested_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  intent text not null,
  reason text not null,
  changes jsonb not null,
  risks jsonb not null default '[]'::jsonb,
  status text not null default 'proposed',
  expires_at timestamptz not null,
  decided_at timestamptz,
  applied_at timestamptz,
  result_version bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (base_version > 0),
  check (result_version is null or result_version > base_version),
  check (length(btrim(intent)) between 1 and 100),
  check (length(btrim(reason)) between 1 and 2000),
  check (jsonb_typeof(changes) = 'array' and jsonb_array_length(changes) > 0),
  check (jsonb_typeof(risks) = 'array'),
  check (status in ('proposed', 'confirmed', 'rejected', 'expired', 'applied', 'failed')),
  check (expires_at > created_at)
);

create table public.trip_change_log (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips(id) on delete cascade,
  version bigint not null,
  command_id uuid not null unique,
  actor_user_id uuid references auth.users(id) on delete set null,
  change_type text not null,
  summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (trip_id, version),
  check (version > 0),
  check (length(btrim(change_type)) between 1 and 80),
  check (jsonb_typeof(summary) = 'object')
);

create index place_visit_information_status_idx
  on public.place_visit_information (locale, status, review_due_at);
create index place_visit_information_sources_source_idx
  on public.place_visit_information_sources (source_id);
create index trips_owner_status_idx
  on public.trips (owner_id, status, updated_at desc);
create index trip_members_user_status_idx
  on public.trip_members (user_id, status, trip_id);
create index trip_members_invited_by_idx
  on public.trip_members (invited_by)
  where invited_by is not null;
create index trip_invitations_trip_active_idx
  on public.trip_invitations (trip_id, expires_at)
  where revoked_at is null;
create index trip_invitations_invited_by_idx
  on public.trip_invitations (invited_by);
create index trip_days_trip_idx
  on public.trip_days (trip_id, day_number);
create index trip_stops_trip_day_order_idx
  on public.trip_stops (trip_id, trip_day_id, sort_order);
create index trip_stops_place_idx
  on public.trip_stops (place_id)
  where place_id is not null;
create index trip_stops_created_by_idx
  on public.trip_stops (created_by)
  where created_by is not null;
create index place_library_items_user_created_idx
  on public.place_library_items (user_id, created_at desc);
create index place_library_items_place_idx
  on public.place_library_items (place_id)
  where place_id is not null;
create index reservations_trip_time_idx
  on public.reservations (trip_id, starts_at);
create index reservations_trip_day_idx
  on public.reservations (trip_day_id)
  where trip_day_id is not null;
create index reservations_place_idx
  on public.reservations (place_id)
  where place_id is not null;
create index reservations_created_by_idx
  on public.reservations (created_by)
  where created_by is not null;
create index agent_suggestions_trip_status_idx
  on public.agent_suggestions (trip_id, status, created_at desc);
create index agent_suggestions_requested_by_idx
  on public.agent_suggestions (requested_by)
  where requested_by is not null;
create index agent_suggestions_confirmed_by_idx
  on public.agent_suggestions (confirmed_by)
  where confirmed_by is not null;
create index trip_change_log_trip_created_idx
  on public.trip_change_log (trip_id, created_at desc);
create index trip_change_log_actor_idx
  on public.trip_change_log (actor_user_id)
  where actor_user_id is not null;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public, anon, authenticated;

create or replace function private.add_trip_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  insert into public.trip_members (
    trip_id,
    user_id,
    role,
    status,
    joined_at
  )
  values (
    new.id,
    new.owner_id,
    'owner',
    'active',
    now()
  );
  return new;
end;
$$;

revoke execute on function private.add_trip_owner_membership() from public, anon, authenticated;

create or replace function private.prevent_trip_owner_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id <> old.owner_id then
    raise exception 'trip owner transfer is not supported in the MVP';
  end if;
  return new;
end;
$$;

revoke execute on function private.prevent_trip_owner_change() from public, anon, authenticated;

create or replace function private.enforce_trip_version_increment()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.version <> old.version + 1 then
    raise exception 'trip version must increase by exactly one';
  end if;
  return new;
end;
$$;

revoke execute on function private.enforce_trip_version_increment() from public, anon, authenticated;

create or replace function private.protect_trip_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' then
    raise exception 'the active trip owner membership cannot be changed or removed';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.protect_trip_owner_membership() from public, anon, authenticated;

create trigger trips_add_owner_membership
after insert on public.trips
for each row execute function private.add_trip_owner_membership();

create trigger trips_prevent_owner_change
before update of owner_id on public.trips
for each row execute function private.prevent_trip_owner_change();

create trigger trips_enforce_version_increment
before update on public.trips
for each row execute function private.enforce_trip_version_increment();

create trigger trip_members_protect_owner
before update or delete on public.trip_members
for each row execute function private.protect_trip_owner_membership();

create trigger places_set_updated_at
before update on public.places
for each row execute function private.set_updated_at();
create trigger place_localizations_set_updated_at
before update on public.place_localizations
for each row execute function private.set_updated_at();
create trigger guide_segments_set_updated_at
before update on public.guide_segments
for each row execute function private.set_updated_at();
create trigger place_sources_set_updated_at
before update on public.place_sources
for each row execute function private.set_updated_at();
create trigger place_media_set_updated_at
before update on public.place_media
for each row execute function private.set_updated_at();
create trigger place_search_documents_set_updated_at
before update on public.place_search_documents
for each row execute function private.set_updated_at();
create trigger place_visit_information_set_updated_at
before update on public.place_visit_information
for each row execute function private.set_updated_at();
create trigger user_profiles_set_updated_at
before update on public.user_profiles
for each row execute function private.set_updated_at();
create trigger trips_set_updated_at
before update on public.trips
for each row execute function private.set_updated_at();
create trigger trip_members_set_updated_at
before update on public.trip_members
for each row execute function private.set_updated_at();
create trigger trip_days_set_updated_at
before update on public.trip_days
for each row execute function private.set_updated_at();
create trigger trip_stops_set_updated_at
before update on public.trip_stops
for each row execute function private.set_updated_at();
create trigger place_library_items_set_updated_at
before update on public.place_library_items
for each row execute function private.set_updated_at();
create trigger reservations_set_updated_at
before update on public.reservations
for each row execute function private.set_updated_at();
create trigger agent_suggestions_set_updated_at
before update on public.agent_suggestions
for each row execute function private.set_updated_at();

create or replace function private.current_trip_role(p_trip_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when trips.owner_id = (select auth.uid()) then 'owner'
    else (
      select trip_members.role
      from public.trip_members
      where trip_members.trip_id = trips.id
        and trip_members.user_id = (select auth.uid())
        and trip_members.status = 'active'
      limit 1
    )
  end
  from public.trips
  where trips.id = p_trip_id;
$$;

revoke execute on function private.current_trip_role(uuid) from public, anon;
grant execute on function private.current_trip_role(uuid) to authenticated, service_role;

alter table public.place_visit_information enable row level security;
alter table public.place_visit_information_sources enable row level security;
alter table public.user_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_invitations enable row level security;
alter table public.trip_days enable row level security;
alter table public.trip_stops enable row level security;
alter table public.place_library_items enable row level security;
alter table public.reservations enable row level security;
alter table public.agent_suggestions enable row level security;
alter table public.trip_change_log enable row level security;

revoke all on table public.place_visit_information from public, anon, authenticated;
revoke all on table public.place_visit_information_sources from public, anon, authenticated;
revoke all on table public.user_profiles from public, anon, authenticated;
revoke all on table public.trips from public, anon, authenticated;
revoke all on table public.trip_members from public, anon, authenticated;
revoke all on table public.trip_invitations from public, anon, authenticated;
revoke all on table public.trip_days from public, anon, authenticated;
revoke all on table public.trip_stops from public, anon, authenticated;
revoke all on table public.place_library_items from public, anon, authenticated;
revoke all on table public.reservations from public, anon, authenticated;
revoke all on table public.agent_suggestions from public, anon, authenticated;
revoke all on table public.trip_change_log from public, anon, authenticated;

grant select on table public.place_visit_information to anon, authenticated;
grant select on table public.place_visit_information_sources to anon, authenticated;
grant select, insert, update on table public.user_profiles to authenticated;
grant select on table public.trips to authenticated;
grant select on table public.trip_members to authenticated;
grant select on table public.trip_days to authenticated;
grant select on table public.trip_stops to authenticated;
grant select, insert, update, delete on table public.place_library_items to authenticated;
grant select on table public.reservations to authenticated;
grant select on table public.agent_suggestions to authenticated;
grant select on table public.trip_change_log to authenticated;

grant all on table public.place_visit_information to service_role;
grant all on table public.place_visit_information_sources to service_role;
grant all on table public.user_profiles to service_role;
grant all on table public.trips to service_role;
grant all on table public.trip_members to service_role;
grant all on table public.trip_invitations to service_role;
grant all on table public.trip_days to service_role;
grant all on table public.trip_stops to service_role;
grant all on table public.place_library_items to service_role;
grant all on table public.reservations to service_role;
grant all on table public.agent_suggestions to service_role;
grant all on table public.trip_change_log to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy "published visit information is readable"
on public.place_visit_information
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = place_visit_information.place_id
      and places.status = 'published'
  )
  and exists (
    select 1
    from public.place_localizations
    where place_localizations.place_id = place_visit_information.place_id
      and place_localizations.locale = place_visit_information.locale
      and place_localizations.review_status = 'published'
  )
);

create policy "published visit information sources are readable"
on public.place_visit_information_sources
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.place_visit_information
    where place_visit_information.place_id = place_visit_information_sources.place_id
      and place_visit_information.locale = place_visit_information_sources.locale
      and place_visit_information.status = 'published'
  )
);

create policy "users can read their profile"
on public.user_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can create their profile"
on public.user_profiles
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their profile"
on public.user_profiles
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "members can read trips"
on public.trips
for select
to authenticated
using ((select private.current_trip_role(id)) is not null);

create policy "members can read trip members"
on public.trip_members
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

create policy "members can read trip days"
on public.trip_days
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

create policy "members can read trip stops"
on public.trip_stops
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

create policy "members can read reservations"
on public.reservations
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

create policy "members can read agent suggestions"
on public.agent_suggestions
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

create policy "members can read trip change log"
on public.trip_change_log
for select
to authenticated
using ((select private.current_trip_role(trip_id)) is not null);

create policy "users can read their library"
on public.place_library_items
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "users can add to their library"
on public.place_library_items
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "users can update their library"
on public.place_library_items
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users can remove from their library"
on public.place_library_items
for delete
to authenticated
using ((select auth.uid()) = user_id);
