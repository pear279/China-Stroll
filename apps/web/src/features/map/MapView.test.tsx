import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { PlaceSummary, TripSnapshot } from "../../../../../packages/shared/src"
import { MapView, type MapViewProps } from "./MapView"

vi.mock("../../components/TravelMap", () => ({
  TravelMap: ({ onSelect }: { onSelect: (id: string) => void }) => (
    <button type="button" onClick={() => onSelect("forbidden-city")}>Select marker</button>
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
  stops: [],
  suggestions: [],
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
    onAddPlace: vi.fn(async () => undefined),
    onOpenDetails: vi.fn(),
    onRadius: vi.fn(),
    onRequestLocation: vi.fn(),
    onSelect: vi.fn(),
  }
}

describe("MapView", () => {
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
})
