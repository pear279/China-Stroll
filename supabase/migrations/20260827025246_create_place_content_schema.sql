create extension if not exists vector with schema extensions;

create table public.places (
  id text primary key,
  category_code text not null,
  latitude double precision,
  longitude double precision,
  recommended_duration_minutes integer not null check (recommended_duration_minutes between 1 and 1440),
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (latitude is null and longitude is null)
    or
    (latitude between -90 and 90 and longitude between -180 and 180)
  )
);

create table public.place_localizations (
  place_id text not null references public.places(id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'en')),
  name text not null,
  aliases text[] not null default '{}',
  tags text[] not null default '{}',
  short_intro text not null,
  history text not null,
  highlights text[] not null default '{}',
  visitor_tips text not null,
  practical_notes text not null,
  photo_spot_notes text not null,
  review_status text not null default 'draft' check (review_status in ('draft', 'reviewed', 'published', 'archived')),
  reviewed_at timestamptz,
  content_version integer not null default 1 check (content_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (place_id, locale)
);

create table public.guide_segments (
  id bigint generated always as identity primary key,
  place_id text not null references public.places(id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'en')),
  segment_type text not null check (segment_type in ('overview', 'history', 'highlight', 'family', 'practical', 'faq')),
  audience text not null default 'general' check (audience in ('general', 'child')),
  sequence integer not null check (sequence > 0),
  title text,
  content text not null,
  review_status text not null default 'draft' check (review_status in ('draft', 'reviewed', 'published', 'archived')),
  content_version integer not null default 1 check (content_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, locale, audience, segment_type, sequence, content_version)
);

create table public.place_sources (
  id bigint generated always as identity primary key,
  place_id text not null references public.places(id) on delete cascade,
  source_type text not null check (source_type in ('official', 'editorial', 'visitor', 'local', 'other')),
  source_name text not null,
  source_url text,
  fact_scope text[] not null default '{}',
  published_at timestamptz,
  checked_at timestamptz,
  review_due_at timestamptz,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_media (
  id uuid primary key default gen_random_uuid(),
  place_id text not null references public.places(id) on delete cascade,
  media_type text not null check (media_type in ('image', 'audio')),
  storage_path text not null unique,
  locale text check (locale is null or locale in ('zh-CN', 'en')),
  alt_text text,
  credit text,
  license text,
  sort_order integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.place_search_documents (
  id bigint generated always as identity primary key,
  place_id text not null references public.places(id) on delete cascade,
  locale text not null check (locale in ('zh-CN', 'en')),
  section text not null,
  content text not null,
  source_ids bigint[] not null default '{}',
  content_version integer not null default 1 check (content_version > 0),
  embedding_model text,
  embedding extensions.vector,
  status text not null default 'draft' check (status in ('draft', 'reviewed', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (place_id, locale, section, content_version)
);

create index places_status_idx on public.places (status);
create index place_localizations_locale_status_idx on public.place_localizations (locale, review_status);
create index place_localizations_tags_idx on public.place_localizations using gin (tags);
create index guide_segments_place_locale_idx on public.guide_segments (place_id, locale, review_status, sequence);
create index place_sources_place_status_idx on public.place_sources (place_id, status);
create index place_media_place_status_idx on public.place_media (place_id, status, sort_order);
create index place_search_documents_lookup_idx on public.place_search_documents (place_id, locale, status);

alter table public.places enable row level security;
alter table public.place_localizations enable row level security;
alter table public.guide_segments enable row level security;
alter table public.place_sources enable row level security;
alter table public.place_media enable row level security;
alter table public.place_search_documents enable row level security;

revoke all on table public.places from public, anon, authenticated;
revoke all on table public.place_localizations from public, anon, authenticated;
revoke all on table public.guide_segments from public, anon, authenticated;
revoke all on table public.place_sources from public, anon, authenticated;
revoke all on table public.place_media from public, anon, authenticated;
revoke all on table public.place_search_documents from public, anon, authenticated;

grant select on table public.places to anon, authenticated;
grant select on table public.place_localizations to anon, authenticated;
grant select on table public.guide_segments to anon, authenticated;
grant select on table public.place_sources to anon, authenticated;
grant select on table public.place_media to anon, authenticated;

grant all on table public.places to service_role;
grant all on table public.place_localizations to service_role;
grant all on table public.guide_segments to service_role;
grant all on table public.place_sources to service_role;
grant all on table public.place_media to service_role;
grant all on table public.place_search_documents to service_role;
grant usage, select on all sequences in schema public to service_role;

create policy "published places are readable"
on public.places
for select
to anon, authenticated
using (status = 'published');

create policy "published localizations are readable"
on public.place_localizations
for select
to anon, authenticated
using (
  review_status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = place_localizations.place_id
      and places.status = 'published'
  )
);

create policy "published guide segments are readable"
on public.guide_segments
for select
to anon, authenticated
using (
  review_status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = guide_segments.place_id
      and places.status = 'published'
  )
);

create policy "published sources are readable"
on public.place_sources
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = place_sources.place_id
      and places.status = 'published'
  )
);

create policy "published media are readable"
on public.place_media
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.places
    where places.id = place_media.place_id
      and places.status = 'published'
  )
);
