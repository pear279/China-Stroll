import { Clock3, Crosshair, LoaderCircle, MapPinOff } from "lucide-react"
import { lazy, Suspense } from "react"
import type { Coordinate, PlaceSummary, TripSnapshot } from "../../../../../packages/shared/src"
import type { LocationStatus, NearbyRadius } from "../../app-shell/types"
import { MapActionSheet } from "./MapActionSheet"

const TravelMap = lazy(() =>
  import("../../components/TravelMap").then((module) => ({ default: module.TravelMap })),
)

export type MapViewProps = {
  locationStatus: LocationStatus
  nearbyRadius: NearbyRadius
  places: PlaceSummary[]
  plannedIds: Set<string | null>
  selectedDay: number
  selectedPlaceId: string | null
  trip: TripSnapshot
  userCoordinate: Coordinate | null
  onAddPlace: (placeId: string, dayNumber: number) => Promise<void>
  onOpenDetails: (placeId: string) => void
  onRadius: (radius: NearbyRadius) => void
  onRequestLocation: () => void
  onSelect: (placeId: string | null) => void
  onSelectDay: (dayNumber: number) => void
}

export function MapView({
  locationStatus,
  nearbyRadius,
  places,
  plannedIds,
  selectedDay,
  selectedPlaceId,
  trip,
  userCoordinate,
  onAddPlace,
  onOpenDetails,
  onRadius,
  onRequestLocation,
  onSelect,
  onSelectDay,
}: MapViewProps) {
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null
  const dayStops = [...trip.stops]
    .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const dayReservations = (trip.reservations ?? []).filter((reservation) => reservation.dayNumber === selectedDay)

  return (
    <section className="module-view map-view" aria-labelledby="map-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">Plan in place</span>
          <h1 id="map-heading">Map and nearby places</h1>
          <p>Select a marker or list item, then choose details, itinerary, or a navigation provider.</p>
        </div>
      </header>

      <div className="nearby-controls">
        <button type="button" onClick={onRequestLocation} disabled={locationStatus === "loading"}>
          {locationStatus === "failed" ? <MapPinOff aria-hidden="true" size={16} /> : <Crosshair aria-hidden="true" size={16} />}
          {locationStatus === "loading" ? "Locating…" : userCoordinate ? "Location ready" : "Use my location"}
        </button>
        {([1, 3, 5] as const).map((radius) => (
          <button
            key={radius}
            type="button"
            className={nearbyRadius === radius ? "is-active" : undefined}
            disabled={!userCoordinate}
            onClick={() => onRadius(radius)}
          >
            {radius} km
          </button>
        ))}
        {locationStatus === "failed" && <span>Location is unavailable. Map browsing still works.</span>}
      </div>

      <div className="day-tabs" aria-label="Trip days">
        {trip.days.map((day) => <button className={selectedDay === day.dayNumber ? "is-active" : undefined} key={day.id} type="button" onClick={() => onSelectDay(day.dayNumber)}><span>Day {day.dayNumber}</span><small>{day.date ?? "Date open"}</small></button>)}
      </div>

      <div className="map-module-grid">
        <div className="map-stage">
          <Suspense fallback={<div className="map-shell" role="status"><LoaderCircle className="spin" aria-hidden="true" size={22} />Preparing map…</div>}>
            <TravelMap
              stops={trip.stops}
              places={places}
              selectedPlaceId={selectedPlaceId}
              userCoordinate={userCoordinate}
              onSelect={(placeId) => onSelect(placeId)}
            />
          </Suspense>
          {selectedPlace && (
            <MapActionSheet
              key={selectedPlace.id}
              place={selectedPlace}
              planned={plannedIds.has(selectedPlace.id)}
              selectedDay={selectedDay}
              onDetails={() => onOpenDetails(selectedPlace.id)}
              onAdd={() => onAddPlace(selectedPlace.id, selectedDay)}
              onCancel={() => onSelect(null)}
            />
          )}
        </div>

        <aside className="map-side-panels">
          <section className="map-itinerary-panel" aria-labelledby="map-itinerary-heading">
            <div className="section-heading"><div><span className="eyebrow">Today’s route</span><h2 id="map-itinerary-heading">Day {selectedDay} itinerary</h2></div><span className="count-chip">{dayStops.length} stops</span></div>
            {dayStops.length === 0 ? <p>This day has no scheduled stops yet.</p> : <ol>{dayStops.map((stop, index) => <li key={stop.id}>{stop.placeId ? <button type="button" className={selectedPlaceId === stop.placeId ? "is-selected" : undefined} onClick={() => onSelect(stop.placeId!)}><span>{index + 1}</span><span><strong>{stop.name}</strong><small><Clock3 aria-hidden="true" size={13} />{stop.startTime ? stop.startTime.slice(0, 5) : "Time open"} · {stop.durationMinutes ?? 90} min</small></span></button> : <div className="map-itinerary-static"><span>{index + 1}</span><span><strong>{stop.name}</strong><small>No map marker is available for this stop.</small></span></div>}</li>)}</ol>}
            <div className="map-reservation-list"><span className="eyebrow">Reservations</span>{dayReservations.length === 0 ? <p>No reservations for this day.</p> : <ul>{dayReservations.map((reservation) => <li key={reservation.id}><strong>{reservation.title}</strong><span>{reservation.status}{reservation.startsAt ? ` · ${reservation.startsAt.slice(11, 16)}` : ""}</span></li>)}</ul>}</div>
          </section>
          <section className="map-place-list" aria-label="Places shown on map">
            <div className="section-heading">
              <div><span className="eyebrow">In this area</span><h2>Reviewed places</h2></div>
              <span className="count-chip">{places.length}</span>
            </div>
            {places.length === 0 ? <p>No place matches the current filters.</p> : <ol>{places.map((place, index) => <li key={place.id}><button type="button" className={selectedPlaceId === place.id ? "is-selected" : undefined} onClick={() => onSelect(place.id)}><span>{index + 1}</span><span><strong>{place.name}</strong><small>{plannedIds.has(place.id) ? "In itinerary" : "Reviewed attraction"}</small></span></button></li>)}</ol>}
          </section>
        </aside>
      </div>
    </section>
  )
}
