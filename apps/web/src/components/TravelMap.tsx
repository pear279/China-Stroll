import { useEffect, useRef, useState } from "react"
import type { Feature, LineString } from "geojson"
import * as maplibregl from "maplibre-gl"
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl"
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import type { TripStop } from "../../../../packages/shared/src"

maplibregl.setWorkerUrl(maplibreWorkerUrl)

type TravelMapProps = {
  stops: TripStop[]
  selectedStopId: string | null
  onSelect: (stopId: string) => void
}

const mapStyle: maplibregl.StyleSpecification = {
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

export function TravelMap({ stops, selectedStopId, onSelect }: TravelMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markersRef = useRef<Marker[]>([])
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: mapStyle,
      center: [116.401, 39.905],
      zoom: 11.5,
      attributionControl: false,
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right")
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right")
    map.on("load", () => setStatus("ready"))
    map.on("error", () => setStatus("failed"))
    mapRef.current = map

    return () => {
      markersRef.current.forEach((marker) => marker.remove())
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    stops.forEach((stop, index) => {
      if (!stop.coordinate) return
      const markerButton = document.createElement("button")
      markerButton.type = "button"
      markerButton.className = `map-marker${selectedStopId === stop.id ? " is-selected" : ""}`
      markerButton.setAttribute("aria-label", `Select ${stop.name}`)
      markerButton.addEventListener("click", () => onSelect(stop.id))
      const markerShape = document.createElement("span")
      markerShape.className = "map-pin"
      const markerLabel = document.createElement("span")
      markerLabel.className = "map-pin-label"
      markerLabel.textContent = String(index + 1)
      markerShape.append(markerLabel)
      markerButton.append(markerShape)
      markersRef.current.push(
        new maplibregl.Marker({ element: markerButton, anchor: "bottom" })
          .setLngLat(stop.coordinate)
          .addTo(map),
      )
    })

    const coordinates = stops.flatMap((stop) => (stop.coordinate ? [stop.coordinate] : []))
    const routeData: Feature<LineString> = {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates },
    }
    const source = map.getSource("trip-line") as GeoJSONSource | undefined
    if (source) {
      source.setData(routeData)
    } else if (map.loaded()) {
      map.addSource("trip-line", { type: "geojson", data: routeData })
      map.addLayer({
        id: "trip-line",
        type: "line",
        source: "trip-line",
        paint: { "line-color": "#b33a2e", "line-width": 3, "line-dasharray": [2, 2] },
      })
    }

    if (coordinates.length > 1) {
      const bounds = coordinates.reduce(
        (value, coordinate) => value.extend(coordinate),
        new maplibregl.LngLatBounds(coordinates[0], coordinates[0]),
      )
      map.fitBounds(bounds, { padding: 70, maxZoom: 13, duration: 500 })
    }
  }, [onSelect, selectedStopId, stops])

  useEffect(() => {
    const selected = stops.find((stop) => stop.id === selectedStopId)
    if (selected?.coordinate) {
      mapRef.current?.flyTo({ center: selected.coordinate, zoom: 13.5, duration: 500 })
    }
  }, [selectedStopId, stops])

  return (
    <div className="map-shell" aria-label="Map of planned places">
      <div ref={containerRef} className="map-canvas" />
      {status !== "ready" && (
        <div className="map-status" role="status">
          {status === "failed" ? "Map tiles are unavailable. Your place list still works." : "Loading map…"}
        </div>
      )}
      {stops.length > 1 && (
        <p className="map-note">The dotted line shows visit order, not a calculated walking route.</p>
      )}
    </div>
  )
}
