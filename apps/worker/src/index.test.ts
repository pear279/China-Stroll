import { beforeEach, describe, expect, it, vi } from "vitest"

const supabaseMocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  userFrom: vi.fn(),
  adminFrom: vi.fn(),
}))

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn((_url: string, _key: string, options?: { global?: unknown }) =>
    options?.global
      ? { from: supabaseMocks.userFrom }
      : {
          auth: { getUser: supabaseMocks.getUser },
          from: supabaseMocks.adminFrom,
          rpc: supabaseMocks.rpc,
        },
  ),
}))

import app, { PROTECTED_PREFIXES, requiresAuthentication } from "./index"

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
  WEB_ORIGIN: "http://localhost:5173",
}

const actorId = "00000000-0000-4000-8000-000000000001"
const peerId = "00000000-0000-4000-8000-000000000002"
const tripId = "00000000-0000-4000-8000-000000000010"

function queryResult(
  data: unknown,
  error: { message: string; code?: string } | null = null,
  terminal: "eq" | "gt" | "in" | "maybeSingle" = "eq",
) {
  const result = { data, error }
  let eqCalls = 0
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn(() => {
      eqCalls += 1
      return terminal === "eq" && eqCalls === 2 ? Promise.resolve(result) : query
    }),
    gt: vi.fn(() => terminal === "gt" ? Promise.resolve(result) : query),
    in: vi.fn(() => terminal === "in" ? Promise.resolve(result) : query),
    maybeSingle: vi.fn(() => Promise.resolve(result)),
  }
  return query
}

describe("worker routes", () => {
  beforeEach(() => {
    supabaseMocks.getUser.mockReset()
    supabaseMocks.rpc.mockReset()
    supabaseMocks.userFrom.mockReset()
    supabaseMocks.adminFrom.mockReset()
    supabaseMocks.getUser.mockResolvedValue({
      data: { user: { id: actorId } },
      error: null,
    })
  })

  it("reports service health without authentication", async () => {
    const response = await app.request("/health", {}, env)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "china-stroll-api" })
  })

  it("blocks trip writes without a bearer token", async () => {
    const response = await app.request(
      "/v1/trips",
      { method: "POST", body: JSON.stringify({}) },
      env,
    )
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    })
  })

  it("requires authentication before location sharing state is read", async () => {
    const response = await app.request("/v1/trips/trip-1/location-sharing", {}, env)
    expect(response.status).toBe(401)
  })

  it("rejects invalid WGS84 coordinates", async () => {
    const response = await app.request(
      "/v1/trips/trip-1/location-sharing/current-location",
      {
        method: "PUT",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 91, longitude: 116.39 }),
      },
      env,
    )
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    })
  })

  it("returns sharing state and only visible unexpired peer points", async () => {
    const now = Date.now()
    const profileQuery = queryResult([{ user_id: peerId, display_name: "Alex" }], null, "in")
    supabaseMocks.userFrom.mockImplementation((table: string) => {
      if (table === "trip_location_sharing_preferences") {
        return queryResult({
          enabled: true,
          enabled_at: new Date(now - 60_000).toISOString(),
          expires_at: new Date(now + 300_000).toISOString(),
          updated_at: new Date(now - 60_000).toISOString(),
        }, null, "maybeSingle")
      }
      if (table === "trip_members") {
        return queryResult([{ user_id: actorId }, { user_id: peerId }])
      }
      if (table === "trip_member_locations") {
        return queryResult([
          {
            user_id: peerId,
            latitude: 39.9,
            longitude: 116.4,
            sharing_enabled: true,
            updated_at: new Date(now - 30_000).toISOString(),
            expires_at: new Date(now + 300_000).toISOString(),
          },
          {
            user_id: "00000000-0000-4000-8000-000000000003",
            latitude: 40,
            longitude: 116.5,
            sharing_enabled: true,
            updated_at: new Date(now - 900_000).toISOString(),
            expires_at: new Date(now - 600_000).toISOString(),
          },
        ], null, "gt")
      }
      throw new Error(`Unexpected user-scoped table: ${table}`)
    })
    supabaseMocks.adminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") return profileQuery
      throw new Error(`Unexpected admin table: ${table}`)
    })

    const response = await app.request(
      `/v1/trips/${tripId}/location-sharing`,
      { headers: { Authorization: "Bearer valid-test-token" } },
      env,
    )

    expect(response.status).toBe(200)
    expect(profileQuery.in).toHaveBeenCalledWith("user_id", [peerId])
    await expect(response.json()).resolves.toEqual({
      tripId,
      enabled: true,
      status: "sharing",
      activeMemberCount: 2,
      expiresAt: expect.any(String),
      visibleLocations: [{
        userId: peerId,
        displayName: "Alex",
        initials: "A",
        coordinate: [116.4, 39.9],
        updatedAt: expect.any(String),
        expiresAt: expect.any(String),
      }],
    })
  })

  it("toggles sharing through the service-role function", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: { tripId, enabled: false }, error: null })
    supabaseMocks.userFrom.mockImplementation((table: string) => {
      if (table === "trip_location_sharing_preferences") return queryResult(null, null, "maybeSingle")
      if (table === "trip_members") return queryResult([{ user_id: actorId }, { user_id: peerId }])
      if (table === "trip_member_locations") return queryResult([], null, "gt")
      throw new Error(`Unexpected user-scoped table: ${table}`)
    })

    const response = await app.request(
      `/v1/trips/${tripId}/location-sharing`,
      {
        method: "PUT",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: false }),
      },
      env,
    )

    expect(response.status).toBe(200)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("set_mvp_location_sharing", {
      p_actor_id: actorId,
      p_enabled: false,
      p_trip_id: tripId,
    })
    await expect(response.json()).resolves.toMatchObject({ enabled: false, status: "off" })
  })

  it("maps a disabled location upload to a permission denial", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "FORBIDDEN location sharing disabled" },
    })

    const response = await app.request(
      `/v1/trips/${tripId}/location-sharing/current-location`,
      {
        method: "PUT",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 39.9, longitude: 116.4 }),
      },
      env,
    )

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "FORBIDDEN" } })
  })

  it("uploads one current point through the service-role function without echoing coordinates", async () => {
    const expiresAt = "2026-08-31T13:10:00.000Z"
    supabaseMocks.rpc.mockResolvedValue({
      data: { tripId, enabled: true, expiresAt, latitude: 39.9, longitude: 116.4 },
      error: null,
    })

    const response = await app.request(
      `/v1/trips/${tripId}/location-sharing/current-location`,
      {
        method: "PUT",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 39.9, longitude: 116.4 }),
      },
      env,
    )

    expect(response.status).toBe(200)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("upsert_mvp_current_location", {
      p_actor_id: actorId,
      p_latitude: 39.9,
      p_longitude: 116.4,
      p_trip_id: tripId,
    })
    await expect(response.json()).resolves.toEqual({ tripId, enabled: true, expiresAt })
  })

  it("maps a location dependency failure without returning a coordinate", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "database unavailable" },
    })

    const response = await app.request(
      `/v1/trips/${tripId}/location-sharing/current-location`,
      {
        method: "PUT",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: 39.9, longitude: 116.4 }),
      },
      env,
    )

    expect(response.status).toBe(503)
    const payload = await response.json() as { error: { code: string; details?: unknown } }
    expect(payload).toEqual({
      error: {
        code: "DEPENDENCY_UNAVAILABLE",
        message: "The trip service is temporarily unavailable.",
      },
    })
  })

  it("allows the place list without a bearer token", async () => {
    const response = await app.request("/v1/places", {}, { ...env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" })
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    })
  })

  it("rejects an unsafe place identifier before touching the database", async () => {
    const response = await app.request("/v1/places/Not%20A%20Place", {}, env)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "VALIDATION_FAILED" },
    })
  })
})

describe("authentication boundary", () => {
  it("protects every trip and invitation path", () => {
    expect(requiresAuthentication("/v1/trips")).toBe(true)
    expect(requiresAuthentication("/v1/trips/abc/stops")).toBe(true)
    expect(requiresAuthentication("/v1/trip-invitations/accept")).toBe(true)
  })

  it("leaves published place reads open", () => {
    expect(requiresAuthentication("/v1/places")).toBe(false)
    expect(requiresAuthentication("/v1/places/forbidden-city")).toBe(false)
    expect(requiresAuthentication("/v1/places/forbidden-city/guide")).toBe(false)
  })

  it("protects saved places while keeping reviewed place questions public", () => {
    expect(requiresAuthentication("/v1/place-library")).toBe(true)
    expect(requiresAuthentication("/v1/places/forbidden-city/questions")).toBe(false)
  })

  it("does not let a lookalike prefix bypass authentication", () => {
    expect(requiresAuthentication("/v1/tripsomething")).toBe(false)
    expect(PROTECTED_PREFIXES).toContain("/v1/trips")
  })
})
