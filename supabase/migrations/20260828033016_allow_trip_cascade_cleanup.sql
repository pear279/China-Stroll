create or replace function private.protect_trip_owner_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'owner' and exists (
    select 1
    from public.trips
    where trips.id = old.trip_id
  ) then
    raise exception 'the active trip owner membership cannot be changed or removed';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke execute on function private.protect_trip_owner_membership() from public, anon, authenticated;
