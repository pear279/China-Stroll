import { Clock3, Crosshair, LoaderCircle, MapPinOff } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import type { Coordinate, PlaceSummary, SharedMemberLocation, TripSnapshot } from "../../../../../packages/shared/src"
import type { LocationSharingControls, LocationStatus, NearbyRadius } from "../../app-shell/types"
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
  locationSharing: LocationSharingControls
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
  locationSharing,
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
  const visibleLocationSnapshot = locationSharing.snapshot?.visibleLocations ?? []
  const locationTime = useLiveLocationTime(visibleLocationSnapshot)
  const memberLocations = visibleLocationSnapshot.filter((member) => {
    const expiresAt = Date.parse(member.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt > locationTime
  })

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

      <MemberLocationContext locations={memberLocations} now={locationTime} status={locationSharing.status} />

      <div className="map-module-grid">
        <div className="map-stage">
          <Suspense fallback={<div className="map-shell" role="status"><LoaderCircle className="spin" aria-hidden="true" size={22} />Preparing map…</div>}>
            <TravelMap
              memberLocations={memberLocations}
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

function MemberLocationContext({ locations, now, status }: {
  locations: SharedMemberLocation[]
  now: number
  status: LocationSharingControls["status"]
}) {
  const warning = memberLocationWarning(status)

  if (locations.length > 0) {
    return (
      <section className="member-location-context" aria-labelledby="member-location-heading">
        <div>
          <span className="eyebrow">Current points only</span>
          <h2 id="member-location-heading">Members sharing now</h2>
        </div>
        <ul>
          {locations.map((member) => (
            <li key={member.userId}>
              <span className="member-location-avatar" aria-hidden="true">{member.initials}</span>
              <span>
                <strong>{member.displayName}</strong>
                <small>{formatLastUpdate(member.updatedAt, now)} · {formatExpiry(member.expiresAt, now)}</small>
              </span>
            </li>
          ))}
        </ul>
        {warning && <div className="member-location-feedback is-error" role="alert">{warning}</div>}
      </section>
    )
  }

  if (status === "loading" || status === "enabling" || status === "revoke-pending") {
    return (
      <div className="member-location-feedback" role="status">
        <LoaderCircle className="spin" aria-hidden="true" size={16} />
        Checking shared locations…
      </div>
    )
  }
  if (status === "expired") {
    return <div className="member-location-feedback" role="status">Your shared current point expired. No location history is shown.</div>
  }
  if (warning) return <div className="member-location-feedback is-error" role="alert">{warning}</div>
  return null
}

function memberLocationWarning(status: LocationSharingControls["status"]) {
  if (status === "permission-denied") {
    return "Your location is not updating. Other map and itinerary features still work."
  }
  if (status === "dependency-unavailable" || status === "upload-failed" || status === "revoke-failed") {
    return "Shared locations could not be refreshed. Map browsing and itinerary still work."
  }
  return null
}

function useLiveLocationTime(locations: SharedMemberLocation[]) {
  const [now, setNow] = useState(() => Date.now())
  const currentTime = Date.now()

  useEffect(() => {
    const currentTime = Date.now()
    const nextDelay = nextLocationRefreshDelay(locations, currentTime)
    if (nextDelay === null) return

    const timer = window.setTimeout(() => setNow(Date.now()), nextDelay)
    return () => window.clearTimeout(timer)
  }, [locations, now])

  return currentTime
}

function nextLocationRefreshDelay(locations: SharedMemberLocation[], now: number) {
  let nextDelay: number | null = null

  for (const location of locations) {
    const expiresAt = Date.parse(location.expiresAt)
    if (!Number.isFinite(expiresAt) || expiresAt <= now) continue

    const expiryDelay = expiresAt - now
    nextDelay = nextDelay === null ? expiryDelay : Math.min(nextDelay, expiryDelay)

    const updatedAt = Date.parse(location.updatedAt)
    if (!Number.isFinite(updatedAt)) continue
    const age = now - updatedAt
    const updateDelay = age < 0 ? -age : 60_000 - (age % 60_000)
    nextDelay = Math.min(nextDelay, updateDelay)

    const remainingMinutes = Math.ceil(expiryDelay / 60_000)
    const expiryLabelDelay = expiryDelay - Math.max(0, remainingMinutes - 1) * 60_000
    nextDelay = Math.min(nextDelay, expiryLabelDelay)
  }

  return nextDelay === null ? null : Math.max(1, Math.min(nextDelay, 2_147_000_000))
}

function formatLastUpdate(value: string, now: number) {
  const updatedAt = Date.parse(value)
  if (!Number.isFinite(updatedAt)) return "Update time unavailable"
  const minutes = Math.max(0, Math.floor((now - updatedAt) / 60_000))
  if (minutes < 1) return "Updated just now"
  if (minutes === 1) return "Updated 1 min ago"
  if (minutes < 60) return `Updated ${minutes} min ago`
  return `Updated ${new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
}

function formatExpiry(value: string, now: number) {
  const expiresAt = Date.parse(value)
  if (!Number.isFinite(expiresAt)) return "expiry unavailable"
  const minutes = Math.max(1, Math.ceil((expiresAt - now) / 60_000))
  return `expires in ${minutes} min`
}
