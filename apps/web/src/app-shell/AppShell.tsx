import { LogOut } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { collectPlaceCategories, haversineKilometres } from "../../../../packages/shared/src"
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
  placeRepository,
  places,
  placesState,
  savedPlaceIds,
  trip,
  testIdentity,
  onAddPlace,
  onAddDay,
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
  const [maxDuration, setMaxDuration] = useState<number | undefined>()
  const [nearbyRadius, setNearbyRadius] = useState<NearbyRadius>(3)
  const { coordinate: userCoordinate, status: locationStatus, requestLocation } = useCurrentLocation()

  const plannedIds = useMemo(() => new Set(trip.stops.map((stop) => stop.placeId)), [trip.stops])
  const categories = useMemo(() => collectPlaceCategories(places), [places])
  const visiblePlaces = useMemo(
    () => places.filter((place) =>
      (category === "all" || place.categoryCode === category)
      && (maxDuration === undefined || place.durationMinutes <= maxDuration)
      && (!userCoordinate || haversineKilometres(userCoordinate, place.coordinate) <= nearbyRadius),
    ),
    [category, maxDuration, nearbyRadius, places, userCoordinate],
  )

  useEffect(() => {
    if (!selectedPlaceId && trip.stops[0]?.placeId) setSelectedPlaceId(trip.stops[0].placeId)
  }, [selectedPlaceId, trip.stops])

  const detailPlace = places.find((place) => place.id === detailPlaceId) ?? null

  function showOnMap(placeId: string) {
    setSelectedPlaceId(placeId)
    navigate("/map")
  }

  return (
    <div className="app-shell module-app-shell">
      <header className="app-header">
        <Link className="brand" to="/attractions" aria-label="China Stroll attractions">
          <span className="brand-seal">游</span><span>China Stroll</span>
        </Link>
        <div className="trip-meta">
          <strong>{trip.name}</strong>
          <span>{mode === "preview" ? "Private preview" : testIdentity ? `Test session · ${testIdentity}` : "Shared trip"} · Version {trip.version}</span>
        </div>
        <button className="icon-button" type="button" onClick={() => void onExit()} aria-label="Leave trip">
          <LogOut aria-hidden="true" size={19} />
        </button>
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
                locationStatus={locationStatus}
                maxDuration={maxDuration}
                nearbyRadius={nearbyRadius}
                places={places}
                placesState={placesState}
                plannedIds={plannedIds}
                savedPlaceIds={savedPlaceIds}
                selectedDay={selectedDay}
                userCoordinate={userCoordinate}
                visiblePlaces={visiblePlaces}
                onAddPlace={onAddPlace}
                onCategory={setCategory}
                onDuration={setMaxDuration}
                onOpenDetails={setDetailPlaceId}
                onRadius={setNearbyRadius}
                onRequestLocation={requestLocation}
                onShowOnMap={showOnMap}
                onToggleSaved={onToggleSaved}
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
                onAddPlace={onAddPlace}
                onOpenDetails={setDetailPlaceId}
                onRadius={setNearbyRadius}
                onRequestLocation={requestLocation}
                onSelect={setSelectedPlaceId}
              />
            )}
          />
          <Route path="/tools" element={<ToolsView />} />
          <Route
            path="/me"
            element={(
              <MineView
                busy={busy}
                message={message}
                mode={mode}
                selectedDay={selectedDay}
                selectedPlaceId={selectedPlaceId}
                testIdentity={testIdentity}
                trip={trip}
                onAddDay={onAddDay}
                onConfirm={onConfirm}
                onSelectDay={setSelectedDay}
                onSelectPlace={setSelectedPlaceId}
                onSuggest={onSuggest}
              />
            )}
          />
          <Route path="*" element={<Navigate replace to="/attractions" />} />
        </Routes>
      </main>

      {detailPlace && (
        <PlaceDetailPanel
          place={detailPlace}
          accessToken={accessToken}
          days={trip.days}
          planned={plannedIds.has(detailPlace.id)}
          repository={placeRepository}
          saved={savedPlaceIds.has(detailPlace.id)}
          onClose={() => setDetailPlaceId(null)}
          onAdd={onAddPlace}
          onToggleSaved={onToggleSaved}
        />
      )}
      <BottomNavigation />
    </div>
  )
}
