import { useEffect, useMemo, useRef, type MouseEvent as ReactMouseEvent } from "react"
import type { Map as MapLibreMap, StyleSpecification } from "maplibre-gl"
import { Map, MapMarker, MapRoute, MarkerContent } from "../../../../components/ui/map"
import type { PlaceSummary, SharedMemberLocation, TripStop } from "../../../../packages/shared/src"

type TravelMapProps = {
  memberLocations: SharedMemberLocation[]
  stops: TripStop[]
  places: PlaceSummary[]
  selectedPlaceId: string | null
  userCoordinate: [number, number] | null
  hintText?: string
  onSelect: (placeId: string | null) => void
}

const mapStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

export function TravelMap({ memberLocations, stops, places, selectedPlaceId, userCoordinate, hintText = "Dashed line = visit order", onSelect }: TravelMapProps) {
  const mapRef = useRef<MapLibreMap | null>(null)
  const stopIds = useMemo(() => new Set(stops.map((stop) => stop.placeId)), [stops])
  const routeCoordinates = useMemo(
    () => [...stops].sort((a, b) => a.sortOrder - b.sortOrder).flatMap((stop) => stop.coordinate ? [stop.coordinate] : []),
    [stops],
  )

  useEffect(() => {
    const selected = places.find((place) => place.id === selectedPlaceId)
      ?? stops.find((stop) => stop.placeId === selectedPlaceId)
    if (selected?.coordinate) mapRef.current?.flyTo({ center: selected.coordinate, zoom: 14, duration: 450 })
  }, [places, selectedPlaceId, stops])

  function handleShellClick(event: ReactMouseEvent<HTMLDivElement>) {
    const target = event.target as Element | null
    if (!target) return
    // Markers and interactive controls handle their own taps; only a tap on
    // empty map canvas should clear the current selection.
    if (target.closest(".maplibregl-marker") || target.closest("button") || target.closest("a")) return
    onSelect(null)
  }

  return (
    <div className="map-shell" data-map-shell aria-label="Map of planned and nearby places" onClick={handleShellClick}>
      <Map
        ref={mapRef}
        className="map-canvas"
        styles={{ light: mapStyle, dark: mapStyle }}
        center={[116.401, 39.905]}
        zoom={11.5}
      >
        {places.map((place, index) => place.coordinate && (
          <MapMarker
            key={place.id}
            longitude={place.coordinate[0]}
            latitude={place.coordinate[1]}
            anchor="bottom"
            onClick={() => onSelect(place.id)}
          >
            <MarkerContent>
              <button
                type="button"
                className={`map-marker${selectedPlaceId === place.id ? " is-selected" : ""}${stopIds.has(place.id) ? " is-planned" : ""}`}
                aria-label={`Select ${place.name}`}
              >
                <span className="map-pin"><span className="map-pin-label">{index + 1}</span></span>
              </button>
            </MarkerContent>
          </MapMarker>
        ))}
        {userCoordinate && (
          <MapMarker longitude={userCoordinate[0]} latitude={userCoordinate[1]} anchor="center">
            <MarkerContent><span className="user-location-marker" aria-label="Your approximate location" /></MarkerContent>
          </MapMarker>
        )}
        {memberLocations.map((member) => (
          <MapMarker
            key={member.userId}
            longitude={member.coordinate[0]}
            latitude={member.coordinate[1]}
            anchor="center"
          >
            <MarkerContent>
              <span
                className="member-location-marker"
                aria-label={`${member.displayName}’s shared current location`}
              >
                {member.initials}
              </span>
            </MarkerContent>
          </MapMarker>
        ))}
        {routeCoordinates.length > 1 && (
          <MapRoute id="trip" coordinates={routeCoordinates} color="#b33a2e" width={3} dashArray={[2, 2]} />
        )}
      </Map>
      {routeCoordinates.length > 1 && <p className="map-hint">{hintText}</p>}
    </div>
  )
}
