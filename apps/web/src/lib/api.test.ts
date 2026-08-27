import { describe, expect, it } from "vitest"
import { resolveApiBaseUrl } from "./api"

describe("API base URL", () => {
  it("uses same-origin requests in production", () => {
    expect(resolveApiBaseUrl(true, "https://legacy-worker.example.workers.dev")).toBe("")
  })

  it("keeps the separate local Worker during development", () => {
    expect(resolveApiBaseUrl(false)).toBe("http://localhost:8787")
    expect(resolveApiBaseUrl(false, "http://localhost:9000")).toBe("http://localhost:9000")
  })
})
