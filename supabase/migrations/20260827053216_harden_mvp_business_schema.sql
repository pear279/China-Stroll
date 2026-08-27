create index trip_stops_trip_day_fk_idx
  on public.trip_stops (trip_day_id, trip_id)
  where trip_day_id is not null;

drop index public.reservations_trip_day_idx;

create index reservations_trip_day_fk_idx
  on public.reservations (trip_day_id, trip_id)
  where trip_day_id is not null;

create policy "clients cannot access trip invitations"
on public.trip_invitations
for all
to anon, authenticated
using (false)
with check (false);
