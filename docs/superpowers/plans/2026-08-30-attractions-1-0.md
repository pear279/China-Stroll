# Attractions 1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a 20-place Attractions module that works without the Worker for reviewed discovery and local Q&A, adds deterministic/AI-assisted recommendations, and uses source-cited web search only after local reviewed content has no match.

**Architecture:** Generate one committed, versioned browser catalog from the curated JSON and access it through the same `PlaceRepository` contract as the Worker API. Keep filtering, ranking, and reviewed-content matching as pure shared functions; keep secrets, Tavily search, rate limiting, and provider normalization in the Worker. Attractions and the detail panel consume repository methods and render typed trust states rather than branching on preview/account mode.

**Tech Stack:** TypeScript 7, React 19, Vite 8, Hono, Cloudflare Workers, Supabase, Zod 4, Vitest, Testing Library, Tavily Search API, SiliconFlow.

**Spec:** `docs/superpowers/specs/2026-08-30-attractions-1-0-design.md`

## Global Constraints

- Publish exactly 20 places from `data/curated/first-20-places.json`; do not publish the remaining 32 records.
- Use only display illustrations resolved from `data/processed/place-display-images` through the generated `/places/*.webp` manifest; do not add real photographs.
- `npm run dev:web` must support catalog, filters, details, guides, deterministic recommendations, and reviewed local Q&A without a Worker.
- Secret-backed web search requires the Worker; no AI or Tavily key may appear in a `VITE_*` variable or browser bundle.
- Attempt reviewed local retrieval before every web search.
- Render a web-grounded answer only when at least one valid clickable HTTPS citation exists.
- Do not perform arbitrary follow-up page fetches in this milestone.
- Location permission is a one-time nearby calculation and is not location sharing.
- Add-to-day must take no more than three user actions.
- Every user-facing flow must cover loading, empty, error, success, denied-location, AI-unavailable, search-unavailable, and 390px mobile states.
- Use test-driven development and commit after every task passes its focused test set.

---

## File Structure

### New files

- `apps/web/public/data/places-v1.json` — generated, committed browser catalog for both locales.
- `scripts/build_place_catalog.mjs` — deterministic curated-JSON-to-browser-catalog builder and verifier.
- `packages/shared/src/place-contracts.ts` — catalog, citation, question, repository, and recommendation types plus Zod schemas.
- `packages/shared/src/place-discovery.ts` — pure text filtering, reviewed-answer retrieval, and deterministic recommendation ranking.
- `packages/shared/src/place-contracts.test.ts` — runtime schema and trust-invariant tests.
- `packages/shared/src/place-discovery.test.ts` — bilingual search, retrieval-threshold, and recommendation tests.
- `apps/web/src/data/placeRepository.ts` — repository interface and typed dependency errors.
- `apps/web/src/data/staticPlaceRepository.ts` — cached catalog loader, local Q&A, and local recommendation fallback.
- `apps/web/src/data/apiPlaceRepository.ts` — API-backed repository implementation.
- `apps/web/src/data/placeRepository.test.ts` — static/API parity and browser-only behavior tests.
- `apps/web/src/features/attractions/RecommendationPanel.tsx` — preference chips, optional text, result reasons, and actions.
- `apps/web/src/features/attractions/RecommendationPanel.test.tsx` — recommendation interaction and fallback-state tests.
- `apps/web/src/components/PlaceSources.tsx` — reusable source cards and freshness labels.
- `apps/web/src/components/PlaceDetailPanel.test.tsx` — details, citations, local/web answer, and failure-state tests.
- `apps/worker/src/webSearch.ts` — `WebSearchProvider`, Tavily adapter, response normalization, and safe-URL filter.
- `apps/worker/src/webSearch.test.ts` — Tavily request, unsafe URL, malformed response, and timeout tests.
- `apps/worker/src/placeIntelligence.ts` — Worker orchestration for local retrieval, web fallback, and recommendation results.
- `apps/worker/src/placeIntelligence.test.ts` — local-first, cited-web-only, and deterministic-fallback tests.

### Modified files

- `package.json` — catalog prepare/verify scripts and build gate.
- `apps/web/vite.config.ts` — precache generated JSON.
- `packages/shared/src/index.ts` — re-export new place modules and remove superseded place contract definitions.
- `packages/shared/src/index.test.ts` — adjust fixtures for enriched summaries/citations.
- `apps/web/src/lib/api.ts` and `apps/web/src/lib/api.test.ts` — optional-auth question/recommendation calls and typed dependency responses.
- `apps/web/src/App.tsx` — construct the mode-appropriate repository and load all 20 preview places.
- `apps/web/src/app-shell/types.ts` — pass repository and recommendation state through the shell.
- `apps/web/src/app-shell/AppShell.tsx` and `apps/web/src/app-shell/AppShell.test.tsx` — search/filter/recommendation state and repository-driven details.
- `apps/web/src/features/attractions/AttractionsView.tsx`, `AttractionsView.test.tsx`, `PlaceFilters.tsx`, and `PlaceCard.tsx` — search, reset, review/distance metadata, and recommendations.
- `apps/web/src/components/PlaceDetailPanel.tsx` — repository reads, full reviewed facts, citations, and open preview Q&A.
- `apps/web/src/styles.css` — responsive search, recommendation, source, and detail states.
- `apps/worker/src/contracts.ts` and `apps/worker/src/contracts.test.ts` — question/recommendation validation.
- `apps/worker/src/index.ts` and `apps/worker/src/index.test.ts` — public rate-limited place intelligence routes.
- `apps/worker/src/siliconflow.ts` and `apps/worker/src/siliconflow.test.ts` — constrained recommendation explanation generation.
- `apps/worker/wrangler.jsonc` and `apps/worker/src/worker-configuration.d.ts` — Tavily secret typing, anonymous development policy, and rate-limit binding.
- `TASKS.md` — record Task 6 verification only after the complete gate passes.

---

### Task 1: Establish Shared Place Contracts and Trust Invariants

**Files:**
- Create: `packages/shared/src/place-contracts.ts`
- Create: `packages/shared/src/place-contracts.test.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.test.ts`

**Interfaces:**
- Consumes: existing `Coordinate`, `Locale`, `OpeningHours`, and place shapes from `packages/shared/src/index.ts`.
- Produces: `PlaceCatalog`, `PlaceCatalogEntry`, `PlaceSourceCitation`, `PlaceQuestionRequest`, `PlaceQuestionResponse`, `PlaceRecommendationInput`, `PlaceRecommendation`, `PlaceRecommendationResponse`, and `placeCatalogSchema`.

- [ ] **Step 1: Write failing schema and trust-invariant tests**

```ts
import { describe, expect, it } from "vitest"
import { placeCatalogSchema, placeQuestionResponseSchema } from "./place-contracts"

describe("place contracts", () => {
  it("rejects a web-grounded answer without clickable citations", () => {
    expect(() => placeQuestionResponseSchema.parse({
      answer: "The rule changed.",
      answerMode: "web-grounded",
      generatedBy: "web-search",
      sources: [],
      updatedAt: null,
      searchedAt: "2026-08-30T12:00:00.000Z",
      dependencyStatus: "ready",
    })).toThrow()
  })

  it("rejects a catalog that does not contain twenty entries per locale", () => {
    const result = placeCatalogSchema.safeParse({
      version: 1,
      checkedAt: "2026-08-30T00:00:00Z",
      reviewDueAt: "2026-09-29T00:00:00Z",
      locales: { en: [], "zh-CN": [] },
    })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test and verify the missing module failure**

Run: `npx vitest run packages/shared/src/place-contracts.test.ts`

Expected: FAIL because `./place-contracts` does not exist.

- [ ] **Step 3: Add the contracts and discriminated answer schema**

```ts
export type PlaceSourceCitation = {
  id: string
  name: string
  url: string
  publisher?: string
  publishedAt: string | null
  checkedAt: string
  reviewDueAt: string | null
  needsRecheck: boolean
  sourceType: "official" | "reviewed-reference" | "web"
}

export type PlaceQuestionResponse = {
  answer: string
  answerMode: "reviewed-local" | "model-grounded-local" | "web-grounded" | "unable-to-confirm"
  generatedBy: "deterministic-retrieval" | "model" | "web-search" | "none"
  sources: PlaceSourceCitation[]
  updatedAt: string | null
  searchedAt: string | null
  dependencyStatus: "ready" | "ai-unavailable" | "search-unavailable" | "no-reliable-sources"
  warning?: string
  sourceIds?: number[]
}

export const placeQuestionResponseSchema = z.object({
  answer: z.string().min(1),
  answerMode: z.enum(["reviewed-local", "model-grounded-local", "web-grounded", "unable-to-confirm"]),
  generatedBy: z.enum(["deterministic-retrieval", "model", "web-search", "none"]),
  sources: z.array(placeSourceCitationSchema),
  updatedAt: z.iso.datetime().nullable(),
  searchedAt: z.iso.datetime().nullable(),
  dependencyStatus: z.enum(["ready", "ai-unavailable", "search-unavailable", "no-reliable-sources"]),
  warning: z.string().optional(),
  sourceIds: z.array(z.number().int().positive()).optional(),
}).superRefine((value, context) => {
  if (value.answerMode === "web-grounded" && value.sources.length === 0) {
    context.addIssue({ code: "custom", path: ["sources"], message: "Web answers require a citation" })
  }
})
```

Define `PlaceCatalogEntry` as `{ summary, detail, guides, searchDocuments, displayImage }`. Add optional migration-safe fields `aliases`, `highlights`, `reviewedAt`, and `reviewDueAt` to `PlaceSummary`; require them in the catalog-entry schema while the Worker list mapper is upgraded in Task 8. Define the recommendation contracts exactly as follows and add `.length(20)` plus unique-ID refinements for both catalog locales.

```ts
export type PlaceQuestionRequest = {
  placeId: string
  locale: Locale
  question: string
}

export type PlaceRecommendationInput = {
  preferences: Array<"family" | "history" | "relaxed" | "photography" | "half-day">
  context: string
  locale: Locale
  coordinate: Coordinate | null
  radiusKm: 1 | 3 | 5 | null
  availableMinutes: number | null
  candidatePlaceIds: string[]
  plannedPlaceIds: string[]
}

export type PlaceRecommendation = {
  placeId: string
  score: number
  matchedSignals: string[]
  reason: string
  reasonMode: "deterministic" | "model"
}

export type PlaceRecommendationResponse = {
  results: PlaceRecommendation[]
  generatedBy: "deterministic" | "model"
  updatedAt: string
}
```

- [ ] **Step 4: Re-export contracts and remove duplicate place type declarations**

```ts
export * from "./place-contracts"
export * from "./place-discovery"
```

Keep `Coordinate`, `Locale`, trip types, image helpers, and existing itinerary helpers in `index.ts`; import/re-export the moved place types so existing consumers retain the same package entry point.

- [ ] **Step 5: Run shared tests and typecheck**

Run: `npx vitest run packages/shared/src/place-contracts.test.ts packages/shared/src/index.test.ts && npm run typecheck`

Expected: PASS with no duplicate export or fixture-shape errors.

- [ ] **Step 6: Commit the contract boundary**

```bash
git add packages/shared/src/place-contracts.ts packages/shared/src/place-contracts.test.ts packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat: define Attractions place contracts"
```

### Task 2: Generate and Verify the 20-place Browser Catalog

**Files:**
- Create: `scripts/build_place_catalog.mjs`
- Create: `apps/web/public/data/places-v1.json`
- Test: `packages/shared/src/place-contracts.test.ts`
- Modify: `package.json`
- Modify: `apps/web/vite.config.ts`

**Interfaces:**
- Consumes: `data/curated/first-20-places.json`, `apps/web/public/places/manifest.json`, and `placeCatalogSchema` semantics from Task 1.
- Produces: deterministic `apps/web/public/data/places-v1.json`; commands `npm run catalog:prepare` and `npm run catalog:verify`.

- [ ] **Step 1: Add a failing committed-artifact test**

```ts
import { readFile } from "node:fs/promises"

it("validates the generated browser catalog", async () => {
  const url = new URL("../../../apps/web/public/data/places-v1.json", import.meta.url)
  const payload = JSON.parse(await readFile(url, "utf8"))
  const catalog = placeCatalogSchema.parse(payload)
  expect(catalog.locales.en).toHaveLength(20)
  expect(catalog.locales["zh-CN"]).toHaveLength(20)
  expect(catalog.locales.en.every((entry) => entry.displayImage.startsWith("/places/"))).toBe(true)
})
```

- [ ] **Step 2: Run the test and verify the missing-file failure**

Run: `npx vitest run packages/shared/src/place-contracts.test.ts`

Expected: FAIL with `ENOENT` for `apps/web/public/data/places-v1.json`.

- [ ] **Step 3: Implement deterministic catalog mapping**

```js
function sourceCitation(place, source, checkedAt, reviewDueAt) {
  return {
    id: `${place.id}:${source.key}`,
    name: source.name,
    url: source.url,
    publisher: source.name,
    publishedAt: null,
    checkedAt: source.checkedAt ?? checkedAt,
    reviewDueAt: source.reviewDueAt ?? reviewDueAt,
    needsRecheck: Date.parse(source.reviewDueAt ?? reviewDueAt) <= Date.parse(checkedAt),
    sourceType: source.type === "official" ? "official" : "reviewed-reference",
  }
}

function localeEntry(place, locale, metadata) {
  const localization = place.localizations.find((item) => item.locale === locale)
  const visit = place.visitInformation.find((item) => item.locale === locale) ?? null
  const sources = place.sources.map((source) => sourceCitation(place, source, metadata.checkedAt, metadata.reviewDueAt))
  const segments = place.guides.filter((guide) => guide.locale === locale).map((guide, index) => ({
    id: index + 1,
    type: guide.segmentType,
    audience: guide.audience,
    title: guide.title,
    content: guide.content,
    sequence: guide.sequence,
    updatedAt: metadata.checkedAt,
  }))
  return buildCatalogEntry(place, localization, visit, sources, segments, metadata)
}
```

Write the JSON with `JSON.stringify(catalog, null, 2) + "\n"`. In `verify`, rebuild in memory, compare exact text to the committed file, validate 20 unique IDs per locale, confirm every image ID exists in the display manifest, and reject non-HTTPS source URLs.

Keep the committed artifact deterministic by comparing review dates with the package `checkedAt`, never the current clock. When `StaticPlaceRepository` loads the artifact in Task 4, recompute each citation and visit record's `needsRecheck` with `isReviewOverdue(reviewDueAt)` so the displayed freshness remains current.

- [ ] **Step 4: Add catalog commands and web precaching**

```json
"catalog:prepare": "node scripts/build_place_catalog.mjs build",
"catalog:verify": "node scripts/build_place_catalog.mjs verify",
"build": "npm run typecheck && npm run lint && npm run places:verify && npm run catalog:verify && npm run test && npm run build:web && npm run build:functions && npm run build:worker"
```

Change the Vite PWA glob to `"**/*.{js,css,html,json,svg,png,woff2}"` so the versioned catalog is available offline after first install.

- [ ] **Step 5: Build and verify the artifact**

Run: `npm run catalog:prepare && npm run catalog:verify && npx vitest run packages/shared/src/place-contracts.test.ts && npm run build:web`

Expected: PASS; the verifier reports 20 English and 20 Chinese entries and the web bundle includes `data/places-v1.json`.

- [ ] **Step 6: Commit generator and catalog**

```bash
git add scripts/build_place_catalog.mjs apps/web/public/data/places-v1.json package.json apps/web/vite.config.ts packages/shared/src/place-contracts.test.ts
git commit -m "feat: publish reviewed browser place catalog"
```

### Task 3: Implement Pure Search, Local Q&A, and Recommendation Ranking

**Files:**
- Create: `packages/shared/src/place-discovery.ts`
- Create: `packages/shared/src/place-discovery.test.ts`
- Modify: `packages/shared/src/index.ts`

**Interfaces:**
- Consumes: `PlaceSummary`, `PlaceCatalogEntry`, `PlaceQuestionResponse`, `PlaceRecommendationInput`, and `PlaceRecommendation` from Task 1.
- Produces: `filterPlaceSummaries`, `findReviewedAnswer`, `rankPlaceRecommendations`, and `inferPreferences`.

- [ ] **Step 1: Write failing behavior tests**

```ts
it("searches aliases, highlights, and Chinese text", () => {
  expect(filterPlaceSummaries(places, { query: "国博", category: "all" }).map((item) => item.id)).toEqual(["national-museum-of-china"])
  expect(filterPlaceSummaries(places, { query: "imperial garden", category: "all" }).map((item) => item.id)).toContain("forbidden-city")
})

it("returns reviewed content before any external fallback", () => {
  const response = findReviewedAnswer(forbiddenCity, "Do I need to recheck booking rules?")
  expect(response?.answerMode).toBe("reviewed-local")
  expect(response?.sources[0].sourceType).toBe("official")
})

it("returns null when reviewed content does not cover the question", () => {
  expect(findReviewedAnswer(forbiddenCity, "Where can I buy a blue umbrella nearby?")).toBeNull()
})

it("ranks stable constrained results", () => {
  const results = rankPlaceRecommendations(places, { preferences: ["history", "half-day"], context: "", locale: "en", coordinate: null, radiusKm: null, availableMinutes: 240, candidatePlaceIds: places.map((place) => place.id), plannedPlaceIds: [] })
  expect(results[0].matchedSignals).toContain("history")
  expect(results.every((item) => places.find((place) => place.id === item.placeId)!.durationMinutes <= 240)).toBe(true)
})
```

- [ ] **Step 2: Run the test and verify missing exports**

Run: `npx vitest run packages/shared/src/place-discovery.test.ts`

Expected: FAIL because the discovery functions do not exist.

- [ ] **Step 3: Implement normalized filtering**

```ts
function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase()
}

export function filterPlaceSummaries(places: PlaceSummary[], filters: PlaceDiscoveryFilters) {
  const query = normalize(filters.query)
  return places.filter((place) => {
    const searchable = normalize([place.name, ...(place.aliases ?? []), ...place.tags, place.shortIntro, ...(place.highlights ?? [])].join(" "))
    return (!query || searchable.includes(query))
      && (filters.category === "all" || place.categoryCode === filters.category)
      && (filters.maxDurationMinutes === undefined || place.durationMinutes <= filters.maxDurationMinutes)
      && (!filters.coordinate || filters.radiusKm === null || haversineKilometres(filters.coordinate, place.coordinate) <= filters.radiusKm)
  })
}
```

- [ ] **Step 4: Implement thresholded reviewed-answer retrieval**

Tokenize Latin words of at least two characters and contiguous Chinese sequences. Add explicit intent aliases for opening, ticket, booking, entrance, history, photo, child/family, and duration. Score exact phrase matches as 4, intent matches as 3, and ordinary token overlap as 1; require score 3 or greater. Return the highest-scoring document, its mapped citations, `answerMode: "reviewed-local"`, and `generatedBy: "deterministic-retrieval"`; return `null` below threshold or without a citation.

```ts
export function findReviewedAnswer(entry: PlaceCatalogEntry, question: string): PlaceQuestionResponse | null {
  const ranked = entry.searchDocuments
    .map((document) => ({ document, score: scoreDocument(question, document) }))
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))
  const match = ranked[0]
  if (!match || match.score < 3) return null
  const sources = entry.guides.sources.filter((source) => match.document.sourceIds.includes(source.id))
  if (sources.length === 0) return null
  return {
    answer: match.document.content,
    answerMode: "reviewed-local",
    generatedBy: "deterministic-retrieval",
    sources,
    updatedAt: match.document.updatedAt,
    searchedAt: null,
    dependencyStatus: "ready",
  }
}
```

- [ ] **Step 5: Implement preference inference and deterministic ranking**

Use fixed chip weights: exact tag/keyword `+5`, category match `+4`, duration fit `+3`, inside selected radius `+3`, unplanned `+1`, already planned `-4`; reject places over `availableMinutes` and outside an active radius. Map English and Chinese context terms into only the five supported preferences. Sort by descending score and then ascending place ID, and return the first five.

```ts
return candidates
  .sort((left, right) => right.score - left.score || left.placeId.localeCompare(right.placeId))
  .slice(0, 5)
  .map((item) => ({ ...item, reasonMode: "deterministic" as const }))
```

- [ ] **Step 6: Run pure-domain tests**

Run: `npx vitest run packages/shared/src/place-discovery.test.ts packages/shared/src/place-contracts.test.ts`

Expected: PASS for bilingual search, local-match/no-match, deterministic scores, radius/duration constraints, and stable tie-breaking.

- [ ] **Step 7: Commit pure discovery logic**

```bash
git add packages/shared/src/place-discovery.ts packages/shared/src/place-discovery.test.ts packages/shared/src/index.ts
git commit -m "feat: add reviewed place discovery logic"
```

### Task 4: Add Static and API Place Repositories

**Files:**
- Create: `apps/web/src/data/placeRepository.ts`
- Create: `apps/web/src/data/staticPlaceRepository.ts`
- Create: `apps/web/src/data/apiPlaceRepository.ts`
- Create: `apps/web/src/data/placeRepository.test.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app-shell/types.ts`

**Interfaces:**
- Consumes: catalog and discovery functions from Tasks 1–3; existing `api` transport.
- Produces: `PlaceRepository`, `StaticPlaceRepository`, `ApiPlaceRepository`, `createPlaceRepository`, and mode-independent repository injection.

- [ ] **Step 1: Write failing repository parity tests**

```ts
it("serves all twenty places and details without API calls", async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify(catalog)))
  const repository = new StaticPlaceRepository(fetcher)
  expect((await repository.listPlaces({ locale: "en" })).places).toHaveLength(20)
  expect((await repository.getPlace("forbidden-city", "en")).name).toBe("The Palace Museum")
  expect(fetcher).toHaveBeenCalledTimes(1)
})

it("answers reviewed questions without calling the online fallback", async () => {
  const online = vi.fn()
  const repository = new StaticPlaceRepository(fetchCatalog, online)
  const answer = await repository.askPlace({ placeId: "forbidden-city", locale: "en", question: "What is its history?" })
  expect(answer.answerMode).toBe("reviewed-local")
  expect(online).not.toHaveBeenCalled()
})

it("returns search-unavailable when local content has no match and the Worker is offline", async () => {
  const repository = new StaticPlaceRepository(fetchCatalog, async () => { throw new TypeError("fetch failed") })
  const answer = await repository.askPlace({ placeId: "forbidden-city", locale: "en", question: "Where is a blue umbrella shop?" })
  expect(answer).toMatchObject({ answerMode: "unable-to-confirm", dependencyStatus: "search-unavailable", sources: [] })
})
```

- [ ] **Step 2: Run the test and verify missing repository modules**

Run: `npx vitest run apps/web/src/data/placeRepository.test.ts`

Expected: FAIL because the repository files do not exist.

- [ ] **Step 3: Define the repository interface**

```ts
export interface PlaceRepository {
  listPlaces(filters?: PlaceListFilters): Promise<PlaceListResponse>
  getPlace(placeId: string, locale?: Locale): Promise<PlaceDetail>
  getGuide(placeId: string, locale?: Locale, audience?: GuideAudience): Promise<PlaceGuideResponse>
  askPlace(input: PlaceQuestionRequest): Promise<PlaceQuestionResponse>
  recommendPlaces(input: PlaceRecommendationInput): Promise<PlaceRecommendationResponse>
}
```

Add `PlaceDependencyError` with codes `catalog-unavailable`, `search-unavailable`, and `ai-unavailable`; preserve `ApiRequestError` status/code when wrapping API failures.

- [ ] **Step 4: Implement the cached static repository**

Fetch `/data/places-v1.json` once, parse with `placeCatalogSchema`, select entries by locale, and apply `filterPlaceSummaries`. `getPlace` and `getGuide` throw `NOT_FOUND` for unknown IDs. `askPlace` runs `findReviewedAnswer` first; only `null` invokes the injected online callback. Convert a network/dependency failure into an `unable-to-confirm` response with `search-unavailable`. `recommendPlaces` attempts the injected Worker callback and catches dependency failures by returning `rankPlaceRecommendations` with `generatedBy: "deterministic"`.

- [ ] **Step 5: Implement the API repository and transport paths**

```ts
export class ApiPlaceRepository implements PlaceRepository {
  constructor(private readonly accessToken: string | null) {}
  listPlaces(filters: PlaceListFilters = {}) { return api.listPlaces(filters) }
  getPlace(placeId: string, locale: Locale = "en") { return api.getPlace(placeId, locale) }
  getGuide(placeId: string, locale: Locale = "en", audience: GuideAudience = "general") { return api.getPlaceGuide(placeId, locale, audience) }
  askPlace(input: PlaceQuestionRequest) { return api.askPlace(this.accessToken, input) }
  recommendPlaces(input: PlaceRecommendationInput) { return api.recommendPlaces(this.accessToken, input) }
}
```

Build optional authorization headers only when a token exists. Add `/v1/places/:placeId/questions` and `/v1/place-recommendations` request tests that assert no `Authorization: Bearer null` header is emitted.

- [ ] **Step 6: Replace runtime `samplePlaces` selection in `App`**

Create the repository with `useMemo`: static in preview, API in account mode. Replace the preview three-place assignment and direct `api.listPlaces` effect with `repository.listPlaces({ locale: "en" })`. Pass the repository through `AppShellProps`. Keep `samplePlaces` only where current demo-trip coordinate helpers require fixtures, not as an Attractions data source.

- [ ] **Step 7: Run repository, App, API, and shell tests**

Run: `npx vitest run apps/web/src/data/placeRepository.test.ts apps/web/src/lib/api.test.ts apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck`

Expected: PASS; preview list count is 20 and static detail/guide/local-answer tests make no request to port 8787.

- [ ] **Step 8: Commit repository wiring**

```bash
git add apps/web/src/data apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts apps/web/src/App.tsx apps/web/src/app-shell/types.ts apps/web/src/app-shell/AppShell.test.tsx
git commit -m "feat: unify preview and API place repositories"
```

### Task 5: Complete Attractions Search, Filters, and Recommendation UI

**Files:**
- Create: `apps/web/src/features/attractions/RecommendationPanel.tsx`
- Create: `apps/web/src/features/attractions/RecommendationPanel.test.tsx`
- Modify: `apps/web/src/features/attractions/AttractionsView.tsx`
- Modify: `apps/web/src/features/attractions/AttractionsView.test.tsx`
- Modify: `apps/web/src/features/attractions/PlaceFilters.tsx`
- Modify: `apps/web/src/features/attractions/PlaceCard.tsx`
- Modify: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/app-shell/AppShell.test.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `filterPlaceSummaries`, `PlaceRepository.recommendPlaces`, place summaries, current coordinate, selected day, and planned IDs.
- Produces: accessible text search/reset, combined filters, preference input, deterministic/AI result labels, and detail/add actions.

- [ ] **Step 1: Write failing search and reset interaction tests**

```tsx
function AttractionsHarness({ places }: { places: PlaceSummary[] }) {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const visiblePlaces = filterPlaceSummaries(places, {
    query,
    category,
    maxDurationMinutes: undefined,
    coordinate: null,
    radiusKm: null,
  })
  return <AttractionsView
    {...createProps()}
    places={places}
    visiblePlaces={visiblePlaces}
    query={query}
    category={category}
    onQuery={setQuery}
    onCategory={setCategory}
    onResetFilters={() => { setQuery(""); setCategory("all") }}
  />
}

it("searches all reviewed fields and resets an empty result", async () => {
  const user = userEvent.setup()
  render(<AttractionsHarness places={twentyPlaces} />)
  await user.type(screen.getByRole("searchbox", { name: "Search reviewed places" }), "国博")
  expect(screen.getByRole("heading", { name: "National Museum of China" })).toBeTruthy()
  await user.clear(screen.getByRole("searchbox", { name: "Search reviewed places" }))
  await user.type(screen.getByRole("searchbox", { name: "Search reviewed places" }), "blue umbrella")
  await user.click(screen.getByRole("button", { name: "Reset search and filters" }))
  expect(screen.getAllByRole("article")).toHaveLength(20)
})
```

- [ ] **Step 2: Write failing recommendation interaction tests**

```tsx
it("submits chips and optional context then opens a result", async () => {
  const user = userEvent.setup()
  const onRecommend = vi.fn(async () => recommendationResponse)
  const onDetails = vi.fn()
  render(<RecommendationPanel
    places={twentyPlaces}
    locale="en"
    coordinate={null}
    radiusKm={null}
    availableMinutes={240}
    plannedPlaceIds={[]}
    selectedDay={1}
    onRecommend={onRecommend}
    onDetails={onDetails}
    onAdd={vi.fn()}
  />)
  await user.click(screen.getByRole("button", { name: "History" }))
  await user.type(screen.getByLabelText("Anything else?"), "quiet morning")
  await user.click(screen.getByRole("button", { name: "Recommend places" }))
  expect(onRecommend).toHaveBeenCalledWith(expect.objectContaining({ preferences: ["history"], context: "quiet morning" }))
  await user.click(screen.getByRole("button", { name: "View The Palace Museum" }))
  expect(onDetails).toHaveBeenCalledWith("forbidden-city")
})
```

- [ ] **Step 3: Run focused component tests and verify missing controls**

Run: `npx vitest run apps/web/src/features/attractions/AttractionsView.test.tsx apps/web/src/features/attractions/RecommendationPanel.test.tsx`

Expected: FAIL because search, reset, and `RecommendationPanel` are absent.

- [ ] **Step 4: Add query state and combined filtering to the shell**

Add `query` state beside category/duration/radius. Replace the inline filter with `filterPlaceSummaries(places, { query, category, maxDurationMinutes: maxDuration, coordinate: userCoordinate, radiusKm: userCoordinate ? nearbyRadius : null })`. Pass `query`, `onQuery`, and `onResetFilters` into Attractions. Reset query, category, duration, and radius to `""`, `"all"`, `undefined`, and `3`.

- [ ] **Step 5: Add accessible search and empty reset**

```tsx
<label className="place-search" htmlFor="place-search">
  <span>Search reviewed places</span>
  <input id="place-search" type="search" value={query} onChange={(event) => onQuery(event.target.value)} />
</label>
```

In the no-match state, render a button named `Reset search and filters`. Keep the location-denied explanation and leave distance buttons disabled with `aria-describedby` pointing to the explanation.

- [ ] **Step 6: Build `RecommendationPanel`**

Render five `aria-pressed` toggle buttons, the optional text field, and one submit action. Pass current coordinate, active radius, selected preferences, context, `candidatePlaceIds: places.map((place) => place.id)`, available minutes, and planned IDs to `repository.recommendPlaces`. Store `idle | loading | ready | failed` independently from the place list. Label `generatedBy: "model"` as `AI-assisted recommendation` and `generatedBy: "deterministic"` as `Reviewed-data match`. Every result exposes View and Add to Day actions.

```ts
type RecommendationPanelProps = {
  places: PlaceSummary[]
  locale: Locale
  coordinate: Coordinate | null
  radiusKm: 1 | 3 | 5 | null
  availableMinutes: number | null
  plannedPlaceIds: string[]
  selectedDay: number
  onRecommend: (input: PlaceRecommendationInput) => Promise<PlaceRecommendationResponse>
  onDetails: (placeId: string) => void
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
}
```

- [ ] **Step 7: Enrich place cards without adding new image sources**

Render distance when a coordinate is granted and a review label from `reviewDueAt`; continue to use `resolvePlaceImage(place.id)` only. Retain Details, Save, Map, and Day actions and their existing accessible names.

- [ ] **Step 8: Add responsive styles**

Add wrapping filter/search groups, chip focus/pressed styles, a single-column recommendation result layout below 640px, and 44px minimum controls. Use the existing colour tokens and editorial card language. Ensure the final result action has bottom clearance above fixed navigation.

- [ ] **Step 9: Run Attractions and shell tests**

Run: `npx vitest run apps/web/src/features/attractions apps/web/src/app-shell/AppShell.test.tsx && npm run typecheck && npm run lint`

Expected: PASS for search, reset, combined filters, denied location, recommendation fallback, View, Add to Day, and accessible pressed states.

- [ ] **Step 10: Commit the complete discovery page**

```bash
git add apps/web/src/features/attractions apps/web/src/app-shell/AppShell.tsx apps/web/src/app-shell/AppShell.test.tsx apps/web/src/styles.css
git commit -m "feat: complete Attractions discovery and recommendations"
```

### Task 6: Complete Place Detail, Sources, and Preview Q&A

**Files:**
- Create: `apps/web/src/components/PlaceSources.tsx`
- Create: `apps/web/src/components/PlaceDetailPanel.test.tsx`
- Modify: `apps/web/src/components/PlaceDetailPanel.tsx`
- Modify: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: injected `PlaceRepository`, `PlaceSourceCitation`, and `PlaceQuestionResponse`.
- Produces: full reviewed detail sections, freshness/source cards, and distinct local/web/unavailable answer presentation.

- [ ] **Step 1: Write failing detail and citation tests**

```tsx
it("loads detail and guide through the injected repository", async () => {
  render(<PlaceDetailPanel {...props} repository={repository} />)
  expect(await screen.findByRole("heading", { name: "History" })).toBeTruthy()
  expect(screen.getByText("Opening information needs rechecking")).toBeTruthy()
  expect(screen.getByRole("link", { name: /Palace Museum official source/ })).toHaveAttribute("href", "https://www.dpm.org.cn/")
})

it("allows preview Q&A and labels a reviewed answer", async () => {
  const user = userEvent.setup()
  render(<PlaceDetailPanel {...props} repository={repository} />)
  await user.type(screen.getByLabelText("Ask about this place"), "What should I notice?")
  await user.click(screen.getByRole("button", { name: "Ask" }))
  expect(await screen.findByText("From reviewed information")).toBeTruthy()
})

it("labels web answers and renders every citation", async () => {
  repository.askPlace = vi.fn(async () => webAnswer)
  render(<PlaceDetailPanel {...props} repository={repository} />)
  await userEvent.type(screen.getByLabelText("Ask about this place"), "What changed today?")
  await userEvent.click(screen.getByRole("button", { name: "Ask" }))
  expect(await screen.findByText("Web information")).toBeTruthy()
  expect(screen.getByRole("link", { name: /Official visitor notice/ })).toBeTruthy()
})
```

- [ ] **Step 2: Run the focused test and verify current API/auth assumptions fail**

Run: `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx`

Expected: FAIL because the panel imports `api` directly, disables signed-out Q&A, and renders source names as plain text.

- [ ] **Step 3: Inject the repository and guard stale requests**

Replace direct `api.getPlace`, `api.getPlaceGuide`, and `api.askPlace` calls with repository methods. Use an `AbortController` or monotonically increasing request ID so closing the panel, changing audience, changing place, or changing repository cannot apply a stale response. Keep detail/guide loading independent from Save and Add operations.

- [ ] **Step 4: Render all reviewed facts and visit-state warnings**

Add History, Highlights, Visit advice, Practical notes, Photo notes, Address, Hours, Tickets, Reservation, and Entrance sections when content exists. If `visitInformation.needsRecheck` is true, render `Opening information needs rechecking` and keep the cited official links adjacent.

- [ ] **Step 5: Build reusable source cards**

```tsx
export function PlaceSources({ sources }: { sources: PlaceSourceCitation[] }) {
  return <ul className="place-sources">{sources.map((source) => (
    <li key={source.id}>
      <a href={source.url} target="_blank" rel="noreferrer">
        {source.name}<ExternalLink aria-hidden="true" size={14} />
      </a>
      <span>{source.sourceType === "official" ? "Official source" : source.sourceType === "web" ? "Web source" : "Reviewed reference"}</span>
      <small>{source.needsRecheck ? "Recheck before visiting" : `Checked ${formatReviewDate(source.checkedAt)}`}</small>
    </li>
  ))}</ul>
}
```

- [ ] **Step 6: Open Q&A in preview and render trust modes**

Remove the `accessToken`-based input disable. Submit `repository.askPlace({ placeId, locale: "en", question })`. Render:

- `reviewed-local` or `model-grounded-local`: `From reviewed information` plus citations;
- `web-grounded`: `Web information`, retrieval time, warning, and citations;
- `unable-to-confirm/search-unavailable`: `Online search requires the API service for questions not covered by the reviewed guide.`;
- `unable-to-confirm/no-reliable-sources`: `No reliable sources were found, so this answer cannot be confirmed.`

Give the submit button accessible name `Ask`, preserve question text on failure, and announce answer status through `role="status"` without moving focus.

- [ ] **Step 7: Run detail tests and verify preview behavior**

Run: `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx apps/web/src/data/placeRepository.test.ts apps/web/src/app-shell/AppShell.test.tsx`

Expected: PASS for full facts, stale review warning, clickable sources, signed-out local Q&A, web label, search-unavailable, no-reliable-sources, and mutation-failure preservation.

- [ ] **Step 8: Commit trusted detail and Q&A UI**

```bash
git add apps/web/src/components/PlaceDetailPanel.tsx apps/web/src/components/PlaceDetailPanel.test.tsx apps/web/src/components/PlaceSources.tsx apps/web/src/app-shell/AppShell.tsx apps/web/src/styles.css
git commit -m "feat: add cited place details and preview questions"
```

### Task 7: Add the Worker-side Tavily Search Adapter and Rate Boundary

**Files:**
- Create: `apps/worker/src/webSearch.ts`
- Create: `apps/worker/src/webSearch.test.ts`
- Modify: `apps/worker/wrangler.jsonc`
- Modify: `apps/worker/src/worker-configuration.d.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`

**Interfaces:**
- Consumes: Worker `fetch`, `TAVILY_API_KEY`, and Cloudflare `RateLimit` binding.
- Produces: `WebSearchProvider.search(query, locale)`, `TavilyWebSearchProvider`, `isSafePublicHttpsUrl`, and `consumePlaceIntelligenceLimit`.

- [ ] **Step 1: Write failing Tavily adapter tests**

```ts
it("requests a basic safe search and normalizes five results", async () => {
  const fetcher = vi.fn(async (_url, init) => new Response(JSON.stringify({
    answer: "The official notice says to recheck before visiting.",
    results: [{ title: "Official visitor notice", url: "https://example.gov.cn/notice", content: "Current visitor rules", score: 0.91 }],
  })))
  const provider = new TavilyWebSearchProvider("tvly-test", fetcher)
  const result = await provider.search("Palace Museum current booking rule", "en")
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({ search_depth: "basic", max_results: 5, include_answer: "basic", include_raw_content: false, safe_search: true })
  expect(result.sources[0].url).toBe("https://example.gov.cn/notice")
})

it.each(["http://example.com", "https://localhost/a", "https://127.0.0.1/a", "file:///tmp/a"])("rejects unsafe citation %s", (url) => {
  expect(isSafePublicHttpsUrl(url)).toBe(false)
})

it("fails closed when Tavily returns an answer without safe sources", async () => {
  const provider = new TavilyWebSearchProvider("tvly-test", async () => new Response(JSON.stringify({ answer: "Unsupported", results: [{ title: "Local", url: "https://localhost/a", content: "x", score: 1 }] })))
  await expect(provider.search("question", "en")).rejects.toThrow("web_search_no_reliable_sources")
})
```

- [ ] **Step 2: Run the test and verify the missing adapter failure**

Run: `npx vitest run apps/worker/src/webSearch.test.ts`

Expected: FAIL because `webSearch.ts` does not exist.

- [ ] **Step 3: Define the provider interface and Tavily adapter**

```ts
export interface WebSearchProvider {
  search(query: string, locale: Locale): Promise<{ answer: string; sources: PlaceSourceCitation[]; searchedAt: string }>
}

const response = await fetcher("https://api.tavily.com/search", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    query,
    search_depth: "basic",
    topic: "general",
    max_results: 5,
    include_answer: "basic",
    include_raw_content: false,
    include_images: false,
    safe_search: true,
  }),
  signal: AbortSignal.timeout(10_000),
})
```

Validate the response with Zod. Normalize safe results to `sourceType: "web"`, `checkedAt: searchedAt`, `reviewDueAt: null`, `publishedAt: null`, and `needsRecheck: false`. Reject empty answers, non-2xx responses, malformed payloads, and zero safe sources with stable internal error names.

Reference checked during planning: `https://docs.tavily.com/documentation/api-reference/endpoint/search`.

- [ ] **Step 4: Implement public-HTTPS filtering**

Require `https:`, empty username/password, and a hostname that is neither `localhost`, `.localhost`, an IP literal in loopback/private/link-local ranges, nor an IPv6 loopback/private/link-local literal. Strip URL fragments before returning citations. Do not fetch any result URL.

- [ ] **Step 5: Add Worker bindings and a concrete rate limit**

```jsonc
"vars": {
  "ALLOW_ANONYMOUS_PLACE_AI": "true"
},
"ratelimits": [{
  "name": "PLACE_AI_RATE_LIMITER",
  "namespace_id": "1001",
  "simple": { "limit": 10, "period": 60 }
}]
```

Add optional `TAVILY_API_KEY`, `ALLOW_ANONYMOUS_PLACE_AI`, and `PLACE_AI_RATE_LIMITER: RateLimit` to `WorkerBindings`. Keep the actual Tavily key in `wrangler secret put TAVILY_API_KEY`; do not put it in `wrangler.jsonc`. Regenerate runtime types with:

Run: `npx wrangler types --config=apps/worker/wrangler.jsonc apps/worker/src/worker-configuration.d.ts`

- [ ] **Step 6: Make place intelligence public and rate-limited by explicit policy**

Remove the place-question regex from `requiresAuthentication` so reviewed local answers stay public. Add `consumePlaceIntelligenceLimit(context)` using authenticated user ID when present or `CF-Connecting-IP` when anonymous. Call it immediately before a Tavily or SiliconFlow request, not before local retrieval or deterministic ranking. Return HTTP 429 with `RATE_LIMITED`; when `ALLOW_ANONYMOUS_PLACE_AI !== "true"`, require a valid bearer user before consuming provider credits. Do not log question text, tokens, or keys.

- [ ] **Step 7: Run adapter, auth-boundary, and dry-run tests**

Run: `npx vitest run apps/worker/src/webSearch.test.ts apps/worker/src/index.test.ts && npm run build:worker`

Expected: PASS for Tavily shape, timeout, unsafe URLs, missing key, 429 policy, anonymous development access, authenticated production policy, and Worker dry run.

- [ ] **Step 8: Commit the search boundary**

```bash
git add apps/worker/src/webSearch.ts apps/worker/src/webSearch.test.ts apps/worker/src/index.ts apps/worker/src/index.test.ts apps/worker/wrangler.jsonc apps/worker/src/worker-configuration.d.ts
git commit -m "feat: add rate-limited cited web search adapter"
```

### Task 8: Orchestrate Worker Local-first Q&A and AI-assisted Recommendations

**Files:**
- Create: `apps/worker/src/placeIntelligence.ts`
- Create: `apps/worker/src/placeIntelligence.test.ts`
- Modify: `apps/worker/src/contracts.ts`
- Modify: `apps/worker/src/contracts.test.ts`
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`
- Modify: `apps/worker/src/siliconflow.ts`
- Modify: `apps/worker/src/siliconflow.test.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/data/apiPlaceRepository.ts`
- Modify: `apps/web/src/data/placeRepository.test.ts`

**Interfaces:**
- Consumes: Tavily provider and rate policy from Task 7; shared local retrieval/ranking from Task 3; existing Supabase published place queries; SiliconFlow configuration.
- Produces: extended `POST /v1/places/:placeId/questions` and new `POST /v1/place-recommendations` responses.

- [ ] **Step 1: Write failing local-first orchestration tests**

```ts
it("does not search the web when reviewed content matches", async () => {
  const search = { search: vi.fn() }
  const answer = await answerPlaceQuestion({ entry, question: "What is its history?", locale: "en", search })
  expect(answer.answerMode).toBe("reviewed-local")
  expect(search.search).not.toHaveBeenCalled()
})

it("returns a cited web answer only after local no-match", async () => {
  const search = { search: vi.fn(async () => citedSearchResult) }
  const answer = await answerPlaceQuestion({ entry, question: "What changed today?", locale: "en", search })
  expect(search.search).toHaveBeenCalledOnce()
  expect(answer).toMatchObject({ answerMode: "web-grounded", generatedBy: "web-search", dependencyStatus: "ready" })
  expect(answer.sources).toHaveLength(1)
})

it("falls back to deterministic recommendations when SiliconFlow is absent", async () => {
  const response = await recommendPlaces({ places, input, modelConfig: { apiKey: undefined } })
  expect(response.generatedBy).toBe("deterministic")
  expect(response.results[0].reasonMode).toBe("deterministic")
})
```

- [ ] **Step 2: Run orchestration tests and verify missing module failure**

Run: `npx vitest run apps/worker/src/placeIntelligence.test.ts`

Expected: FAIL because `placeIntelligence.ts` does not exist.

- [ ] **Step 3: Extract one Worker catalog-entry loader**

Create a helper that reads published localization, visit information, guide segments, search documents, and complete source rows (`id`, name, URL, type, checked/review dates) and maps them to the Task 1 contract. Reuse it in detail/guide/question routes so citation normalization has one implementation. Reject published source rows without HTTPS URL or checked date instead of fabricating metadata. Extend the list query/mapper to return aliases, highlights, localization review time, and the locale visit record's review-due time; this completes the optional `PlaceSummary` migration fields introduced in Task 1.

- [ ] **Step 4: Implement local-first question orchestration**

```ts
export async function answerPlaceQuestion(input: AnswerPlaceQuestionInput): Promise<PlaceQuestionResponse> {
  const reviewed = findReviewedAnswer(input.entry, input.question)
  if (reviewed) return reviewed
  if (!input.search) return unableToConfirm("search-unavailable")
  try {
    const web = await input.search.search(`${input.entry.summary.name} ${input.question}`, input.locale)
    return {
      answer: web.answer,
      answerMode: "web-grounded",
      generatedBy: "web-search",
      sources: web.sources,
      updatedAt: null,
      searchedAt: web.searchedAt,
      dependencyStatus: "ready",
      warning: "Web information can change; verify time-sensitive details with the linked source.",
    }
  } catch (error) {
    return unableToConfirm(errorName(error) === "web_search_no_reliable_sources" ? "no-reliable-sources" : "search-unavailable")
  }
}
```

- [ ] **Step 5: Add strict request schemas**

Extend `placeQuestionSchema` only with the existing `locale` and 2–500 character question. Add `placeRecommendationSchema` that permits only five preference enum values, context up to 300 characters, at most 20 valid place IDs, nullable WGS84 coordinate, radius `1 | 3 | 5 | null`, available minutes 30–720, and planned IDs at most 20. Add `RATE_LIMITED` to `ApiErrorCode`.

- [ ] **Step 6: Replace the question route response**

Load the reviewed entry, consume the rate limit only when local retrieval returns no match, construct Tavily only when `TAVILY_API_KEY` exists, and return `PlaceQuestionResponse`. Keep legacy `sourceIds` during this migration by deriving numeric IDs from database-backed reviewed sources; omit it for web answers. Ensure local match works when both SiliconFlow and Tavily are missing.

- [ ] **Step 7: Add constrained recommendation explanations**

Run `rankPlaceRecommendations` first. Send only the top five allowed place IDs, names, and matched signals to SiliconFlow. Require JSON `{ explanations: [{ placeId, reason }] }`, reject unknown or duplicate IDs, cap each reason at 180 characters, and merge text without changing order, score, or hard constraints. On any model error, return the deterministic response.

```ts
const allowedIds = new Set(ranked.map((item) => item.placeId))
const explanations = modelResultSchema.parse(JSON.parse(content)).explanations
if (explanations.some((item) => !allowedIds.has(item.placeId))) throw new Error("siliconflow_unknown_place")
return ranked.map((item) => ({ ...item, reason: explanations.find((value) => value.placeId === item.placeId)?.reason ?? item.reason, reasonMode: "model" }))
```

- [ ] **Step 8: Add the recommendation route**

Register `POST /v1/place-recommendations`, validate input, consume the same rate binding, load only the requested published place IDs in the requested locale, rank with the shared function, and optionally enhance reasons. Return deterministic success when SiliconFlow is unconfigured; return 400 for invalid IDs and never include an unpublished place.

- [ ] **Step 9: Update API transport and repository integration**

Parse every question/recommendation response with shared Zod schemas before returning it to components. Preserve typed dependency status in HTTP 200 unable-to-confirm responses; reserve non-2xx for validation, authentication policy, rate limit, or total service failure.

- [ ] **Step 10: Run Worker and repository integration tests**

Run: `npx vitest run apps/worker/src/placeIntelligence.test.ts apps/worker/src/contracts.test.ts apps/worker/src/index.test.ts apps/worker/src/siliconflow.test.ts apps/web/src/data/placeRepository.test.ts apps/web/src/lib/api.test.ts && npm run typecheck && npm run build:worker`

Expected: PASS for local-first behavior, real-citation invariant, unconfigured search, Tavily failure, rate limiting, deterministic recommendation, constrained model copy, and response parsing.

- [ ] **Step 11: Commit place intelligence endpoints**

```bash
git add apps/worker/src/placeIntelligence.ts apps/worker/src/placeIntelligence.test.ts apps/worker/src/contracts.ts apps/worker/src/contracts.test.ts apps/worker/src/index.ts apps/worker/src/index.test.ts apps/worker/src/siliconflow.ts apps/worker/src/siliconflow.test.ts apps/web/src/lib/api.ts apps/web/src/data/apiPlaceRepository.ts apps/web/src/data/placeRepository.test.ts
git commit -m "feat: add local-first place intelligence endpoints"
```

### Task 9: Verify the Complete Attractions 1.0 Story and Record Completion

**Files:**
- Modify: `TASKS.md`
- Modify only if verification exposes a defect: files owned by Tasks 1–8, with a focused regression test committed alongside the fix.

**Interfaces:**
- Consumes: the complete Attractions 1.0 implementation.
- Produces: passing project quality gate, browser evidence, and Task 6 verification record.

- [ ] **Step 1: Run the complete automated gate**

Run: `npm run build`

Expected: PASS for typecheck, zero-warning lint, 20-place source verification, generated catalog verification, all Vitest suites, Web/Functions build, and Worker dry run.

- [ ] **Step 2: Start browser-only preview and verify no Worker dependency**

Run: `npm run dev:web`

At `http://127.0.0.1:5173/attractions`, enter preview, create or restore a preview trip, and verify:

1. the count is 20;
2. `国博` finds National Museum of China;
3. category/duration filters combine with search;
4. details and both guide audiences load;
5. every image URL begins `/places/` and ends `.webp`;
6. a reviewed history question returns `From reviewed information` with a clickable source;
7. a deliberately unmatched question returns the explicit API-service requirement;
8. deterministic recommendations work with Worker port 8787 stopped.

- [ ] **Step 3: Verify denied location and mobile accessibility**

At 390x844, deny geolocation and confirm all 20 places remain searchable, radius controls explain why they are disabled, there is no horizontal overflow, filter chips expose pressed state, the detail panel restores focus, all actions have visible focus, and the last action remains above bottom navigation.

- [ ] **Step 4: Start the integrated environment and verify cited web fallback**

Create the already-ignored `apps/worker/.dev.vars` through a local editor so the values do not enter shell history. Its exact keys are:

```dotenv
TAVILY_API_KEY=
SILICONFLOW_API_KEY=
```

Paste each secret after its `=` through the editor and save the ignored file.

Then start both services:

```bash
npm run dev
```

Ask a question absent from the reviewed package. Confirm Network shows one question request, local-match questions cause no Tavily request in Worker test logs, the unmatched response is labelled `Web information`, every displayed source is clickable HTTPS, and retrieval time is visible. Temporarily remove/disable the Tavily key and confirm the search-unavailable state.

- [ ] **Step 5: Verify the three-action trip acceptance path**

From the 20-place list: choose the trip day in Mine, return to Attractions, and press the card's Day action. Confirm the place appears on that day in Mine. From details: open a place, select a day, and press Add to trip. Confirm each route uses at most three user actions and preview persistence survives reload.

- [ ] **Step 6: Record exact verification in `TASKS.md`**

Change Task 6 to checked only after Steps 1–5 pass. Add a `Verified:` line containing the date, exact automated test count, catalog count, build results, browser viewport, denied-location outcome, local-first Q&A outcome, cited-web outcome, and maximum action count.

- [ ] **Step 7: Commit verification record and any regression fixes**

```bash
git add TASKS.md
git commit -m "docs: verify Attractions 1.0"
```

- [ ] **Step 8: Review branch history and hand off for merge**

Run: `git status --short --branch && git log --oneline --decorate -12`

Expected: clean feature branch, nine focused task commits (plus focused regression commits if verification required them), and no unrelated user changes included.

---

## Execution Notes

- Create the implementation branch/worktree only when execution begins; use branch name `codex/attractions-1-0`.
- Install dependencies inside that worktree with `npm ci` and run the existing baseline tests before Task 1.
- The Tavily request/response fields in Task 7 were checked against the official API reference on 2026-08-30. Recheck the same official page immediately before implementing the adapter if execution occurs on a different date.
- Do not mark Task 6 complete merely because Tavily is unconfigured locally. The automated adapter tests must pass, and an integrated cited response must be verified with a configured development secret before completion.
