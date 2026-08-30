import { Compass, Crosshair, LoaderCircle, MapPinOff } from "lucide-react"
import type { Coordinate, PlaceSummary } from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"
import type { LocationStatus, NearbyRadius, PlacesState } from "../../app-shell/types"
import { PlaceCard } from "./PlaceCard"
import { PlaceFilters } from "./PlaceFilters"

export type AttractionsViewProps = {
  busy: string | null
  categories: string[]
  category: string
  locationStatus: LocationStatus
  maxDuration: number | undefined
  nearbyRadius: NearbyRadius
  places: PlaceSummary[]
  placesState: PlacesState
  plannedIds: Set<string | null>
  savedPlaceIds: Set<string>
  selectedDay: number
  userCoordinate: Coordinate | null
  visiblePlaces: PlaceSummary[]
  onAddPlace: (placeId: string, dayNumber: number) => Promise<void>
  onCategory: (category: string) => void
  onDuration: (duration: number | undefined) => void
  onOpenDetails: (placeId: string) => void
  onRadius: (radius: NearbyRadius) => void
  onRequestLocation: () => void
  onShowOnMap: (placeId: string) => void
  onToggleSaved: (placeId: string) => Promise<void>
}

export function AttractionsView({
  busy,
  categories,
  category,
  locationStatus,
  maxDuration,
  nearbyRadius,
  places,
  placesState,
  plannedIds,
  savedPlaceIds,
  selectedDay,
  userCoordinate,
  visiblePlaces,
  onAddPlace,
  onCategory,
  onDuration,
  onOpenDetails,
  onRadius,
  onRequestLocation,
  onShowOnMap,
  onToggleSaved,
}: AttractionsViewProps) {
  const nearest = userCoordinate && visiblePlaces.length
    ? [...visiblePlaces].sort(
        (left, right) =>
          haversineKilometres(userCoordinate, left.coordinate)
          - haversineKilometres(userCoordinate, right.coordinate),
      )[0]
    : null

  return (
    <section className="module-view attractions-view" aria-labelledby="attractions-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">Explore Beijing</span>
          <h1 id="attractions-heading">Attractions</h1>
          <p>Reviewed places, practical visit lengths, and one clear route into your day.</p>
        </div>
        <span className="count-chip">{visiblePlaces.length} shown</span>
      </header>

      <div className="location-context">
        {nearest && userCoordinate ? (
          <div className="nearest-place">
            <span>Nearest reviewed place</span>
            <strong>{nearest.name}</strong>
            <small>{haversineKilometres(userCoordinate, nearest.coordinate).toFixed(1)} km away</small>
          </div>
        ) : (
          <div>
            {locationStatus === "failed" ? <MapPinOff aria-hidden="true" size={22} /> : <Crosshair aria-hidden="true" size={22} />}
            <strong>{locationStatus === "failed" ? "Location is unavailable" : "Find nearby places"}</strong>
            <span>{locationStatus === "failed" ? "You can still browse every reviewed place." : "Use a one-time location check to sort places nearby."}</span>
          </div>
        )}
        <button type="button" disabled={locationStatus === "loading"} onClick={onRequestLocation}>
          {locationStatus === "loading" ? "Locating…" : "Use my location"}
        </button>
      </div>

      {placesState === "ready" && places.length > 0 && (
        <PlaceFilters
          categories={categories}
          category={category}
          maxDuration={maxDuration}
          radius={nearbyRadius}
          hasLocation={Boolean(userCoordinate)}
          onCategory={onCategory}
          onDuration={onDuration}
          onRadius={onRadius}
        />
      )}

      {placesState === "loading" && (
        <div className="empty-plan" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={26} />
          <p>Loading reviewed places…</p>
        </div>
      )}

      {placesState === "failed" && (
        <div className="empty-plan" role="status">
          <Compass aria-hidden="true" size={28} />
          <h2>Places are unavailable right now.</h2>
          <p>Your saved itinerary still works. Try again in a moment.</p>
        </div>
      )}

      {placesState === "ready" && places.length === 0 && (
        <div className="empty-plan" role="status">
          <Compass aria-hidden="true" size={28} />
          <h2>No reviewed places are available yet.</h2>
        </div>
      )}

      {placesState === "ready" && places.length > 0 && visiblePlaces.length === 0 && (
        <div className="empty-plan" role="status">
          <Compass aria-hidden="true" size={28} />
          <h2>No place matches these filters.</h2>
          <p>Widen the distance, category, or visit length to see more.</p>
        </div>
      )}

      {visiblePlaces.length > 0 && (
        <div className="place-grid">
          {visiblePlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              planned={plannedIds.has(place.id)}
              saved={savedPlaceIds.has(place.id)}
              selectedDay={selectedDay}
              busy={busy}
              onDetails={onOpenDetails}
              onSave={onToggleSaved}
              onAdd={onAddPlace}
              onShowOnMap={onShowOnMap}
            />
          ))}
        </div>
      )}
    </section>
  )
}
