# China Stroll MVP Function Completion Roadmap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement each linked package plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete every confirmed MVP function before one unified product acceptance and release gate.

**Architecture:** Delivery follows five vertical packages. Each package produces usable frontend, API, persistence/provider, feedback, and minimum interface checks; exhaustive cross-module browser acceptance stays in Package 6.

**Tech Stack:** React 19, TypeScript, Vite 8, Hono, Supabase PostgreSQL 17/Auth/RLS/Storage, Cloudflare Workers, MapLibre/mapcn, PWA, Zod, Vitest, oxlint.

**Spec:** `docs/superpowers/specs/2026-09-01-mvp-function-completion-design.md`

## Global Constraints

- Public reviewed attractions and private user-created locations are separate trust classes.
- `placeId`, WGS84 coordinates, and product route types remain provider-neutral.
- AI returns drafts or proposals only and never directly mutates trips, reservations, membership, profiles, privacy, or records.
- Every trip mutation retains permission, expected-version, command-id, idempotency, and change-log checks.
- Unknown provider facts remain unknown; no fake exchange rate, translation, phone number, coordinate, booking, price, or availability is displayed.
- Place display images continue to use only `data/processed/place-display-images`.
- Development uses minimal package-level checks; final mobile, weak-network, two-account, full build, and release acceptance run in Package 6.

---

### Package 1: Account, Profile, and Trip Members

**Detailed plan:** `docs/superpowers/plans/2026-09-01-account-profile-trip-members.md`

- [ ] Profile read/update for display name, locales, country, and bounded travel preferences.
- [ ] Expiring single-use editor/viewer invitation links with hashed tokens.
- [ ] Authenticated invitation preview/acceptance, invitation revoke, and member removal.
- [ ] Mine profile/member UI and immediate refresh of location-sharing recipient context.

### Package 2: Complete Itinerary and Reservation Editing

- [ ] Create a detailed package plan from the approved spec before changing code.
- [ ] Stop time/duration/transport/notes editing and cross-day movement.
- [ ] Trip-day date/title/notes editing.
- [ ] AI reservation parsing to an editable, explicitly unsaved draft.
- [ ] Refresh the shared trip snapshot after account writes and mirror transitions in preview.

### Package 3: Tools 1.0

- [ ] Create a detailed package plan from the approved spec before changing code.
- [ ] Offline-reviewed payment guidance, common phrases, and service contacts.
- [ ] Timestamped exchange quote adapter and UI with honest unavailable state.
- [ ] Bounded text translation adapter and UI with copy/swap controls.
- [ ] Selected-place navigation and ride-provider deep links without booking claims.

### Package 4: Private Places and Map Completion

- [ ] Create a detailed package plan from the approved spec before changing code.
- [ ] Trip-scoped private place identity and RLS for hotel, restaurant, meeting point, and other stops.
- [ ] Private-place creation, itinerary/reservation linking, marker styling, and navigation.
- [ ] Formal basemap attribution, Beijing network fallback, and license record.

### Package 5: Private Records and Offline Reading

- [ ] Create a detailed package plan from the approved spec before changing code.
- [ ] Private text/photo records with user-scoped metadata and storage policies.
- [ ] Upload progress, EXIF-aware processing, signed reads, and deletion.
- [ ] Versioned, schema-validated read cache for active trip, reservations, place detail/guide, phrases, and emergency guidance.
- [ ] Explicit offline labels and disabled non-replayed write/provider actions.

### Package 6: Unified Acceptance and Release

- [ ] Create an acceptance checklist directly from Product success criteria and all five package reports.
- [ ] Run two-account invitation, membership removal, trip permission, and location-sharing flows.
- [ ] Run 390px and desktop normal/empty/error/weak-network/offline walkthroughs across all modules.
- [ ] Check navigation providers, basemap attribution, Beijing network behavior, media privacy, sources, secrets, and logs.
- [ ] Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run db:verify`.
- [ ] Update `TASKS.md` and `ARCHITECTURE.md`, then request explicit merge/push/release authorization.

