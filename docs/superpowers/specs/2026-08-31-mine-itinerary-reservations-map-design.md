# Mine editing, reservations, and map itinerary design

## Goal

Turn the existing four-module shell into an executable trip workflow: users can add reviewed places to any trip day, reorder or remove stops, maintain their own reservations, and see the selected day's itinerary in Map. The work follows the product's single shared `TripSnapshot` model; no module owns a private copy of itinerary state.

## Scope and order

1. Mine itinerary editing: add a day, select a reviewed place for the active day, remove it, and reorder it by drag-and-drop or accessible move controls.
2. Mine reservations: create, edit, delete, and view manual reservation records.
3. Map itinerary panel: show the selected day separately from nearby places and synchronize its selection with map markers.
4. Run the complete mobile/browser quality gate after the functional slices are available.

Tavily is already configured locally. The existing worker adapter remains the only network search path. Preview mode continues to use its deterministic catalog unless an explicit preview-to-worker mode is added later; account mode uses the Worker endpoint.

## Itinerary editing

Mine renders a reviewed-place select control for the current day. It receives the same published place list already used by Attractions and Map. Adding a place passes the active `dayNumber`; it never silently adds to day one. A place already scheduled anywhere in the trip is excluded from the add list, preserving the existing one-stop-per-place MVP rule.

Each stop has:

- select/open-place action;
- remove action;
- move up and move down controls for keyboard and touch accessibility;
- native drag-and-drop reordering for pointer users.

The UI sends one explicit trip command containing `update_stop`, `move_stop`, or `remove_stop` changes, with the current expected version and a new command ID. The Worker continues to call `apply_mvp_trip_changes`, which enforces membership, role, command idempotency, expected version, and the change log. On success, the client refreshes the snapshot and keeps the selected day/place valid. Permission denial, conflict, and dependency errors are shown in the existing status banner.

Preview mode implements identical visible interactions through pure `demo.ts` snapshot helpers. This makes the local preview useful without pretending the changes were stored remotely.

## Reservations

Reservations use the existing `reservations` table. The shared contract adds a reservation type to `TripSnapshot` so Mine and Map consume the same snapshot. A manual reservation form supports:

- category: accommodation, transport, restaurant, attraction, activity;
- title and optional linked day/place;
- start/end time;
- status: planned, confirmed, cancelled, completed;
- provider, confirmation code, and notes.

The Worker exposes authenticated create, update, and delete endpoints. Writes must verify the caller's active trip membership and use an expected trip version plus command ID; the data command increments trip version and appends a `trip_change_log` entry. AI can later populate an unsubmitted form draft only; it does not write reservation data.

Preview reservations are clearly marked local to this device and never sent to the Worker.

## Map itinerary panel

Map gains a dedicated “Day itinerary” panel above the nearby reviewed-place list. It uses the selected day from `AppShell`, orders stops by `sortOrder`, and displays sequence, name, time, and duration. Selecting an item updates `selectedPlaceId`; selecting a corresponding map marker updates the panel. A stop without a map coordinate remains visible in the panel but does not create a marker. Nearby filters and the 1/3/5 km controls remain independent from the itinerary panel.

## API and data flow

```text
Mine action → App state handler → preview helper OR authenticated Worker endpoint
  → versioned trip command / reservation command → refreshed TripSnapshot
  → Attractions planned state + Mine day timeline + Map itinerary panel
```

The Worker snapshot read includes reservations ordered by start time, then creation time. It never exposes another trip's data. Reservation records do not make unreviewed places visible: an optional `placeId` is only a relation, not a content publishing bypass.

## Failure handling

- Empty day: show a place select and a clear empty state.
- No unplanned reviewed place: disable the add action and explain that every reviewed place is already scheduled.
- Concurrent trip change: return version conflict, keep the local view unchanged, and prompt refresh.
- Membership/role denial: return forbidden; no optimistic mutation persists.
- Reservation time invalid: return validation feedback before writing.
- Map lacks a stop coordinate: retain the itinerary item with a clear non-map state.
- Tavily unavailable/absent: retain reviewed local answer or explicit unable-to-confirm state; never invent a source.

## Verification

Each slice gets focused normal, permission-denied, conflict, and dependency-failure coverage where its API writes require it. The final gate covers the Mine add-to-Day-2, remove, keyboard reorder, drag reorder, reservation lifecycle, Map synchronization, 390px layout, and the existing Attractions flow. It also runs typecheck, lint, tests, database verification for new command functions, and production builds.
