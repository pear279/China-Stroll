-- Membership and invitation commands are non-itinerary audited writes: they
-- record a trip_change_log entry without incrementing trips.version (membership
-- does not reorder stops or days). The former unique(trip_id, version) constraint
-- would reject a second audit event at the same version, so it is relaxed to a
-- non-unique index; command_id remains the unique idempotency key.
alter table public.trip_change_log
  drop constraint if exists trip_change_log_trip_id_version_key;

create index if not exists trip_change_log_trip_version_idx
  on public.trip_change_log (trip_id, version);

create or replace function private.record_mvp_membership_audit(
  p_trip_id uuid,
  p_actor_id uuid,
  p_command_id uuid,
  p_change_type text,
  p_summary jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_version bigint;
begin
  select version into v_version
  from public.trips
  where id = p_trip_id;

  if v_version is null then
    raise exception 'NOT_FOUND trip';
  end if;

  insert into public.trip_change_log (
    trip_id,
    version,
    command_id,
    actor_user_id,
    change_type,
    summary
  )
  values (
    p_trip_id,
    v_version,
    p_command_id,
    p_actor_id,
    p_change_type,
    p_summary
  );
end;
$$;

revoke all on function private.record_mvp_membership_audit(uuid, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
grant execute on function private.record_mvp_membership_audit(uuid, uuid, uuid, text, jsonb)
  to service_role;

create or replace function public.create_mvp_trip_invitation(
  p_actor_id uuid,
  p_trip_id uuid,
  p_command_id uuid,
  p_token_hash text,
  p_role text,
  p_expires_in_hours integer
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_version bigint;
  v_invitation_id uuid;
  v_expires_at timestamptz;
  v_result jsonb;
begin
  select role into v_role
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = p_actor_id
    and status = 'active';

  if v_role is null or v_role <> 'owner' then
    raise exception 'FORBIDDEN trip ownership';
  end if;

  select summary into v_result
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id
    and trip_id = p_trip_id;

  if v_result is not null then
    return v_result;
  end if;

  if p_role not in ('editor', 'viewer') then
    raise exception 'VALIDATION_FAILED invitation role';
  end if;

  if p_expires_in_hours not in (1, 24, 72, 168) then
    raise exception 'VALIDATION_FAILED invitation expiry';
  end if;

  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'VALIDATION_FAILED token hash';
  end if;

  select version into v_version
  from public.trips
  where id = p_trip_id
  for update;

  if v_version is null then
    raise exception 'NOT_FOUND trip';
  end if;

  v_expires_at := now() + make_interval(hours => p_expires_in_hours);

  insert into public.trip_invitations (
    trip_id,
    invited_by,
    role,
    token_hash,
    expires_at,
    max_uses,
    use_count
  )
  values (
    p_trip_id,
    p_actor_id,
    p_role,
    p_token_hash,
    v_expires_at,
    1,
    0
  )
  returning id into v_invitation_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_version,
    'commandId', p_command_id,
    'invitation', jsonb_build_object(
      'id', v_invitation_id,
      'tripId', p_trip_id,
      'role', p_role,
      'expiresAt', v_expires_at,
      'useCount', 0,
      'maxUses', 1,
      'revokedAt', null
    )
  );

  perform private.record_mvp_membership_audit(
    p_trip_id,
    p_actor_id,
    p_command_id,
    'invitation_create',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.create_mvp_trip_invitation(uuid, uuid, uuid, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.create_mvp_trip_invitation(uuid, uuid, uuid, text, text, integer)
  to service_role;

create or replace function public.preview_mvp_trip_invitation(
  p_actor_id uuid,
  p_token_hash text
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_invitation public.trip_invitations%rowtype;
  v_trip_name text;
  v_status text;
begin
  if p_actor_id is null then
    raise exception 'FORBIDDEN unauthenticated';
  end if;

  select * into v_invitation
  from public.trip_invitations
  where token_hash = p_token_hash;

  if v_invitation.id is null then
    raise exception 'NOT_FOUND invitation';
  end if;

  select name into v_trip_name
  from public.trips
  where id = v_invitation.trip_id;

  if v_invitation.revoked_at is not null then
    v_status := 'revoked';
  elsif v_invitation.expires_at <= now() then
    v_status := 'expired';
  elsif v_invitation.use_count >= v_invitation.max_uses then
    v_status := 'consumed';
  else
    v_status := 'ready';
  end if;

  return jsonb_build_object(
    'tripId', v_invitation.trip_id,
    'tripName', v_trip_name,
    'role', v_invitation.role,
    'expiresAt', v_invitation.expires_at,
    'status', v_status
  );
end;
$$;

revoke all on function public.preview_mvp_trip_invitation(uuid, text)
  from public, anon, authenticated;
grant execute on function public.preview_mvp_trip_invitation(uuid, text)
  to service_role;

create or replace function public.accept_mvp_trip_invitation(
  p_actor_id uuid,
  p_token_hash text,
  p_command_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_invitation public.trip_invitations%rowtype;
  v_owner_id uuid;
  v_version bigint;
  v_result jsonb;
begin
  if p_actor_id is null then
    raise exception 'FORBIDDEN unauthenticated';
  end if;

  select * into v_invitation
  from public.trip_invitations
  where token_hash = p_token_hash
  for update;

  if v_invitation.id is null then
    raise exception 'NOT_FOUND invitation';
  end if;

  select summary into v_result
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id
    and trip_id = v_invitation.trip_id;

  if v_result is not null then
    return v_result;
  end if;

  if v_invitation.revoked_at is not null then
    raise exception 'INVITATION_UNAVAILABLE invitation revoked';
  end if;

  if v_invitation.expires_at <= now() then
    raise exception 'INVITATION_EXPIRED';
  end if;

  if v_invitation.use_count >= v_invitation.max_uses then
    raise exception 'INVITATION_UNAVAILABLE invitation used';
  end if;

  select owner_id, version into v_owner_id, v_version
  from public.trips
  where id = v_invitation.trip_id;

  if v_owner_id is null then
    raise exception 'NOT_FOUND trip';
  end if;

  if v_owner_id = p_actor_id then
    raise exception 'MEMBER_CONFLICT owner cannot accept';
  end if;

  insert into public.trip_members (
    trip_id,
    user_id,
    role,
    status,
    invited_by,
    joined_at
  )
  values (
    v_invitation.trip_id,
    p_actor_id,
    v_invitation.role,
    'active',
    v_invitation.invited_by,
    now()
  )
  on conflict (trip_id, user_id) do update
  set
    role = excluded.role,
    status = 'active',
    invited_by = excluded.invited_by,
    joined_at = now();

  update public.trip_invitations
  set use_count = use_count + 1
  where id = v_invitation.id;

  v_result := jsonb_build_object(
    'tripId', v_invitation.trip_id,
    'version', v_version,
    'commandId', p_command_id,
    'invitationId', v_invitation.id,
    'member', jsonb_build_object(
      'userId', p_actor_id,
      'role', v_invitation.role
    )
  );

  perform private.record_mvp_membership_audit(
    v_invitation.trip_id,
    p_actor_id,
    p_command_id,
    'invitation_accept',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.accept_mvp_trip_invitation(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.accept_mvp_trip_invitation(uuid, text, uuid)
  to service_role;

create or replace function public.revoke_mvp_trip_invitation(
  p_actor_id uuid,
  p_trip_id uuid,
  p_invitation_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_version bigint;
  v_revoked_at timestamptz;
  v_result jsonb;
begin
  select role into v_role
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = p_actor_id
    and status = 'active';

  if v_role is null or v_role <> 'owner' then
    raise exception 'FORBIDDEN trip ownership';
  end if;

  select summary into v_result
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id
    and trip_id = p_trip_id;

  if v_result is not null then
    return v_result;
  end if;

  select version into v_version
  from public.trips
  where id = p_trip_id
  for update;

  if v_version is null then
    raise exception 'NOT_FOUND trip';
  end if;

  update public.trip_invitations
  set revoked_at = now()
  where id = p_invitation_id
    and trip_id = p_trip_id
    and revoked_at is null
  returning revoked_at into v_revoked_at;

  if v_revoked_at is null then
    if not exists (
      select 1 from public.trip_invitations where id = p_invitation_id and trip_id = p_trip_id
    ) then
      raise exception 'NOT_FOUND invitation';
    end if;
    select revoked_at into v_revoked_at
    from public.trip_invitations
    where id = p_invitation_id and trip_id = p_trip_id;
  end if;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_version,
    'commandId', p_command_id,
    'invitationId', p_invitation_id,
    'revokedAt', v_revoked_at
  );

  perform private.record_mvp_membership_audit(
    p_trip_id,
    p_actor_id,
    p_command_id,
    'invitation_revoke',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.revoke_mvp_trip_invitation(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.revoke_mvp_trip_invitation(uuid, uuid, uuid, uuid)
  to service_role;

create or replace function public.remove_mvp_trip_member(
  p_actor_id uuid,
  p_trip_id uuid,
  p_member_user_id uuid,
  p_command_id uuid
)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_role text;
  v_version bigint;
  v_target_role text;
  v_target_status text;
  v_result jsonb;
begin
  select role into v_role
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = p_actor_id
    and status = 'active';

  if v_role is null or v_role <> 'owner' then
    raise exception 'FORBIDDEN trip ownership';
  end if;

  select summary into v_result
  from public.trip_change_log
  where command_id = p_command_id
    and actor_user_id = p_actor_id
    and trip_id = p_trip_id;

  if v_result is not null then
    return v_result;
  end if;

  select version into v_version
  from public.trips
  where id = p_trip_id
  for update;

  if v_version is null then
    raise exception 'NOT_FOUND trip';
  end if;

  select role, status into v_target_role, v_target_status
  from public.trip_members
  where trip_id = p_trip_id
    and user_id = p_member_user_id
  for update;

  if v_target_role is null then
    raise exception 'NOT_FOUND member';
  end if;

  if v_target_role = 'owner' then
    raise exception 'MEMBER_CONFLICT owner cannot be removed';
  end if;

  if v_target_status <> 'active' then
    raise exception 'MEMBER_CONFLICT member already removed';
  end if;

  delete from public.trip_member_locations
  where trip_id = p_trip_id
    and user_id = p_member_user_id;

  delete from public.trip_location_sharing_preferences
  where trip_id = p_trip_id
    and user_id = p_member_user_id;

  update public.trip_members
  set status = 'removed'
  where trip_id = p_trip_id
    and user_id = p_member_user_id;

  v_result := jsonb_build_object(
    'tripId', p_trip_id,
    'version', v_version,
    'commandId', p_command_id,
    'removedUserId', p_member_user_id
  );

  perform private.record_mvp_membership_audit(
    p_trip_id,
    p_actor_id,
    p_command_id,
    'member_remove',
    v_result
  );

  return v_result;
end;
$$;

revoke all on function public.remove_mvp_trip_member(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.remove_mvp_trip_member(uuid, uuid, uuid, uuid)
  to service_role;
