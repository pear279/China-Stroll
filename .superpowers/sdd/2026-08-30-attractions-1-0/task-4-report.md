# Task 4 Report — Static and API Place Repositories

## Implementation

- Added `PlaceRepository` plus `createPlaceRepository`, `StaticPlaceRepository`, and `ApiPlaceRepository` under `apps/web/src/data/`.
- `StaticPlaceRepository` loads `/data/places-v1.json` once, validates it with `placeCatalogSchema`, recomputes every guide citation and visit record `needsRecheck` with runtime `isReviewOverdue(reviewDueAt)`, serves list/detail/guide from the curated catalog, avoids online fallback for reviewed local answers, converts dependency failures on unmatched questions into `unable-to-confirm` / `search-unavailable`, and falls back to deterministic ranking when recommendations cannot reach the Worker.
- Updated `apps/web/src/lib/api.ts` so place questions use the request-object shape and both question/recommendation requests omit `Authorization` when no token exists.
- Replaced the preview-only three-place Attractions source in `apps/web/src/App.tsx` with repository-based loading for both preview and account modes while keeping preview trip/save behavior intact.
- Injected the repository through `AppShellProps` so `PlaceDetailPanel` also uses the static/API repository abstraction for detail, guide, and place-question loading.
- Updated `TASKS.md` progress for Attractions 1.0 with the repository milestone.

## RED / GREEN Evidence

- RED 1: `npx vitest run apps/web/src/data/placeRepository.test.ts` failed with `Cannot find module './staticPlaceRepository'`.
- RED 2: `npx vitest run apps/web/src/lib/api.test.ts` failed because `askPlace` emitted `Authorization: Bearer null`, encoded `[object Object]` in the question path, and `api.recommendPlaces` did not exist.
- GREEN: `npx vitest run apps/web/src/data/placeRepository.test.ts apps/web/src/lib/api.test.ts apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck` passed with 3 test files, 17 tests, and clean web/worker TypeScript checks.

## Exact Tests / Results

- `npx vitest run apps/web/src/data/placeRepository.test.ts` → PASS (5 tests)
- `npx vitest run apps/web/src/lib/api.test.ts` → PASS (6 tests)
- `npx vitest run apps/web/src/app-shell/AppShell.test.tsx` → PASS (6 tests)
- `npx vitest run apps/web/src/data/placeRepository.test.ts apps/web/src/lib/api.test.ts apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck` → PASS (17 tests + `tsc -p apps/web/tsconfig.json --noEmit && tsc -p apps/worker/tsconfig.json --noEmit`)
- `git diff --check` → PASS

## Files

- Added: `apps/web/src/data/placeRepository.ts`
- Added: `apps/web/src/data/staticPlaceRepository.ts`
- Added: `apps/web/src/data/apiPlaceRepository.ts`
- Added: `apps/web/src/data/placeRepository.test.ts`
- Updated: `apps/web/src/lib/api.ts`
- Updated: `apps/web/src/lib/api.test.ts`
- Updated: `apps/web/src/App.tsx`
- Updated: `apps/web/src/components/PlaceDetailPanel.tsx`
- Updated: `apps/web/src/app-shell/types.ts`
- Updated: `apps/web/src/app-shell/AppShell.tsx`
- Updated: `apps/web/src/app-shell/AppShell.test.tsx`
- Updated: `TASKS.md`

## Self-Review

- Confirmed the static repository never calls the online fallback for reviewed local matches.
- Confirmed unmatched local questions degrade to typed `unable-to-confirm` responses when the Worker/network dependency is unavailable.
- Confirmed preview and account Attractions both read through one repository abstraction and preview trip/save local storage behavior remains untouched.
- Confirmed guide/detail data paths now share the same repository injection used by the list view.

## Concerns

- `api.recommendPlaces` is transport-ready and covered by request tests, but no UI flow consumes recommendations yet in this task.
- I ran the focused repository/API/AppShell tests plus full typecheck requested by the brief; I did not run the full lint/test/build gate in this scoped task.
