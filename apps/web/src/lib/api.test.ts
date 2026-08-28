import { describe, expect, it } from "vitest"
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
