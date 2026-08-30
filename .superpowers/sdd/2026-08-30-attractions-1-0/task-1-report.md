implementation summary

- Added `packages/shared/src/place-contracts.ts` as the shared place-contract boundary for place payloads, catalog payloads, citations, question/recommendation contracts, and runtime Zod schemas.
- Moved place-related shared exports behind `packages/shared/src/index.ts` so existing consumers still import from the package entry point, while keeping `Coordinate`, `Locale`, trip types, and itinerary helpers in `index.ts`.
- Added focused contract tests for the two required trust invariants and a package-entry-point re-export check.
- Updated the Worker place-question route to emit the expanded `PlaceQuestionResponse` shape so full typecheck passes before later source-normalization work.
- Updated `TASKS.md` and `ARCHITECTURE.md` to record the new shared contract boundary as Task 6 progress.

tests and exact results

- RED: `npx vitest run packages/shared/src/place-contracts.test.ts`
  - Result: failed as expected because `./place-contracts` did not exist.
  - Key output: `Failed to resolve import "./place-contracts" from "packages/shared/src/place-contracts.test.ts". Does the file exist?`
- GREEN: `npx vitest run packages/shared/src/place-contracts.test.ts packages/shared/src/index.test.ts`
  - Result: passed.
  - Exact summary:
    - `Test Files  2 passed (2)`
    - `Tests  14 passed (14)`
- Final verification: `npx vitest run packages/shared/src/place-contracts.test.ts packages/shared/src/index.test.ts && npm run typecheck`
  - Result: passed.
  - Exact summary:
    - `Test Files  2 passed (2)`
    - `Tests  14 passed (14)`
    - `> tsc -p apps/web/tsconfig.json --noEmit && tsc -p apps/worker/tsconfig.json --noEmit`
    - exit code `0`
- Additional hygiene: `git diff --check`
  - Result: passed with no whitespace or patch-format errors.

RED and GREEN TDD evidence

- RED 1: added `packages/shared/src/place-contracts.test.ts`, then ran the focused test and observed the missing-module failure before creating any production implementation file.
- GREEN 1: created `packages/shared/src/place-contracts.ts`, updated the shared entry point and re-export test, then reran the focused shared tests and saw `14 passed`.
- RED 2: ran `npm run typecheck` after the contract change and observed the Worker compatibility failure at `apps/worker/src/index.ts(497,9)` because the route still returned the legacy `PlaceQuestionResponse` shape.
- GREEN 2: updated the Worker route to emit the new response fields, then reran the same focused tests plus full typecheck and got exit code `0`.

files changed

- `packages/shared/src/place-contracts.ts`
- `packages/shared/src/place-contracts.test.ts`
- `packages/shared/src/index.ts`
- `packages/shared/src/index.test.ts`
- `apps/worker/src/index.ts`
- `TASKS.md`
- `ARCHITECTURE.md`

self-review findings

- No blocking findings in the shared contract extraction, schema wiring, or entry-point re-export.
- The catalog schema now enforces the required 20-entry per-locale invariant and unique place IDs per locale.
- `PlaceSummary` keeps the migration fields optional in the cross-mode TypeScript type while `placeCatalogEntrySchema` requires them through `placeCatalogSummarySchema`, matching the brief.
- `index.ts` exports only `place-contracts` for the new shared place boundary and does not export `place-discovery`, matching the ruling needed for Task 1 typecheck.

concerns

- The Worker compatibility edit intentionally uses empty normalized `sources` arrays for local/model-grounded answers for now. That keeps the contract shape consistent for typecheck, but the full citation-normalization behavior still belongs to the later Worker catalog/source task.
