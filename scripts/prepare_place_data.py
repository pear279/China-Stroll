#!/usr/bin/env python3
"""Normalize the collected Beijing place CSV and build an idempotent draft import."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path


CATEGORY_CODES = {
    "古建筑": "historic_building",
    "城市地标，城市中心广场": "civic_landmark_square",
    "博物馆": "museum",
    "公园": "park",
    "历史遗址": "historic_site",
    "寺庙": "religious_site",
    "街区": "neighborhood",
    "商业街区": "commercial_district",
    "城市地标": "urban_landmark",
    "其他": "other",
}

SEGMENT_TYPES = ["overview", "history", "highlight", "practical", "practical"]


def column(columns: list[str], prefix: str) -> str:
    matches = [name for name in columns if name.startswith(prefix)]
    if len(matches) != 1:
        raise ValueError(f"Expected one column starting with {prefix!r}, found {matches!r}")
    return matches[0]


def split_list(value: str, pattern: str) -> list[str]:
    return [item.strip() for item in re.split(pattern, value) if item.strip()]


def nullable_float(value: str) -> float | None:
    value = value.strip()
    return float(value) if value else None


def normalize(source: Path) -> tuple[list[dict], list[dict]]:
    with source.open(encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    if len(rows) != 52:
        raise ValueError(f"Expected 52 place rows, found {len(rows)}")

    columns = [name for name in rows[0].keys() if name]
    names = {
        "id": column(columns, "id"),
        "name": column(columns, "name"),
        "aliases": column(columns, "aliases"),
        "category": column(columns, "category"),
        "latitude": column(columns, "latitude"),
        "longitude": column(columns, "longitude"),
        "duration": column(columns, "recommended_duration_minutes"),
        "tags": column(columns, "tags"),
        "short_intro": column(columns, "short_intro"),
        "history": column(columns, "history"),
        "highlights": column(columns, "highlights"),
        "visitor_tips": column(columns, "visitor_tips"),
        "practical_notes": column(columns, "practical_notes"),
        "photo_spot_notes": column(columns, "photo_spot_notes"),
        "guide_segments": column(columns, "guide_segments"),
    }

    places: list[dict] = []
    segments: list[dict] = []
    seen_ids: set[str] = set()

    for row in rows:
        place_id = row[names["id"]].strip()
        if not re.fullmatch(r"[a-z0-9_-]+", place_id):
            raise ValueError(f"Invalid place id {place_id!r}")
        if place_id in seen_ids:
            raise ValueError(f"Duplicate place id {place_id!r}")
        seen_ids.add(place_id)

        latitude = nullable_float(row[names["latitude"]])
        longitude = nullable_float(row[names["longitude"]])
        if (latitude is None) != (longitude is None):
            raise ValueError(f"Incomplete coordinate pair for {place_id}")

        category = row[names["category"]].strip()
        if category not in CATEGORY_CODES:
            raise ValueError(f"Unknown category {category!r} for {place_id}")

        places.append(
            {
                "id": place_id,
                "category_code": CATEGORY_CODES[category],
                "latitude": latitude,
                "longitude": longitude,
                "recommended_duration_minutes": int(row[names["duration"]]),
                "locale": "zh-CN",
                "name": row[names["name"]].strip(),
                "aliases": split_list(row[names["aliases"]], r"[，,、；;/]+"),
                "tags": split_list(row[names["tags"]], r"[，,、；;/]+"),
                "short_intro": row[names["short_intro"]].strip(),
                "history": row[names["history"]].strip(),
                "highlights": split_list(row[names["highlights"]], r"[；;]+"),
                "visitor_tips": row[names["visitor_tips"]].strip(),
                "practical_notes": row[names["practical_notes"]].strip(),
                "photo_spot_notes": row[names["photo_spot_notes"]].strip(),
            }
        )

        raw_segments = split_list(row[names["guide_segments"]], r"[｜|]+")
        if len(raw_segments) not in (4, 5):
            raise ValueError(f"Expected four or five guide segments for {place_id}")
        for index, content in enumerate(raw_segments, start=1):
            content = re.sub(r"^第\s*\d+\s*段\s*[：:]\s*", "", content).strip()
            segments.append(
                {
                    "place_id": place_id,
                    "locale": "zh-CN",
                    "segment_type": SEGMENT_TYPES[index - 1],
                    "audience": "general",
                    "sequence": index,
                    "content": content,
                }
            )

    return places, segments


def build_sql(places: list[dict], segments: list[dict]) -> str:
    places_json = json.dumps(places, ensure_ascii=False, separators=(",", ":"))
    segments_json = json.dumps(segments, ensure_ascii=False, separators=(",", ":"))
    return f"""begin;

with payload as (
  select $place_data${places_json}$place_data$::jsonb as data
), records as (
  select *
  from payload
  cross join lateral jsonb_to_recordset(payload.data) as item(
    id text,
    category_code text,
    latitude double precision,
    longitude double precision,
    recommended_duration_minutes integer,
    locale text,
    name text,
    aliases text[],
    tags text[],
    short_intro text,
    history text,
    highlights text[],
    visitor_tips text,
    practical_notes text,
    photo_spot_notes text
  )
)
insert into public.places (
  id,
  category_code,
  latitude,
  longitude,
  recommended_duration_minutes,
  status
)
select
  id,
  category_code,
  latitude,
  longitude,
  recommended_duration_minutes,
  'draft'
from records
on conflict (id) do update
set category_code = excluded.category_code,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    recommended_duration_minutes = excluded.recommended_duration_minutes,
    updated_at = now()
where public.places.status = 'draft';

with payload as (
  select $place_data${places_json}$place_data$::jsonb as data
), records as (
  select *
  from payload
  cross join lateral jsonb_to_recordset(payload.data) as item(
    id text,
    category_code text,
    latitude double precision,
    longitude double precision,
    recommended_duration_minutes integer,
    locale text,
    name text,
    aliases text[],
    tags text[],
    short_intro text,
    history text,
    highlights text[],
    visitor_tips text,
    practical_notes text,
    photo_spot_notes text
  )
)
insert into public.place_localizations (
  place_id,
  locale,
  name,
  aliases,
  tags,
  short_intro,
  history,
  highlights,
  visitor_tips,
  practical_notes,
  photo_spot_notes,
  review_status
)
select
  id,
  locale,
  name,
  aliases,
  tags,
  short_intro,
  history,
  highlights,
  visitor_tips,
  practical_notes,
  photo_spot_notes,
  'draft'
from records
on conflict (place_id, locale) do update
set name = excluded.name,
    aliases = excluded.aliases,
    tags = excluded.tags,
    short_intro = excluded.short_intro,
    history = excluded.history,
    highlights = excluded.highlights,
    visitor_tips = excluded.visitor_tips,
    practical_notes = excluded.practical_notes,
    photo_spot_notes = excluded.photo_spot_notes,
    updated_at = now()
where public.place_localizations.review_status = 'draft';

with payload as (
  select $segment_data${segments_json}$segment_data$::jsonb as data
), records as (
  select *
  from payload
  cross join lateral jsonb_to_recordset(payload.data) as item(
    place_id text,
    locale text,
    segment_type text,
    audience text,
    sequence integer,
    content text
  )
)
insert into public.guide_segments (
  place_id,
  locale,
  segment_type,
  audience,
  sequence,
  content,
  review_status
)
select
  place_id,
  locale,
  segment_type,
  audience,
  sequence,
  content,
  'draft'
from records
on conflict (place_id, locale, audience, segment_type, sequence, content_version) do update
set content = excluded.content,
    updated_at = now()
where public.guide_segments.review_status = 'draft';

commit;

select
  (select count(*) from public.places) as places,
  (select count(*) from public.place_localizations where locale = 'zh-CN') as zh_localizations,
  (select count(*) from public.guide_segments where locale = 'zh-CN') as zh_guide_segments;
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--source",
        type=Path,
        default=Path("data/50景点信息sql表 .csv"),
    )
    parser.add_argument("--output-dir", type=Path, default=Path("data/processed"))
    args = parser.parse_args()

    places, segments = normalize(args.source)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "places.zh-CN.json").write_text(
        json.dumps(places, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "guide_segments.zh-CN.json").write_text(
        json.dumps(segments, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    (args.output_dir / "import-draft.sql").write_text(
        build_sql(places, segments),
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "places": len(places),
                "guide_segments": len(segments),
                "missing_coordinates": [
                    item["id"] for item in places if item["latitude"] is None
                ],
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
