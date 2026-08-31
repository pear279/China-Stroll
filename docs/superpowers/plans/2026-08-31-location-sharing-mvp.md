# Location Sharing MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let existing active trip members explicitly share one expiring foreground current location with their active trip peers.

**Architecture:** A Supabase table stores only the latest WGS84 point for a member/trip pair and RLS limits visibility to active members in that same trip. The Worker exposes a small authenticated sharing boundary. A browser controller owns `watchPosition` lifecycle, while Mine owns consent/revocation and Map renders peer markers from a shared snapshot.

**Tech Stack:** Supabase PostgreSQL/RLS, Cloudflare Worker + Hono + Zod, React 19, TypeScript, MapLibre/mapcn wrapper, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-location-sharing-mvp-design.md`

## Global Constraints

- Sharing is off by default and only existing active trip members participate; invitations are out of scope.
- Persist only one WGS84 current point per member/trip with a ten-minute server expiry; never persist a trail.
- A browser watch runs only while the application is open and sharing is successfully enabled.
- Turning sharing off stops browser updates and revokes server visibility; do not claim success before revoke succeeds.
- Position refreshes do not modify `trips.version` or itinerary change logs.
- Coordinates, access tokens, service-role keys, and trails must never appear in client/server logs.
- Location failures must leave map and itinerary browsing usable at 390px.

---

### Task 1: Add private current-point storage and RLS

**Files:**
- Create: `supabase/migrations/20260831190000_add_trip_member_locations.sql`
- Modify: `supabase/database.types.ts`
- Modify: `supabase/tests/mvp_trip_commands.sql`

**Interfaces:**
- Produces `public.trip_member_locations` with `trip_id uuid`, `user_id uuid`, `latitude double precision`, `longitude double precision`, `sharing_enabled boolean`, `updated_at timestamptz`, and `expires_at timestamptz`.
- Produces service-role functions `public.set_mvp_location_sharing(uuid, uuid, boolean)` and `public.upsert_mvp_current_location(uuid, uuid, double precision, double precision)`.
- Readers can select only active same-trip, enabled, non-expired rows; a member cannot see another trip's rows.

- [ ] **Step 1: Write failing SQL assertions for active-member visibility and revoke**

```sql
perform public.set_mvp_location_sharing(v_actor, v_trip, true);
perform public.upsert_mvp_current_location(v_actor, v_trip, 39.9163, 116.3972);
if not exists (select 1 from public.trip_member_locations where trip_id = v_trip and user_id = v_actor and expires_at > now()) then
  raise exception 'enabled sharing must retain one unexpired current point';
end if;
perform public.set_mvp_location_sharing(v_actor, v_trip, false);
if exists (select 1 from public.trip_member_locations where trip_id = v_trip and user_id = v_actor) then
  raise exception 'disabling sharing must revoke the current point';
end if;
```

Add a cross-trip/non-member RLS assertion and an expired-row assertion that cannot be selected by an active peer.

- [ ] **Step 2: Run database verification to demonstrate the missing functions**

Run: `npm run db:verify`

Expected: FAIL until the migration provides the table, RLS policies, and functions.

- [ ] **Step 3: Implement storage, policies, and service-role commands**

```sql
create table public.trip_member_locations (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  sharing_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (trip_id, user_id)
);
```

`set_mvp_location_sharing` checks active membership, deletes the caller row when disabled, and creates no fake point when enabled. `upsert_mvp_current_location` checks active membership and an enabled row, then writes only that caller's point with `expires_at = now() + interval '10 minutes'`. Enable RLS and a same-trip-active, non-expired select policy; revoke direct authenticated mutations and grant both functions only to `service_role`.

- [ ] **Step 4: Update generated database function types**

```ts
set_mvp_location_sharing: {
  Args: { p_actor_id: string; p_enabled: boolean; p_trip_id: string }
  Returns: Json
}
upsert_mvp_current_location: {
  Args: { p_actor_id: string; p_latitude: number; p_longitude: number; p_trip_id: string }
  Returns: Json
}
```

- [ ] **Step 5: Run the database gate**

Run: `npm run db:verify`

Expected: PASS including create, same-trip read, non-member denial, expiry exclusion, and revoke assertions.

- [ ] **Step 6: Commit the database boundary**

```bash
git add supabase/migrations/20260831190000_add_trip_member_locations.sql supabase/database.types.ts supabase/tests/mvp_trip_commands.sql
git commit -m "feat: add expiring trip member locations"
```

### Task 2: Expose authenticated sharing status, switch, and upload endpoints

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/worker/src/contracts.ts`
- Modify: `apps/worker/src/contracts.test.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces `LocationSharingSnapshot`, `SharedMemberLocation`, and `LocationSharingStatus` shared types.
- Produces `GET|PUT /v1/trips/:tripId/location-sharing` and `PUT /v1/trips/:tripId/location-sharing/current-location`.
- Produces browser methods `api.getLocationSharing`, `api.setLocationSharing`, and `api.updateCurrentLocation`.

- [ ] **Step 1: Write failing Worker route tests**

```ts
it("requires authentication before location sharing state is read", async () => {
  const response = await app.request("/v1/trips/trip-1/location-sharing", {}, env)
  expect(response.status).toBe(401)
})

it("rejects invalid WGS84 coordinates", async () => {
  const response = await authenticatedRequest("/v1/trips/trip-1/location-sharing/current-location", {
    method: "PUT", body: JSON.stringify({ latitude: 91, longitude: 116.39 }),
  })
  expect(response.status).toBe(400)
})
```

- [ ] **Step 2: Run the focused Worker tests**

Run: `npx vitest run apps/worker/src/index.test.ts apps/worker/src/contracts.test.ts`

Expected: FAIL because the sharing schemas and routes do not exist.

- [ ] **Step 3: Add shared contracts and bounded Zod schemas**

```ts
export const locationSharingToggleSchema = z.object({ enabled: z.boolean() })
export const currentLocationSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
})
```

Map database rows to shared camelCase types. Return only active peer identity labels, sharing state, and visible unexpired points; do not return expired rows or audit summaries containing coordinates.

- [ ] **Step 4: Implement routes through the service-role functions**

```ts
app.put("/v1/trips/:tripId/location-sharing", async (context) => {
  const parsed = locationSharingToggleSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Choose whether to share your location."), 400)
  const { data, error } = await context.get("admin").rpc("set_mvp_location_sharing", {
    p_actor_id: context.get("user").id, p_enabled: parsed.data.enabled, p_trip_id: context.req.param("tripId"),
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(locationSharingToggleResponseSchema.parse(data))
})
```

Implement the current-location route using `upsert_mvp_current_location`; the GET route reads the current caller state, active-member count, and RLS-visible non-expired points through `userClient`.

- [ ] **Step 5: Add typed web transport**

```ts
setLocationSharing(accessToken: string, tripId: string, enabled: boolean) {
  return request<LocationSharingSnapshot>(`/v1/trips/${tripId}/location-sharing`, accessToken, {
    method: "PUT", body: JSON.stringify({ enabled }),
  })
}
```

`updateCurrentLocation` sends finite WGS84 latitude/longitude only; none of the browser methods log coordinates.

- [ ] **Step 6: Run focused Worker verification**

Run: `npx vitest run apps/worker/src/index.test.ts apps/worker/src/contracts.test.ts && npm run typecheck && npm run build:worker`

Expected: PASS.

- [ ] **Step 7: Commit the API boundary**

```bash
git add packages/shared/src/index.ts apps/worker/src/contracts.ts apps/worker/src/contracts.test.ts apps/worker/src/index.ts apps/worker/src/index.test.ts apps/web/src/lib/api.ts
git commit -m "feat: expose location sharing endpoints"
```

### Task 3: Add a foreground sharing controller and Mine privacy switch

**Files:**
- Create: `apps/web/src/features/location/useLocationSharing.ts`
- Create: `apps/web/src/features/location/useLocationSharing.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app-shell/types.ts`
- Modify: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/features/me/MineView.tsx`
- Modify: `apps/web/src/features/me/MineView.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes `api.getLocationSharing`, `api.setLocationSharing`, `api.updateCurrentLocation`, and `navigator.geolocation.watchPosition`.
- Produces `useLocationSharing({ accessToken, tripId, enabled })` with `status`, `snapshot`, `enable()`, `disable()`, and `retryDisable()`.
- Mine consumes status plus callbacks and renders an explicit sharing switch.

- [ ] **Step 1: Write failing controller tests**

```tsx
it("starts a foreground watch only after enable and stops it before revoke", async () => {
  const { result } = renderHook(() => useLocationSharing(options))
  await act(() => result.current.enable())
  expect(navigator.geolocation.watchPosition).toHaveBeenCalled()
  await act(() => result.current.disable())
  expect(navigator.geolocation.clearWatch).toHaveBeenCalled()
})
```

Add cases for permission denial, initial-upload failure, and failed revocation retaining a retry-visible state.

- [ ] **Step 2: Run the controller test to demonstrate the missing hook**

Run: `npx vitest run apps/web/src/features/location/useLocationSharing.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the controller without a location trail**

```ts
const watchId = navigator.geolocation.watchPosition(
  ({ coords }) => void updateCurrentLocation(coords.latitude, coords.longitude),
  () => setStatus("permission-denied"),
  { enableHighAccuracy: false, maximumAge: 60_000, timeout: 15_000 },
)
```

On enable: call the server switch, request/upload an initial point, then retain the watch ID only after upload success. On disable: clear the watch first, call the revoke endpoint, and report `revoke-failed` until retry succeeds. In preview mode render a deterministic unavailable state rather than fabricating other members or locations.

- [ ] **Step 4: Add Mine UI tests before rendering the card**

```tsx
expect(screen.getByRole("switch", { name: "Share my current location" })).not.toBeChecked()
expect(screen.getByText("Location sharing is off")).toBeTruthy()
```

Add enabled, no-peer, denied, and revoke-retry render assertions.

- [ ] **Step 5: Render the privacy card and mobile-safe feedback**

Render the switch in Mine with the product copy: “Only while this app is open”, “active trip members only”, “no location history”, and “not a safety guarantee”. Show the active-member count, loading state, successful sharing state, error text, and a retry-revoke button. Use `role="switch"`, `aria-checked`, and non-color-only status text.

- [ ] **Step 6: Run focused web verification**

Run: `npx vitest run apps/web/src/features/location/useLocationSharing.test.tsx apps/web/src/features/me/MineView.test.tsx apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 7: Commit the foreground privacy control**

```bash
git add apps/web/src/features/location apps/web/src/App.tsx apps/web/src/app-shell apps/web/src/features/me apps/web/src/styles.css
git commit -m "feat: add foreground location sharing control"
```

### Task 4: Render visible member locations on Map and record delivery context

**Files:**
- Modify: `apps/web/src/components/TravelMap.tsx`
- Modify: `apps/web/src/components/TravelMap.test.tsx`
- Modify: `apps/web/src/features/map/MapView.tsx`
- Modify: `apps/web/src/features/map/MapView.test.tsx`
- Modify: `apps/web/src/styles.css`
- Modify: `ARCHITECTURE.md`
- Modify: `TASKS.md`

**Interfaces:**
- Consumes `LocationSharingSnapshot.visibleLocations` from AppShell.
- Extends `TravelMap` with `memberLocations: SharedMemberLocation[]`.
- Map renders member marker label and relative last-update context without a trail or route line.

- [ ] **Step 1: Write failing Map marker and expiry tests**

```tsx
render(<MapView {...props} sharing={{ status: "sharing", visibleLocations: [memberPoint] }} />)
expect(await screen.findByLabelText("Alex’s shared current location")).toBeTruthy()
expect(screen.queryByText("Route history")).toBeNull()
```

Add a test that expired locations are absent and map browsing remains available when sharing has a dependency failure.

- [ ] **Step 2: Run the focused Map test to verify it fails**

Run: `npx vitest run apps/web/src/features/map/MapView.test.tsx apps/web/src/components/TravelMap.test.tsx`

Expected: FAIL because `memberLocations` is not part of the map boundary.

- [ ] **Step 3: Extend the map boundary with distinct current-point markers**

```tsx
{memberLocations.map((member) => (
  <Marker key={member.userId} longitude={member.coordinate[0]} latitude={member.coordinate[1]}>
    <MarkerContent><span className="member-location-marker" aria-label={`${member.displayName}’s shared current location`}>{member.initials}</span></MarkerContent>
  </Marker>
))}
```

Use only unexpired coordinates already returned by the Worker. Do not draw lines between points and do not reuse the user-location marker color/label.

- [ ] **Step 4: Render map context and responsive marker styling**

Show a compact “Members sharing now” state with last-update text, an explicit expired/permission/dependency fallback, and no empty placeholder when no peer is sharing. Ensure marker labels and the Mine switch card fit at 390px.

- [ ] **Step 5: Run final focused checks and record the completed decision**

Run: `npx vitest run apps/web/src/components/TravelMap.test.tsx apps/web/src/features/map/MapView.test.tsx apps/web/src/features/me/MineView.test.tsx && npm run typecheck && npm run lint && npm run build`

Expected: PASS. Then add the implemented current-point, ten-minute expiry, and revoke semantics to `ARCHITECTURE.md` and Task 9 progress in `TASKS.md`.

- [ ] **Step 6: Commit map rendering and context update**

```bash
git add apps/web/src/components/TravelMap.tsx apps/web/src/components/TravelMap.test.tsx apps/web/src/features/map/MapView.tsx apps/web/src/features/map/MapView.test.tsx apps/web/src/styles.css ARCHITECTURE.md TASKS.md
git commit -m "feat: show shared member locations on map"
```
