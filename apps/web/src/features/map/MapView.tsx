import { Clock3, Crosshair, ExternalLink, LoaderCircle, MapPinOff, Navigation, ShieldCheck, X } from "lucide-react"
import { lazy, Suspense, useEffect, useState } from "react"
import type { Coordinate, PlaceSummary, SharedMemberLocation, TripSnapshot } from "../../../../../packages/shared/src"
import { amapSearchUrl, appleMapsUrl, baiduMapsUrl, googleMapsUrl } from "../../lib/navigation"
import type { LocationSharingControls, LocationStatus, NearbyRadius } from "../../app-shell/types"

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
          <span className="eyebrow">地图</span>
          <h1 id="map-heading">地图</h1>
        </div>
      </header>

      <div className="map-stage">
        <Suspense fallback={<div className="map-shell" role="status"><LoaderCircle className="spin" aria-hidden="true" size={22} />加载地图…</div>}>
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

      <div className="map-function-buttons" role="group" aria-label="地图功能">
        <button type="button" className={activeFeature === "sharing" ? "is-active" : undefined} aria-pressed={activeFeature === "sharing"} onClick={() => setActiveFeature((current) => current === "sharing" ? null : "sharing")}>
          <ShieldCheck aria-hidden="true" size={17} />共享位置
        </button>
        <button type="button" className={activeFeature === "nearby" ? "is-active" : undefined} aria-pressed={activeFeature === "nearby"} onClick={() => setActiveFeature((current) => current === "nearby" ? null : "nearby")}>
          <Navigation aria-hidden="true" size={17} />附近景点
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
        <div className="map-nearby-panel" aria-label="附近景点">
          <button type="button" onClick={onRequestLocation} disabled={locationStatus === "loading"}>
            {locationStatus === "failed" ? <MapPinOff aria-hidden="true" size={16} /> : <Crosshair aria-hidden="true" size={16} />}
            {locationStatus === "loading" ? "定位中…" : userCoordinate ? "定位已就绪" : "使用我的位置"}
          </button>
          <div className="radius-controls" aria-label="距离范围">
            {([1, 3, 5, 10, 20] as const).map((value) => (
              <button key={value} type="button" className={nearbyRadius === value ? "is-active" : undefined} disabled={!userCoordinate} onClick={() => onRadius(value)}>{value} km</button>
            ))}
          </div>
          {locationStatus === "failed" && <span>定位不可用，地图浏览仍可用。</span>}
        </div>
      )}

      <section className="map-trip-area" aria-labelledby="map-trip-heading">
        <div className="map-trip-heading">
          <h2 id="map-trip-heading">行程</h2>
          <div className="day-tabs" aria-label="选择日程">
            {trip.days.map((day) => <button className={selectedDay === day.dayNumber ? "is-active" : undefined} key={day.id} type="button" onClick={() => onSelectDay(day.dayNumber)}>第 {day.dayNumber} 天</button>)}
          </div>
        </div>

        {dayStops.length === 0 ? (
          <p className="map-trip-empty">该日程暂无景点。</p>
        ) : (
          <ol className="map-itinerary-list">
            {dayStops.map((stop, index) => (
              <li key={stop.id}>
                <button type="button" className={selectedPlaceId === stop.placeId ? "is-selected" : undefined} onClick={() => stop.placeId && onSelect(stop.placeId)}>
                  <span className="map-itinerary-number">{index + 1}</span>
                  <span className="map-itinerary-copy">
                    <strong>{stop.name}{stop.privatePlaceId ? " · 私人" : ""}</strong>
                    <small><Clock3 aria-hidden="true" size={13} />{stop.startTime ? stop.startTime.slice(0, 5) : "时间待定"} · {stop.durationMinutes ?? 90} 分钟</small>
                  </span>
                </button>
                <div className="map-itinerary-actions">
                  <button type="button" aria-label={`${stop.name} 详情`} onClick={() => stop.placeId && onOpenDetails(stop.placeId)}>详情</button>
                  <button type="button" aria-label={`${stop.name} 导航`} disabled={!stop.coordinate} onClick={() => setNavPlaceId(stop.placeId)}>导航</button>
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
  const [navigationExpanded, setNavigationExpanded] = useState(false)

  return (
    <section className="map-action-sheet" role="dialog" aria-modal="false" aria-label={`${place.name} 地图操作`}>
      <div className="map-action-heading">
        <div><span className="eyebrow">已审核景点</span><h2>{place.name}</h2></div>
        <button type="button" aria-label="取消" onClick={onCancel}><X aria-hidden="true" size={19} /></button>
      </div>
      <div className="map-action-buttons">
        <button type="button" onClick={onDetails}>详情</button>
        <button type="button" disabled={planned} onClick={() => void onAdd()}>{planned ? "已加入" : `加入第 ${selectedDay} 天`}</button>
        <button type="button" onClick={() => setNavigationExpanded((current) => !current)}><Navigation aria-hidden="true" size={16} />导航</button>
      </div>
      {navigationExpanded && (
        <nav className="navigation-links" aria-label="选择导航平台">
          <a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps <ExternalLink aria-hidden="true" size={14} /></a>
          <a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps <ExternalLink aria-hidden="true" size={14} /></a>
          <a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">高德地图 <ExternalLink aria-hidden="true" size={14} /></a>
          <a href={baiduMapsUrl(place.name)} target="_blank" rel="noreferrer">百度地图 <ExternalLink aria-hidden="true" size={14} /></a>
        </nav>
      )}
    </section>
  )
}

function NavigationSheet({ place, onCancel }: { place: PlaceSummary; onCancel: () => void }) {
  return (
    <div className="navigation-sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <section className="navigation-sheet" role="dialog" aria-modal="true" aria-label="选择导航平台">
        <div className="navigation-sheet-heading">
          <strong>{place.name}</strong>
          <button type="button" aria-label="关闭" onClick={onCancel}><X size={18} /></button>
        </div>
        <nav className="navigation-links" aria-label="第三方地图平台">
          <a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps</a>
          <a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps</a>
          <a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">高德地图</a>
          <a href={baiduMapsUrl(place.name)} target="_blank" rel="noreferrer">百度地图</a>
        </nav>
        <button className="navigation-sheet-cancel" type="button" onClick={onCancel}>取消</button>
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
  const checked = snapshot?.enabled ?? false
  const waiting = status === "loading" || status === "enabling" || status === "revoke-pending"

  let statusText = "位置共享已关闭"
  if (mode === "account" && status === "loading") statusText = "检查位置共享…"
  else if (status === "sharing") statusText = `正在与 ${Math.max(0, (snapshot?.activeMemberCount ?? 1) - 1)} 位同行成员共享当前位置。`
  else if (status === "permission-denied") statusText = "定位权限被拒绝，位置共享已关闭。"
  else if (status === "dependency-unavailable") statusText = "位置共享暂时不可用。"
  else if (status === "revoke-pending") statusText = "正在撤销…"

  return (
    <div className="map-sharing-panel">
      <div className="map-sharing-copy">
        <ShieldCheck aria-hidden="true" size={18} />
        <div>
          <strong>共享位置</strong>
          <p>{statusText}</p>
        </div>
      </div>
      <button className={checked ? "is-active" : undefined} role="switch" aria-checked={checked} disabled={waiting} onClick={() => void (checked ? onDisable() : onEnable())}>
        {checked ? "关闭共享" : "开启共享"}
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
