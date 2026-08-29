import { describe, expect, it } from "vitest"
import { amapSearchUrl, appleMapsUrl, googleMapsUrl, haversineKilometres } from "./navigation"

describe("navigation helpers", () => {
  const coordinate: [number, number] = [116.397, 39.916]

  it("builds cross-platform navigation links", () => {
    expect(appleMapsUrl("Forbidden City", coordinate)).toContain("maps.apple.com")
    expect(googleMapsUrl("Forbidden City", coordinate)).toContain("api=1")
    expect(amapSearchUrl("Forbidden City")).toContain("uri.amap.com")
  })

  it("calculates nearby distance", () => {
    expect(haversineKilometres(coordinate, coordinate)).toBe(0)
    expect(haversineKilometres(coordinate, [116.407, 39.916])).toBeGreaterThan(0.8)
  })
})
