import { afterEach, describe, expect, it, vi } from "vitest"
import { buildPlaceListPath, resolveApiBaseUrl } from "./api"

describe("API base URL", () => {
  it("uses same-origin requests in production", () => {
    expect(resolveApiBaseUrl(true, "https://legacy-worker.example.workers.dev")).toBe("")
  })

  it("keeps the separate local Worker during development", () => {
    expect(resolveApiBaseUrl(false)).toBe("http://localhost:8787")
    expect(resolveApiBaseUrl(false, "http://localhost:9000")).toBe("http://localhost:9000")
  })
})

describe("place list path", () => {
  it("omits the query string when no filter is chosen", () => {
    expect(buildPlaceListPath()).toBe("/v1/places")
  })

  it("carries every chosen filter", () => {
    const path = buildPlaceListPath({ locale: "zh-CN", category: "historic", maxDurationMinutes: 120 })
    expect(path).toContain("locale=zh-CN")
    expect(path).toContain("category=historic")
    expect(path).toContain("maxDurationMinutes=120")
  })
})

describe("authenticated place requests", () => {
  const fetchMock = vi.fn()

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("does not emit Authorization: Bearer null for place questions", async () => {
    const { api } = await import("./api")
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        answer: "Unable to confirm.",
        answerMode: "unable-to-confirm",
        generatedBy: "none",
        sources: [],
        searchedAt: null,
        updatedAt: null,
        dependencyStatus: "search-unavailable",
      })),
    )
    vi.stubGlobal("fetch", fetchMock)

    await api.askPlace(null, {
      placeId: "forbidden-city",
      locale: "en",
      question: "Where is a blue umbrella shop?",
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/places/forbidden-city/questions"),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: "Bearer null",
        }),
      }),
    )
  })

  it("does not emit Authorization: Bearer null for place recommendations", async () => {
    const { api } = await import("./api")
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({
        results: [],
        generatedBy: "deterministic",
        updatedAt: "2026-08-30T00:00:00.000Z",
      })),
    )
    vi.stubGlobal("fetch", fetchMock)

    await api.recommendPlaces(null, {
      preferences: ["history"],
      context: "",
      locale: "en",
      coordinate: null,
      radiusKm: null,
      availableMinutes: 240,
      candidatePlaceIds: ["forbidden-city"],
      plannedPlaceIds: [],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/place-recommendations"),
      expect.objectContaining({
        headers: expect.not.objectContaining({
          Authorization: "Bearer null",
        }),
      }),
    )
  })
})
