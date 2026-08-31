# Mine Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create, edit, delete, and view their own reservation records in Mine without bypassing trip permission, version, command-id, or change-log safeguards.

**Architecture:** Reservations become a typed member of `TripSnapshot`. Account writes use a single security-definer PostgreSQL command and authenticated Worker endpoints; preview writes stay in browser state. Mine owns the form UI, while Map only consumes reservation data later if needed.

**Tech Stack:** React 19, TypeScript, Hono, Supabase PostgreSQL, Vitest, SQL transactional tests.

**Spec:** `docs/superpowers/specs/2026-08-31-mine-itinerary-reservations-map-design.md`

## Global Constraints

- Reservation records are private trip data, never public place content.
- Account writes need accepted membership, editor/owner role, expected version, command ID, and change log.
- AI can populate a draft only; it cannot write a reservation.
- Unknown booking facts stay user-entered/explicit; do not infer confirmation or provider values.

---

### Task 1: Define reservation contracts and versioned database command

**Files:**
- Create: `supabase/migrations/20260831_add_mvp_reservation_commands.sql`
- Modify: `supabase/database.types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `supabase/tests/mvp_trip_commands.sql`

**Interfaces:**
- Produces: `TripReservation`, `create_mvp_reservation`, `update_mvp_reservation`, `delete_mvp_reservation`.
- `TripReservation`: `{ id, tripId, dayNumber, placeId, category, title, startsAt, endsAt, status, provider, confirmationCode, notes }`.

- [ ] **Step 1: Write failing SQL assertions**

```sql
perform public.create_mvp_reservation(v_actor, v_trip, v_version, v_command, jsonb_build_object('category','restaurant','title','Dinner'));
if not exists (select 1 from public.reservations where trip_id = v_trip and title = 'Dinner') then
  raise exception 'reservation command must create a record';
end if;
```

Add a stale-version assertion and a non-member forbidden assertion.

- [ ] **Step 2: Verify the database test fails**

Run: `npm run db:verify`

Expected: FAIL because the reservation command is absent.

- [ ] **Step 3: Implement command functions**

Create one internal `private.apply_mvp_reservation_change` function that validates category, title, optional day relationship, time range, and status. Each public command must lock the trip, check active owner/editor membership, return the original summary for duplicate command ID, increment trip version, and insert `trip_change_log` with `reservation_create`, `reservation_update`, or `reservation_delete`.

- [ ] **Step 4: Regenerate types and run database verification**

Run: `npm run db:verify`

Expected: PASS with create, denial, conflict, duplicate-command, update, and delete checks.

- [ ] **Step 5: Commit database contracts**

```bash
git add supabase/migrations supabase/database.types.ts packages/shared/src/index.ts supabase/tests/mvp_trip_commands.sql
git commit -m "feat: add versioned reservation commands"
```

### Task 2: Add authenticated reservation API and snapshot read

**Files:**
- Modify: `apps/worker/src/contracts.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: `POST /v1/trips/:tripId/reservations`, `PATCH /v1/trips/:tripId/reservations/:reservationId`, `DELETE /v1/trips/:tripId/reservations/:reservationId`.

- [ ] **Step 1: Write failing authenticated-boundary tests**

```ts
it("requires a bearer token for reservation creation", async () => {
  const response = await app.request("/v1/trips/trip-1/reservations", { method: "POST", body: "{}" }, env)
  expect(response.status).toBe(401)
})
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run apps/worker/src/index.test.ts`

Expected: FAIL because no reservation route exists.

- [ ] **Step 3: Implement schemas and routes**

Use a Zod body schema with enum category/status, title 1–200 characters, optional day/place IDs, nullable ISO datetimes, provider/confirmation code up to 200 characters, notes up to 4000 characters, expected version, and command ID. Map database errors through `mapDatabaseError`. Extend `GET /v1/trips/:tripId` to read reservations ordered by `starts_at nulls last, created_at` and map day IDs to `dayNumber`.

- [ ] **Step 4: Add typed browser transport**

```ts
createReservation(accessToken, trip, input) {
  return request(`/v1/trips/${trip.id}/reservations`, accessToken, { method: "POST", body: JSON.stringify({ ...input, expectedVersion: trip.version, commandId: crypto.randomUUID() }) })
}
```

Add parallel update/delete methods with the same version and command guarantees.

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run apps/worker/src/index.test.ts apps/worker/src/contracts.test.ts && npm run typecheck && npm run build:worker`

Expected: PASS.

- [ ] **Step 6: Commit API support**

```bash
git add apps/worker/src apps/web/src/lib/api.ts
git commit -m "feat: expose trip reservation endpoints"
```

### Task 3: Build the Mine reservation manager

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app-shell/types.ts`
- Modify: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/features/me/MineView.tsx`
- Modify: `apps/web/src/features/me/MineView.test.tsx`
- Modify: `apps/web/src/lib/demo.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `TripSnapshot.reservations` and create/update/delete callbacks.
- Produces: an accessible form and reservation list with local preview persistence.

- [ ] **Step 1: Write failing form tests**

```tsx
await user.type(screen.getByLabelText("Reservation title"), "Museum entry")
await user.click(screen.getByRole("button", { name: "Save reservation" }))
expect(props.onCreateReservation).toHaveBeenCalledWith(expect.objectContaining({ title: "Museum entry", category: "attraction" }))
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run apps/web/src/features/me/MineView.test.tsx`

Expected: FAIL because Mine shows only the reservation placeholder.

- [ ] **Step 3: Implement controlled form and list**

Render category, title, day, start/end datetime-local, status, provider, confirmation code, and notes with labels. Validate end time is not before start time before invoking a callback. Render Edit and Delete actions, reusing the form for edit state. In preview call pure demo helpers; in account call the typed API then refresh the snapshot. Show saved/failed state in the status banner.

- [ ] **Step 4: Run focused verification**

Run: `npx vitest run apps/web/src/features/me/MineView.test.tsx apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit the reservation manager**

```bash
git add apps/web/src/App.tsx apps/web/src/app-shell apps/web/src/features/me apps/web/src/lib/demo.ts apps/web/src/styles.css
git commit -m "feat: manage reservations in mine"
```
