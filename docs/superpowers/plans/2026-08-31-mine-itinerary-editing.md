# Mine Itinerary Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user add a reviewed place to the selected trip day, remove it, and reorder day stops through keyboard controls or drag-and-drop.

**Architecture:** `App` owns the authoritative `TripSnapshot`; preview changes use deterministic `demo.ts` helpers and account changes use one versioned Worker command. `MineView` receives published place choices and action callbacks, while Map and Attractions update automatically from the refreshed shared snapshot.

**Tech Stack:** React 19, TypeScript, Hono, Supabase PostgreSQL commands, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-08-31-mine-itinerary-reservations-map-design.md`

## Global Constraints

- Use `placeId`, WGS84 coordinates, and product route types as authoritative domain values.
- AI may not write itinerary changes; every account write needs membership, expected version, command ID, and change-log validation.
- Add controls must have loading, empty, error, and success feedback at 390px.
- Preview interactions remain local-only and must not claim remote persistence.
- Reuse `apply_mvp_trip_changes`; do not create a second itinerary mutation pathway.

---

### Task 1: Expose versioned stop-change transport and preview helpers

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/demo.ts`
- Modify: `apps/web/src/lib/demo.test.ts`

**Interfaces:**
- Consumes: `TripSnapshot`, `AgentChange`, `apply_mvp_trip_changes` Worker route.
- Produces: `api.applyTripChanges(accessToken, trip, changes)` and pure `removeDemoStop`, `reorderDemoStops` helpers.

- [ ] **Step 1: Write failing preview-helper tests**

```ts
it("moves a stop within one day and renumbers every sort order", () => {
  expect(reorderDemoStops(trip, "stop-b", 0).stops.map((stop) => stop.id)).toEqual(["stop-b", "stop-a"])
})

it("removes only the selected stop", () => {
  expect(removeDemoStop(trip, "stop-a").stops.map((stop) => stop.id)).toEqual(["stop-b"])
})
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run apps/web/src/lib/demo.test.ts`

Expected: FAIL because the helpers do not exist.

- [ ] **Step 3: Implement pure stop helpers**

```ts
export function reorderDemoStops(trip: TripSnapshot, stopId: string, targetIndex: number): TripSnapshot {
  const dayNumber = trip.stops.find((stop) => stop.id === stopId)?.dayNumber
  const dayStops = trip.stops.filter((stop) => stop.dayNumber === dayNumber).sort((a, b) => a.sortOrder - b.sortOrder)
  const moving = dayStops.find((stop) => stop.id === stopId)
  if (!moving) return trip
  const reordered = [...dayStops.filter((stop) => stop.id !== stopId)]
  reordered.splice(Math.max(0, Math.min(targetIndex, reordered.length)), 0, moving)
  const order = new Map(reordered.map((stop, index) => [stop.id, index]))
  return { ...trip, version: trip.version + 1, stops: trip.stops.map((stop) => order.has(stop.id) ? { ...stop, sortOrder: order.get(stop.id)! } : stop) }
}
```

Implement `removeDemoStop` by filtering the ID and incrementing preview version only when an item was removed. Add `api.applyTripChanges` that sends `PATCH /v1/trips/:tripId/stops` with `{ expectedVersion, commandId, changes }`.

- [ ] **Step 4: Run focused verification**

Run: `npx vitest run apps/web/src/lib/demo.test.ts && npm run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the transport boundary**

```bash
git add apps/web/src/lib/api.ts apps/web/src/lib/demo.ts apps/web/src/lib/demo.test.ts
git commit -m "feat: add itinerary edit transport"
```

### Task 2: Add Worker route for existing versioned trip changes

**Files:**
- Modify: `apps/worker/src/contracts.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`

**Interfaces:**
- Consumes: `{ expectedVersion: number; commandId: string; changes: AgentChange[] }`.
- Produces: `PATCH /v1/trips/:tripId/stops`, forwarding to `apply_mvp_trip_changes` with `p_change_type: "edit_itinerary"`.

- [ ] **Step 1: Write failing route-contract tests**

```ts
it("requires authentication for an itinerary edit", async () => {
  const response = await app.request("/v1/trips/trip-1/stops", { method: "PATCH", body: JSON.stringify({}) }, env)
  expect(response.status).toBe(401)
})
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run apps/worker/src/index.test.ts`

Expected: FAIL because PATCH is not registered.

- [ ] **Step 3: Add the schema and route**

```ts
export const editTripStopsSchema = z.object({
  expectedVersion: z.int().positive(),
  commandId: z.uuid(),
  changes: agentChangesSchema.min(1).max(20),
})

app.patch("/v1/trips/:tripId/stops", async (context) => {
  const parsed = editTripStopsSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Check the itinerary changes."), 400)
  const { data, error } = await context.get("admin").rpc("apply_mvp_trip_changes", {
    p_actor_id: context.get("user").id, p_trip_id: context.req.param("tripId"),
    p_expected_version: parsed.data.expectedVersion, p_command_id: parsed.data.commandId,
    p_changes: parsed.data.changes, p_change_type: "edit_itinerary",
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data))
})
```

- [ ] **Step 4: Run Worker verification**

Run: `npx vitest run apps/worker/src/index.test.ts apps/worker/src/contracts.test.ts && npm run typecheck && npm run build:worker`

Expected: PASS.

- [ ] **Step 5: Commit the Worker endpoint**

```bash
git add apps/worker/src/contracts.ts apps/worker/src/index.ts apps/worker/src/index.test.ts
git commit -m "feat: add versioned itinerary edit endpoint"
```

### Task 3: Build Mine day-place add, remove, and reorder controls

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app-shell/types.ts`
- Modify: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/features/me/MineView.tsx`
- Modify: `apps/web/src/features/me/MineView.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: published `PlaceSummary[]`, `onAddPlace(placeId, dayNumber)`, `onEditStops(changes)`.
- Produces: selected-day add control, remove control, keyboard movement and pointer drag reorder.

- [ ] **Step 1: Write failing Mine interaction tests**

```tsx
await user.selectOptions(screen.getByLabelText("Add reviewed place"), "forbidden-city")
await user.click(screen.getByRole("button", { name: "Add to Day 2" }))
expect(props.onAddPlace).toHaveBeenCalledWith("forbidden-city", 2)

await user.click(screen.getByRole("button", { name: "Move Jingshan Park down" }))
expect(props.onEditStops).toHaveBeenCalledWith(expect.arrayContaining([{ op: "update_stop", stopId: "stop-1" }]))
```

- [ ] **Step 2: Verify the tests fail**

Run: `npx vitest run apps/web/src/features/me/MineView.test.tsx`

Expected: FAIL because the controls and callbacks do not exist.

- [ ] **Step 3: Wire App state and Mine UI**

In `App`, implement `editStops(changes)` with `reorderDemoStops`/`removeDemoStop` in preview and `api.applyTripChanges` plus `loadTrip` in account mode. Pass `places`, `onAddPlace`, and `onEditStops` through `AppShell`.

In `MineView`, compute `availablePlaces = places.filter((place) => !trip.stops.some((stop) => stop.placeId === place.id))`, render a labelled `<select>` and `Add to Day {selectedDay}` button, and disable the button with an explanatory message when no selection is available. Render Remove, Move up, and Move down buttons per stop. For drag handling, set `draggable`, store the dragged ID in state, and on drop emit an ordered `update_stop` change array for that day. Do not use drag as the only ordering affordance.

- [ ] **Step 4: Add responsive styling**

Add `.itinerary-editor`, `.stop-actions`, and `.drag-handle` rules that wrap controls at 390px without horizontal overflow. Use visible focus styles and 44px minimum button targets.

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run apps/web/src/features/me/MineView.test.tsx apps/web/src/app-shell/AppShell.test.tsx apps/web/src/lib/demo.test.ts && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit the Mine itinerary editor**

```bash
git add apps/web/src/App.tsx apps/web/src/app-shell apps/web/src/features/me apps/web/src/styles.css
git commit -m "feat: edit itinerary stops in mine"
```
