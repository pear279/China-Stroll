import { describe, expect, it } from "vitest"
import type { PlaceSummary, TripSnapshot } from "../../../../packages/shared/src"
import { addDemoDay, addDemoStop, createDemoTrip, refreshSampleCoordinates, removeDemoStop, reorderDemoStops } from "./demo"

const jingshan: PlaceSummary = {
  id: "jingshan-park",
  locale: "en",
  name: "Jingshan Park",
  shortIntro: "A reviewed view point.",
  categoryCode: "park",
  tags: ["view"],
  coordinate: [116.3903973, 39.9244589],
  durationMinutes: 90,
  coordinatesCheckedAt: "2026-08-30T00:00:00Z",
}

describe("preview trip days", () => {
  it("adds a new day and places a stop on the chosen day", () => {
    const first = createDemoTrip("Beijing", "2026-09-01")
    const second = addDemoDay(first, "2026-09-02")
    const planned = addDemoStop(second, jingshan, 2)

    expect(second.days).toHaveLength(2)
    expect(planned.stops[0].dayNumber).toBe(2)
    expect(planned.version).toBe(3)
  })
})

describe("preview itinerary editing", () => {
  const trip: TripSnapshot = {
    id: "trip-1", name: "Beijing", startDate: null, endDate: null, locale: "en", version: 2,
    days: [{ id: 1, dayNumber: 1, date: null, title: "Day 1" }], suggestions: [],
    stops: [
      { id: "stop-a", tripId: "trip-1", dayNumber: 1, placeId: "forbidden-city", name: "The Palace Museum", coordinate: [116.3907694, 39.9172757], startTime: null, durationMinutes: 240, sortOrder: 0 },
      { id: "stop-b", tripId: "trip-1", dayNumber: 1, placeId: "jingshan-park", name: "Jingshan Park", coordinate: [116.3903973, 39.9244589], startTime: null, durationMinutes: 90, sortOrder: 1 },
    ],
  }

  it("moves a stop within one day and renumbers every sort order", () => {
    const changed = reorderDemoStops(trip, "stop-b", 0)
    expect([...changed.stops].sort((left, right) => left.sortOrder - right.sortOrder).map((stop) => stop.id)).toEqual(["stop-b", "stop-a"])
  })

  it("removes only the selected stop", () => {
    expect(removeDemoStop(trip, "stop-a").stops.map((stop) => stop.id)).toEqual(["stop-b"])
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
