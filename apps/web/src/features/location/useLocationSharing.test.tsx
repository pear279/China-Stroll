import { act, cleanup, renderHook, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { LocationSharingSnapshot } from "../../../../../packages/shared/src"
import { api } from "../../lib/api"
import { useLocationSharing } from "./useLocationSharing"

vi.mock("../../lib/api", () => ({
  api: {
    getLocationSharing: vi.fn(),
    setLocationSharing: vi.fn(),
    updateCurrentLocation: vi.fn(),
  },
}))

const offSnapshot: LocationSharingSnapshot = {
  tripId: "trip-1",
  enabled: false,
  status: "off",
  activeMemberCount: 2,
  expiresAt: null,
  visibleLocations: [],
}

const enabledSnapshot: LocationSharingSnapshot = {
  ...offSnapshot,
  enabled: true,
  status: "sharing",
  expiresAt: "2026-08-31T12:10:00.000Z",
}

const options = { accessToken: "access-token", tripId: "trip-1", enabled: true }

function deferred<Value>() {
  let resolve!: (value: Value) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<Value>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}

function installGeolocation({ errorCode }: { errorCode?: number } = {}) {
  let watchSuccess: PositionCallback | null = null
  let watchError: PositionErrorCallback | null = null
  const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success, error) => {
    if (errorCode) {
      error?.({ code: errorCode, message: "location failed", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
      return
    }
    success({ coords: { latitude: 39.9163, longitude: 116.3972 } } as GeolocationPosition)
  })
  const watchPosition = vi.fn<Geolocation["watchPosition"]>((success, error) => {
    watchSuccess = success
    watchError = error ?? null
    return 41
  })
  const clearWatch = vi.fn<Geolocation["clearWatch"]>()
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition, watchPosition, clearWatch },
  })
  return {
    clearWatch,
    getCurrentPosition,
    watchPosition,
    emitWatchPosition(latitude: number, longitude: number) {
      if (!watchSuccess) throw new Error("Location watch has not started.")
      watchSuccess({ coords: { latitude, longitude } } as GeolocationPosition)
    },
    emitWatchError(code: number) {
      if (!watchError) throw new Error("Location watch has not started.")
      watchError({ code, message: "watch failed", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
    },
  }
}

describe("useLocationSharing", () => {
  beforeEach(() => {
    vi.mocked(api.getLocationSharing).mockResolvedValue(offSnapshot)
    vi.mocked(api.setLocationSharing).mockImplementation(async (_token, _tripId, enabled) => enabled ? enabledSnapshot : offSnapshot)
    vi.mocked(api.updateCurrentLocation).mockResolvedValue({
      tripId: "trip-1",
      enabled: true,
      expiresAt: "2026-08-31T12:10:00.000Z",
    })
  })

  afterEach(() => {
    cleanup()
    vi.resetAllMocks()
  })

  it("starts a foreground watch only after the initial point uploads and clears it before revoke", async () => {
    const geolocation = installGeolocation()
    const order: string[] = []
    vi.mocked(api.updateCurrentLocation).mockImplementation(async () => {
      order.push("initial-upload")
      return { tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:10:00.000Z" }
    })
    geolocation.watchPosition.mockImplementation(() => {
      order.push("watch")
      return 41
    })
    geolocation.clearWatch.mockImplementation(() => { order.push("clear-watch") })
    vi.mocked(api.setLocationSharing).mockImplementation(async (_token, _tripId, enabled) => {
      order.push(enabled ? "server-enable" : "server-revoke")
      return enabled ? enabledSnapshot : offSnapshot
    })

    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    await act(() => result.current.enable())

    expect(result.current.status).toBe("sharing")
    expect(order.slice(0, 3)).toEqual(["server-enable", "initial-upload", "watch"])

    await act(() => result.current.disable())

    expect(result.current.status).toBe("off")
    expect(order.slice(-2)).toEqual(["clear-watch", "server-revoke"])
  })

  it("resumes the foreground watch after loading a persisted enabled preference", async () => {
    const geolocation = installGeolocation()
    vi.mocked(api.getLocationSharing).mockResolvedValue(enabledSnapshot)

    const { result } = renderHook(() => useLocationSharing(options))

    await waitFor(() => expect(result.current.status).toBe("sharing"))
    expect(api.updateCurrentLocation).toHaveBeenCalledWith("access-token", "trip-1", 39.9163, 116.3972)
    expect(geolocation.watchPosition).toHaveBeenCalledTimes(1)
  })

  it("revokes the old trip if an enable response arrives after unmount", async () => {
    const geolocation = installGeolocation()
    const serverEnable = deferred<LocationSharingSnapshot>()
    vi.mocked(api.setLocationSharing).mockImplementation(async (_token, _tripId, enabled) => {
      if (enabled) return serverEnable.promise
      return offSnapshot
    })
    const { result, unmount } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    let enablePromise!: Promise<void>
    act(() => { enablePromise = result.current.enable() })
    await waitFor(() => expect(api.setLocationSharing).toHaveBeenCalledWith("access-token", "trip-1", true))
    unmount()

    await act(async () => {
      serverEnable.resolve(enabledSnapshot)
      await enablePromise
    })

    expect(api.setLocationSharing).toHaveBeenLastCalledWith("access-token", "trip-1", false)
    expect(geolocation.getCurrentPosition).not.toHaveBeenCalled()
    expect(api.updateCurrentLocation).not.toHaveBeenCalled()
  })

  it("revokes the old trip and skips upload when scope changes during initial positioning", async () => {
    const geolocation = installGeolocation()
    let resolvePosition: PositionCallback | null = null
    geolocation.getCurrentPosition.mockImplementation((success) => { resolvePosition = success })
    const { result, rerender } = renderHook(
      ({ tripId }) => useLocationSharing({ ...options, tripId }),
      { initialProps: { tripId: "trip-1" } },
    )
    await waitFor(() => expect(result.current.status).toBe("off"))

    let enablePromise!: Promise<void>
    act(() => { enablePromise = result.current.enable() })
    await waitFor(() => expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1))
    rerender({ tripId: "trip-2" })

    await waitFor(() => expect(api.setLocationSharing).toHaveBeenCalledWith("access-token", "trip-1", false))
    expect(api.updateCurrentLocation).not.toHaveBeenCalled()

    await act(async () => {
      if (!resolvePosition) throw new Error("Initial position was not requested.")
      resolvePosition({ coords: { latitude: 39.9163, longitude: 116.3972 } } as GeolocationPosition)
      await enablePromise
    })

    expect(api.updateCurrentLocation).not.toHaveBeenCalled()
    expect(api.setLocationSharing).toHaveBeenCalledWith("access-token", "trip-1", false)
  })

  it("revokes immediately when unmounted during initial positioning", async () => {
    const geolocation = installGeolocation()
    let resolvePosition: PositionCallback | null = null
    geolocation.getCurrentPosition.mockImplementation((success) => { resolvePosition = success })
    const { result, unmount } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    let enablePromise!: Promise<void>
    act(() => { enablePromise = result.current.enable() })
    await waitFor(() => expect(geolocation.getCurrentPosition).toHaveBeenCalledTimes(1))
    unmount()

    await waitFor(() => expect(api.setLocationSharing).toHaveBeenCalledWith("access-token", "trip-1", false))
    expect(api.updateCurrentLocation).not.toHaveBeenCalled()

    await act(async () => {
      if (!resolvePosition) throw new Error("Initial position was not requested.")
      resolvePosition({ coords: { latitude: 39.9163, longitude: 116.3972 } } as GeolocationPosition)
      await enablePromise
    })

    expect(api.updateCurrentLocation).not.toHaveBeenCalled()
  })

  it("serializes watch uploads so a newer point cannot be overwritten by an older request", async () => {
    const geolocation = installGeolocation()
    const firstWatchUpload = deferred<Pick<LocationSharingSnapshot, "tripId" | "enabled" | "expiresAt">>()
    const secondWatchUpload = deferred<Pick<LocationSharingSnapshot, "tripId" | "enabled" | "expiresAt">>()
    vi.mocked(api.updateCurrentLocation)
      .mockResolvedValueOnce({ tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:10:00.000Z" })
      .mockImplementationOnce(() => firstWatchUpload.promise)
      .mockImplementationOnce(() => secondWatchUpload.promise)
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))
    await act(() => result.current.enable())

    act(() => {
      geolocation.emitWatchPosition(39.91, 116.39)
      geolocation.emitWatchPosition(39.92, 116.4)
    })
    expect(api.updateCurrentLocation).toHaveBeenCalledTimes(2)

    await act(async () => {
      firstWatchUpload.resolve({ tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:11:00.000Z" })
      await firstWatchUpload.promise
    })
    await waitFor(() => expect(api.updateCurrentLocation).toHaveBeenCalledTimes(3))

    await act(async () => {
      secondWatchUpload.resolve({ tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:12:00.000Z" })
      await secondWatchUpload.promise
    })

    expect(result.current.snapshot?.expiresAt).toBe("2026-08-31T12:12:00.000Z")
    expect(api.updateCurrentLocation).toHaveBeenNthCalledWith(3, "access-token", "trip-1", 39.92, 116.4)
  })

  it("invalidates in-flight and queued watch uploads after a watch error", async () => {
    const geolocation = installGeolocation()
    const inFlightUpload = deferred<Pick<LocationSharingSnapshot, "tripId" | "enabled" | "expiresAt">>()
    vi.mocked(api.updateCurrentLocation)
      .mockResolvedValueOnce({ tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:10:00.000Z" })
      .mockImplementationOnce(() => inFlightUpload.promise)
      .mockResolvedValueOnce({ tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:12:00.000Z" })
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))
    await act(() => result.current.enable())

    act(() => {
      geolocation.emitWatchPosition(39.91, 116.39)
      geolocation.emitWatchPosition(39.92, 116.4)
      geolocation.emitWatchError(1)
    })
    expect(result.current.status).toBe("permission-denied")

    await act(async () => {
      inFlightUpload.resolve({ tripId: "trip-1", enabled: true, expiresAt: "2026-08-31T12:11:00.000Z" })
      await inFlightUpload.promise
    })

    expect(api.updateCurrentLocation).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe("permission-denied")
    expect(result.current.snapshot?.expiresAt).toBe("2026-08-31T12:10:00.000Z")
  })

  it("leaves sharing off when foreground location permission is denied", async () => {
    const geolocation = installGeolocation({ errorCode: 1 })
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    await act(() => result.current.enable())

    expect(result.current.status).toBe("permission-denied")
    expect(result.current.snapshot?.enabled).toBe(false)
    expect(api.setLocationSharing).toHaveBeenLastCalledWith("access-token", "trip-1", false)
    expect(api.updateCurrentLocation).not.toHaveBeenCalled()
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
  })

  it("reports unavailable positioning as a dependency failure rather than permission denial", async () => {
    installGeolocation({ errorCode: 2 })
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    await act(() => result.current.enable())

    expect(result.current.status).toBe("dependency-unavailable")
    expect(result.current.snapshot?.enabled).toBe(false)
  })

  it("revokes the server switch and does not start a watch when the initial upload fails", async () => {
    const geolocation = installGeolocation()
    vi.mocked(api.updateCurrentLocation).mockRejectedValueOnce(new Error("offline"))
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    await act(() => result.current.enable())

    expect(result.current.status).toBe("upload-failed")
    expect(result.current.snapshot?.enabled).toBe(false)
    expect(api.setLocationSharing).toHaveBeenLastCalledWith("access-token", "trip-1", false)
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
  })

  it("retains a retry-visible state until failed revocation succeeds", async () => {
    const geolocation = installGeolocation()
    vi.mocked(api.setLocationSharing)
      .mockResolvedValueOnce(enabledSnapshot)
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(offSnapshot)
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))
    await act(() => result.current.enable())

    await act(() => result.current.disable())

    expect(geolocation.clearWatch).toHaveBeenCalledWith(41)
    expect(result.current.status).toBe("revoke-failed")
    expect(result.current.snapshot?.enabled).toBe(true)

    await act(() => result.current.retryDisable())

    expect(result.current.status).toBe("off")
    expect(result.current.snapshot?.enabled).toBe(false)
  })

  it("stays deterministically unavailable when account sharing is disabled", async () => {
    installGeolocation()
    const { result } = renderHook(() => useLocationSharing({ accessToken: null, tripId: "preview-trip", enabled: false }))

    expect(result.current.status).toBe("dependency-unavailable")
    expect(result.current.snapshot).toBeNull()
    expect(api.getLocationSharing).not.toHaveBeenCalled()

    await act(() => result.current.enable())

    expect(api.setLocationSharing).not.toHaveBeenCalled()
  })
})
