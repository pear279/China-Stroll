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

function locationFailureStatus(error: unknown): LocationSharingStatus {
  return typeof error === "object" && error !== null && "code" in error && error.code === 1
    ? "permission-denied"
    : "dependency-unavailable"
}

async function revokeStaleSharing(accessToken: string, tripId: string) {
  try {
    await api.setLocationSharing(accessToken, tripId, false)
  } catch {
    // A stale scope has no mounted UI to update. The server expiry remains the fallback.
  }
}

type PendingEnableScope = {
  accessToken: string
  revokePromise: Promise<void> | null
  serverEnabled: boolean
  tripId: string
}

function compensatePendingEnable(scope: PendingEnableScope) {
  if (!scope.serverEnabled && !scope.revokePromise) return Promise.resolve()
  if (!scope.revokePromise) {
    scope.serverEnabled = false
    scope.revokePromise = revokeStaleSharing(scope.accessToken, scope.tripId)
  }
  return scope.revokePromise
}

export function useLocationSharing({ accessToken, tripId, enabled }: UseLocationSharingOptions): LocationSharingController {
  const available = enabled && Boolean(accessToken && tripId)
  const [status, setStatus] = useState<LocationSharingStatus>(available ? "loading" : "dependency-unavailable")
  const [snapshot, setSnapshot] = useState<LocationSharingSnapshot | null>(null)
  const watchIdRef = useRef<number | null>(null)
  const operationRef = useRef(0)
  const pendingEnableRef = useRef<PendingEnableScope | null>(null)

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
    const isStale = () => operationRef.current !== operation
    const previousPendingEnable = pendingEnableRef.current
    if (previousPendingEnable) void compensatePendingEnable(previousPendingEnable)
    const pendingEnable: PendingEnableScope = {
      accessToken,
      revokePromise: null,
      serverEnabled: false,
      tripId,
    }
    pendingEnableRef.current = pendingEnable
    clearForegroundWatch()
    setStatus("enabling")
    setSnapshot((current) => current ? { ...current, status: "enabling" } : current)

    let enabledSnapshot: LocationSharingSnapshot
    try {
      enabledSnapshot = await api.setLocationSharing(accessToken, tripId, true)
    } catch {
      if (!isStale()) setStatus("dependency-unavailable")
      return
    }
    pendingEnable.serverEnabled = true
    if (isStale()) {
      await compensatePendingEnable(pendingEnable)
      return
    }
    setSnapshot({ ...enabledSnapshot, status: "enabling" })

    let position: GeolocationPosition
    try {
      position = await requestCurrentPosition()
    } catch (error) {
      if (isStale()) {
        await compensatePendingEnable(pendingEnable)
        return
      }
      const failureStatus = locationFailureStatus(error)
      try {
        const revokedSnapshot = await api.setLocationSharing(accessToken, tripId, false)
        if (isStale()) return
        pendingEnable.serverEnabled = false
        if (pendingEnableRef.current === pendingEnable) pendingEnableRef.current = null
        setSnapshot({ ...revokedSnapshot, status: failureStatus })
        setStatus(failureStatus)
      } catch {
        if (isStale()) return
        setSnapshot({ ...enabledSnapshot, status: "revoke-failed" })
        setStatus("revoke-failed")
      }
      return
    }
    if (isStale()) {
      await compensatePendingEnable(pendingEnable)
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
      if (isStale()) {
        await compensatePendingEnable(pendingEnable)
        return
      }
      try {
        const revokedSnapshot = await api.setLocationSharing(accessToken, tripId, false)
        if (isStale()) return
        pendingEnable.serverEnabled = false
        if (pendingEnableRef.current === pendingEnable) pendingEnableRef.current = null
        setSnapshot({ ...revokedSnapshot, status: "upload-failed" })
        setStatus("upload-failed")
      } catch {
        if (isStale()) return
        setSnapshot({ ...enabledSnapshot, status: "revoke-failed" })
        setStatus("revoke-failed")
      }
      return
    }
    if (isStale()) {
      await compensatePendingEnable(pendingEnable)
      return
    }

    pendingEnable.serverEnabled = false
    if (pendingEnableRef.current === pendingEnable) pendingEnableRef.current = null
    setSnapshot({ ...enabledSnapshot, enabled: true, expiresAt: initialUpload.expiresAt, status: "sharing" })
    setStatus("sharing")
    let queuedPosition: { latitude: number; longitude: number } | null = null
    let watchUploadInFlight = false
    let watchStopped = false
    let watchUploadGeneration = 0
    const uploadLatestWatchPosition = () => {
      if (watchStopped || watchUploadInFlight || !queuedPosition || isStale()) return
      const nextPosition = queuedPosition
      const uploadGeneration = watchUploadGeneration
      queuedPosition = null
      watchUploadInFlight = true
      void api.updateCurrentLocation(accessToken, tripId, nextPosition.latitude, nextPosition.longitude).then((upload) => {
        if (watchStopped || uploadGeneration !== watchUploadGeneration || isStale()) return
        setSnapshot((current) => current ? {
          ...current,
          enabled: true,
          expiresAt: upload.expiresAt,
          status: "sharing",
        } : current)
        setStatus("sharing")
      }).catch(() => {
        if (watchStopped || uploadGeneration !== watchUploadGeneration || isStale()) return
        setSnapshot((current) => current ? { ...current, status: "dependency-unavailable" } : current)
        setStatus("dependency-unavailable")
      }).finally(() => {
        if (watchStopped || uploadGeneration !== watchUploadGeneration || isStale()) return
        watchUploadInFlight = false
        uploadLatestWatchPosition()
      })
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      ({ coords }) => {
        if (watchStopped || isStale()) return
        queuedPosition = { latitude: coords.latitude, longitude: coords.longitude }
        uploadLatestWatchPosition()
      },
      (error) => {
        if (watchStopped || isStale()) return
        watchStopped = true
        watchUploadGeneration += 1
        queuedPosition = null
        clearForegroundWatch()
        const failureStatus = locationFailureStatus(error)
        setSnapshot((current) => current ? { ...current, status: failureStatus } : current)
        setStatus(failureStatus)
      },
      positionOptions,
    )
  }, [accessToken, available, clearForegroundWatch, tripId])

  const disableSharing = useCallback(async () => {
    const operation = ++operationRef.current
    const pendingEnable = pendingEnableRef.current
    if (pendingEnable) {
      pendingEnable.serverEnabled = false
      pendingEnableRef.current = null
    }
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
      const pendingEnable = pendingEnableRef.current
      if (pendingEnable) {
        pendingEnableRef.current = null
        void compensatePendingEnable(pendingEnable)
      }
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
