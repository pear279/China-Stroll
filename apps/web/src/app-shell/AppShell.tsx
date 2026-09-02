import { useEffect, useMemo, useRef, useState } from "react"
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { collectPlaceCategories, filterPlaceSummaries } from "../../../../packages/shared/src"
import { PlaceDetailPanel } from "../components/PlaceDetailPanel"
import { AttractionsView } from "../features/attractions/AttractionsView"
import { MapView } from "../features/map/MapView"
import { MineView } from "../features/me/MineView"
import { ToolsView } from "../features/tools/ToolsView"
import { BottomNavigation } from "./BottomNavigation"
import type { AppShellProps, NearbyRadius } from "./types"
import { useCurrentLocation } from "./useCurrentLocation"

export function AppShell({
  accessToken,
  busy,
  message,
  mode,
  itineraryEditing,
  locationSharing,
  membership,
  privatePlaces,
  profile,
  placeRepository,
  places,
  placesState,
  savedPlaceIds,
  trip,
  testIdentity,
  onAddPlace,
  onAddDay,
  onRemoveStop,
  onReorderStop,
  onCreateReservation,
  onUpdateReservation,
  onRemoveReservation,
  onToggleSaved,
  onConfirm,
  onSuggest,
  onExit,
}: AppShellProps) {
  const navigate = useNavigate()
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(trip.stops[0]?.placeId ?? null)
  const [detailPlaceId, setDetailPlaceId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState(trip.days[0]?.dayNumber ?? 1)
  const [category, setCategory] = useState("all")
  const [query, setQuery] = useState("")
  const [maxDuration, setMaxDuration] = useState<number | undefined>()
  const [nearbyRadius, setNearbyRadius] = useState<NearbyRadius>(3)
  const detailOpenerRef = useRef<HTMLElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const { coordinate: userCoordinate, status: locationStatus, requestLocation } = useCurrentLocation()

  const plannedIds = useMemo(() => new Set(trip.stops.map((stop) => stop.placeId)), [trip.stops])
  const categories = useMemo(() => collectPlaceCategories(places), [places])
  const visiblePlaces = useMemo(
    () =>
      filterPlaceSummaries(places, {
        query,
        category,
        maxDurationMinutes: maxDuration,
        coordinate: userCoordinate,
        radiusKm: userCoordinate ? nearbyRadius : null,
      }),
    [category, maxDuration, nearbyRadius, places, query, userCoordinate],
  )

  useEffect(() => {
    if (!selectedPlaceId && trip.stops[0]?.placeId) setSelectedPlaceId(trip.stops[0].placeId)
  }, [selectedPlaceId, trip.stops])

  useEffect(() => {
    if (!detailPlaceId && restoreFocusRef.current) {
      restoreFocusRef.current.focus()
      restoreFocusRef.current = null
    }
  }, [detailPlaceId])

  const detailPlace = places.find((place) => place.id === detailPlaceId) ?? null

  function showOnMap(placeId: string) {
    setSelectedPlaceId(placeId)
    navigate("/map")
  }

  function openDetails(placeId: string) {
    detailOpenerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDetailPlaceId(placeId)
  }

  function closeDetails() {
    restoreFocusRef.current = detailOpenerRef.current
    setDetailPlaceId(null)
  }

  return (
    <div className="app-shell module-app-shell">
      <header className="app-header">
        <Link className="brand" to="/attractions" aria-label="China Stroll attractions">
          <span className="brand-seal">游</span><span>China Stroll</span>
        </Link>
        <Link className="header-avatar" to="/me" aria-label="Open your profile">
          {profile.profile?.displayName?.trim()?.[0]?.toUpperCase() ?? "游"}
        </Link>
      </header>

      <main className="module-main">
        <Routes>
          <Route
            path="/attractions"
            element={(
              <AttractionsView
                busy={busy}
                categories={categories}
                category={category}
                locale={trip.locale}
                locationStatus={locationStatus}
                maxDuration={maxDuration}
                nearbyRadius={nearbyRadius}
                places={places}
                placesState={placesState}
                plannedIds={plannedIds}
                query={query}
                savedPlaceIds={savedPlaceIds}
                selectedDay={selectedDay}
                tripDays={trip.days}
                userCoordinate={userCoordinate}
                visiblePlaces={visiblePlaces}
                onAddPlace={onAddPlace}
                onCategory={setCategory}
                onDuration={setMaxDuration}
                onOpenDetails={openDetails}
                onQuery={setQuery}
                onRecommendPlaces={placeRepository.recommendPlaces.bind(placeRepository)}
                onRadius={setNearbyRadius}
                onRequestLocation={requestLocation}
                onResetFilters={() => {
                  setQuery("")
                  setCategory("all")
                  setMaxDuration(undefined)
                  setNearbyRadius(3)
                }}
                onShowOnMap={showOnMap}
                onToggleSaved={onToggleSaved}
                onSelectDay={setSelectedDay}
              />
            )}
          />
          <Route
            path="/map"
            element={(
              <MapView
                locationStatus={locationStatus}
                nearbyRadius={nearbyRadius}
                places={visiblePlaces}
                plannedIds={plannedIds}
                selectedDay={selectedDay}
                selectedPlaceId={selectedPlaceId}
                trip={trip}
                userCoordinate={userCoordinate}
                locationSharing={locationSharing}
                onAddPlace={onAddPlace}
                onOpenDetails={openDetails}
                onRadius={setNearbyRadius}
                onRequestLocation={requestLocation}
                onSelect={setSelectedPlaceId}
                onSelectDay={setSelectedDay}
              />
            )}
          />
          <Route path="/tools" element={<ToolsView mode={mode} accessToken={accessToken} />} />
          <Route
            path="/me"
            element={(
              <MineView
                busy={busy}
                message={message}
                mode={mode}
                itineraryEditing={itineraryEditing}
                locationSharing={locationSharing}
                membership={membership}
                privatePlaces={privatePlaces}
                profile={profile}
                places={places}
                selectedDay={selectedDay}
                selectedPlaceId={selectedPlaceId}
                testIdentity={testIdentity}
                trip={trip}
                onAddDay={onAddDay}
                onAddPlace={onAddPlace}
                onConfirm={onConfirm}
                onRemoveStop={onRemoveStop}
                onReorderStop={onReorderStop}
                onCreateReservation={onCreateReservation}
                onUpdateReservation={onUpdateReservation}
                onRemoveReservation={onRemoveReservation}
                onSelectDay={setSelectedDay}
                onSelectPlace={setSelectedPlaceId}
                onSuggest={onSuggest}
                onExit={onExit}
              />
            )}
          />
          <Route path="*" element={<Navigate replace to="/attractions" />} />
        </Routes>
      </main>

      {detailPlace && (
        <PlaceDetailPanel
          place={detailPlace}
          days={trip.days}
          planned={plannedIds.has(detailPlace.id)}
          repository={placeRepository}
          saved={savedPlaceIds.has(detailPlace.id)}
          onClose={closeDetails}
          onAdd={onAddPlace}
          onAddDay={onAddDay}
          onToggleSaved={onToggleSaved}
        />
      )}
      <BottomNavigation />
    </div>
  )
}
