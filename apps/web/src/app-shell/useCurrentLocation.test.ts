import { act, renderHook } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useCurrentLocation } from "./useCurrentLocation"

afterEach(() => vi.unstubAllGlobals())

describe("useCurrentLocation", () => {
  it("stores a one-shot WGS84 browser coordinate", () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { longitude: 116.39, latitude: 39.91 } } as GeolocationPosition),
      },
    })
    const { result } = renderHook(() => useCurrentLocation())

    act(() => result.current.requestLocation())

    expect(result.current.status).toBe("ready")
    expect(result.current.coordinate).toEqual([116.39, 39.91])
  })

  it("reports failure without blocking browsing", () => {
    vi.stubGlobal("navigator", {
      geolocation: {
        getCurrentPosition: (_success: PositionCallback, failure: PositionErrorCallback) =>
          failure({ code: 1, message: "denied" } as GeolocationPositionError),
      },
    })
    const { result } = renderHook(() => useCurrentLocation())

    act(() => result.current.requestLocation())

    expect(result.current.status).toBe("failed")
    expect(result.current.coordinate).toBeNull()
  })
})
