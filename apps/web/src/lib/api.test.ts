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

describe("location-sharing transport", () => {
  const fetchMock = vi.fn()

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("sends an explicit sharing choice through the trip boundary", async () => {
    const { api } = await import("./api")
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      tripId: "trip-1",
      enabled: true,
      activeMemberCount: 2,
      expiresAt: null,
      visibleLocations: [],
    })))
    vi.stubGlobal("fetch", fetchMock)

    await api.setLocationSharing("access-token", "trip-1", true)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/v1/trips/trip-1/location-sharing"),
      expect.objectContaining({ method: "PUT", body: JSON.stringify({ enabled: true }) }),
    )
  })

  it("never sends an invalid WGS84 point", async () => {
    const { api } = await import("./api")
    vi.stubGlobal("fetch", fetchMock)

    await expect(api.updateCurrentLocation("access-token", "trip-1", Number.NaN, 116.39))
      .rejects.toThrow("valid WGS84")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("profile and membership transport", () => {
  const fetchMock = vi.fn()

  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it("reads and updates the caller's profile", async () => {
    const { api } = await import("./api")
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      userId: "user-1",
      displayName: "Alex",
      interfaceLocale: "en",
      contentLocale: "en",
      countryCode: "US",
      travelPreferences: {},
    })))
    vi.stubGlobal("fetch", fetchMock)

    await api.getProfile("access-token")
    await api.updateProfile("access-token", {
      displayName: "Alex",
      interfaceLocale: "en",
      contentLocale: "zh-CN",
      countryCode: "US",
      travelPreferences: { pace: "relaxed" },
    })

    const getCall = fetchMock.mock.calls[0] as [string, RequestInit]
    const putCall = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(getCall[0]).toContain("/v1/profile")
    expect((getCall[1].headers as Headers).get("Authorization")).toBe("Bearer access-token")
    expect(putCall[0]).toContain("/v1/profile")
    expect(putCall[1].method).toBe("PUT")
    expect(putCall[1].body).toContain("zh-CN")
  })

  it("lists members and manages invitations and removal through the trip boundary", async () => {
    const { api } = await import("./api")
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ members: [] })))
    vi.stubGlobal("fetch", fetchMock)

    await api.getTripMembers("access-token", "trip-1")
    await api.createTripInvitation("access-token", "trip-1", { role: "viewer", expiresInHours: 24 })
    await api.previewTripInvitation("access-token", "raw-token-value-here-raw-token-value-here")
    await api.acceptTripInvitation("access-token", "raw-token-value-here-raw-token-value-here")
    await api.revokeTripInvitation("access-token", "trip-1", "invitation-1")
    await api.removeTripMember("access-token", "trip-1", "member-1")

    expect(fetchMock).toHaveBeenCalledTimes(6)

    const membersCall = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(membersCall[0]).toContain("/v1/trips/trip-1/members")
    expect((membersCall[1].headers as Headers).get("Authorization")).toBe("Bearer access-token")

    const createCall = fetchMock.mock.calls[1] as [string, RequestInit]
    expect(createCall[0]).toContain("/v1/trips/trip-1/invitations")
    expect(createCall[1].method).toBe("POST")
    expect(createCall[1].body).toBe(JSON.stringify({ role: "viewer", expiresInHours: 24 }))

    const previewCall = fetchMock.mock.calls[2] as [string, RequestInit]
    expect(previewCall[0]).toContain("/v1/trip-invitations/raw-token-value-here")
    expect((previewCall[1].headers as Headers).get("Authorization")).toBe("Bearer access-token")

    const acceptCall = fetchMock.mock.calls[3] as [string, RequestInit]
    expect(acceptCall[0]).toContain("/accept")
    expect(acceptCall[1].method).toBe("POST")

    const revokeCall = fetchMock.mock.calls[4] as [string, RequestInit]
    expect(revokeCall[0]).toContain("/v1/trips/trip-1/invitations/invitation-1")
    expect(revokeCall[1].method).toBe("DELETE")

    const removeCall = fetchMock.mock.calls[5] as [string, RequestInit]
    expect(removeCall[0]).toContain("/v1/trips/trip-1/members/member-1")
    expect(removeCall[1].method).toBe("DELETE")
  })
})
