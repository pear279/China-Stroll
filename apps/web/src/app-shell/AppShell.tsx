import { useEffect, useMemo, useRef, useState } from "react"
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom"
import { collectPlaceCategories, filterPlaceSummaries } from "../../../../packages/shared/src"
import { BrandMark } from "../components/BrandMark"
import { PlaceDetailPanel } from "../components/PlaceDetailPanel"
import { AttractionsView } from "../features/attractions/AttractionsView"
import { MapView } from "../features/map/MapView"
import { EditProfileView } from "../features/me/EditProfileView"
import { MemberProfileView } from "../features/me/MemberProfileView"
import { MineView } from "../features/me/MineView"
import { SavedPlacesView } from "../features/me/SavedPlacesView"
import { VisitedPlacesView } from "../features/me/VisitedPlacesView"
import { ToolsView } from "../features/tools/ToolsView"
import { TranslationAIView } from "../features/tools/TranslationAIView"
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
  profile,
  placeRepository,
  places,
  placesState,
  savedPlaceIds,
  trip,
  completedStopIds,
  completedReservationIds,
  profileExtras,
  onAddPlace,
  onAddDay,
  onToggleStopCompleted,
  onToggleReservationCompleted,
  onSaveProfileExtras,
  onEditTripDates,
  onRemoveStop,
  onReorderStop,
  onCreateReservation,
  onUpdateReservation,
  onRemoveReservation,
  onToggleSaved,
  onExit,
}: AppShellProps) {
  const navigate = useNavigate()
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null)
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
          <span className="brand-seal" aria-hidden="true"><BrandMark /></span><span>China Stroll</span>
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
                placeCatalog={places}
                plannedIds={plannedIds}
                selectedDay={selectedDay}
                selectedPlaceId={selectedPlaceId}
                trip={trip}
                userCoordinate={userCoordinate}
                locationSharing={locationSharing}
                onAddPlace={onAddPlace}
                onOpenDetails={openDetails}
                onRadius={setNearbyRadius}
                onReorderStop={onReorderStop}
                onRequestLocation={requestLocation}
                onSelect={setSelectedPlaceId}
                onSelectDay={setSelectedDay}
              />
            )}
          />
          <Route path="/tools" element={<ToolsView />} />
          <Route path="/tools/translation" element={<TranslationAIView mode={mode} accessToken={accessToken} />} />
          <Route
            path="/me"
            element={(
              <MineView
                mode={mode}
                profile={profile}
                membership={membership}
                profileExtras={profileExtras}
                trip={trip}
                busy={busy}
                message={message}
                itineraryEditing={itineraryEditing}
                places={places}
                selectedDay={selectedDay}
                userCoordinate={userCoordinate}
                completedStopIds={completedStopIds}
                completedReservationIds={completedReservationIds}
                onAddDay={onAddDay}
                onToggleStopCompleted={onToggleStopCompleted}
                onToggleReservationCompleted={onToggleReservationCompleted}
                onEditTripDates={onEditTripDates}
                onRemoveStop={onRemoveStop}
                onReorderStop={onReorderStop}
                onCreateReservation={onCreateReservation}
                onUpdateReservation={onUpdateReservation}
                onRemoveReservation={onRemoveReservation}
                onSelectDay={setSelectedDay}
              />
            )}
          />
          <Route
            path="/me/edit-profile"
            element={(
              <EditProfileView
                message={message}
                profile={profile}
                profileExtras={profileExtras}
                onSaveProfileExtras={onSaveProfileExtras}
                onExit={onExit}
              />
            )}
          />
          <Route path="/me/itinerary" element={<Navigate replace to="/me" />} />
          <Route
            path="/me/saved"
            element={(
              <SavedPlacesView
                busy={busy}
                places={places}
                plannedIds={plannedIds}
                savedPlaceIds={savedPlaceIds}
                selectedDay={selectedDay}
                userCoordinate={userCoordinate}
                onAddPlace={onAddPlace}
                onOpenDetails={openDetails}
                onShowOnMap={showOnMap}
                onToggleSaved={onToggleSaved}
              />
            )}
          />
          <Route
            path="/me/visited"
            element={(
              <VisitedPlacesView
                busy={busy}
                places={places}
                plannedIds={plannedIds}
                savedPlaceIds={savedPlaceIds}
                selectedDay={selectedDay}
                trip={trip}
                completedStopIds={completedStopIds}
                userCoordinate={userCoordinate}
                onAddPlace={onAddPlace}
                onOpenDetails={openDetails}
                onShowOnMap={showOnMap}
                onToggleSaved={onToggleSaved}
              />
            )}
          />
          <Route
            path="/me/member/:userId"
            element={<MemberProfileView membership={membership} />}
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
