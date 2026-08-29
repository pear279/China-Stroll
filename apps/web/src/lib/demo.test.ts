import { describe, expect, it } from "vitest"
import type { TripSnapshot } from "../../../../packages/shared/src"
import { addDemoDay, addDemoStop, createDemoTrip, refreshSampleCoordinates } from "./demo"

describe("preview trip days", () => {
  it("adds a new day and places a stop on the chosen day", () => {
    const first = createDemoTrip("Beijing", "2026-09-01")
    const second = addDemoDay(first, "2026-09-02")
    const planned = addDemoStop(second, "jingshan-park", 2)

    expect(second.days).toHaveLength(2)
    expect(planned.stops[0].dayNumber).toBe(2)
    expect(planned.version).toBe(3)
  })
})

describe("preview coordinate refresh", () => {
  it("replaces stale sample coordinates without changing the trip version", () => {
    const trip: TripSnapshot = {
      id: "trip-1",
      name: "Beijing",
      startDate: null,
      endDate: null,
      locale: "en",
      version: 4,
      days: [],
      suggestions: [],
      stops: [{
        id: "stop-1",
        tripId: "trip-1",
        dayNumber: 1,
        placeId: "forbidden-city",
        name: "The Palace Museum",
        coordinate: [116.397155, 39.916345],
        startTime: null,
        durationMinutes: 240,
        sortOrder: 0,
      }],
    }

    const refreshed = refreshSampleCoordinates(trip)

    expect(refreshed.version).toBe(4)
    expect(refreshed.stops[0].coordinate).toEqual([116.3907694, 39.9172757])
  })

  it("leaves unknown places unchanged", () => {
    const trip: TripSnapshot = {
      id: "trip-1",
      name: "Beijing",
      startDate: null,
      endDate: null,
      locale: "en",
      version: 1,
      days: [],
      suggestions: [],
      stops: [{
        id: "stop-1",
        tripId: "trip-1",
        dayNumber: 1,
        placeId: "other-place",
        name: "Other place",
        coordinate: [116.3, 39.9],
        startTime: null,
        durationMinutes: 60,
        sortOrder: 0,
      }],
    }

    expect(refreshSampleCoordinates(trip)).toBe(trip)
  })
})
