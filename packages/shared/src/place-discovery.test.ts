/// <reference types="node" />
// @vitest-environment node
import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import type { PlaceCatalogEntry } from "./place-contracts"
import { placeCatalogSchema } from "./place-contracts"
import {
  filterPlaceSummaries,
  findReviewedAnswer,
  inferPreferences,
  rankPlaceRecommendations,
} from "./place-discovery"

async function loadCatalog() {
  const url = new URL("../../../apps/web/public/data/places-v1.json", import.meta.url)
  const payload = JSON.parse(await readFile(url, "utf8"))
  return placeCatalogSchema.parse(payload)
}

function buildReviewedEntry(content: string): PlaceCatalogEntry {
  return {
    summary: {
      id: "test-place",
      locale: "en",
      name: "Test Place",
      shortIntro: "Reviewed summary",
      categoryCode: "museum",
      tags: ["history"],
      coordinate: [116.39, 39.91],
      durationMinutes: 120,
      coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
      aliases: [],
      highlights: ["Imperial Garden"],
      reviewedAt: "2026-08-30T00:00:00.000Z",
      reviewDueAt: "2026-09-29T00:00:00.000Z",
    },
    detail: {
      id: "test-place",
      locale: "en",
      name: "Test Place",
      aliases: [],
      tags: ["history"],
      shortIntro: "Reviewed summary",
      history: "Reviewed history",
      highlights: ["Imperial Garden"],
      visitorTips: "Arrive early.",
      practicalNotes: "Bring ID.",
      photoSpotNotes: "Best light in the morning.",
      categoryCode: "museum",
      coordinate: [116.39, 39.91],
      durationMinutes: 120,
      coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
      reviewedAt: "2026-08-30T00:00:00.000Z",
      visitInformation: null,
    },
    guides: {
      placeId: "test-place",
      locale: "en",
      general: [],
      child: [],
      sources: [
        {
          id: "test-place:official",
          name: "Test Place Official",
          url: "https://example.com/test-place",
          publishedAt: null,
          checkedAt: "2026-08-30T00:00:00.000Z",
          reviewDueAt: "2026-09-29T00:00:00.000Z",
          needsRecheck: false,
          sourceType: "official",
        },
      ],
    },
    searchDocuments: [
      {
        id: "test-place:guide",
        section: "guide",
        content,
        sourceIds: ["test-place:official"],
        updatedAt: "2026-08-30T00:00:00.000Z",
      },
    ],
    displayImage: "/places/test-place.webp",
  }
}

describe("filterPlaceSummaries", () => {
  it("searches aliases, highlights, and Chinese text", async () => {
    const catalog = await loadCatalog()

    expect(
      filterPlaceSummaries(catalog.locales["zh-CN"].map((entry) => entry.summary), {
        query: "国博",
        category: "all",
      }).map((item) => item.id),
    ).toEqual(["national-museum-of-china"])

    expect(
      filterPlaceSummaries(catalog.locales.en.map((entry) => entry.summary), {
        query: "imperial garden",
        category: "all",
      }).map((item) => item.id),
    ).toContain("forbidden-city")
  })

  it("applies category, duration, and radius constraints together", async () => {
    const catalog = await loadCatalog()

    const results = filterPlaceSummaries(catalog.locales.en.map((entry) => entry.summary), {
      query: "",
      category: "park",
      maxDurationMinutes: 120,
      coordinate: [116.3907694, 39.9172757],
      radiusKm: 1,
    })

    expect(results.map((item) => item.id)).toEqual(["jingshan-park"])
  })
})

describe("findReviewedAnswer", () => {
  it("returns reviewed content before any external fallback", async () => {
    const catalog = await loadCatalog()
    const forbiddenCity = catalog.locales.en.find((entry) => entry.summary.id === "forbidden-city")

    expect(forbiddenCity).toBeDefined()

    const response = findReviewedAnswer(
      forbiddenCity!,
      "Do I need to recheck booking rules?",
    )

    expect(response?.answerMode).toBe("reviewed-local")
    expect(response?.generatedBy).toBe("deterministic-retrieval")
    expect(response?.sources[0].sourceType).toBe("official")
    expect(response?.answer).toContain("booking information can change")
  })

  it("returns null when reviewed content does not cover the question", async () => {
    const catalog = await loadCatalog()
    const forbiddenCity = catalog.locales.en.find((entry) => entry.summary.id === "forbidden-city")

    expect(
      findReviewedAnswer(forbiddenCity!, "Where can I buy a blue umbrella nearby?"),
    ).toBeNull()
  })

  it("returns null for a generic unsupported what-is question", () => {
    const entry = buildReviewedEntry("This is the reviewed overview of the palace museum.")

    expect(findReviewedAnswer(entry, "What is the blue umbrella policy?")).toBeNull()
  })

  it("keeps meaningful exact phrase boosts for covered content", () => {
    const entry = buildReviewedEntry("Imperial Garden walking route and courtyard context.")

    const response = findReviewedAnswer(entry, "Can you explain the Imperial Garden?")

    expect(response?.answerMode).toBe("reviewed-local")
    expect(response?.answer).toContain("Imperial Garden")
  })
})

describe("inferPreferences", () => {
  it("maps English and Chinese context into the supported preferences once each", () => {
    expect(
      inferPreferences(
        "Need a relaxed half-day stop for family photos and history; 想轻松一点，适合孩子拍照，也想看看历史，半天安排。",
      ),
    ).toEqual(["family", "history", "relaxed", "photography", "half-day"])
  })
})

describe("rankPlaceRecommendations", () => {
  it("ranks stable constrained results", async () => {
    const catalog = await loadCatalog()
    const places = catalog.locales.en.map((entry) => entry.summary)

    const results = rankPlaceRecommendations(places, {
      preferences: ["history", "half-day"],
      context: "",
      locale: "en",
      coordinate: null,
      radiusKm: null,
      availableMinutes: 240,
      candidatePlaceIds: places.map((place) => place.id),
      plannedPlaceIds: [],
    })

    expect(results[0].matchedSignals).toContain("history")
    expect(
      results.every(
        (item) => places.find((place) => place.id === item.placeId)!.durationMinutes <= 240,
      ),
    ).toBe(true)
  })

  it("breaks ties by place id after applying deterministic scores", async () => {
    const catalog = await loadCatalog()
    const places = catalog.locales.en.map((entry) => entry.summary)

    const results = rankPlaceRecommendations(places, {
      preferences: [],
      context: "",
      locale: "en",
      coordinate: null,
      radiusKm: null,
      availableMinutes: null,
      candidatePlaceIds: ["jingshan-park", "forbidden-city"],
      plannedPlaceIds: [],
    })

    expect(results.map((item) => item.placeId)).toEqual(["forbidden-city", "jingshan-park"])
  })

  it("deduplicates candidate place ids before ranking top-5 results", async () => {
    const catalog = await loadCatalog()
    const places = catalog.locales.en.map((entry) => entry.summary)

    const results = rankPlaceRecommendations(places, {
      preferences: [],
      context: "",
      locale: "en",
      coordinate: null,
      radiusKm: null,
      availableMinutes: null,
      candidatePlaceIds: [
        "forbidden-city",
        "forbidden-city",
        "jingshan-park",
        "jingshan-park",
        "temple-of-heaven",
        "beihai-park",
        "beijing-zoo",
        "national-museum-of-china",
      ],
      plannedPlaceIds: [],
    })

    expect(results.map((item) => item.placeId)).toEqual([
      "beihai-park",
      "beijing-zoo",
      "forbidden-city",
      "jingshan-park",
      "national-museum-of-china",
    ])
    expect(new Set(results.map((item) => item.placeId)).size).toBe(results.length)
  })
})
