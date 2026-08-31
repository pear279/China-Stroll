import { Compass, Crosshair, LoaderCircle, MapPinOff } from "lucide-react"
import type {
  Coordinate,
  Locale,
  PlaceRecommendationInput,
  PlaceRecommendationResponse,
  PlaceSummary,
} from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"
import type { LocationStatus, NearbyRadius, PlacesState } from "../../app-shell/types"
import { PlaceCard } from "./PlaceCard"
import { PlaceFilters } from "./PlaceFilters"
import { RecommendationPanel } from "./RecommendationPanel"

export type AttractionsViewProps = {
  busy: string | null
  categories: string[]
  category: string
  locale: Locale
  locationStatus: LocationStatus
  maxDuration: number | undefined
  nearbyRadius: NearbyRadius
  places: PlaceSummary[]
  placesState: PlacesState
  plannedIds: Set<string | null>
  query: string
  savedPlaceIds: Set<string>
  selectedDay: number
  userCoordinate: Coordinate | null
  visiblePlaces: PlaceSummary[]
  onAddPlace: (placeId: string, dayNumber: number) => Promise<void>
  onCategory: (category: string) => void
  onDuration: (duration: number | undefined) => void
  onOpenDetails: (placeId: string) => void
  onQuery: (query: string) => void
  onRecommendPlaces: (input: PlaceRecommendationInput) => Promise<PlaceRecommendationResponse>
  onRadius: (radius: NearbyRadius) => void
  onRequestLocation: () => void
  onResetFilters: () => void
  onShowOnMap: (placeId: string) => void
  onToggleSaved: (placeId: string) => Promise<void>
}

export function AttractionsView({
  busy,
  categories,
  category,
  locale,
  locationStatus,
  maxDuration,
  nearbyRadius,
  places,
  placesState,
  plannedIds,
  query,
  savedPlaceIds,
  selectedDay,
  userCoordinate,
  visiblePlaces,
  onAddPlace,
  onCategory,
  onDuration,
  onOpenDetails,
  onQuery,
  onRecommendPlaces,
  onRadius,
  onRequestLocation,
  onResetFilters,
  onShowOnMap,
  onToggleSaved,
}: AttractionsViewProps) {
  const locationMessageId = "attractions-location-message"
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
          <h1 id="attractions-heading">Reviewed attractions</h1>
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
            <span id={locationMessageId}>{locationStatus === "failed" ? "You can still browse every reviewed place." : "Use a one-time location check to sort places nearby."}</span>
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
          query={query}
          radius={nearbyRadius}
          hasLocation={Boolean(userCoordinate)}
          locationMessageId={locationMessageId}
          onCategory={onCategory}
          onDuration={onDuration}
          onQuery={onQuery}
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
          <button type="button" className="secondary-button inline-reset-button" onClick={onResetFilters}>
            Reset search and filters
          </button>
        </div>
      )}

      {placesState === "ready" && places.length > 0 && (
        <RecommendationPanel
          places={places}
          candidatePlaces={visiblePlaces}
          locale={locale}
          coordinate={userCoordinate}
          radiusKm={userCoordinate ? nearbyRadius : null}
          availableMinutes={maxDuration ?? null}
          plannedPlaceIds={[...plannedIds].filter((placeId): placeId is string => Boolean(placeId))}
          selectedDay={selectedDay}
          onRecommend={onRecommendPlaces}
          onDetails={onOpenDetails}
          onAdd={onAddPlace}
        />
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
              userCoordinate={userCoordinate}
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
