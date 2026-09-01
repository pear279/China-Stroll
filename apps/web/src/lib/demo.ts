import {
  buildSampleSuggestion,
  samplePlaces,
  type AgentSuggestion,
  type PlaceSummary,
  type ReservationInput,
  type TransportMode,
  type TripReservation,
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
    days: [{ id: 1, dayNumber: 1, date: startDate, title: "Day 1", notes: "" }],
    stops: [],
    reservations: [],
    suggestions: [],
  }
}

export function createDemoReservation(trip: TripSnapshot, input: ReservationInput): TripSnapshot {
  const reservation: TripReservation = { ...input, id: crypto.randomUUID(), tripId: trip.id }
  return { ...trip, version: trip.version + 1, reservations: [...(trip.reservations ?? []), reservation] }
}

export function updateDemoReservation(trip: TripSnapshot, reservationId: string, input: ReservationInput): TripSnapshot {
  const reservations = (trip.reservations ?? []).map((reservation) => reservation.id === reservationId ? { ...reservation, ...input } : reservation)
  return reservations.some((reservation) => reservation.id === reservationId)
    ? { ...trip, version: trip.version + 1, reservations }
    : trip
}

export function removeDemoReservation(trip: TripSnapshot, reservationId: string): TripSnapshot {
  const reservations = (trip.reservations ?? []).filter((reservation) => reservation.id !== reservationId)
  return reservations.length === (trip.reservations ?? []).length ? trip : { ...trip, version: trip.version + 1, reservations }
}

export function addDemoStop(trip: TripSnapshot, place: PlaceSummary, dayNumber = 1): TripSnapshot {
  if (trip.stops.some((stop) => stop.placeId === place.id)) return trip

  return {
    ...trip,
    version: trip.version + 1,
    stops: [
      ...trip.stops,
      {
        id: crypto.randomUUID(),
        tripId: trip.id,
        dayNumber,
        placeId: place.id,
        name: place.name,
        coordinate: place.coordinate,
        startTime: null,
        durationMinutes: place.durationMinutes,
        transportMode: null, privatePlaceId: null,
        notes: "",
        sortOrder: trip.stops.filter((stop) => stop.dayNumber === dayNumber).length,
      },
    ],
  }
}

export function removeDemoStop(trip: TripSnapshot, stopId: string): TripSnapshot {
  const stops = trip.stops.filter((stop) => stop.id !== stopId)
  if (stops.length === trip.stops.length) return trip
  return { ...trip, version: trip.version + 1, stops }
}

export function reorderDemoStops(trip: TripSnapshot, stopId: string, targetIndex: number): TripSnapshot {
  const moving = trip.stops.find((stop) => stop.id === stopId)
  if (!moving) return trip
  const dayNumber = moving.dayNumber ?? 1
  const dayStops = trip.stops.filter((stop) => (stop.dayNumber ?? 1) === dayNumber).sort((left, right) => left.sortOrder - right.sortOrder)
  const reordered = dayStops.filter((stop) => stop.id !== stopId)
  reordered.splice(Math.max(0, Math.min(targetIndex, reordered.length)), 0, moving)
  const sortOrders = new Map(reordered.map((stop, index) => [stop.id, index]))
  return {
    ...trip,
    version: trip.version + 1,
    stops: trip.stops.map((stop) => sortOrders.has(stop.id) ? { ...stop, sortOrder: sortOrders.get(stop.id)! } : stop),
  }
}

export function addDemoDay(trip: TripSnapshot, date: string | null = null): TripSnapshot {
  const dayNumber = trip.days.length + 1
  return {
    ...trip,
    endDate: date ?? trip.endDate,
    version: trip.version + 1,
    days: [...trip.days, { id: dayNumber, dayNumber, date, title: `Day ${dayNumber}`, notes: "" }],
  }
}

export function editDemoStop(
  trip: TripSnapshot,
  stopId: string,
  fields: { startTime?: string | null; durationMinutes?: number | null; transportMode?: TransportMode | null; notes?: string },
): TripSnapshot {
  if (!trip.stops.some((stop) => stop.id === stopId)) return trip
  return {
    ...trip,
    version: trip.version + 1,
    stops: trip.stops.map((stop) => stop.id === stopId ? { ...stop, ...fields } : stop),
  }
}

export function moveDemoStopToDay(trip: TripSnapshot, stopId: string, dayNumber: number): TripSnapshot {
  const moving = trip.stops.find((stop) => stop.id === stopId)
  if (!moving || (moving.dayNumber ?? 1) === dayNumber) return trip
  const targetSort = trip.stops.filter((stop) => (stop.dayNumber ?? 1) === dayNumber).length
  return {
    ...trip,
    version: trip.version + 1,
    stops: trip.stops.map((stop) => stop.id === stopId ? { ...stop, dayNumber, sortOrder: targetSort } : stop),
  }
}

export function editDemoDay(
  trip: TripSnapshot,
  dayNumber: number,
  fields: { date?: string | null; title?: string | null; notes?: string },
): TripSnapshot {
  if (!trip.days.some((day) => day.dayNumber === dayNumber)) return trip
  return {
    ...trip,
    version: trip.version + 1,
    days: trip.days.map((day) => day.dayNumber === dayNumber ? { ...day, ...fields } : day),
  }
}

export function refreshSampleCoordinates(trip: TripSnapshot): TripSnapshot {
  let changed = false
  const stops = trip.stops.map((stop) => {
    const place = samplePlaces.find((item) => item.id === stop.placeId)
    if (!place) return stop
    if (
      stop.coordinate?.[0] === place.coordinate[0]
      && stop.coordinate?.[1] === place.coordinate[1]
    ) {
      return stop
    }
    changed = true
    return { ...stop, coordinate: place.coordinate }
  })
  return changed ? { ...trip, stops } : trip
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
