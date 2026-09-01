import { act, cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { LocationSharingSnapshot, PlaceSummary, SharedMemberLocation, TripSnapshot } from "../../../../../packages/shared/src"
import { MapView, type MapViewProps } from "./MapView"

vi.mock("../../components/TravelMap", () => ({
  TravelMap: ({ memberLocations, onSelect }: { memberLocations: SharedMemberLocation[]; onSelect: (id: string) => void }) => (
    <div>
      <button type="button" onClick={() => onSelect("forbidden-city")}>Select marker</button>
      {memberLocations.map((member) => <span key={member.userId} aria-label={`${member.displayName}’s shared current location`} />)}
    </div>
  ),
}))

const palace: PlaceSummary = {
  id: "forbidden-city",
  locale: "en",
  name: "The Palace Museum",
  shortIntro: "Imperial courtyards at the heart of Beijing.",
  categoryCode: "historic",
  tags: ["palace"],
  coordinate: [116.3907694, 39.9172757],
  durationMinutes: 240,
  coordinatesCheckedAt: "2026-08-30",
}

const trip: TripSnapshot = {
  id: "trip-1",
  name: "Beijing",
  startDate: null,
  endDate: null,
  locale: "en",
  version: 1,
  days: [{ id: 1, dayNumber: 1, date: null, title: null, notes: "" }],
  stops: [{ id: "stop-1", tripId: "trip-1", dayNumber: 1, placeId: "forbidden-city", name: "The Palace Museum", coordinate: [116.3907694, 39.9172757], startTime: "09:00:00", durationMinutes: 240, transportMode: null, privatePlaceId: null, notes: "", sortOrder: 0 }],
  suggestions: [],
}

const memberPoint: SharedMemberLocation = {
  userId: "user-alex",
  displayName: "Alex",
  initials: "A",
  coordinate: [116.397, 39.908],
  updatedAt: "2099-09-01T10:00:00.000Z",
  expiresAt: "2099-09-01T10:10:00.000Z",
}

const sharingSnapshot: LocationSharingSnapshot = {
  tripId: "trip-1",
  enabled: false,
  status: "off",
  activeMemberCount: 2,
  expiresAt: null,
  visibleLocations: [],
}

function createProps(): MapViewProps {
  return {
    locationStatus: "idle",
    nearbyRadius: 3,
    places: [palace],
    plannedIds: new Set(),
    selectedDay: 1,
    selectedPlaceId: null,
    trip,
    userCoordinate: null,
    locationSharing: {
      status: "off",
      snapshot: sharingSnapshot,
      onEnable: vi.fn(async () => undefined),
      onDisable: vi.fn(async () => undefined),
      onRetryDisable: vi.fn(async () => undefined),
      onRefresh: vi.fn(async () => undefined),
    },
    onAddPlace: vi.fn(async () => undefined),
    onOpenDetails: vi.fn(),
    onRadius: vi.fn(),
    onRequestLocation: vi.fn(),
    onSelect: vi.fn(),
    onSelectDay: vi.fn(),
  }
}

describe("MapView", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("shows the trip area with the selected day itinerary", async () => {
    const props = createProps()
    render(<MapView {...props} />)
    expect(screen.getByRole("heading", { name: "行程" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /The Palace Museum.*分钟/ }))
    expect(props.onSelect).toHaveBeenCalledWith("forbidden-city")
  })

  it("opens details and navigation for an itinerary place", async () => {
    const props = createProps()
    render(<MapView {...props} />)

    await userEvent.click(screen.getByRole("button", { name: "The Palace Museum 详情" }))
    expect(props.onOpenDetails).toHaveBeenCalledWith("forbidden-city")

    await userEvent.click(screen.getByRole("button", { name: "The Palace Museum 导航" }))
    expect(screen.getByRole("dialog", { name: "选择导航平台" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Apple Maps" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Google Maps" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "高德地图" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "取消" }))
    expect(screen.queryByRole("dialog", { name: "选择导航平台" })).toBeNull()
  })

  it("switches the shared day from the map day tabs", async () => {
    const props = createProps()
    render(<MapView {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /第 1 天/ }))
    expect(props.onSelectDay).toHaveBeenCalledWith(1)
  })

  it("toggles the sharing panel with an enable/disable switch", async () => {
    const props = createProps()
    render(<MapView {...props} />)

    expect(screen.queryByText(/位置共享已关闭/)).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /共享位置/ }))
    expect(screen.getByRole("switch", { name: /开启共享|关闭共享/ })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /附近景点/ }))
    expect(screen.getByLabelText("距离范围")).toBeTruthy()
  })

  it("renders unexpired member locations on the map", async () => {
    const props = createProps()
    props.locationSharing = { ...props.locationSharing, snapshot: { ...sharingSnapshot, visibleLocations: [memberPoint] } }
    render(<MapView {...props} />)

    await act(async () => Promise.resolve())
    expect(screen.getByLabelText("Alex’s shared current location")).toBeTruthy()
  })

  it("removes a member point once its current point expires", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2099-09-01T10:00:30.000Z"))
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      snapshot: { ...sharingSnapshot, visibleLocations: [{ ...memberPoint, expiresAt: "2099-09-01T10:02:00.000Z" }] },
    }
    render(<MapView {...props} />)

    await act(async () => Promise.resolve())
    expect(screen.getByLabelText("Alex’s shared current location")).toBeTruthy()

    await act(async () => vi.advanceTimersByTime(120_000))
    expect(screen.queryByLabelText("Alex’s shared current location")).toBeNull()
  })

  it("keeps the map usable when shared locations cannot be refreshed", async () => {
    const props = createProps()
    props.locationSharing = { ...props.locationSharing, status: "dependency-unavailable", snapshot: null }
    render(<MapView {...props} />)

    await userEvent.click(await screen.findByRole("button", { name: "Select marker" }))
    expect(props.onSelect).toHaveBeenCalledWith("forbidden-city")
  })
})
