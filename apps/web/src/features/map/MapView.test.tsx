import { cleanup, render, screen } from "@testing-library/react"
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
  days: [{ id: 1, dayNumber: 1, date: null, title: null }],
  stops: [{ id: "stop-1", tripId: "trip-1", dayNumber: 1, placeId: "forbidden-city", name: "The Palace Museum", coordinate: [116.3907694, 39.9172757], startTime: "09:00:00", durationMinutes: 240, sortOrder: 0 }],
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
  afterEach(cleanup)

  it("shows the selected day itinerary and synchronizes its selection", async () => {
    const props = createProps()
    render(<MapView {...props} />)
    expect(screen.getByRole("heading", { name: "Day 1 itinerary" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /The Palace Museum.*09:00/ }))
    expect(props.onSelect).toHaveBeenCalledWith("forbidden-city")
  })

  it("switches the shared day from the map date tabs", async () => {
    const props = createProps()
    render(<MapView {...props} />)
    await userEvent.click(screen.getByRole("button", { name: /Day 1/ }))
    expect(props.onSelectDay).toHaveBeenCalledWith(1)
  })

  it("opens Details, Add, Navigate and Cancel for a selected marker", async () => {
    const props = createProps()
    const { rerender } = render(<MapView {...props} />)

    await userEvent.click(await screen.findByRole("button", { name: "Select marker" }))
    expect(props.onSelect).toHaveBeenCalledWith("forbidden-city")

    rerender(<MapView {...props} selectedPlaceId="forbidden-city" />)
    expect(screen.getByRole("dialog", { name: "The Palace Museum map actions" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Details" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add to day 1" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Navigate" }))
    expect(screen.getByRole("link", { name: "Apple Maps" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Google Maps" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Amap" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(props.onSelect).toHaveBeenLastCalledWith(null)
  })

  it("shows unexpired member locations with current-point context and no history", async () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      snapshot: { ...sharingSnapshot, visibleLocations: [memberPoint] },
    }
    render(<MapView {...props} />)

    expect(await screen.findByLabelText("Alex’s shared current location")).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Members sharing now" })).toBeTruthy()
    expect(screen.getByText("Alex")).toBeTruthy()
    expect(screen.getByText(/Updated/)).toBeTruthy()
    expect(screen.getByText(/expires in/)).toBeTruthy()
    expect(screen.queryByText(/Route history/i)).toBeNull()
  })

  it("omits expired member points without adding an empty placeholder", () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      snapshot: {
        ...sharingSnapshot,
        visibleLocations: [{ ...memberPoint, expiresAt: "2000-01-01T00:00:00.000Z" }],
      },
    }
    render(<MapView {...props} />)

    expect(screen.queryByLabelText("Alex’s shared current location")).toBeNull()
    expect(screen.queryByRole("heading", { name: "Members sharing now" })).toBeNull()
    expect(screen.queryByText(/No members are sharing/i)).toBeNull()
  })

  it("keeps map browsing available when shared locations cannot be refreshed", async () => {
    const props = createProps()
    props.locationSharing = { ...props.locationSharing, status: "dependency-unavailable", snapshot: null }
    render(<MapView {...props} />)

    expect(screen.getByRole("alert").textContent).toContain("Shared locations could not be refreshed")
    await userEvent.click(await screen.findByRole("button", { name: "Select marker" }))
    expect(props.onSelect).toHaveBeenCalledWith("forbidden-city")
  })

  it.each([
    ["expired" as const, "shared current point expired"],
    ["permission-denied" as const, "location is not updating"],
  ])("explains the %s state without hiding the itinerary", (status, message) => {
    const props = createProps()
    props.locationSharing = { ...props.locationSharing, status }
    render(<MapView {...props} />)

    expect(screen.getByText(new RegExp(message, "i"))).toBeTruthy()
    expect(screen.getByRole("heading", { name: "Day 1 itinerary" })).toBeTruthy()
  })
})
