/// <reference types="node" />
// @vitest-environment node
import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
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
})
