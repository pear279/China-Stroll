# Complete Itinerary and Reservation Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every stop and trip-day field editable in Mine, allow cross-day movement, and add an AI reservation draft that never writes.

**Architecture:** Stop field edits and cross-day moves ride the existing `apply_mvp_trip_changes` command boundary with `update_stop`/`move_stop` operations extended for `transportMode` and `notes`. Day edits use a new versioned `update_mvp_trip_day` command. AI reservation drafting is a read-only Worker route that returns an unsaved `ReservationInput`; it cannot call a reservation write command.

**Tech Stack:** React 19, TypeScript, Hono, Supabase PostgreSQL 17/Auth/RLS, SiliconFlow chat adapter, Zod, Vitest, transactional SQL tests.

**Spec:** `docs/superpowers/specs/2026-09-01-mvp-function-completion-design.md`

## Global Constraints

- `placeId`, WGS84 coordinates, and product route types stay provider-neutral.
- AI returns drafts only; only the normal user Save action invokes a mutation.
- Every stop/day write keeps role, command-id, expected-version, and change-log checks.
- Offline writes are never queued or replayed.
- Preview mode mirrors each account transition with an equivalent deterministic local transition.

---

### Task 1: Stop and Day Contracts

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.test.ts`

- [ ] Add `transportMode` and `notes` to `TripStop`; add `notes` to `TripDay`.
- [ ] Extend the `update_stop` agent-change contract with optional `transportMode` and `notes`; add an `update_day` change shape when needed by preview.
- [ ] Commit contracts.

### Task 2: Extend Stop and Day Commands

**Files:**
- Create: `supabase/migrations/20260901170000_extend_trip_edits.sql`
- Create: `supabase/tests/mvp_trip_edit_commands.sql`
- Modify: `supabase/database.types.ts`
- Modify: `scripts/verify-local-database.sh`

- [ ] Extend `private.apply_mvp_changes` `update_stop` to set `transport_mode` and `notes`; keep `move_stop` cross-day with destination sort order.
- [ ] Add `update_mvp_trip_day` (versioned, editor/owner, idempotent) for date/title/notes edits.
- [ ] Add transactional SQL tests for permission, conflict, idempotency, invalid times, and day-edit validation.
- [ ] Run `npm run db:verify`.
- [ ] Commit commands.

### Task 3: Worker Endpoints and Reservation Draft

**Files:**
- Modify: `apps/worker/src/index.ts`, `apps/worker/src/contracts.ts`, `apps/worker/src/index.test.ts`
- Modify: `apps/worker/src/siliconflow.ts` (reuse chat adapter)
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/lib/api.test.ts`

- [ ] Add `PATCH /v1/trips/:tripId/days/:dayId` (update day) and keep the stop PATCH boundary.
- [ ] Add `POST /v1/trips/:tripId/reservation-drafts` returning a structured `ReservationInput`; provider failure returns an explicit unavailable state and never writes.
- [ ] Add typed web transport methods.
- [ ] Commit endpoints.

### Task 4: Mine Editing UI

**Files:**
- Modify: `apps/web/src/features/me/MineView.tsx`, `MineView.test.tsx`
- Modify: `apps/web/src/app-shell/AppShell.tsx`, `apps/web/src/app-shell/types.ts`
- Modify: `apps/web/src/App.tsx`, `apps/web/src/styles.css`

- [ ] Add stop field editing (start time, duration, transport, notes) and cross-day move controls.
- [ ] Add trip-day date/title/notes editing.
- [ ] Add the AI reservation draft action with an editable, explicitly unsaved form.
- [ ] Keep loading/empty/error/success and 390px states.
- [ ] Commit UI.

### Task 5: Package Context and Interface Checkpoint

- [ ] Run the minimum gate: `npm run typecheck`, `npm run lint`, `npm test`, `npm run db:verify`, `git diff --check`.
- [ ] Confirm no write path is reachable from the AI draft and preview mirrors account transitions.
- [ ] Update `ARCHITECTURE.md`, `TASKS.md`, and the roadmap; commit context.
