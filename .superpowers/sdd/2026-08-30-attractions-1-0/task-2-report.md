# Task 2 Report — Generate and Verify the 20-place Browser Catalog

## Implementation summary

- Added `scripts/build_place_catalog.mjs` with deterministic `build` and `verify` commands.
- Generated `apps/web/public/data/places-v1.json` from the curated first-20 package and display-image manifest.
- Mapped both `en` and `zh-CN` entries to shared catalog contracts, including summaries, details, visit freshness, guides, citations, search documents, and manifest-backed display images.
- Added HTTPS source validation, exact generated-text verification, unique curated IDs per locale, and display-image mapping checks.
- Added `catalog:prepare` and `catalog:verify` scripts and included the catalog verifier in the production build gate.
- Added JSON to the Vite PWA precache glob.

## Tests and exact results

- `npx vitest run packages/shared/src/place-contracts.test.ts` — PASS, 1 file / 9 tests.
- `npm run catalog:prepare` — PASS; wrote 20 English and 20 Chinese entries.
- `npm run catalog:verify` — PASS; verified 20 English and 20 Chinese entries.
- `npm run build:web` — PASS; Vite output included `dist/web/data/places-v1.json` and the generated service worker precache list included `data/places-v1.json`.
- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm test` — PASS, 17 files / 75 tests.
- Re-running `catalog:prepare` produced the same SHA-256 (`78c0122174d3ff8dc8c9a3499bd2bc550e461f5741a7387eea2bb5072bde7385`).

## RED/GREEN evidence

- RED: before the artifact existed, the committed-artifact test failed with `ENOENT` for `apps/web/public/data/places-v1.json`.
- GREEN: after implementing the generator and artifact, the focused contract test passed with 9/9 tests.

## Files changed

- `scripts/build_place_catalog.mjs`
- `apps/web/public/data/places-v1.json`
- `packages/shared/src/place-contracts.test.ts`
- `package.json`
- `apps/web/vite.config.ts`

## Self-review

- Output ordering follows curated package order and is generated with `JSON.stringify(catalog, null, 2) + "\\n"`.
- Citation and visit freshness are compared against curated `checkedAt`, never the current clock.
- Display paths come from the approved manifest; no photograph source is read.
- Catalog IDs are checked against the exact curated ID sequence in both locale buckets.
- The test uses the Node Vitest environment because the repository-wide default `happy-dom` environment resolves `import.meta.url` to an HTTP URL, which Node `readFile` cannot consume.

## Concerns

None. Runtime freshness recomputation remains intentionally deferred to Task 4 as specified.

## Fix Round 1

### Change

Search-document citations are now selected from curated `factScope` values. Overview documents use identity/history scopes, visit documents use `visit_recheck`, and guide documents use narrative/review scopes. Coordinate-only `display_coordinate` sources are therefore excluded from all reviewed-local content documents. Regression assertions cover Tian'anmen overview, visit, and guide documents.

### Exact verification commands and results

- `npx vitest run packages/shared/src/place-contracts.test.ts` — first run after adding the regression test: FAIL, `expected [ 'tiananmen:official', …(1) ] to not include 'tiananmen:coordinate-1'`.
- `npm run catalog:prepare` — PASS; `Wrote apps/web/public/data/places-v1.json (20 English, 20 Chinese entries)`.
- `npx vitest run packages/shared/src/place-contracts.test.ts` — PASS, `Test Files 1 passed`, `Tests 10 passed`.
- `npm run catalog:verify` — PASS; `Catalog verified: 20 English and 20 Chinese entries`.
- `npm run typecheck` — PASS.
- `npm run build:web` — PASS; image verification reported `Verified 52 display illustrations; no photograph-format fallback assets found`; Vite and PWA generation completed with `precache 12 entries`.

### Changed files

- `scripts/build_place_catalog.mjs`
- `apps/web/public/data/places-v1.json`
- `packages/shared/src/place-contracts.test.ts`
