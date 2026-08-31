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

function installGeolocation({ denied = false }: { denied?: boolean } = {}) {
  const getCurrentPosition = vi.fn<Geolocation["getCurrentPosition"]>((success, error) => {
    if (denied) {
      error?.({ code: 1, message: "denied", PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 })
      return
    }
    success({ coords: { latitude: 39.9163, longitude: 116.3972 } } as GeolocationPosition)
  })
  const watchPosition = vi.fn<Geolocation["watchPosition"]>(() => 41)
  const clearWatch = vi.fn<Geolocation["clearWatch"]>()
  Object.defineProperty(navigator, "geolocation", {
    configurable: true,
    value: { getCurrentPosition, watchPosition, clearWatch },
  })
  return { clearWatch, getCurrentPosition, watchPosition }
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
    vi.clearAllMocks()
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

  it("leaves sharing off when foreground location permission is denied", async () => {
    const geolocation = installGeolocation({ denied: true })
    const { result } = renderHook(() => useLocationSharing(options))
    await waitFor(() => expect(result.current.status).toBe("off"))

    await act(() => result.current.enable())

    expect(result.current.status).toBe("permission-denied")
    expect(result.current.snapshot?.enabled).toBe(false)
    expect(api.setLocationSharing).toHaveBeenLastCalledWith("access-token", "trip-1", false)
    expect(api.updateCurrentLocation).not.toHaveBeenCalled()
    expect(geolocation.watchPosition).not.toHaveBeenCalled()
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
