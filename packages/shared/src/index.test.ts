import { describe, expect, it } from "vitest"
import coordinateReviews from "../../../data/coordinate-reviews.json"
import { buildSampleSuggestion, samplePlaces, type TripStop } from "./index"

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
