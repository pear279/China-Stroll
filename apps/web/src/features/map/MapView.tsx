import { Crosshair, GripVertical, Info, LoaderCircle, MapPinOff, Navigation, ShieldCheck, X } from "lucide-react"
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import type { Coordinate, PlaceSummary, SharedMemberLocation, TripSnapshot, TripStop } from "../../../../../packages/shared/src"
import { formatCategoryLabel, formatDurationHours } from "../../../../../packages/shared/src"
import { amapSearchUrl, appleMapsUrl, baiduMapsUrl, googleMapsUrl, haversineKilometres } from "../../lib/navigation"
import type { LocationSharingControls, LocationStatus, NearbyRadius } from "../../app-shell/types"
import { useLocale } from "../../lib/i18n"

const TravelMap = lazy(() =>
  import("../../components/TravelMap").then((module) => ({ default: module.TravelMap })),
)

export type MapViewProps = {
  locationStatus: LocationStatus
  nearbyRadius: NearbyRadius
  places: PlaceSummary[]
  placeCatalog: PlaceSummary[]
  plannedIds: Set<string | null>
  selectedDay: number
  selectedPlaceId: string | null
  trip: TripSnapshot
  userCoordinate: Coordinate | null
  locationSharing: LocationSharingControls
  onAddPlace: (placeId: string, dayNumber: number) => Promise<void>
  onOpenDetails: (placeId: string) => void
  onRadius: (radius: NearbyRadius) => void
  onReorderStop: (stopId: string, targetIndex: number) => Promise<void>
  onRequestLocation: () => void
  onSelect: (placeId: string | null) => void
  onSelectDay: (dayNumber: number) => void
}

type ActiveFeature = "sharing" | "nearby" | null

export function MapView({
  locationStatus,
  nearbyRadius,
  places,
  placeCatalog,
  plannedIds,
  selectedDay,
  selectedPlaceId,
  trip,
  userCoordinate,
  locationSharing,
  onAddPlace,
  onOpenDetails,
  onRadius,
  onReorderStop,
  onRequestLocation,
  onSelect,
  onSelectDay,
}: MapViewProps) {
  const { t } = useLocale()
  const [activeFeature, setActiveFeature] = useState<ActiveFeature>(null)
  const [navPlaceId, setNavPlaceId] = useState<string | null>(null)
  const selectedPlace = places.find((place) => place.id === selectedPlaceId) ?? null
  const navPlace = places.find((place) => place.id === navPlaceId) ?? null
  const dayStops = [...trip.stops]
    .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const visibleLocationSnapshot = locationSharing.snapshot?.visibleLocations ?? []
  const locationTime = useLiveLocationTime(visibleLocationSnapshot)
  const memberLocations = visibleLocationSnapshot.filter((member) => {
    const expiresAt = Date.parse(member.expiresAt)
    return Number.isFinite(expiresAt) && expiresAt > locationTime
  })

  return (
    <section className="module-view map-view" aria-labelledby="map-heading">
      <header className="map-heading">
        <h1 id="map-heading">{t("map.title")}</h1>
      </header>

      <div className="map-stage">
        <Suspense fallback={<div className="map-shell" role="status"><LoaderCircle className="spin" aria-hidden="true" size={22} />{t("map.loadingMap")}</div>}>
          <TravelMap
            memberLocations={memberLocations}
            stops={trip.stops}
            places={places}
            selectedPlaceId={selectedPlaceId}
            userCoordinate={userCoordinate}
            hintText={t("map.hint")}
            onSelect={(placeId) => onSelect(placeId)}
          />
        </Suspense>
      </div>

      <div className="map-function-buttons" role="group" aria-label={t("map.functions")}>
        <button type="button" className={activeFeature === "sharing" ? "is-active" : undefined} aria-pressed={activeFeature === "sharing"} onClick={() => setActiveFeature((current) => current === "sharing" ? null : "sharing")}>
          <ShieldCheck aria-hidden="true" size={17} />{t("map.shareLocation")}
        </button>
        <button type="button" className={activeFeature === "nearby" ? "is-active" : undefined} aria-pressed={activeFeature === "nearby"} onClick={() => setActiveFeature((current) => current === "nearby" ? null : "nearby")}>
          <Navigation aria-hidden="true" size={17} />{t("map.nearby")}
        </button>
      </div>

      {activeFeature === "sharing" && (
        <LocationSharingPanel
          mode="account"
          status={locationSharing.status}
          snapshot={locationSharing.snapshot}
          onEnable={locationSharing.onEnable}
          onDisable={locationSharing.onDisable}
        />
      )}

      {activeFeature === "nearby" && (
        <div className="map-nearby-panel" aria-label={t("map.nearby")}>
          <button type="button" onClick={onRequestLocation} disabled={locationStatus === "loading"}>
            {locationStatus === "failed" ? <MapPinOff aria-hidden="true" size={16} /> : <Crosshair aria-hidden="true" size={16} />}
            {locationStatus === "loading" ? t("map.locating") : userCoordinate ? t("map.ready") : t("map.useLocation")}
          </button>
          <div className="radius-controls" aria-label={t("attr.distanceSheet")}>
            {([1, 3, 5, 10, 20] as const).map((value) => (
              <button key={value} type="button" className={nearbyRadius === value ? "is-active" : undefined} disabled={!userCoordinate} onClick={() => onRadius(value)}>{value} km</button>
            ))}
          </div>
          {locationStatus === "failed" && <span>{t("map.locationUnavailableBrowse")}</span>}
        </div>
      )}

      <section className="map-trip-area" aria-labelledby="map-trip-heading">
        <div className="map-trip-heading">
          <h2 id="map-trip-heading">{t("map.itinerary")}</h2>
          <div className={`map-day-tabs${trip.days.length <= 3 ? " is-fill" : ""}`} aria-label={t("map.selectDay")}>
            {trip.days.map((day) => <button className={selectedDay === day.dayNumber ? "is-active" : undefined} key={day.id} type="button" onClick={() => onSelectDay(day.dayNumber)}>{t("common.dayN", { n: day.dayNumber })}</button>)}
          </div>
        </div>

        {dayStops.length === 0 ? (
          <p className="map-trip-empty">{t("map.noStops")}</p>
        ) : (
          <MapItineraryList
            stops={dayStops}
            catalog={placeCatalog}
            userCoordinate={userCoordinate}
            selectedPlaceId={selectedPlaceId}
            onSelect={(placeId) => onSelect(placeId)}
            onOpenDetails={onOpenDetails}
            onNavigate={(placeId) => setNavPlaceId(placeId)}
            onReorder={onReorderStop}
          />
        )}
      </section>

      {selectedPlace && (
        <MapPlaceSheet
          key={selectedPlace.id}
          place={selectedPlace}
          planned={plannedIds.has(selectedPlace.id)}
          selectedDay={selectedDay}
          onDetails={() => onOpenDetails(selectedPlace.id)}
          onAdd={() => onAddPlace(selectedPlace.id, selectedDay)}
          onNavigate={() => setNavPlaceId(selectedPlace.id)}
          onClose={() => onSelect(null)}
        />
      )}

      {navPlace && navPlace.coordinate && (
        <NavigationSheet place={navPlace} onCancel={() => setNavPlaceId(null)} />
      )}
    </section>
  )
}

function MapPlaceSheet({ place, planned, selectedDay, onDetails, onAdd, onNavigate, onClose }: {
  place: PlaceSummary
  planned: boolean
  selectedDay: number
  onDetails: () => void
  onAdd: () => Promise<void>
  onNavigate: () => void
  onClose: () => void
}) {
  const { t } = useLocale()
  const sheetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Element | null
      if (!target) return
      if (sheetRef.current?.contains(target)) return
      if (target.closest("[data-map-shell]")) return
      onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  return (
    <section ref={sheetRef} className="map-place-sheet" role="dialog" aria-modal="false" aria-label={t("map.actionSheet", { name: place.name })}>
      <div className="map-place-sheet-heading">
        <div className="map-place-sheet-title">
          <span className="eyebrow">{t("map.reviewed")}</span>
          <h2>{place.name}</h2>
        </div>
        <button type="button" className="map-place-sheet-close" aria-label={t("common.close")} onClick={onClose}><X aria-hidden="true" size={17} /></button>
      </div>
      <div className="map-place-sheet-actions">
        <button type="button" onClick={onDetails}><Info aria-hidden="true" size={16} /><span>{t("common.details")}</span></button>
        <button type="button" disabled={planned} onClick={() => void onAdd()}>{planned ? t("attr.planned") : t("attr.addToDay", { day: selectedDay })}</button>
        <button type="button" onClick={onNavigate}><Navigation aria-hidden="true" size={16} /><span>{t("common.navigate")}</span></button>
      </div>
    </section>
  )
}

const GAP = 8
const ITEM_STEP = 72

type DragState = {
  id: string
  index: number
  startY: number
  dy: number
  targetIndex: number
  itemHeight: number
}

function computeTargetIndex(clientY: number, dragId: string, stops: TripStop[], refs: Record<string, HTMLLIElement | null>) {
  let target = 0
  for (const stop of stops) {
    if (stop.id === dragId) continue
    const element = refs[stop.id]
    if (!element) continue
    const rect = element.getBoundingClientRect()
    if (rect.top + rect.height / 2 < clientY) target += 1
  }
  return Math.max(0, Math.min(stops.length - 1, target))
}

function shiftFor(index: number, drag: DragState | null) {
  if (!drag || index === drag.index) return 0
  if (drag.targetIndex > drag.index && index > drag.index && index <= drag.targetIndex) return -drag.itemHeight
  if (drag.targetIndex < drag.index && index >= drag.targetIndex && index < drag.index) return drag.itemHeight
  return 0
}

function stopMetaParts(stop: TripStop, place: PlaceSummary | undefined, userCoordinate: Coordinate | null): string[] {
  const parts: string[] = []
  if (place) parts.push(formatCategoryLabel(place.categoryCode))
  const duration = stop.durationMinutes ?? place?.durationMinutes ?? null
  if (duration != null && duration > 0) parts.push(formatDurationHours(duration))
  if (userCoordinate && stop.coordinate) {
    parts.push(`${haversineKilometres(userCoordinate, stop.coordinate).toFixed(1)} km`)
  }
  return parts
}

function MapItineraryList({ stops, catalog, userCoordinate, selectedPlaceId, onSelect, onOpenDetails, onNavigate, onReorder }: {
  stops: TripStop[]
  catalog: PlaceSummary[]
  userCoordinate: Coordinate | null
  selectedPlaceId: string | null
  onSelect: (placeId: string | null) => void
  onOpenDetails: (placeId: string) => void
  onNavigate: (placeId: string) => void
  onReorder: (stopId: string, targetIndex: number) => Promise<void>
}) {
  const { t } = useLocale()
  const catalogById = useMemo(() => new Map(catalog.map((place) => [place.id, place])), [catalog])
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag
  const stopsRef = useRef(stops)
  stopsRef.current = stops
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const itemRefs = useRef<Record<string, HTMLLIElement | null>>({})

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const current = dragRef.current
      if (!current) return
      if (event.cancelable) event.preventDefault()
      const dy = event.clientY - current.startY
      const targetIndex = computeTargetIndex(event.clientY, current.id, stopsRef.current, itemRefs.current)
      setDrag({ ...current, dy, targetIndex })
    }
    function handleUp(event: PointerEvent) {
      const current = dragRef.current
      if (!current) return
      if (event.cancelable) event.preventDefault()
      setDrag(null)
      if (current.targetIndex !== current.index) {
        void onReorderRef.current(current.id, current.targetIndex)
      }
    }
    function handleCancel() {
      setDrag(null)
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
    }
  }, [])

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, stop: TripStop) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    const index = stopsRef.current.findIndex((item) => item.id === stop.id)
    const element = itemRefs.current[stop.id]
    const itemHeight = element ? element.getBoundingClientRect().height + GAP : ITEM_STEP
    event.preventDefault()
    setDrag({ id: stop.id, index, startY: event.clientY, dy: 0, targetIndex: index, itemHeight })
  }

  return (
    <ol className="map-itinerary-list">
      {stops.map((stop, index) => {
        const isDragging = drag?.id === stop.id
        const shift = shiftFor(index, drag)
        const place = stop.placeId ? catalogById.get(stop.placeId) : undefined
        const meta = stopMetaParts(stop, place, userCoordinate).join(" · ")
        return (
          <li
            key={stop.id}
            ref={(element) => { itemRefs.current[stop.id] = element }}
            className={`map-itinerary-item${selectedPlaceId === stop.placeId ? " is-selected" : ""}${isDragging ? " is-dragging" : ""}`}
            style={isDragging ? { transform: `translateY(${drag?.dy ?? 0}px) scale(1.02)`, zIndex: 3 } : shift !== 0 ? { transform: `translateY(${shift}px)` } : undefined}
          >
            <div className="map-itinerary-rail">
              <button
                type="button"
                className="map-itinerary-handle"
                aria-label={t("map.reorder", { name: stop.name })}
                onPointerDown={(event) => startDrag(event, stop)}
              >
                <GripVertical aria-hidden="true" size={16} />
              </button>
              <span className="map-itinerary-number" aria-hidden="true">{index + 1}</span>
            </div>
            <div className="map-itinerary-body">
              <button
                type="button"
                className="map-itinerary-main"
                onClick={() => stop.placeId && onSelect(stop.placeId)}
              >
                <span className="map-itinerary-name">{stop.name}{stop.privatePlaceId ? ` · ${t("map.private")}` : ""}</span>
                {meta ? <span className="map-itinerary-meta">{meta}</span> : null}
              </button>
              <div className="map-itinerary-actions">
                <button type="button" aria-label={t("attr.detailsFor", { name: stop.name })} onClick={() => stop.placeId && onOpenDetails(stop.placeId)}>
                  <Info aria-hidden="true" size={15} />
                  <span>{t("common.details")}</span>
                </button>
                <button type="button" aria-label={`${stop.name} ${t("common.navigate")}`} disabled={!stop.coordinate} onClick={() => stop.placeId && onNavigate(stop.placeId)}>
                  <Navigation aria-hidden="true" size={15} />
                  <span>{t("common.navigate")}</span>
                </button>
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

function NavigationSheet({ place, onCancel }: { place: PlaceSummary; onCancel: () => void }) {
  const { t } = useLocale()
  return (
    <div className="navigation-sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="navigation-sheet" role="dialog" aria-modal="true" aria-label={t("map.chooseProvider")}>
        <div className="navigation-sheet-heading">
          <strong>{place.name}</strong>
          <button type="button" aria-label={t("common.close")} onClick={onCancel}><X size={18} /></button>
        </div>
        <nav className="navigation-links" aria-label={t("map.thirdParty")}>
          <a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps</a>
          <a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps</a>
          <a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">{t("map.amap")}</a>
          <a href={baiduMapsUrl(place.name)} target="_blank" rel="noreferrer">{t("map.baidu")}</a>
        </nav>
        <button className="navigation-sheet-cancel" type="button" onClick={onCancel}>{t("common.cancel")}</button>
      </section>
    </div>
  )
}

function LocationSharingPanel({ mode, status, snapshot, onEnable, onDisable }: {
  mode: "account"
  status: LocationSharingControls["status"]
  snapshot: LocationSharingControls["snapshot"]
  onEnable: () => Promise<void>
  onDisable: () => Promise<void>
}) {
  const { t } = useLocale()
  const checked = snapshot?.enabled ?? false
  const waiting = status === "loading" || status === "enabling" || status === "revoke-pending"

  let statusText = t("map.shareOff")
  if (mode === "account" && status === "loading") statusText = t("map.shareChecking")
  else if (status === "sharing") statusText = t("map.sharingWith", { n: Math.max(0, (snapshot?.activeMemberCount ?? 1) - 1) })
  else if (status === "permission-denied") statusText = t("map.shareDenied")
  else if (status === "dependency-unavailable") statusText = t("map.shareUnavailable")
  else if (status === "revoke-pending") statusText = t("map.shareRevoking")

  return (
    <div className="map-sharing-panel">
      <div className="map-sharing-copy">
        <ShieldCheck aria-hidden="true" size={18} />
        <div>
          <strong>{t("map.shareLocation")}</strong>
          <p>{statusText}</p>
        </div>
      </div>
      <button className={checked ? "is-active" : undefined} role="switch" aria-checked={checked} disabled={waiting} onClick={() => void (checked ? onDisable() : onEnable())}>
        {checked ? t("map.shareDisable") : t("map.shareEnable")}
      </button>
      {snapshot?.visibleLocations && snapshot.visibleLocations.length > 0 && (
        <ul className="map-sharing-members">
          {snapshot.visibleLocations.map((member) => <li key={member.userId}>{member.displayName}</li>)}
        </ul>
      )}
    </div>
  )
}

function useLiveLocationTime(locations: SharedMemberLocation[]) {
  const [now, setNow] = useState(() => Date.now())
  const currentTime = Date.now()

  useEffect(() => {
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
  }
  return nextDelay === null ? null : Math.max(1, Math.min(nextDelay, 2_147_000_000))
}
