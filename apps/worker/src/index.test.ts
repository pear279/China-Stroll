import { describe, expect, it } from "vitest"
import app, { PROTECTED_PREFIXES, requiresAuthentication } from "./index"

const env = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
  WEB_ORIGIN: "http://localhost:5173",
}

describe("worker routes", () => {
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
