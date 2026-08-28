with corrected(id, latitude, longitude, osm_id) as (
  values
    ('forbidden-city', 39.9172757::double precision, 116.3907694::double precision, 'relation/9511883'),
    ('jingshan-park', 39.9244589::double precision, 116.3903973::double precision, 'way/29201967'),
    ('temple-of-heaven', 39.8799066::double precision, 116.4028716::double precision, 'way/24824550')
)
update public.places as place
set latitude = corrected.latitude,
    longitude = corrected.longitude,
    coordinate_system = 'WGS84',
    coordinates_checked_at = '2026-08-28T02:56:43Z'::timestamptz,
    external_ids = place.external_ids || jsonb_build_object('osm', corrected.osm_id),
    updated_at = now()
from corrected
where place.id = corrected.id;

with corrected(id, latitude, longitude) as (
  values
    ('forbidden-city', 39.9172757::double precision, 116.3907694::double precision),
    ('jingshan-park', 39.9244589::double precision, 116.3903973::double precision),
    ('temple-of-heaven', 39.8799066::double precision, 116.4028716::double precision)
)
update public.trip_stops as stop
set snapshot_latitude = corrected.latitude,
    snapshot_longitude = corrected.longitude,
    updated_at = now()
from corrected
where stop.place_id = corrected.id;
