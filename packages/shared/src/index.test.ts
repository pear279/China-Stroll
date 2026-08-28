import { describe, expect, it } from "vitest"
import coordinateReviews from "../../../data/coordinate-reviews.json"
import {
  buildSampleSuggestion,
  collectPlaceCategories,
  formatCategoryLabel,
  formatDurationHours,
  placeInitials,
  resolvePlaceImage,
  samplePlaces,
  type PlaceSummary,
  type TripStop,
} from "./index"

describe("sample place coordinates", () => {
  it("keeps every map sample tied to a reviewed WGS84 display anchor", () => {
    expect(coordinateReviews.coordinate_system).toBe("WGS84")
    expect(coordinateReviews.purpose).toBe("display_anchor")

    for (const place of samplePlaces) {
      const review = coordinateReviews.places[place.id]
      expect(review, `${place.id} needs a coordinate review`).toBeDefined()
      expect(place.coordinate).toEqual([review.longitude, review.latitude])
      expect(review.source_url).toMatch(/^https:\/\/www\.openstreetmap\.org\//)
    }
  })
})

describe("buildSampleSuggestion", () => {
  it("orders the three sample stops and keeps stable visit durations", () => {
    const stops: TripStop[] = [...samplePlaces].reverse().map((place, index) => ({
      id: `stop-${index}`,
      tripId: "trip-1",
      dayNumber: 1,
      placeId: place.id,
      name: place.name,
      coordinate: place.coordinate,
      startTime: null,
      durationMinutes: null,
      sortOrder: index,
    }))

    const suggestion = buildSampleSuggestion(stops)

    expect(suggestion.changes).toHaveLength(3)
    expect(suggestion.changes.map((change) => change.op)).toEqual([
      "update_stop",
      "update_stop",
      "update_stop",
    ])
    expect(suggestion.changes.map((change) => "startTime" in change && change.startTime)).toEqual([
      "09:00",
      "14:15",
      "16:15",
    ])
  })

  it("only proposes changes for places already in the trip", () => {
    const suggestion = buildSampleSuggestion([
      {
        id: "stop-1",
        tripId: "trip-1",
        dayNumber: 1,
        placeId: "forbidden-city",
        name: "The Palace Museum",
        coordinate: [116.397155, 39.916345],
        startTime: null,
        durationMinutes: 240,
        sortOrder: 0,
      },
    ])

    expect(suggestion.changes).toHaveLength(1)
  })
})

describe("place display helpers", () => {
  it("returns a cleared image only for the three sample places", () => {
    expect(resolvePlaceImage("forbidden-city")).toBe("/places/palace-museum.png")
    expect(resolvePlaceImage("summer-palace")).toBeNull()
  })

  it("builds readable initials for a placeholder tile", () => {
    expect(placeInitials("The Palace Museum")).toBe("PM")
    expect(placeInitials("Jingshan Park")).toBe("JP")
    expect(placeInitials("Hutong")).toBe("HU")
    expect(placeInitials("")).toBe("?")
  })

  it("reads visit length in half hour steps and keeps short visits in minutes", () => {
    expect(formatDurationHours(240)).toBe("4 hr")
    expect(formatDurationHours(90)).toBe("1.5 hr")
    expect(formatDurationHours(60)).toBe("1 hr")
    expect(formatDurationHours(45)).toBe("45 min")
  })

  it("collects a sorted unique category list", () => {
    const places = [
      { categoryCode: "museum" },
      { categoryCode: "historic" },
      { categoryCode: "museum" },
    ] as PlaceSummary[]
    expect(collectPlaceCategories(places)).toEqual(["historic", "museum"])
  })

  it("turns a category code into a label", () => {
    expect(formatCategoryLabel("historic")).toBe("Historic")
    expect(formatCategoryLabel("imperial-garden")).toBe("Imperial Garden")
  })
})
