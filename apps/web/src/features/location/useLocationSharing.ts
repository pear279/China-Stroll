import { useCallback, useEffect, useRef, useState } from "react"
import type { LocationSharingSnapshot, LocationSharingStatus } from "../../../../../packages/shared/src"
import { api } from "../../lib/api"

type UseLocationSharingOptions = {
  accessToken: string | null
  tripId: string | null
  enabled: boolean
}

export type LocationSharingController = {
  status: LocationSharingStatus
  snapshot: LocationSharingSnapshot | null
  enable: () => Promise<void>
  disable: () => Promise<void>
  retryDisable: () => Promise<void>
}

const positionOptions: PositionOptions = {
  enableHighAccuracy: false,
  maximumAge: 60_000,
  timeout: 15_000,
}

function requestCurrentPosition() {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, positionOptions)
  })
}

export function useLocationSharing({ accessToken, tripId, enabled }: UseLocationSharingOptions): LocationSharingController {
  const available = enabled && Boolean(accessToken && tripId)
  const [status, setStatus] = useState<LocationSharingStatus>(available ? "loading" : "dependency-unavailable")
  const [snapshot, setSnapshot] = useState<LocationSharingSnapshot | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const operationRef = useRef(0)

  const clearForegroundWatch = useCallback(() => {
    if (watchIdRef.current === null) return
    navigator.geolocation?.clearWatch(watchIdRef.current)
    watchIdRef.current = null
  }, [])

  const enableSharing = useCallback(async () => {
    if (!available || !accessToken || !tripId || !navigator.geolocation) {
      setStatus("dependency-unavailable")
      return
    }

    const operation = ++operationRef.current
    clearForegroundWatch()
    setStatus("enabling")
    setSnapshot((current) => current ? { ...current, status: "enabling" } : current)

    let enabledSnapshot: LocationSharingSnapshot
    try {
      enabledSnapshot = await api.setLocationSharing(accessToken, tripId, true)
    } catch {
      if (operationRef.current === operation) setStatus("dependency-unavailable")
      return
    }
    if (operationRef.current !== operation) return
    setSnapshot({ ...enabledSnapshot, status: "enabling" })

    let position: GeolocationPosition
    try {
      position = await requestCurrentPosition()
    } catch {
      try {
        const revokedSnapshot = await api.setLocationSharing(accessToken, tripId, false)
        if (operationRef.current !== operation) return
        setSnapshot({ ...revokedSnapshot, status: "permission-denied" })
        setStatus("permission-denied")
      } catch {
        if (operationRef.current !== operation) return
        setSnapshot({ ...enabledSnapshot, status: "revoke-failed" })
        setStatus("revoke-failed")
      }
      return
    }

    let initialUpload: Pick<LocationSharingSnapshot, "tripId" | "enabled" | "expiresAt">
    try {
      initialUpload = await api.updateCurrentLocation(
        accessToken,
        tripId,
        position.coords.latitude,
        position.coords.longitude,
      )
    } catch {
      try {
        const revokedSnapshot = await api.setLocationSharing(accessToken, tripId, false)
        if (operationRef.current !== operation) return
        setSnapshot({ ...revokedSnapshot, status: "upload-failed" })
        setStatus("upload-failed")
      } catch {
        if (operationRef.current !== operation) return
        setSnapshot({ ...enabledSnapshot, status: "revoke-failed" })
        setStatus("revoke-failed")
      }
      return
    }
    if (operationRef.current !== operation) return

    setSnapshot({ ...enabledSnapshot, enabled: true, expiresAt: initialUpload.expiresAt, status: "sharing" })
    setStatus("sharing")
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        void api.updateCurrentLocation(accessToken, tripId, coords.latitude, coords.longitude).then((upload) => {
          if (operationRef.current !== operation) return
          setSnapshot((current) => current ? {
            ...current,
            enabled: true,
            expiresAt: upload.expiresAt,
            status: "sharing",
          } : current)
          setStatus("sharing")
        }).catch(() => {
          if (operationRef.current !== operation) return
          setSnapshot((current) => current ? { ...current, status: "dependency-unavailable" } : current)
          setStatus("dependency-unavailable")
        })
      },
      () => {
        if (operationRef.current !== operation) return
        clearForegroundWatch()
        setSnapshot((current) => current ? { ...current, status: "permission-denied" } : current)
        setStatus("permission-denied")
      },
      positionOptions,
    )
  }, [accessToken, available, clearForegroundWatch, tripId])

  const disableSharing = useCallback(async () => {
    const operation = ++operationRef.current
    clearForegroundWatch()
    if (!available || !accessToken || !tripId) {
      setStatus("dependency-unavailable")
      return
    }

    setSnapshot((current) => current ? { ...current, status: "revoke-pending" } : current)
    setStatus("revoke-pending")
    try {
      const revokedSnapshot = await api.setLocationSharing(accessToken, tripId, false)
      if (operationRef.current !== operation) return
      setSnapshot(revokedSnapshot)
      setStatus("off")
    } catch {
      if (operationRef.current !== operation) return
      setSnapshot((current) => current ? { ...current, status: "revoke-failed" } : current)
      setStatus("revoke-failed")
    }
  }, [accessToken, available, clearForegroundWatch, tripId])

  useEffect(() => {
    const operation = ++operationRef.current
    clearForegroundWatch()
    if (!available || !accessToken || !tripId) {
      setSnapshot(null)
      setStatus("dependency-unavailable")
      return
    }

    setStatus("loading")
    void api.getLocationSharing(accessToken, tripId).then((nextSnapshot) => {
      if (operationRef.current !== operation) return
      setSnapshot(nextSnapshot)
      if (nextSnapshot.enabled) {
        void enableSharing()
        return
      }
      setStatus(nextSnapshot.status)
    }).catch(() => {
      if (operationRef.current !== operation) return
      setSnapshot(null)
      setStatus("dependency-unavailable")
    })

    return () => {
      operationRef.current += 1
      clearForegroundWatch()
    }
  }, [accessToken, available, clearForegroundWatch, enableSharing, tripId])

  return {
    status,
    snapshot,
    enable: enableSharing,
    disable: disableSharing,
    retryDisable: disableSharing,
  }
}
