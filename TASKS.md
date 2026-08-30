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

- [ ] Task 7 — Complete itinerary editing and reservations in Mine
  - Goal: make the itinerary and reservation data models usable.
  - Files: trip/stop/reservation endpoints, database commands, Mine screens and tests.
  - Acceptance: add, edit, move and remove stops; create/update/delete reservations; version, role and idempotency rules hold; AI only drafts reservation fields.
  - Test: SQL rollback tests, API tests and mobile UI flow.

- [ ] Task 8 — Complete Map 1.0
  - Goal: provide a map-first trip and nearby-place workflow.
  - Files: Map module, `TravelMap`, navigation action sheet, map/route adapters and tests.
  - Acceptance: trip places, food and hotels share product place identity; marker selection shows Navigate/Cancel; nearby list and map remain synchronized; formal basemap passes license and Beijing network checks.
  - Test: component/browser tests and Beijing device navigation checks.

- [ ] Task 9 — Add opt-in associated-user location sharing
  - Goal: allow a member to explicitly share an expiring current location with accepted trip members.
  - Files: Supabase migration/RLS, Worker endpoints, Map/Mine switch, browser geolocation controller and tests.
  - Acceptance: default off; only associated members can read; switching off stops updates and revokes visibility; removed members lose access; denial and expiry states are clear.
  - Test: SQL permission tests, API tests and two-account browser test.

- [ ] Task 10 — Build Tools 1.0
  - Goal: provide travel essentials even when AI is unavailable.
  - Files: Tools screens, static emergency content, exchange-rate/translation adapters and tests.
  - Acceptance: payment guidance, timestamped exchange rate, common phrases, translation and service numbers have loading/error/offline behavior.
  - Test: adapter tests, offline check and mobile UI review.

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
