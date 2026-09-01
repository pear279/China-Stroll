begin;

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000001', 'authenticated', 'authenticated', 'member-owner@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000002', 'authenticated', 'authenticated', 'member-editor@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000003', 'authenticated', 'authenticated', 'member-viewer@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000004', 'authenticated', 'authenticated', 'member-outsider@example.invalid', now(), now()),
  ('aaaaaaaa-aaaa-4aaa-8aaa-000000000005', 'authenticated', 'authenticated', 'member-recipient@example.invalid', now(), now());

do $$
declare
  v_owner constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
  v_editor constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000002';
  v_viewer constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003';
  v_outsider constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000004';
  v_recipient constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000005';
  v_trip uuid;
  v_create_result jsonb;
  v_invitation_id uuid;
  v_hash constant text := repeat('a', 64);
  v_second_hash constant text := repeat('b', 64);
  v_third_hash constant text := repeat('c', 64);
  v_fourth_hash constant text := repeat('d', 64);
  v_rejected boolean;
begin
  -- Only service_role may execute membership commands.
  if has_function_privilege('authenticated', 'public.create_mvp_trip_invitation(uuid,uuid,uuid,text,text,integer)', 'execute') then
    raise exception 'authenticated must not execute create_mvp_trip_invitation';
  end if;
  if has_function_privilege('authenticated', 'public.preview_mvp_trip_invitation(uuid,text)', 'execute') then
    raise exception 'authenticated must not execute preview_mvp_trip_invitation';
  end if;
  if has_function_privilege('authenticated', 'public.accept_mvp_trip_invitation(uuid,text,uuid)', 'execute') then
    raise exception 'authenticated must not execute accept_mvp_trip_invitation';
  end if;
  if has_function_privilege('authenticated', 'public.revoke_mvp_trip_invitation(uuid,uuid,uuid,uuid)', 'execute') then
    raise exception 'authenticated must not execute revoke_mvp_trip_invitation';
  end if;
  if has_function_privilege('authenticated', 'public.remove_mvp_trip_member(uuid,uuid,uuid,uuid)', 'execute') then
    raise exception 'authenticated must not execute remove_mvp_trip_member';
  end if;

  v_trip := (
    public.create_mvp_trip(
      v_owner,
      'bbbbbbbb-bbbb-4bbb-8bbb-000000000001',
      'Member command test trip',
      current_date,
      'en'
    ) ->> 'tripId'
  )::uuid;

  insert into public.trip_members (trip_id, user_id, role, status, invited_by, joined_at)
  values
    (v_trip, v_editor, 'editor', 'active', v_owner, now()),
    (v_trip, v_viewer, 'viewer', 'active', v_owner, now());

  -- Outsider cannot create an invitation.
  v_rejected := false;
  begin
    perform public.create_mvp_trip_invitation(v_outsider, v_trip, 'cccccccc-cccc-4ccc-8ccc-000000000001', v_hash, 'editor', 24);
  exception when others then
    v_rejected := sqlerrm like '%FORBIDDEN trip ownership%';
  end;
  if not v_rejected then
    raise exception 'an outsider must not create an invitation';
  end if;

  -- Editor cannot create an invitation (owner only).
  v_rejected := false;
  begin
    perform public.create_mvp_trip_invitation(v_editor, v_trip, 'cccccccc-cccc-4ccc-8ccc-000000000002', v_hash, 'editor', 24);
  exception when others then
    v_rejected := sqlerrm like '%FORBIDDEN trip ownership%';
  end;
  if not v_rejected then
    raise exception 'an editor must not create an invitation';
  end if;

  -- Owner creates a single-use viewer invitation.
  v_create_result := public.create_mvp_trip_invitation(
    v_owner,
    v_trip,
    'cccccccc-cccc-4ccc-8ccc-000000000003',
    v_hash,
    'viewer',
    24
  );
  v_invitation_id := (v_create_result #>> '{invitation,id}')::uuid;

  if v_invitation_id is null then
    raise exception 'creating an invitation must return its id';
  end if;

  if not exists (
    select 1 from public.trip_invitations where id = v_invitation_id and token_hash = v_hash
  ) then
    raise exception 'the invitation must store only the token hash';
  end if;

  -- A duplicate command returns the first result without another write.
  if public.create_mvp_trip_invitation(
    v_owner, v_trip, 'cccccccc-cccc-4ccc-8ccc-000000000003', v_hash, 'viewer', 24
  ) <> v_create_result then
    raise exception 'a duplicate invitation command must return the first result';
  end if;

  if (select count(*) from public.trip_invitations where trip_id = v_trip) <> 1 then
    raise exception 'a duplicate invitation command must not create another invitation';
  end if;

  -- Preview by an authenticated recipient reports ready.
  if (public.preview_mvp_trip_invitation(v_recipient, v_hash) ->> 'status') <> 'ready' then
    raise exception 'a fresh invitation must preview as ready';
  end if;

  if (public.preview_mvp_trip_invitation(v_recipient, v_hash) ->> 'tripName') is null then
    raise exception 'preview must include the trip name';
  end if;

  -- The owner cannot accept an invitation to their own trip.
  v_rejected := false;
  begin
    perform public.accept_mvp_trip_invitation(v_owner, v_hash, 'cccccccc-cccc-4ccc-8ccc-000000000004');
  exception when others then
    v_rejected := sqlerrm like '%MEMBER_CONFLICT owner cannot accept%';
  end;
  if not v_rejected then
    raise exception 'the owner must not accept an invitation to their own trip';
  end if;

  -- Acceptance creates one active membership and consumes the invitation once.
  perform public.accept_mvp_trip_invitation(v_recipient, v_hash, 'cccccccc-cccc-4ccc-8ccc-000000000005');

  if not exists (
    select 1 from public.trip_members
    where trip_id = v_trip and user_id = v_recipient and role = 'viewer' and status = 'active'
  ) then
    raise exception 'acceptance must create an active viewer membership';
  end if;

  if (select use_count from public.trip_invitations where id = v_invitation_id) <> 1 then
    raise exception 'acceptance must increment use_count exactly once';
  end if;

  if (public.preview_mvp_trip_invitation(v_recipient, v_hash) ->> 'status') <> 'consumed' then
    raise exception 'a consumed invitation must preview as consumed';
  end if;

  -- A second acceptance (new command) cannot exceed max_uses.
  v_rejected := false;
  begin
    perform public.accept_mvp_trip_invitation(v_editor, v_hash, 'cccccccc-cccc-4ccc-8ccc-000000000006');
  exception when others then
    v_rejected := sqlerrm like '%INVITATION_UNAVAILABLE invitation used%';
  end;
  if not v_rejected then
    raise exception 'a used invitation must not be accepted again';
  end if;

  if (select use_count from public.trip_invitations where id = v_invitation_id) <> 1 then
    raise exception 'a rejected acceptance must not change use_count';
  end if;

  -- An expired invitation cannot be accepted.
  v_rejected := false;
  perform public.create_mvp_trip_invitation(v_owner, v_trip, 'cccccccc-cccc-4ccc-8ccc-000000000007', v_second_hash, 'editor', 1);
  update public.trip_invitations
  set
    created_at = now() - interval '2 hours',
    expires_at = now() - interval '1 hour'
  where token_hash = v_second_hash;

  if (public.preview_mvp_trip_invitation(v_recipient, v_second_hash) ->> 'status') <> 'expired' then
    raise exception 'an expired invitation must preview as expired';
  end if;

  begin
    perform public.accept_mvp_trip_invitation(v_editor, v_second_hash, 'cccccccc-cccc-4ccc-8ccc-000000000008');
  exception when others then
    v_rejected := sqlerrm like '%INVITATION_EXPIRED%';
  end;
  if not v_rejected then
    raise exception 'an expired invitation must not be accepted';
  end if;

  -- A revoked invitation cannot be accepted.
  v_rejected := false;
  perform public.create_mvp_trip_invitation(v_owner, v_trip, 'cccccccc-cccc-4ccc-8ccc-000000000009', v_third_hash, 'editor', 24);
  perform public.revoke_mvp_trip_invitation(v_owner, v_trip, (select id from public.trip_invitations where token_hash = v_third_hash), 'cccccccc-cccc-4ccc-8ccc-000000000010');

  if (public.preview_mvp_trip_invitation(v_recipient, v_third_hash) ->> 'status') <> 'revoked' then
    raise exception 'a revoked invitation must preview as revoked';
  end if;

  begin
    perform public.accept_mvp_trip_invitation(v_editor, v_third_hash, 'cccccccc-cccc-4ccc-8ccc-000000000011');
  exception when others then
    v_rejected := sqlerrm like '%INVITATION_UNAVAILABLE invitation revoked%';
  end;
  if not v_rejected then
    raise exception 'a revoked invitation must not be accepted';
  end if;

  -- An editor cannot remove a member.
  v_rejected := false;
  begin
    perform public.remove_mvp_trip_member(v_editor, v_trip, v_viewer, 'cccccccc-cccc-4ccc-8ccc-000000000012');
  exception when others then
    v_rejected := sqlerrm like '%FORBIDDEN trip ownership%';
  end;
  if not v_rejected then
    raise exception 'an editor must not remove a member';
  end if;

  -- The owner cannot be removed.
  v_rejected := false;
  begin
    perform public.remove_mvp_trip_member(v_owner, v_trip, v_owner, 'cccccccc-cccc-4ccc-8ccc-000000000013');
  exception when others then
    v_rejected := sqlerrm like '%MEMBER_CONFLICT owner cannot be removed%';
  end;
  if not v_rejected then
    raise exception 'the owner must not be removed';
  end if;

  -- Removing a non-existent member is a distinct failure.
  v_rejected := false;
  begin
    perform public.remove_mvp_trip_member(v_owner, v_trip, v_outsider, 'cccccccc-cccc-4ccc-8ccc-000000000014');
  exception when others then
    v_rejected := sqlerrm like '%NOT_FOUND member%';
  end;
  if not v_rejected then
    raise exception 'removing a non-member must be a distinct not-found failure';
  end if;

  -- Set up a sharing point for the viewer so removal cleans it up.
  perform public.set_mvp_location_sharing(v_viewer, v_trip, true);
  perform public.upsert_mvp_current_location(v_viewer, v_trip, 39.9163, 116.3972);

  perform public.remove_mvp_trip_member(v_owner, v_trip, v_viewer, 'cccccccc-cccc-4ccc-8ccc-000000000015');

  if exists (
    select 1 from public.trip_members
    where trip_id = v_trip and user_id = v_viewer and status = 'active'
  ) then
    raise exception 'removal must deactivate the member';
  end if;

  if exists (
    select 1 from public.trip_member_locations where trip_id = v_trip and user_id = v_viewer
  ) or exists (
    select 1 from public.trip_location_sharing_preferences where trip_id = v_trip and user_id = v_viewer
  ) then
    raise exception 'removal must delete the member''s location and sharing preference';
  end if;

  -- Removing an already-removed member is a conflict.
  v_rejected := false;
  begin
    perform public.remove_mvp_trip_member(v_owner, v_trip, v_viewer, 'cccccccc-cccc-4ccc-8ccc-000000000016');
  exception when others then
    v_rejected := sqlerrm like '%MEMBER_CONFLICT member already removed%';
  end;
  if not v_rejected then
    raise exception 'removing an already-removed member must conflict';
  end if;
end;
$$;

-- RLS: after removal the former member can no longer read the trip or its members.
do $$
declare
  v_owner constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000001';
  v_viewer constant uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-000000000003';
  v_trip uuid;
begin
  select trip_id into v_trip
  from public.trip_members
  where user_id = v_viewer
  limit 1;

  perform set_config('request.jwt.claim.sub', v_viewer::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_viewer, 'role', 'authenticated')::text, true);
  set local role authenticated;

  if private.current_trip_role(v_trip) is not null then
    raise exception 'a removed member must no longer resolve a trip role';
  end if;

  if (select count(*) from public.trips where id = v_trip) <> 0 then
    raise exception 'a removed member must not read the trip';
  end if;

  if (select count(*) from public.trip_members where trip_id = v_trip) <> 0 then
    raise exception 'a removed member must not read trip members';
  end if;

  reset role;
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

rollback;
