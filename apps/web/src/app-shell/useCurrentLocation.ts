import { useState } from "react"
import type { Coordinate } from "../../../../packages/shared/src"
import type { LocationStatus } from "./types"

export function useCurrentLocation() {
  const [coordinate, setCoordinate] = useState<Coordinate | null>(null)
  const [status, setStatus] = useState<LocationStatus>("idle")

  function requestLocation() {
    if (!navigator.geolocation) {
      setStatus("failed")
      return
    }

    setStatus("loading")
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setCoordinate([coords.longitude, coords.latitude])
        setStatus("ready")
      },
      () => setStatus("failed"),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 },
    )
  }

  return { coordinate, status, requestLocation }
}
