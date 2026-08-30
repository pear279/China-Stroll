/// <reference types="node" />
// @vitest-environment node
import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import type {
  PlaceCatalog,
  PlaceQuestionResponse,
  PlaceRecommendationInput,
} from "../../../../packages/shared/src"
import { placeCatalogSchema } from "../../../../packages/shared/src"
import { StaticPlaceRepository } from "./staticPlaceRepository"

async function loadCatalog() {
  const url = new URL("../../public/data/places-v1.json", import.meta.url)
  const payload = JSON.parse(await readFile(url, "utf8"))
  return placeCatalogSchema.parse(payload)
}

function createCatalogFetcher(catalog: PlaceCatalog) {
  return vi.fn(async () =>
    new Response(JSON.stringify(catalog), {
      headers: { "Content-Type": "application/json" },
    }))
}

describe("StaticPlaceRepository", () => {
  it("serves all twenty places and details without API calls", async () => {
    const catalog = await loadCatalog()
    const fetcher = createCatalogFetcher(catalog)
    const repository = new StaticPlaceRepository(fetcher)

    expect((await repository.listPlaces({ locale: "en" })).places).toHaveLength(20)
    expect((await repository.getPlace("forbidden-city", "en")).name).toBe("The Palace Museum")
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it("answers reviewed questions without calling the online fallback", async () => {
    const catalog = await loadCatalog()
    const fetcher = createCatalogFetcher(catalog)
    const online = vi.fn<(_: { placeId: string; locale: "en" | "zh-CN"; question: string }) => Promise<PlaceQuestionResponse>>()
    const repository = new StaticPlaceRepository(fetcher, online)

    const answer = await repository.askPlace({
      placeId: "forbidden-city",
      locale: "en",
      question: "What is its history?",
    })

    expect(answer.answerMode).toBe("reviewed-local")
    expect(online).not.toHaveBeenCalled()
  })

  it("returns search-unavailable when local content has no match and the Worker is offline", async () => {
    const catalog = await loadCatalog()
    const fetcher = createCatalogFetcher(catalog)
    const repository = new StaticPlaceRepository(fetcher, async () => {
      throw new TypeError("fetch failed")
    })

    const answer = await repository.askPlace({
      placeId: "forbidden-city",
      locale: "en",
      question: "Where is a blue umbrella shop?",
    })

    expect(answer).toMatchObject({
      answerMode: "unable-to-confirm",
      dependencyStatus: "search-unavailable",
      sources: [],
    })
  })

  it("recomputes runtime freshness flags for visit info and citations", async () => {
    const catalog = await loadCatalog()
    const entry = catalog.locales.en.find((item) => item.summary.id === "forbidden-city")
    if (!entry) {
      throw new Error("Expected forbidden-city in the curated catalog")
    }

    entry.detail.visitInformation = {
      ...entry.detail.visitInformation!,
      reviewDueAt: "2026-01-01T00:00:00.000Z",
      needsRecheck: false,
    }
    entry.guides.sources = entry.guides.sources.map((source, index) =>
      index === 0
        ? {
            ...source,
            reviewDueAt: "2026-01-01T00:00:00.000Z",
            needsRecheck: false,
          }
        : source,
    )

    const repository = new StaticPlaceRepository(createCatalogFetcher(catalog))
    const detail = await repository.getPlace("forbidden-city", "en")
    const guide = await repository.getGuide("forbidden-city", "en")

    expect(detail.visitInformation?.needsRecheck).toBe(true)
    expect(guide.sources[0]?.needsRecheck).toBe(true)
  })

  it("falls back to deterministic recommendations when the Worker is unavailable", async () => {
    const catalog = await loadCatalog()
    const repository = new StaticPlaceRepository(
      createCatalogFetcher(catalog),
      undefined,
      async () => {
        throw new TypeError("fetch failed")
      },
    )

    const input: PlaceRecommendationInput = {
      preferences: ["history"],
      context: "",
      locale: "en",
      coordinate: null,
      radiusKm: null,
      availableMinutes: 240,
      candidatePlaceIds: catalog.locales.en.map((item) => item.summary.id),
      plannedPlaceIds: [],
    }

    const result = await repository.recommendPlaces(input)

    expect(result.generatedBy).toBe("deterministic")
    expect(result.results.length).toBeGreaterThan(0)
  })
})
