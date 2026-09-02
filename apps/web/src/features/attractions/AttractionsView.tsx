import { ChevronDown, ChevronUp, Compass, Crosshair, LayoutGrid, List, LoaderCircle, MapPinOff, Sparkles } from "lucide-react"
import { useState } from "react"
import type {
  Coordinate,
  Locale,
  PlaceRecommendationInput,
  PlaceRecommendationResponse,
  PlaceSummary,
  TripDay,
} from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"
import { resolvePlaceImage } from "../../../../../packages/shared/src"
import type { LocationStatus, NearbyRadius, PlacesState } from "../../app-shell/types"
import { useLocale } from "../../lib/i18n"
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
  tripDays: TripDay[]
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
  onSelectDay: (dayNumber: number) => void
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
  tripDays,
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
  onSelectDay,
}: AttractionsViewProps) {
  const locationMessageId = "attractions-location-message"
  const { t } = useLocale()
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid")
  const [showRecommendation, setShowRecommendation] = useState(false)

  const nearest = userCoordinate && visiblePlaces.length
    ? [...visiblePlaces].sort(
        (left, right) =>
          haversineKilometres(userCoordinate, left.coordinate)
          - haversineKilometres(userCoordinate, right.coordinate),
      )[0]
    : visiblePlaces[0] ?? null
  const nearestDistance = userCoordinate && nearest ? haversineKilometres(userCoordinate, nearest.coordinate) : null

  return (
    <section className="module-view attractions-view" aria-labelledby="attractions-heading">
      <div className="attractions-top-row">
        {nearest ? (
          <button className="nearest-card" type="button" onClick={() => onOpenDetails(nearest.id)} aria-label={`${t(userCoordinate ? "attr.nearest" : "attr.recommended")}: ${nearest.name}`}>
            <img src={resolvePlaceImage(nearest.id)} alt="" />
            <span>
              <small>{t(userCoordinate ? "attr.nearest" : "attr.recommended")}</small>
              <strong>{nearest.name}</strong>
              {nearestDistance !== null && <em>{nearestDistance.toFixed(1)} km</em>}
            </span>
          </button>
        ) : (
          <div className="nearest-card nearest-card--empty">
            <span>
              <small>{t("attr.recommended")}</small>
              <strong>{t(placesState === "loading" ? "attr.loadingShort" : "attr.empty")}</strong>
            </span>
          </div>
        )}
        <button className="locate-button" type="button" onClick={onRequestLocation} disabled={locationStatus === "loading"} aria-label={t("attr.locate")}>
          {locationStatus === "loading" ? <LoaderCircle className="spin" size={20} /> : <Crosshair size={20} />}
        </button>
      </div>

      <h1 className="attractions-title" id="attractions-heading">{t("attr.title")}</h1>

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

      {locationStatus === "failed" && <p className="location-unavailable" id={locationMessageId}><MapPinOff aria-hidden="true" size={15} />{t("attr.locationUnavailable")}</p>}

      <button className="recommend-toggle" type="button" aria-expanded={showRecommendation} onClick={() => setShowRecommendation((current) => !current)}>
        <Sparkles aria-hidden="true" size={17} />
        {t("attr.personalRecommend")}
        {showRecommendation ? <ChevronUp aria-hidden="true" size={17} /> : <ChevronDown aria-hidden="true" size={17} />}
      </button>

      {showRecommendation && placesState === "ready" && places.length > 0 && (
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

      <label className="attraction-day-picker">
        {t("attr.joinItinerary")}
        <select value={selectedDay} onChange={(event) => onSelectDay(Number(event.target.value))}>
          {tripDays.map((day) => <option key={day.id} value={day.dayNumber}>{t("common.dayN", { n: day.dayNumber })}{day.date ? ` · ${day.date}` : ""}</option>)}
        </select>
      </label>

      {placesState === "loading" && (
        <div className="empty-plan" role="status">
          <LoaderCircle className="spin" aria-hidden="true" size={26} />
          <p>{t("attr.loading")}</p>
        </div>
      )}

      {placesState === "failed" && (
        <div className="empty-plan" role="status">
          <Compass aria-hidden="true" size={28} />
          <h2>{t("attr.unavailable")}</h2>
          <p>{t("attr.savedItinerary")}</p>
        </div>
      )}

      {placesState === "ready" && places.length === 0 && (
        <div className="empty-plan" role="status">
          <Compass aria-hidden="true" size={28} />
          <h2>{t("attr.empty")}</h2>
        </div>
      )}

      {placesState === "ready" && places.length > 0 && visiblePlaces.length === 0 && (
        <div className="empty-plan" role="status">
          <Compass aria-hidden="true" size={28} />
          <h2>{t("attr.noMatch")}</h2>
          <p>{t("attr.widenFilters")}</p>
          <button type="button" className="secondary-button inline-reset-button" onClick={onResetFilters}>
            {t("attr.resetFilters")}
          </button>
        </div>
      )}

      {visiblePlaces.length > 0 && (
        <div className="display-mode-toggle" role="group" aria-label={t("attr.displayMode")}>
          <button type="button" className={displayMode === "grid" ? "is-active" : undefined} aria-pressed={displayMode === "grid"} onClick={() => setDisplayMode("grid")}>
            <LayoutGrid aria-hidden="true" size={16} />{t("attr.grid")}
          </button>
          <button type="button" className={displayMode === "list" ? "is-active" : undefined} aria-pressed={displayMode === "list"} onClick={() => setDisplayMode("list")}>
            <List aria-hidden="true" size={16} />{t("attr.list")}
          </button>
        </div>
      )}

      {visiblePlaces.length > 0 && (
        <div className={displayMode === "grid" ? "place-grid" : "place-grid place-grid--list"}>
          {visiblePlaces.map((place) => (
            <PlaceCard
              key={place.id}
              place={place}
              planned={plannedIds.has(place.id)}
              saved={savedPlaceIds.has(place.id)}
              selectedDay={selectedDay}
              busy={busy}
              userCoordinate={userCoordinate}
              mode={displayMode}
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
