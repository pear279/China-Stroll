# Private Places and Map Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let an active editor create trip-scoped private places (hotel, restaurant, meeting point, other), link them to a day and a reservation, render them with a distinct trust label on the map, and record the formal basemap attribution and Beijing fallback.

**Architecture:** A new `private_places` table keeps user-created locations separate from the reviewed `places` pipeline. Stops and reservations gain a nullable `private_place_id` so they can link to either a reviewed place or a trip-scoped private place through one product place identity. The map renders private markers with a distinct style and never invents coordinates. The existing MapLibre/mapcn wrapper stays the visual boundary; final acceptance records basemap attribution, license, and Beijing availability.

**Tech Stack:** React 19, TypeScript, Hono, Supabase PostgreSQL 17/Auth/RLS, MapLibre/mapcn, Zod, Vitest, transactional SQL tests.

**Spec:** `docs/superpowers/specs/2026-09-01-mvp-function-completion-design.md`

## Global Constraints

- Private places are a separate trust class; they are never returned by public place APIs or described as reviewed.
- `placeId`, WGS84 coordinates, and product route types stay provider-neutral.
- The product never invents a coordinate for a location that lacks one.
- Every private-place write uses role, command-id, expected-version, and change-log checks where a trip version is involved.
- AI has no write path to private places.

---

### Task 1: Private Place Data Model and Commands

- [ ] Add `private_places` table and RLS (active members read; owner/editor create/update).
- [ ] Add `private_place_id` to `trip_stops` and `reservations`.
- [ ] Add `create_mvp_private_place` (trip-scoped, idempotent, editor/owner) and an `add_private_stop` change path.
- [ ] Add transactional SQL tests for permission, RLS, and non-reviewed isolation.

### Task 2: Private Place Contracts and Endpoints

- [ ] Add shared `PrivatePlace` and `PrivatePlaceInput` types and Zod schemas.
- [ ] Add Worker routes: create private place and list trip private places; include private stops/reservations in the trip snapshot.
- [ ] Add typed web API methods.

### Task 3: Mine and Map UI

- [ ] Add a Mine private-place creator (name, type, optional address/coordinate/notes) and add-to-day.
- [ ] Render private stops with a distinct trust label and marker style; keep coordinate-less stops as text.

### Task 4: Basemap Attribution and Package Checkpoint

- [ ] Record formal basemap attribution, license, and Beijing fallback in `ARCHITECTURE.md` and the map boundary.
- [ ] Run the minimum gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run db:verify`, `git diff --check`.
- [ ] Update `ARCHITECTURE.md`, `TASKS.md`, and the roadmap; commit context.
