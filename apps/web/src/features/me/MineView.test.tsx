import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { TripSnapshot } from "../../../../../packages/shared/src"
import { MineView, type MineViewProps } from "./MineView"

const trip: TripSnapshot = {
  id: "trip-1",
  name: "Beijing family trip",
  startDate: "2026-09-01",
  endDate: null,
  locale: "en",
  version: 2,
  days: [
    { id: 1, dayNumber: 1, date: "2026-09-01", title: null },
    { id: 2, dayNumber: 2, date: "2026-09-02", title: null },
  ],
  stops: [{
    id: "stop-1",
    tripId: "trip-1",
    dayNumber: 2,
    placeId: "jingshan-park",
    name: "Jingshan Park",
    coordinate: [116.3903973, 39.9244589],
    startTime: "09:00:00",
    durationMinutes: 90,
    sortOrder: 0,
  }],
  suggestions: [],
}

function createProps(): MineViewProps {
  return {
    busy: null,
    message: null,
    mode: "preview",
    selectedDay: 2,
    selectedPlaceId: null,
    testIdentity: null,
    trip,
    onAddDay: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => undefined),
    onSelectDay: vi.fn(),
    onSelectPlace: vi.fn(),
    onSuggest: vi.fn(async () => undefined),
  }
}

describe("MineView", () => {
  it("shows the selected day and forwards itinerary selection", async () => {
    const props = createProps()
    render(<MineView {...props} />)

    expect(screen.getByRole("heading", { name: "Day 2 itinerary" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: /Jingshan Park/ }))
    expect(props.onSelectPlace).toHaveBeenCalledWith("jingshan-park")
  })
})
