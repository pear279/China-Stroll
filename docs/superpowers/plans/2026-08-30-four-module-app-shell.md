# Four-module Application Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the planner-only screen with four routable, mobile-first Attractions, Map, Tools and Mine modules while preserving every currently working place, map, trip and AI-suggestion flow.

**Architecture:** `App` continues to own session, domain data and mutations. A new `AppShell` owns route-independent UI selection/filter/location state and renders focused module views through React Router. Shared presentational components keep Attractions and Map synchronized without introducing a global state library or changing Worker/database contracts.

**Tech Stack:** React 19, TypeScript 7, react-router-dom, Vite 8, Vitest 4, Testing Library, lucide-react, existing mapcn/MapLibre wrapper, Cloudflare Pages SPA fallback.

**Spec:** `docs/superpowers/specs/2026-08-30-four-module-app-shell-design.md`

## Global Constraints

- Primary routes are exactly `/attractions`, `/map`, `/tools` and `/me`; unknown paths redirect to `/attractions`.
- Signed-out and trip-creation screens remain outside the module shell.
- `App` remains the owner of session, trip, place data, saved place IDs and mutation functions.
- `AppShell` owns `selectedPlaceId`, `detailPlaceId`, selected day, current coordinate/status, nearby radius, category and duration filters.
- No new global state library and no Worker, Supabase schema or server-contract change.
- MapLibre remains lazy and hidden behind `TravelMap`.
- Tools contains only real links/reviewed static information; provider-dependent future capabilities are non-interactive status cards.
- Do not display a location-sharing switch until its server preference, RLS and revocation behavior exist.
- All controls have visible text or accessible names; active module uses `aria-current="page"`.
- Every module supports 390px without horizontal overflow and reserves space for fixed mobile navigation.
- Existing preview/account behavior, trip version checks and AI confirmation flow must remain unchanged.

## File Map

### Create

- `apps/web/src/app-shell/types.ts` — shared frontend-only shell contracts.
- `apps/web/src/app-shell/useCurrentLocation.ts` — one-shot browser geolocation state.
- `apps/web/src/app-shell/useCurrentLocation.test.ts` — location success/failure tests.
- `apps/web/src/app-shell/BottomNavigation.tsx` — four primary route links.
- `apps/web/src/app-shell/BottomNavigation.test.tsx` — route label and active-state tests.
- `apps/web/src/app-shell/AppShell.tsx` — shared UI state and route composition.
- `apps/web/src/app-shell/AppShell.test.tsx` — route, redirect and shared-selection integration tests.
- `apps/web/src/features/attractions/PlaceFilters.tsx` — category/duration/radius controls.
- `apps/web/src/features/attractions/PlaceCard.tsx` — reusable reviewed-place card.
- `apps/web/src/features/attractions/AttractionsView.tsx` — current/nearby context and discovery list.
- `apps/web/src/features/attractions/AttractionsView.test.tsx` — loading, denial and action tests.
- `apps/web/src/features/map/MapActionSheet.tsx` — Details/Add/Navigate/Cancel actions.
- `apps/web/src/features/map/MapView.tsx` — map, controls and synchronized place list.
- `apps/web/src/features/map/MapView.test.tsx` — marker/list selection and navigation actions.
- `apps/web/src/features/tools/ToolsView.tsx` — reviewed static travel-support groups.
- `apps/web/src/features/tools/ToolsView.test.tsx` — real links and non-interactive roadmap state.
- `apps/web/src/features/me/MineView.tsx` — identity, trip days, itinerary and suggestion UI.
- `apps/web/src/features/me/MineView.test.tsx` — day selection, empty itinerary and callbacks.
- `apps/web/public/_redirects` — Cloudflare Pages SPA fallback.

### Modify

- `package.json` / `package-lock.json` — add `react-router-dom`.
- `apps/web/src/main.tsx` — wrap `App` with `BrowserRouter`.
- `apps/web/src/App.tsx` — retain lifecycle/mutations; replace `Planner` with `AppShell`; remove migrated Planner markup.
- `apps/web/src/styles.css` — module shell, bottom navigation, views and responsive states.
- `apps/web/public/_routes.json` — verify Functions paths remain included; change only if current pattern conflicts with SPA fallback.
- `TASKS.md` — record Task 5 verification only after all acceptance checks pass.

### Retain Without Contract Changes

- `apps/web/src/components/TravelMap.tsx`
- `apps/web/src/components/PlaceDetailPanel.tsx`
- `apps/web/src/lib/api.ts`
- `apps/web/src/lib/demo.ts`
- `packages/shared/src/index.ts`

---

### Task 1: Install Router and Establish Route Metadata

**Files:**
- Create: `apps/web/src/app-shell/types.ts`
- Create: `apps/web/src/app-shell/BottomNavigation.tsx`
- Test: `apps/web/src/app-shell/BottomNavigation.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Produces: `ModulePath = "/attractions" | "/map" | "/tools" | "/me"`.
- Produces: `MODULES: readonly { path: ModulePath; label: string; icon: LucideIcon }[]`.
- Produces: `BottomNavigation(): JSX.Element` using React Router `NavLink`.

- [ ] **Step 1: Install the routing dependency on the current Mac**

Run:

```bash
npm install react-router-dom@7.18.3
```

Expected: `package.json` and `package-lock.json` add one direct dependency; no copied native modules.

- [ ] **Step 2: Create the frontend shell contracts**

Create `apps/web/src/app-shell/types.ts`:

```ts
import type { AgentSuggestion, PlaceSummary, TripSnapshot } from "../../../../packages/shared/src"

export type AppMode = "preview" | "account"
export type PlacesState = "idle" | "loading" | "ready" | "failed"
export type LocationStatus = "idle" | "loading" | "ready" | "failed"
export type NearbyRadius = 1 | 3 | 5
export type ModulePath = "/attractions" | "/map" | "/tools" | "/me"

export type AppShellProps = {
  accessToken: string | null
  busy: string | null
  message: string | null
  mode: AppMode
  places: PlaceSummary[]
  placesState: PlacesState
  savedPlaceIds: Set<string>
  trip: TripSnapshot
  testIdentity: string | null
  onAddPlace: (placeId: string, dayNumber?: number) => Promise<void>
  onAddDay: () => Promise<void>
  onToggleSaved: (placeId: string) => Promise<void>
  onConfirm: (suggestion: AgentSuggestion) => Promise<void>
  onSuggest: () => Promise<void>
  onExit: () => Promise<void>
}
```

- [ ] **Step 3: Write the failing bottom-navigation test**

Create `apps/web/src/app-shell/BottomNavigation.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { BottomNavigation } from "./BottomNavigation"

describe("BottomNavigation", () => {
  it("shows four labelled routes and marks the current one", () => {
    render(<MemoryRouter initialEntries={["/map"]}><BottomNavigation /></MemoryRouter>)
    expect(screen.getAllByRole("link")).toHaveLength(4)
    expect(screen.getByRole("link", { name: "Attractions" }).getAttribute("href")).toBe("/attractions")
    expect(screen.getByRole("link", { name: /Map/ }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: "Tools" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mine" })).toBeTruthy()
  })
})
```

- [ ] **Step 4: Run the focused test and confirm the missing-component failure**

Run:

```bash
npx vitest run apps/web/src/app-shell/BottomNavigation.test.tsx
```

Expected: FAIL because `./BottomNavigation` does not exist.

- [ ] **Step 5: Implement module metadata and navigation**

Create `apps/web/src/app-shell/BottomNavigation.tsx`:

```tsx
import { Binoculars, Map, UserRound, Wrench, type LucideIcon } from "lucide-react"
import { NavLink } from "react-router-dom"
import type { ModulePath } from "./types"

export const MODULES = [
  { path: "/attractions", label: "Attractions", icon: Binoculars },
  { path: "/map", label: "Map", icon: Map },
  { path: "/tools", label: "Tools", icon: Wrench },
  { path: "/me", label: "Mine", icon: UserRound },
] as const satisfies readonly { path: ModulePath; label: string; icon: LucideIcon }[]

export function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Primary">
      {MODULES.map(({ path, label, icon: Icon }) => (
        <NavLink key={path} to={path} className={({ isActive }) => isActive ? "is-active" : undefined}>
          {({ isActive }) => <><Icon aria-hidden="true" size={20} /><span>{label}</span>{isActive && <span className="sr-only">Current page</span>}</>}
        </NavLink>
      ))}
    </nav>
  )
}
```

- [ ] **Step 6: Run the focused test**

Run: `npx vitest run apps/web/src/app-shell/BottomNavigation.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the routing foundation**

```bash
git add package.json package-lock.json apps/web/src/app-shell/types.ts apps/web/src/app-shell/BottomNavigation.tsx apps/web/src/app-shell/BottomNavigation.test.tsx
git commit -m "feat: add four-module route navigation"
```

---

### Task 2: Extract One-shot Location State

**Files:**
- Create: `apps/web/src/app-shell/useCurrentLocation.ts`
- Test: `apps/web/src/app-shell/useCurrentLocation.test.ts`

**Interfaces:**
- Produces: `useCurrentLocation(): { coordinate: Coordinate | null; status: LocationStatus; requestLocation: () => void }`.
- Uses browser `navigator.geolocation.getCurrentPosition` with `{ enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }`.

- [ ] **Step 1: Write failing success and failure tests**

Create `apps/web/src/app-shell/useCurrentLocation.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCurrentLocation } from "./useCurrentLocation"

afterEach(() => vi.unstubAllGlobals())

describe("useCurrentLocation", () => {
  it("stores a one-shot WGS84 browser coordinate", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (success: PositionCallback) => success({ coords: { longitude: 116.39, latitude: 39.91 } } as GeolocationPosition) } })
    const { result } = renderHook(() => useCurrentLocation())
    act(() => result.current.requestLocation())
    expect(result.current.status).toBe("ready")
    expect(result.current.coordinate).toEqual([116.39, 39.91])
  })

  it("reports failure without blocking browsing", () => {
    vi.stubGlobal("navigator", { geolocation: { getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) => failure({ code: 1, message: "denied" } as GeolocationPositionError) } })
    const { result } = renderHook(() => useCurrentLocation())
    act(() => result.current.requestLocation())
    expect(result.current.status).toBe("failed")
    expect(result.current.coordinate).toBeNull()
  })
})
```

- [ ] **Step 2: Run the focused test and confirm failure**

Run: `npx vitest run apps/web/src/app-shell/useCurrentLocation.test.ts`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement the hook**

```ts
import { useState } from "react"
import type { Coordinate } from "../../../../packages/shared/src"
import type { LocationStatus } from "./types"

export function useCurrentLocation() {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")

  function requestLocation() {
    if (!navigator.geolocation) { setStatus("failed"); return }
    setStatus("loading")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => { setCoordinate([coords.longitude, coords.latitude]); setStatus("ready") },
      () => setStatus("failed"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  return { coordinate, status, requestLocation }
}
```

- [ ] **Step 4: Run focused tests**

Run: `npx vitest run apps/web/src/app-shell/useCurrentLocation.test.ts`

Expected: 2 PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/app-shell/useCurrentLocation.ts apps/web/src/app-shell/useCurrentLocation.test.ts
git commit -m "feat: extract current location state"
```

---

### Task 3: Build Reusable Attractions Controls and Cards

**Files:**
- Create: `apps/web/src/features/attractions/PlaceFilters.tsx`
- Create: `apps/web/src/features/attractions/PlaceCard.tsx`
- Create: `apps/web/src/features/attractions/AttractionsView.tsx`
- Test: `apps/web/src/features/attractions/AttractionsView.test.tsx`

**Interfaces:**
- `PlaceFilters` consumes category, duration, radius, location availability and setter callbacks.
- `PlaceCard` consumes one `PlaceSummary`, `planned`, `saved`, selected day and Details/Save/Add/Show-on-map callbacks.
- `AttractionsView` consumes already-filtered `visiblePlaces`; filtering remains owned by `AppShell`.

- [ ] **Step 1: Write the failing Attractions behavior test**

Create a fixture with one reviewed place and render `AttractionsView`. Assert loading and normal states separately:

```tsx
it("keeps discovery usable when location is denied", async () => {
  render(<AttractionsView {...props} locationStatus="failed" userCoordinate={null} />)
  expect(screen.getByText("Location is unavailable")).toBeTruthy()
  expect(screen.getByRole("heading", { name: "The Palace Museum" })).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: "Details for The Palace Museum" }))
  expect(props.onOpenDetails).toHaveBeenCalledWith("forbidden-city")
})

it("shows a dedicated loading state", () => {
  render(<AttractionsView {...props} placesState="loading" places={[]} visiblePlaces={[]} />)
  expect(screen.getByRole("status").textContent).toContain("Loading reviewed places")
})
```

- [ ] **Step 2: Run the focused test and confirm missing components**

Run: `npx vitest run apps/web/src/features/attractions/AttractionsView.test.tsx`

Expected: FAIL because `AttractionsView` does not exist.

- [ ] **Step 3: Implement `PlaceFilters`**

Use existing `durationFilters`, `formatCategoryLabel` and visible labels. Radius buttons remain disabled when `userCoordinate` is null, and the denial explanation is rendered as text.

```tsx
import { durationFilters, formatCategoryLabel } from "../../../../../packages/shared/src"
import type { NearbyRadius } from "../../app-shell/types"

type Props = {
  categories: string[]
  category: string
  maxDuration: number | undefined
  radius: NearbyRadius
  hasLocation: boolean
  onCategory: (category: string) => void
  onDuration: (duration: number | undefined) => void
  onRadius: (radius: NearbyRadius) => void
}

export function PlaceFilters({ categories, category, maxDuration, radius, hasLocation, onCategory, onDuration, onRadius }: Props) {
  return (
    <div className="place-filters">
      <label htmlFor="place-category">Category</label>
      <select id="place-category" value={category} onChange={(event) => onCategory(event.target.value)}>
        <option value="all">All categories</option>
        {categories.map((code) => <option key={code} value={code}>{formatCategoryLabel(code)}</option>)}
      </select>
      <label htmlFor="place-duration">Visit length</label>
      <select id="place-duration" value={maxDuration ?? "any"} onChange={(event) => onDuration(event.target.value === "any" ? undefined : Number(event.target.value))}>
        {durationFilters.map((filter) => <option key={filter.label} value={filter.maxDurationMinutes ?? "any"}>{filter.label}</option>)}
      </select>
      <div className="radius-controls" aria-label="Nearby radius">
        {([1, 3, 5] as const).map((value) => (
          <button key={value} type="button" className={radius === value ? "is-active" : undefined} disabled={!hasLocation} onClick={() => onRadius(value)}>{value} km</button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Implement `PlaceCard` with real actions**

Render the approved WebP via `resolvePlaceImage(place.id)`. Buttons and labels:

- `Details for ${place.name}`
- `Save ${place.name}` / `Remove ${place.name} from saved places`
- `Show ${place.name} on map`
- `Add ${place.name} to day ${selectedDay}` or visible `Planned`

- [ ] **Step 5: Implement `AttractionsView`**

Render:

1. module heading;
2. nearest reviewed place when coordinate and visible places exist, using `haversineKilometres`;
3. location enable/failed context card;
4. `PlaceFilters`;
5. distinct loading, failed, no-data, no-filter-match and normal grids.

- [ ] **Step 6: Run focused and shared helper tests**

Run:

```bash
npx vitest run apps/web/src/features/attractions/AttractionsView.test.tsx packages/shared/src/index.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit Attractions components**

```bash
git add apps/web/src/features/attractions
git commit -m "feat: build attractions module view"
```

---

### Task 4: Build Map View and Navigation Action Sheet

**Files:**
- Create: `apps/web/src/features/map/MapActionSheet.tsx`
- Create: `apps/web/src/features/map/MapView.tsx`
- Test: `apps/web/src/features/map/MapView.test.tsx`

**Interfaces:**
- `MapView` consumes `TripSnapshot`, visible places, selected place, coordinate/status/radius, selected day and callbacks.
- `MapActionSheet` receives `place`, `planned`, `selectedDay`, `onDetails`, `onAdd`, `onCancel`.
- Map action links use existing `appleMapsUrl`, `googleMapsUrl`, `amapSearchUrl` helpers.

- [ ] **Step 1: Write the failing action-sheet test**

Mock `TravelMap` to call `onSelect("forbidden-city")`, then assert the sheet:

```tsx
vi.mock("../../components/TravelMap", () => ({ TravelMap: ({ onSelect }: { onSelect: (id: string) => void }) => <button onClick={() => onSelect("forbidden-city")}>Select marker</button> }))

it("opens Details, Add, Navigate and Cancel for a selected marker", async () => {
  render(<MapView {...props} />)
  await userEvent.click(screen.getByRole("button", { name: "Select marker" }))
  expect(screen.getByRole("dialog", { name: "The Palace Museum map actions" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Details" })).toBeTruthy()
  expect(screen.getByRole("button", { name: "Add to day 1" })).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: "Navigate" }))
  expect(screen.getByRole("link", { name: "Apple Maps" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Google Maps" })).toBeTruthy()
  expect(screen.getByRole("link", { name: "Amap" })).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
  expect(screen.queryByRole("dialog")).toBeNull()
})
```

- [ ] **Step 2: Run focused test and confirm failure**

Run: `npx vitest run apps/web/src/features/map/MapView.test.tsx`

Expected: FAIL because the view does not exist.

- [ ] **Step 3: Implement `MapActionSheet`**

Use `role="dialog"`, `aria-modal="false"`, a visible reviewed-place label and an internal `navigationExpanded` boolean. Generate external links only from the selected product place coordinate/name. Cancel clears selection through `onCancel`.

- [ ] **Step 4: Implement `MapView`**

Render location/radius controls, lazy-map fallback, `TravelMap`, synchronized list and `MapActionSheet`. The list item click and marker click both call `onSelect(place.id)`. Keep the dotted-line explanation supplied by `TravelMap`.

- [ ] **Step 5: Run focused navigation tests**

Run:

```bash
npx vitest run apps/web/src/features/map/MapView.test.tsx apps/web/src/lib/navigation.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Map components**

```bash
git add apps/web/src/features/map
git commit -m "feat: build map module actions"
```

---

### Task 5: Build Tools and Mine Views

**Files:**
- Create: `apps/web/src/features/tools/ToolsView.tsx`
- Test: `apps/web/src/features/tools/ToolsView.test.tsx`
- Create: `apps/web/src/features/me/MineView.tsx`
- Test: `apps/web/src/features/me/MineView.test.tsx`

**Interfaces:**
- `ToolsView` has no domain mutation props; it renders reviewed static content and real `tel:`/external links.
- `MineView` consumes mode/identity/trip/busy/message and Add Day/Suggest/Confirm/Select Place callbacks.
- `MineView` exports no state; selected day is controlled by `AppShell`.

- [ ] **Step 1: Write failing Tools assertions**

```tsx
it("offers real emergency actions and no fake exchange button", () => {
  render(<ToolsView />)
  expect(screen.getByRole("link", { name: /Police 110/ }).getAttribute("href")).toBe("tel:110")
  expect(screen.getByRole("link", { name: /Medical 120/ }).getAttribute("href")).toBe("tel:120")
  expect(screen.getByText("Exchange rate connection is being prepared")).toBeTruthy()
  expect(screen.queryByRole("button", { name: /exchange/i })).toBeNull()
})
```

- [ ] **Step 2: Implement `ToolsView`**

Render four semantic sections. Include reviewed baseline copy:

- payment: international cards may not work everywhere; Alipay/WeChat setup and merchant acceptance vary; carry a backup payment method;
- emergency links: Police 110, Fire 119, Medical 120;
- navigation: explain provider choice occurs from a selected place;
- exchange/translation: non-interactive provider-preparation status.

- [ ] **Step 3: Write failing Mine day-flow assertions**

```tsx
it("shows the selected day and forwards itinerary selection", async () => {
  render(<MineView {...props} selectedDay={2} />)
  expect(screen.getByRole("heading", { name: "Day 2 itinerary" })).toBeTruthy()
  await userEvent.click(screen.getByRole("button", { name: /Jingshan Park/ }))
  expect(props.onSelectPlace).toHaveBeenCalledWith("jingshan-park")
})
```

- [ ] **Step 4: Implement `MineView`**

Move the current header identity, day tabs, timeline, message banner, assistant card and `SuggestionPanel` markup out of `Planner`. Add visible Reservations and Trip Members empty-state sections. Do not add unsupported edit, invitation or sharing switches.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run apps/web/src/features/tools/ToolsView.test.tsx apps/web/src/features/me/MineView.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit Tools and Mine**

```bash
git add apps/web/src/features/tools apps/web/src/features/me
git commit -m "feat: build tools and mine module views"
```

---

### Task 6: Compose Shared AppShell Routes

**Files:**
- Create: `apps/web/src/app-shell/AppShell.tsx`
- Test: `apps/web/src/app-shell/AppShell.test.tsx`

**Interfaces:**
- Consumes: `AppShellProps`, module views and `useCurrentLocation`.
- Produces: routable shell containing the four views, persistent header/detail drawer/bottom navigation and shared UI state.

- [ ] **Step 1: Write failing route and redirect tests**

Use `MemoryRouter` and a common `AppShellProps` fixture:

```tsx
it.each([
  ["/attractions", "Reviewed attractions"],
  ["/map", "Map and nearby places"],
  ["/tools", "Travel tools"],
  ["/me", "My trip"],
])("renders %s", (path, heading) => {
  render(<MemoryRouter initialEntries={[path]}><AppShell {...props} /></MemoryRouter>)
  expect(screen.getByRole("heading", { name: heading })).toBeTruthy()
})

it("redirects unknown paths to Attractions", async () => {
  render(<MemoryRouter initialEntries={["/unknown"]}><AppShell {...props} /></MemoryRouter>)
  expect(await screen.findByRole("heading", { name: "Reviewed attractions" })).toBeTruthy()
})
```

- [ ] **Step 2: Write the cross-module selection test**

Start at Attractions, click Show on Map, assert navigation to Map and the selected place action sheet remains open. Use a `LocationDisplay` test helper or assert the Map heading plus dialog.

- [ ] **Step 3: Run focused tests and confirm failure**

Run: `npx vitest run apps/web/src/app-shell/AppShell.test.tsx`

Expected: FAIL because `AppShell` does not exist.

- [ ] **Step 4: Implement shared state and filtering**

Initialize:

```ts
const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(trip.stops[0]?.placeId ?? null)
const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null)
const [selectedDay, setSelectedDay] = useState(trip.days[0]?.dayNumber ?? 1)
const [category, setCategory] = useState("all")
const [maxDuration, setMaxDuration] = useState<number | undefined>()
const [nearbyRadius, setNearbyRadius] = useState<NearbyRadius>(3)
const { coordinate: userCoordinate, status: locationStatus, requestLocation } = useCurrentLocation()
```

Compute `plannedIds`, `categories` and `visiblePlaces` with the existing shared helpers. Keep the effect that selects the first trip stop when no place is selected.

- [ ] **Step 5: Implement route composition**

Render persistent `ModuleHeader`, then:

```tsx
<Routes>
  <Route path="/attractions" element={<AttractionsView {...attractionsProps} />} />
  <Route path="/map" element={<MapView {...mapProps} />} />
  <Route path="/tools" element={<ToolsView />} />
  <Route path="/me" element={<MineView {...mineProps} />} />
  <Route path="*" element={<Navigate replace to="/attractions" />} />
</Routes>
```

Render `PlaceDetailPanel` once above module content when `detailPlace` exists, followed by `BottomNavigation`.

- [ ] **Step 6: Run AppShell and all new component tests**

Run: `npx vitest run apps/web/src/app-shell apps/web/src/features`

Expected: all new tests PASS.

- [ ] **Step 7: Commit AppShell**

```bash
git add apps/web/src/app-shell/AppShell.tsx apps/web/src/app-shell/AppShell.test.tsx
git commit -m "feat: compose four-module app shell"
```

---

### Task 7: Integrate App, BrowserRouter and Cloudflare SPA Fallback

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/main.tsx`
- Create: `apps/web/public/_redirects`
- Inspect: `apps/web/public/_routes.json`
- Test: existing `apps/web/src/lib/*.test.ts` plus `AppShell.test.tsx`

**Interfaces:**
- `App` passes its current props/callbacks to `AppShell` after trip creation.
- `main.tsx` supplies `BrowserRouter`; `AppShell` tests continue to supply `MemoryRouter`.

- [ ] **Step 1: Wrap the application with `BrowserRouter`**

Modify `main.tsx`:

```tsx
import { BrowserRouter } from "react-router-dom"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 2: Replace `Planner` with `AppShell`**

Import `AppShell` and pass the exact current state and callbacks. Remove the migrated `Planner`, `SuggestionPanel` and map lazy import from `App.tsx`; keep `WelcomeScreen`, `CreateTripScreen`, session lifecycle and all mutation functions unchanged.

- [ ] **Step 3: Add Pages SPA fallback**

Create `apps/web/public/_redirects`:

```text
/* /index.html 200
```

Read `_routes.json` and confirm `/health` and `/v1/*` remain in the Functions routing scope. Do not add either path to SPA exclusions that bypass Functions.

- [ ] **Step 4: Run typecheck and all tests**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck PASS and at least the existing 51 plus new tests PASS.

- [ ] **Step 5: Run Pages production builds**

Run:

```bash
npm run build:web
npm run build:functions
npm run build:worker
```

Expected: all PASS; Map chunk remains lazy. The known large Map chunk warning may remain but no new main-entry chunk warning is introduced.

- [ ] **Step 6: Commit integration**

```bash
git add apps/web/src/App.tsx apps/web/src/main.tsx apps/web/public/_redirects apps/web/public/_routes.json
git commit -m "feat: route app through four modules"
```

---

### Task 8: Implement Responsive Module Styling and Accessibility

**Files:**
- Modify: `apps/web/src/styles.css`
- Modify: module components only when an accessibility check reveals missing semantics.

**Interfaces:**
- CSS classes: `.module-shell`, `.module-content`, `.bottom-navigation`, `.module-heading`, `.current-place-card`, `.map-view`, `.map-place-list`, `.map-action-sheet`, `.tool-grid`, `.tool-card`, `.mine-grid`, `.sr-only`.

- [ ] **Step 1: Add shared shell and visually-hidden styles**

Add `.module-shell` bottom padding, `.bottom-navigation` fixed mobile positioning, active-route shape/text state, and `.sr-only` clipping. Ensure every target is at least 44px high.

- [ ] **Step 2: Add per-module layouts**

- Attractions: one-column mobile cards and multi-column desktop grid.
- Map: full-width map plus synchronized list; mobile action sheet fixed above bottom navigation.
- Tools: one-column mobile and two-column desktop cards.
- Mine: day/timeline plus account/empty-state cards.

- [ ] **Step 3: Preserve reduced-motion and focus rules**

Keep existing `prefers-reduced-motion` behavior. Add `select:focus-visible` and route-link focus styling without removing browser outlines.

- [ ] **Step 4: Run app for visual verification**

Run:

```bash
npm run dev:web
```

At 390×844 capture and inspect `/attractions`, `/map`, `/tools`, `/me`. Verify:

- no horizontal overflow;
- bottom navigation does not cover final actions;
- all four labels are visible;
- map has a list equivalent;
- selected/saved/planned states use text or shape in addition to colour;
- denied-location copy remains visible and browsing still works.

- [ ] **Step 5: Check keyboard flow**

Tab through bottom navigation, filters, cards and action sheet. Confirm visible focus, logical order, dialog naming and Cancel behavior.

- [ ] **Step 6: Commit responsive styling**

```bash
git add apps/web/src/styles.css apps/web/src/app-shell apps/web/src/features
git commit -m "style: polish responsive four-module shell"
```

---

### Task 9: Full Verification and Context Update

**Files:**
- Modify: `TASKS.md`
- Modify: `ARCHITECTURE.md` only if implementation differs from the approved component/route design.
- Modify: `README.md` to document module routes and local direct-load behavior.

**Interfaces:**
- No new runtime interface; this task proves and records the milestone.

- [ ] **Step 1: Run the complete automated gate**

Run:

```bash
npm run build
```

Expected: typecheck, lint, curated-place verification, all tests, image verification, web build, Pages Functions build and Worker dry-run PASS.

- [ ] **Step 2: Run the complete local database gate**

Run:

```bash
npm run db:verify
```

Expected: two clean PostgreSQL 17 rebuilds, both transactional SQL suites, 20/40/40 curated data assertions and anonymous RLS read assertions PASS.

- [ ] **Step 3: Verify Pages direct routes and API separation**

Run `npm run dev:pages`, then check:

```bash
curl -I http://localhost:8788/attractions
curl -I http://localhost:8788/map
curl -I http://localhost:8788/tools
curl -I http://localhost:8788/me
curl -i http://localhost:8788/health
```

Expected: module routes return SPA HTML successfully; `/health` returns API JSON rather than `index.html`.

- [ ] **Step 4: Review against Product Quality Gate**

For each module record yes/no for understandable entry, minimal steps, empty state, error state, loading feedback, success feedback and 390px behavior. Fix every “no” before continuing.

- [ ] **Step 5: Update project context**

Mark Task 5 complete in `TASKS.md` with exact test counts and build output. If implementation matched the spec, do not restate it in `ARCHITECTURE.md`; only record real deviations and their reason. Update README with the four routes.

- [ ] **Step 6: Commit the verified milestone**

```bash
git add TASKS.md ARCHITECTURE.md README.md
git commit -m "docs: record four-module shell verification"
```

- [ ] **Step 7: Final review**

Run:

```bash
git status --short
git log --oneline -12
```

Expected: no unintended generated files or unrelated changes; milestone commits are ordered and reviewable.
