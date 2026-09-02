import { Clock3, Crosshair, ExternalLink, LoaderCircle, MapPinOff, Navigation, ShieldCheck, X } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import type { Coordinate, PlaceSummary, SharedMemberLocation, TripSnapshot } from "../../../../../packages/shared/src"
import { amapSearchUrl, appleMapsUrl, baiduMapsUrl, googleMapsUrl } from "../../lib/navigation"
import type { LocationSharingControls, LocationStatus, NearbyRadius } from "../../app-shell/types"
import { useLocale } from "../../lib/i18n"

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

type ActiveFeature = "sharing" | "nearby" | null

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
      <header className="module-heading">
        <div>
          <span className="eyebrow">{t("map.title")}</span>
          <h1 id="map-heading">{t("map.title")}</h1>
        </div>
      </header>

      <div className="map-stage">
        <Suspense fallback={<div className="map-shell" role="status"><LoaderCircle className="spin" aria-hidden="true" size={22} />{t("map.loadingMap")}</div>}>
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
          <div className="day-tabs" aria-label={t("map.selectDay")}>
            {trip.days.map((day) => <button className={selectedDay === day.dayNumber ? "is-active" : undefined} key={day.id} type="button" onClick={() => onSelectDay(day.dayNumber)}>{t("common.dayN", { n: day.dayNumber })}</button>)}
          </div>
        </div>

        {dayStops.length === 0 ? (
          <p className="map-trip-empty">{t("map.noStops")}</p>
        ) : (
          <ol className="map-itinerary-list">
            {dayStops.map((stop, index) => (
              <li key={stop.id}>
                <button type="button" className={selectedPlaceId === stop.placeId ? "is-selected" : undefined} onClick={() => stop.placeId && onSelect(stop.placeId)}>
                  <span className="map-itinerary-number">{index + 1}</span>
                  <span className="map-itinerary-copy">
                    <strong>{stop.name}{stop.privatePlaceId ? ` · ${t("map.private")}` : ""}</strong>
                    <small><Clock3 aria-hidden="true" size={13} />{stop.startTime ? stop.startTime.slice(0, 5) : t("map.timeOpen")} · {stop.durationMinutes ?? 90} {t("map.minutes")}</small>
                  </span>
                </button>
                <div className="map-itinerary-actions">
                  <button type="button" aria-label={t("attr.detailsFor", { name: stop.name })} onClick={() => stop.placeId && onOpenDetails(stop.placeId)}>{t("common.details")}</button>
                  <button type="button" aria-label={`${stop.name} ${t("common.navigate")}`} disabled={!stop.coordinate} onClick={() => setNavPlaceId(stop.placeId)}>{t("common.navigate")}</button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {navPlace && navPlace.coordinate && (
        <NavigationSheet place={navPlace} onCancel={() => setNavPlaceId(null)} />
      )}
    </section>
  )
}

function MapActionSheet({ place, planned, selectedDay, onDetails, onAdd, onCancel }: {
  place: PlaceSummary
  planned: boolean
  selectedDay: number
  onDetails: () => void
  onAdd: () => Promise<void>
  onCancel: () => void
}) {
  const { t } = useLocale()
  const [navigationExpanded, setNavigationExpanded] = useState(false)

  return (
    <section className="map-action-sheet" role="dialog" aria-modal="false" aria-label={t("map.actionSheet", { name: place.name })}>
      <div className="map-action-heading">
        <div><span className="eyebrow">{t("map.reviewed")}</span><h2>{place.name}</h2></div>
        <button type="button" aria-label={t("common.cancel")} onClick={onCancel}><X aria-hidden="true" size={19} /></button>
      </div>
      <div className="map-action-buttons">
        <button type="button" onClick={onDetails}>{t("common.details")}</button>
        <button type="button" disabled={planned} onClick={() => void onAdd()}>{planned ? t("attr.planned") : t("attr.addToDay", { day: selectedDay })}</button>
        <button type="button" onClick={() => setNavigationExpanded((current) => !current)}><Navigation aria-hidden="true" size={16} />{t("common.navigate")}</button>
      </div>
      {navigationExpanded && (
        <nav className="navigation-links" aria-label={t("map.chooseProvider")}>
          <a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps <ExternalLink aria-hidden="true" size={14} /></a>
          <a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps <ExternalLink aria-hidden="true" size={14} /></a>
          <a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">{t("map.amap")} <ExternalLink aria-hidden="true" size={14} /></a>
          <a href={baiduMapsUrl(place.name)} target="_blank" rel="noreferrer">{t("map.baidu")} <ExternalLink aria-hidden="true" size={14} /></a>
        </nav>
      )}
    </section>
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
