import { describe, expect, it } from "vitest"
import { handlePagesRequest, resolvePagesBindings } from "./pages"

describe("Pages Functions adapter", () => {
  it("uses the public Supabase URL and derives the same-origin CORS value", () => {
    const request = new Request("https://china-stroll.pages.dev/v1/trips")
    expect(
      resolvePagesBindings(request, {
        VITE_SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
      }),
    ).toEqual({
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "test-only-service-key",
      WEB_ORIGIN: "https://china-stroll.pages.dev",
    })
  })

  it("reports health through Pages Functions", async () => {
    const response = await handlePagesRequest(new Request("https://china-stroll.pages.dev/health"), {})
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "ok", service: "china-stroll-api" })
  })

  it("rejects unauthenticated writes before reading server credentials", async () => {
    const response = await handlePagesRequest(
      new Request("https://china-stroll.pages.dev/v1/trips", { method: "POST", body: "{}" }),
      {},
    )
    expect(response.status).toBe(401)
    expect(response.headers.get("Cache-Control")).toBe("private, no-store")
  })

  it("returns a controlled error when a required Pages Secret is missing", async () => {
    const response = await handlePagesRequest(
      new Request("https://china-stroll.pages.dev/v1/trips", {
        headers: { Authorization: "Bearer test-only-token" },
      }),
      { VITE_SUPABASE_URL: "https://example.supabase.co" },
    )
    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "DEPENDENCY_UNAVAILABLE" },
    })
  })
})
