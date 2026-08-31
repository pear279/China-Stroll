# Map Itinerary Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show the selected day's ordered trip stops separately from nearby places and synchronize each itinerary selection with map marker selection.

**Architecture:** `AppShell` remains the owner of `selectedDay` and `selectedPlaceId`. `MapView` derives day stops from the shared `TripSnapshot`, while `TravelMap` continues to receive all trip stops and uses the shared place ID selection.

**Tech Stack:** React 19, TypeScript, MapLibre/mapcn wrapper, Vitest, CSS.

**Spec:** `docs/superpowers/specs/2026-08-31-mine-itinerary-reservations-map-design.md`

## Global Constraints

- Map and Mine use the same trip stop identity and selected day state.
- A stop without WGS84 coordinates remains visible in itinerary text but is not represented as a fabricated map marker.
- Nearby filters stay independent from the selected-day itinerary list.
- Preserve Details, Add, Navigate, and Cancel marker actions.

---

### Task 1: Render and synchronize the selected-day itinerary panel

**Files:**
- Modify: `apps/web/src/features/map/MapView.tsx`
- Modify: `apps/web/src/features/map/MapView.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `trip.stops`, `selectedDay`, `selectedPlaceId`, and `onSelect(placeId | null)`.
- Produces: `Day itinerary` panel ordered by `sortOrder` and marker-synchronized selection.

- [ ] **Step 1: Write failing panel tests**

```tsx
expect(screen.getByRole("heading", { name: "Day 2 itinerary" })).toBeTruthy()
await user.click(screen.getByRole("button", { name: /Jingshan Park/ }))
expect(props.onSelect).toHaveBeenCalledWith("jingshan-park")
```

- [ ] **Step 2: Verify the test fails**

Run: `npx vitest run apps/web/src/features/map/MapView.test.tsx`

Expected: FAIL because Map has no itinerary panel.

- [ ] **Step 3: Implement the derived panel**

```ts
const dayStops = trip.stops
  .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
  .sort((left, right) => left.sortOrder - right.sortOrder)
```

Render it above `.map-place-list` with sequence, title, time/duration, and selected styling when `selectedPlaceId === stop.placeId`. A click on a stop with `placeId` calls `onSelect(stop.placeId)`; a stop lacking it renders static text.

- [ ] **Step 4: Add mobile styling**

Create `.map-itinerary-panel` styles with a compact vertical list, no fixed overflow, visible selected state, and 44px minimum action rows.

- [ ] **Step 5: Run focused verification**

Run: `npx vitest run apps/web/src/features/map/MapView.test.tsx apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck && npm run lint`

Expected: PASS.

- [ ] **Step 6: Commit the Map panel**

```bash
git add apps/web/src/features/map/MapView.tsx apps/web/src/features/map/MapView.test.tsx apps/web/src/styles.css
git commit -m "feat: show selected day itinerary on map"
```
