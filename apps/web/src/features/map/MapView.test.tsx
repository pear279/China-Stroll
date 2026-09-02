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
    expect(screen.getByRole("heading", { name: "Itinerary" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /The Palace Museum.*min/ }))
    expect(props.onSelect).toHaveBeenCalledWith("forbidden-city")
  })

  it("opens details and navigation for an itinerary place", async () => {
    const props = createProps()
    render(<MapView {...props} />)

    await userEvent.click(screen.getByRole("button", { name: "Details for The Palace Museum" }))
    expect(props.onOpenDetails).toHaveBeenCalledWith("forbidden-city")

    await userEvent.click(screen.getByRole("button", { name: "The Palace Museum Navigate" }))
    expect(screen.getByRole("dialog", { name: "Choose navigation provider" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Apple Maps" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Google Maps" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "AMap" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("dialog", { name: "Choose navigation provider" })).toBeNull()
  })

  it("switches the shared day from the map day tabs", async () => {
    const props = createProps()
    render(<MapView {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /Day 1/ }))
    expect(props.onSelectDay).toHaveBeenCalledWith(1)
  })

  it("toggles the sharing panel with an enable/disable switch", async () => {
    const props = createProps()
    render(<MapView {...props} />)

    expect(screen.queryByText(/Location sharing is off/)).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: /Share location/ }))
    expect(screen.getByRole("switch", { name: /Turn on|Turn off/ })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /Nearby places/ }))
    expect(screen.getByLabelText("Distance range")).toBeTruthy()
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
