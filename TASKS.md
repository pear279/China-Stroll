# China Stroll Tasks

This file is the authoritative implementation plan. A task is complete only when its acceptance criteria and test method pass and the result is recorded here.

## Current Milestone — Four-module trustworthy-place MVP

- [x] Task 0 — Confirm the current product baseline
  - Goal: align the product to Attractions, Map, Tools and Mine.
  - Files: `PRODUCT.md`.
  - Acceptance: the four modules, image policy, opt-in associated-user location sharing and staged community scope are explicit.
  - Test: product review against the user's confirmed decisions.

- [x] Task 1 — Persist project context and working rules
  - Goal: make current intent, architecture, plan and agent rules available to every future session.
  - Files: `PRODUCT.md`, `ARCHITECTURE.md`, `TASKS.md`, `AGENTS.md`.
  - Acceptance: root context files exist; they declare precedence over conflicting legacy references.
  - Test: read each file from a fresh repository session before coding.

- [x] Task 2 — Repair the local development environment
  - Goal: replace dependencies copied from another Mac with dependencies installed from `package-lock.json` on this machine.
  - Files: ignored `node_modules`; documentation if runtime constraints change.
  - Steps: run `npm ci`, confirm native bindings load, run the standard verification commands.
  - Acceptance: typecheck, lint, 51+ tests and all production builds run without native-binding or transferred-file failures.
  - Test: `npm run build`.
  - Verified: `npm ci` installed 514 packages on the current Apple-silicon Mac; `npm run build` passed typecheck, lint, 51 tests, web build, Pages Functions build and Worker dry-run on 2026-08-30.

- [x] Task 3 — Make display illustrations the only place-image source
  - Goal: remove real photographs from the web build path and publish one generated display image per place.
  - Files: `scripts/prepare_place_display_images.*`, `apps/web/public/places/*`, shared image resolver and tests.
  - Steps: validate 52 mappings, handle the `forbidden-city`/`palace-museum` alias, generate optimized public assets, remove or overwrite former photograph assets, add a deterministic manifest/check.
  - Acceptance: every known place resolves to a display illustration; no asset derived from `data/50景点图片附件` remains in the public places directory.
  - Test: image mapping test plus production build inspection.
  - Verified: 52 source illustrations deterministically generated as 960px WebP (about 6.2 MB total); manifest/hash verification, 51 tests and the web production build passed on 2026-08-30.

- [x] Task 4 — Build the first-20 curated place data package
  - Goal: make 20 reviewed Beijing places reproducibly available in a clean local database.
  - Files: curated JSON package, validator/generator scripts, generated Supabase migration, data tests and source documentation.
  - Steps: verify WGS84/OSM display points; review official address, opening, ticket, booking and entrance facts; prepare `zh-CN` and `en`; validate field-source mappings; generate migration.
  - Acceptance: exactly 20 places meet the publishing gate and the other 32 remain unavailable through the public list.
  - Test: deterministic validator, `npm run db:verify`, public list/detail API test.
  - Verified: deterministic 20-place JSON/SQL and migration created; two clean PostgreSQL 17 rebuilds, transactional SQL tests, anonymous RLS counts (20 places/40 localizations/40 visit records) and source-link assertions passed on 2026-08-30. Fast-changing opening, ticket and booking facts are intentionally marked for official recheck rather than asserted.

- [x] Task 5 — Implement the four-module application shell
  - Goal: replace the planner-only information architecture without losing current features.
  - Files: web module components, navigation state/router, styles and UI tests.
  - Steps: extract Attractions, Map, Tools and Mine views; add mobile bottom navigation; share trip/place selection state; preserve loading/empty/error/success states.
  - Acceptance: all four entry points are obvious at 390px; existing discovery, map and itinerary flows remain usable.
  - Test: component tests, production build and mobile screenshots.
  - Verified: React Router routes `/attractions`, `/map`, `/tools` and `/me`, shared place/day/filter/location state, persistent accessible bottom navigation and Pages direct loads passed on 2026-08-30. The complete gate passed 16 test files/65 tests, 20-place deterministic validation, 52-image verification, typecheck, zero-warning lint, Web/Functions/Worker builds and two clean PostgreSQL 17 rebuilds with 20/40/40 RLS assertions. Playwright at 390×844 found no horizontal overflow on any module; denied location kept all three preview places usable; the final attraction action retained 44px clearance above the fixed navigation; keyboard focus order and visible focus passed. Tools exposes only real emergency links and reviewed guidance; unsupported provider actions and location sharing remain visibly unavailable.

- [ ] Task 6 — Complete Attractions 1.0
  - Goal: deliver current/nearby place, filters, detail, save, add-to-day, guide and recommendation as one coherent module.
  - Files: Attractions module, API client/Worker endpoints, shared contracts and tests.
  - Acceptance: a user can find one of 20 places, understand its source/review status and add it to a selected day in three actions or fewer.
  - Test: normal, empty, denied-location, AI-unavailable and mobile paths.
  - Progress 2026-08-30: shared place contracts and trust invariants landed in `packages/shared/src/place-contracts.ts`; deterministic place discovery, reviewed local Q&A retrieval, preference inference and recommendation ranking landed in `packages/shared/src/place-discovery.ts`; static/API place repositories now back the full 20-place catalog in preview and account modes, recompute runtime freshness flags from the catalog artifact, avoid `Authorization: Bearer null`, and passed focused repository/API/AppShell tests plus full app/Worker typecheck in the Attractions 1.0 worktree.
  - Progress 2026-08-31: Attractions now applies shared reviewed-text query/category/duration/radius filtering in the shell, exposes an accessible search/reset flow, renders recommendation chips plus reviewed/AI result labels through `PlaceRepository.recommendPlaces`, and surfaces review-due metadata on cards without changing place identity or image sourcing. Focused Attractions/AppShell tests, fresh `typecheck`, fresh `lint`, and manual desktop plus 390px browser screenshots passed in the Attractions 1.0 worktree.
  - Progress 2026-08-31 review fix: recommendation requests now use the active `visiblePlaces` set as `candidatePlaceIds` while retaining full-place lookup for returned result cards, and the Attractions/AppShell tests now cover filtered candidates, deterministic vs AI labels, chip `aria-pressed` changes, and Add-to-Day using the selected day. Fresh focused tests, `typecheck`, and `lint` passed in the Attractions 1.0 worktree.
  - Progress 2026-08-31 detail/Q&A slice: the place detail panel now loads reviewed detail and guide content through the injected repository with stale-request guards, renders full reviewed fact sections plus linked source cards and recheck warnings, allows signed-out preview questions against local reviewed content, shows the required reviewed/web/unconfirmed trust modes with citations and retrieval time, and restores focus to the detail opener on close. Fresh `PlaceDetailPanel`/repository/AppShell tests, `typecheck`, and `lint` passed in the Attractions 1.0 worktree.
  - Progress 2026-08-31 Worker search boundary: the Worker now has a bounded Tavily adapter that validates responses, returns only public HTTPS citations, strips fragments and never fetches result pages. Reviewed local questions remain public; immediately before an external SiliconFlow/Tavily request, the Worker applies the explicit anonymous policy and the `PLACE_AI_RATE_LIMITER` binding (10 requests per 60 seconds). Fresh adapter/auth-boundary tests, `typecheck`, `lint`, and Worker dry run passed in the Attractions 1.0 worktree.
  - Progress 2026-08-31 local-first answer path: `POST /v1/places/:placeId/questions` now returns the matching reviewed document with its verified citations first. On a local no-match it uses Tavily only when configured, retains the citations and retrieval time in a `web-grounded` response, and otherwise returns an explicit unable-to-confirm state. Focused intelligence/adapter/auth-boundary tests, `typecheck`, `lint`, and Worker dry run passed in the Attractions 1.0 worktree.
  - Progress 2026-08-31 recommendation endpoint: `POST /v1/place-recommendations` now validates the bounded preference/location/time/candidate scope, rejects unavailable candidate IDs, and ranks only published locale-matched places through the shared deterministic ranking rules. When a SiliconFlow key is configured, it can add short explanations only for the already-ranked top five IDs; unknown/duplicate model IDs are rejected and any provider failure retains the deterministic response. Fresh `typecheck`, `lint`, and Worker dry run passed in the Attractions 1.0 worktree.

- [ ] Task 7 — Complete itinerary editing and reservations in Mine
  - Goal: make the itinerary and reservation data models usable.
  - Files: trip/stop/reservation endpoints, database commands, Mine screens and tests.
  - Acceptance: add, edit, move and remove stops; create/update/delete reservations; version, role and idempotency rules hold; AI only drafts reservation fields.
  - Test: SQL rollback tests, API tests and mobile UI flow.
  - Progress 2026-08-31: preview itinerary helpers now accept the full reviewed place catalog rather than the legacy three-place sample, and support pure remove/reorder state transitions with version increments. The account transport now has a versioned `PATCH` client boundary ready for the Worker route. Focused preview tests and typecheck passed in the Attractions worktree.
  - Progress 2026-08-31: authenticated `PATCH /v1/trips/:tripId/stops` now sends bounded existing change operations through `apply_mvp_trip_changes` with `edit_itinerary` audit type, retaining role, command-id, expected-version, and change-log checks. Focused Worker contract/route tests, typecheck, and Worker dry run passed in the Attractions worktree.
  - Progress 2026-08-31: Mine now lets a traveler select an unscheduled reviewed attraction for the active day, automatically focuses a newly created day, removes stops, and reorders stops with drag or accessible up/down controls. Preview persists these changes locally; account mode sends remove or normalized move commands through the versioned Worker endpoint. Focused Mine/AppShell/demo tests (16 assertions) and typecheck passed in the Attractions worktree.
  - Progress 2026-08-31: reservations are now included in trip snapshots and have versioned create/update/delete Worker boundaries backed by a new service-role-only reservation command migration. Mine supplies the full controlled reservation form and list in preview and account modes; AI remains absent from the write path. Focused web/Worker tests (36 assertions), typecheck, and Worker dry run passed. `db:verify` is pending because Docker/OrbStack is unavailable on this Mac.
  - Progress 2026-08-31: Mine now filters the reservation list by its shared selected day, so selecting a date consistently shows that day’s itinerary and associated bookings.

- [ ] Task 8 — Complete Map 1.0
  - Goal: provide a map-first trip and nearby-place workflow.
  - Files: Map module, `TravelMap`, navigation action sheet, map/route adapters and tests.
  - Acceptance: trip places, food and hotels share product place identity; marker selection shows Navigate/Cancel; nearby list and map remain synchronized; formal basemap passes license and Beijing network checks.
  - Test: component/browser tests and Beijing device navigation checks.
  - Progress 2026-08-31: Map now presents an independent selected-day itinerary panel above nearby reviewed places. It retains the shared day/place selection state, orders stops by `sortOrder`, highlights the matching stop, and leaves coordinate-less stops as explicit text rather than inventing markers. Focused Map/AppShell tests (11 assertions) and typecheck passed in the Attractions worktree.
  - Progress 2026-08-31: Map date tabs now update the shared active day and show both the matching itinerary and associated reservations. Attractions adds an explicit target-day selector for new-place additions. Focused Attractions/Map/Mine/AppShell tests (19 assertions) and typecheck passed in the Attractions worktree.

- [ ] Task 9 — Add opt-in associated-user location sharing
  - Goal: allow a member to explicitly share an expiring current location with accepted trip members.
  - Files: Supabase migration/RLS, Worker endpoints, Map/Mine switch, browser geolocation controller and tests.
  - Acceptance: default off; only associated members can read; switching off stops updates and revokes visibility; removed members lose access; denial and expiry states are clear.
  - Test: SQL permission tests, API tests and two-account browser test.
  - Progress 2026-09-01: trip-scoped sharing preferences and one expiring current-point row per member are now protected by active-member RLS and service-role-only commands. Enable/disable and uploads serialize per trip member, preventing an overlapping upload from surviving revocation. Authenticated Worker boundaries expose enable/disable, current-point refresh, and server-filtered peer reads without changing trip versions or logging coordinates. Mine provides the default-off foreground sharing switch with permission, upload, expiry, revoke and retry states. While mounted, the shared controller refreshes peer snapshots periodically with single-flight and stale-scope guards; Map renders unexpired peer points as distinct identity markers with relative update/expiry context and never draws a member trail. Focused database, Worker, controller, Mine and Map tests plus typecheck/lint passed; final two-account browser verification remains before checking Task 9 complete.

- [ ] Task 10 — Build Tools 1.0
  - Goal: provide travel essentials even when AI is unavailable.
  - Files: Tools screens, static emergency content, exchange-rate/translation adapters and tests.
  - Acceptance: payment guidance, timestamped exchange rate, common phrases, translation and service numbers have loading/error/offline behavior.
  - Test: adapter tests, offline check and mobile UI review.

- [x] Package 1 — Account, Profile, and Trip Members (2026-09-01)
  - Goal: profile read/update, single-use hashed invitation links, invitation preview/accept/revoke, member removal, and the Mine account UI.
  - Files: `supabase/migrations/20260901090000_add_mvp_member_commands.sql`, member/invitation Worker endpoints, `ProfileCard`, `TripMembersCard`, `JoinTripView`, `useLocationSharing.refresh`.
  - Verified: two clean PostgreSQL 17 rebuilds with five service-role-only member/invitation commands and transactional permission/RLS/expiry/revoke/atomic-accept/concurrency tests; Worker profile/member/invitation routes store only SHA-256 token hashes; Mine account UI and the `/join/:token` accept flow. typecheck, lint, 207 tests, web/Functions/Worker builds, and `db:verify` passed on 2026-09-01. Two-account browser acceptance remains in Package 6.

## Later Milestone

- [ ] Private photo and travel records.
- [ ] Friend-visible/public records after visibility and privacy validation.
- [ ] Public place community after moderation, reporting and blocking are designed.
- [ ] Audio guide and richer multimodal translation.
- [ ] Additional cities and languages after Beijing MVP validation.

## Quality Gate for Every User-facing Task

- Entry point and wording are understandable.
- Loading, empty, error and success states exist.
- Permission denial and external-service failure have a usable fallback.
- Mobile width 390px has no horizontal overflow.
- Main actions are keyboard accessible and do not rely on color alone.
- Tests/build output is recorded before checking the task complete.
