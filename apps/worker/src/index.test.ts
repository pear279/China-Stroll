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
const invitationId = "00000000-0000-4000-8000-000000000020"

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

  it("returns the caller's normalized profile", async () => {
    supabaseMocks.adminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") {
        return queryResult({
          display_name: "Alex Chen",
          interface_locale: "en",
          content_locale: "zh-CN",
          country_code: "US",
          travel_preferences: { pace: "relaxed" },
        }, null, "maybeSingle")
      }
      throw new Error(`Unexpected admin table: ${table}`)
    })

    const response = await app.request("/v1/profile", { headers: { Authorization: "Bearer valid-test-token" } }, env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      userId: actorId,
      displayName: "Alex Chen",
      interfaceLocale: "en",
      contentLocale: "zh-CN",
      countryCode: "US",
      travelPreferences: { pace: "relaxed" },
    })
  })

  it("returns profile defaults when no profile row exists", async () => {
    supabaseMocks.adminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") return queryResult(null, null, "maybeSingle")
      throw new Error(`Unexpected admin table: ${table}`)
    })

    const response = await app.request("/v1/profile", { headers: { Authorization: "Bearer valid-test-token" } }, env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      userId: actorId,
      displayName: "",
      interfaceLocale: "en",
      contentLocale: "en",
      countryCode: null,
      travelPreferences: {},
    })
  })

  it("upserts the caller's profile", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null })
    supabaseMocks.adminFrom.mockImplementation((table: string) => {
      if (table === "user_profiles") return { upsert }
      throw new Error(`Unexpected admin table: ${table}`)
    })

    const response = await app.request(
      "/v1/profile",
      {
        method: "PUT",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: "Alex Chen",
          interfaceLocale: "en",
          contentLocale: "zh-CN",
          countryCode: "US",
          travelPreferences: { pace: "relaxed" },
        }),
      },
      env,
    )

    expect(response.status).toBe(200)
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: actorId, display_name: "Alex Chen", country_code: "US" }),
      { onConflict: "user_id" },
    )
  })

  it("returns active trip members with joined display names", async () => {
    const profiles = queryResult(
      [{ user_id: actorId, display_name: "Alex" }, { user_id: peerId, display_name: null }],
      null,
      "in",
    )
    supabaseMocks.adminFrom.mockImplementation((table: string) => {
      if (table === "trip_members") {
        return queryResult([
          { user_id: actorId, role: "owner", joined_at: null },
          { user_id: peerId, role: "editor", joined_at: "2026-09-01T00:00:00.000Z" },
        ], null, "eq")
      }
      if (table === "user_profiles") return profiles
      throw new Error(`Unexpected admin table: ${table}`)
    })

    const response = await app.request(`/v1/trips/${tripId}/members`, { headers: { Authorization: "Bearer valid-test-token" } }, env)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      members: [
        { userId: actorId, displayName: "Alex", role: "owner", joinedAt: null, isCurrentUser: true },
        { userId: peerId, displayName: "Trip member", role: "editor", joinedAt: "2026-09-01T00:00:00.000Z", isCurrentUser: false },
      ],
    })
  })

  it("hides members from a caller who is not an active member", async () => {
    supabaseMocks.adminFrom.mockImplementation((table: string) => {
      if (table === "trip_members") {
        return queryResult([{ user_id: peerId, role: "editor", joined_at: null }], null, "eq")
      }
      throw new Error(`Unexpected admin table: ${table}`)
    })

    const response = await app.request(`/v1/trips/${tripId}/members`, { headers: { Authorization: "Bearer valid-test-token" } }, env)

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } })
  })

  it("creates an invitation and returns a one-time link without echoing the token hash", async () => {
    const invitation = {
      id: invitationId,
      tripId,
      role: "editor",
      expiresAt: "2026-09-02T00:00:00.000Z",
      useCount: 0,
      maxUses: 1,
      revokedAt: null,
    }
    supabaseMocks.rpc.mockResolvedValue({
      data: { tripId, version: 1, commandId: crypto.randomUUID(), invitation },
      error: null,
    })

    const response = await app.request(
      `/v1/trips/${tripId}/invitations`,
      {
        method: "POST",
        headers: { Authorization: "Bearer valid-test-token", "Content-Type": "application/json" },
        body: JSON.stringify({ role: "editor", expiresInHours: 24 }),
      },
      env,
    )

    expect(response.status).toBe(201)
    const rpcArgs = supabaseMocks.rpc.mock.calls[0][1] as Record<string, unknown>
    expect(rpcArgs.p_token_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(rpcArgs.p_role).toBe("editor")
    expect(rpcArgs.p_expires_in_hours).toBe(24)
    expect(rpcArgs.p_actor_id).toBe(actorId)
    expect(rpcArgs.p_trip_id).toBe(tripId)
    const payload = await response.json() as { inviteUrl: string; invitation: typeof invitation }
    expect(payload.invitation).toEqual(invitation)
    expect(payload.inviteUrl).toMatch(/^http:\/\/localhost:5173\/join\/[A-Za-z0-9_-]{43}$/)
    expect(payload.inviteUrl).not.toContain(rpcArgs.p_token_hash as string)
  })

  it("previews an invitation from its token", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: { tripId, tripName: "Family trip", role: "viewer", expiresAt: "2026-09-02T00:00:00.000Z", status: "ready" },
      error: null,
    })

    const token = "a".repeat(43)
    const response = await app.request(`/v1/trip-invitations/${token}`, { headers: { Authorization: "Bearer valid-test-token" } }, env)

    expect(response.status).toBe(200)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("preview_mvp_trip_invitation", {
      p_actor_id: actorId,
      p_token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    })
    await expect(response.json()).resolves.toEqual({
      tripId,
      tripName: "Family trip",
      role: "viewer",
      expiresAt: "2026-09-02T00:00:00.000Z",
      status: "ready",
    })
  })

  it("accepts an invitation and returns the joined trip", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        tripId,
        version: 2,
        commandId: crypto.randomUUID(),
        invitationId,
        member: { userId: actorId, role: "viewer" },
      },
      error: null,
    })

    const token = "b".repeat(43)
    const response = await app.request(`/v1/trip-invitations/${token}/accept`, {
      method: "POST",
      headers: { Authorization: "Bearer valid-test-token" },
    }, env)

    expect(response.status).toBe(200)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("accept_mvp_trip_invitation", expect.objectContaining({
      p_actor_id: actorId,
      p_token_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    }))
    await expect(response.json()).resolves.toEqual({
      tripId,
      version: 2,
      invitationId,
      member: { userId: actorId, role: "viewer" },
    })
  })

  it("revokes an invitation", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: { tripId, version: 1, commandId: crypto.randomUUID(), invitationId, revokedAt: "2026-09-01T12:00:00.000Z" },
      error: null,
    })

    const response = await app.request(`/v1/trips/${tripId}/invitations/${invitationId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-test-token" },
    }, env)

    expect(response.status).toBe(200)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("revoke_mvp_trip_invitation", {
      p_actor_id: actorId,
      p_trip_id: tripId,
      p_invitation_id: invitationId,
      p_command_id: expect.any(String),
    })
    await expect(response.json()).resolves.toEqual({ tripId, invitationId, revokedAt: "2026-09-01T12:00:00.000Z" })
  })

  it("removes a trip member", async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: { tripId, version: 1, commandId: crypto.randomUUID(), removedUserId: peerId },
      error: null,
    })

    const response = await app.request(`/v1/trips/${tripId}/members/${peerId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-test-token" },
    }, env)

    expect(response.status).toBe(200)
    expect(supabaseMocks.rpc).toHaveBeenCalledWith("remove_mvp_trip_member", {
      p_actor_id: actorId,
      p_trip_id: tripId,
      p_member_user_id: peerId,
      p_command_id: expect.any(String),
    })
    await expect(response.json()).resolves.toEqual({ tripId, removedUserId: peerId })
  })

  it("maps an expired invitation to 410", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: { message: "INVITATION_EXPIRED" } })
    const response = await app.request(`/v1/trip-invitations/${"c".repeat(43)}`, {
      headers: { Authorization: "Bearer valid-test-token" },
    }, env)
    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVITATION_EXPIRED" } })
  })

  it("maps an unavailable invitation to 410", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: { message: "INVITATION_UNAVAILABLE invitation used" } })
    const response = await app.request(`/v1/trip-invitations/${"d".repeat(43)}/accept`, {
      method: "POST",
      headers: { Authorization: "Bearer valid-test-token" },
    }, env)
    expect(response.status).toBe(410)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "INVITATION_UNAVAILABLE" } })
  })

  it("maps a member conflict to 409", async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: { message: "MEMBER_CONFLICT owner cannot be removed" } })
    const response = await app.request(`/v1/trips/${tripId}/members/${peerId}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer valid-test-token" },
    }, env)
    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toMatchObject({ error: { code: "MEMBER_CONFLICT" } })
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

  it("protects the profile endpoint", () => {
    expect(requiresAuthentication("/v1/profile")).toBe(true)
    expect(PROTECTED_PREFIXES).toContain("/v1/profile")
  })
})
