import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlaceSummary, TripSnapshot } from "../../../../../packages/shared/src"
import { deriveVisitedDates, VisitedPlacesView } from "./VisitedPlacesView"

const palace: PlaceSummary = {
  id: "forbidden-city",
  locale: "en",
  name: "The Palace Museum",
  shortIntro: "Imperial courtyards at the heart of Beijing.",
  categoryCode: "historic",
  tags: ["palace"],
  coordinate: [116.3907694, 39.9172757],
  durationMinutes: 240,
  coordinatesCheckedAt: null,
}

const trip: TripSnapshot = {
  id: "trip-1",
  name: "Beijing",
  startDate: null,
  endDate: null,
  travelerCount: 1,
  locale: "en",
  version: 1,
  days: [{ id: 1, dayNumber: 1, date: "2026-09-03", title: null, notes: "" }],
  stops: [{
    id: "stop-1", tripId: "trip-1", dayNumber: 1, placeId: "forbidden-city", name: "The Palace Museum",
    coordinate: [116.3907694, 39.9172757], startTime: null, durationMinutes: 240, transportMode: null,
    privatePlaceId: null, notes: "", sortOrder: 0,
  }],
  suggestions: [],
}

const dayDateByNumber = new Map([[1, "2026-09-03"]])

describe("deriveVisitedDates", () => {
  it("treats a place as visited when at least one of its stops is completed", () => {
    const dates = deriveVisitedDates(trip.stops, new Set(["stop-1"]), dayDateByNumber)
    expect(dates.get("forbidden-city")).toBe("2026-09-03")
  })

  it("drops a place when none of its stops are completed", () => {
    const dates = deriveVisitedDates(trip.stops, new Set(), dayDateByNumber)
    expect(dates.size).toBe(0)
  })

  it("keeps the most recent date when a place is completed on multiple days", () => {
    const stops = [
      { ...trip.stops[0], id: "stop-1", dayNumber: 1 },
      { ...trip.stops[0], id: "stop-2", dayNumber: 2 },
    ]
    const dates = deriveVisitedDates(stops, new Set(["stop-1", "stop-2"]), new Map([[1, "2026-09-03"], [2, "2026-09-05"]]))
    expect(dates.get("forbidden-city")).toBe("2026-09-05")
  })
})

describe("VisitedPlacesView", () => {
  afterEach(cleanup)

  it("shows the empty state before any stop is completed", () => {
    render(
      <MemoryRouter>
        <VisitedPlacesView
          busy={null}
          places={[palace]}
          plannedIds={new Set()}
          savedPlaceIds={new Set()}
          selectedDay={1}
          trip={trip}
          completedStopIds={new Set()}
          userCoordinate={null}
          onAddPlace={vi.fn(async () => undefined)}
          onOpenDetails={vi.fn()}
          onShowOnMap={vi.fn()}
          onToggleSaved={vi.fn(async () => undefined)}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "Visited places" })).toBeTruthy()
    expect(screen.getByText("No visited places yet.")).toBeTruthy()
  })

  it("lists a completed place with its visited date", () => {
    render(
      <MemoryRouter>
        <VisitedPlacesView
          busy={null}
          places={[palace]}
          plannedIds={new Set()}
          savedPlaceIds={new Set()}
          selectedDay={1}
          trip={trip}
          completedStopIds={new Set(["stop-1"])}
          userCoordinate={null}
          onAddPlace={vi.fn(async () => undefined)}
          onOpenDetails={vi.fn()}
          onShowOnMap={vi.fn()}
          onToggleSaved={vi.fn(async () => undefined)}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "The Palace Museum" })).toBeTruthy()
    expect(screen.getByText("Visited Sep 3")).toBeTruthy()
  })
})
