import { describe, expect, it } from "vitest"
import app from "./index"

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
})
