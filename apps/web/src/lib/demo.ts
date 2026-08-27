import {
  buildSampleSuggestion,
  samplePlaces,
  type AgentSuggestion,
  type TripSnapshot,
} from "../../../../packages/shared/src"

export function createDemoTrip(name: string, startDate: string | null): TripSnapshot {
  return {
    id: crypto.randomUUID(),
    name,
    startDate,
    endDate: startDate,
    locale: "en",
    version: 1,
    days: [{ id: 1, dayNumber: 1, date: startDate, title: "Day 1" }],
    stops: [],
    suggestions: [],
  }
}

export function addDemoStop(trip: TripSnapshot, placeId: string): TripSnapshot {
  const place = samplePlaces.find((item) => item.id === placeId)
  if (!place || trip.stops.some((stop) => stop.placeId === placeId)) return trip

  return {
    ...trip,
    version: trip.version + 1,
    stops: [
      ...trip.stops,
      {
        id: crypto.randomUUID(),
        tripId: trip.id,
        dayNumber: 1,
        placeId: place.id,
        name: place.name,
        coordinate: place.coordinate,
        startTime: null,
        durationMinutes: place.durationMinutes,
        sortOrder: trip.stops.length,
      },
    ],
  }
}

export function createDemoSuggestion(trip: TripSnapshot): TripSnapshot {
  const draft = buildSampleSuggestion(trip.stops)
  const suggestion: AgentSuggestion = {
    ...draft,
    id: crypto.randomUUID(),
    tripId: trip.id,
    baseVersion: trip.version,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  }
  return { ...trip, suggestions: [suggestion, ...trip.suggestions] }
}

export function applyDemoSuggestion(trip: TripSnapshot, suggestionId: string): TripSnapshot {
  const suggestion = trip.suggestions.find((item) => item.id === suggestionId)
  if (!suggestion || suggestion.baseVersion !== trip.version) return trip

  const stops = trip.stops.map((stop) => {
    const change = suggestion.changes.find(
      (item) => item.op === "update_stop" && item.stopId === stop.id,
    )
    return change?.op === "update_stop"
      ? {
          ...stop,
          startTime: change.startTime,
          durationMinutes: change.durationMinutes,
          sortOrder: change.sortOrder,
        }
      : stop
  })

  return {
    ...trip,
    version: trip.version + 1,
    stops: stops.sort((left, right) => left.sortOrder - right.sortOrder),
    suggestions: trip.suggestions.map((item) =>
      item.id === suggestionId ? { ...item, status: "applied" as const } : item,
    ),
  }
}
