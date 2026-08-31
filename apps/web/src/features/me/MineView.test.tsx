import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlaceSummary, TripSnapshot } from "../../../../../packages/shared/src"
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

const places: PlaceSummary[] = [
  {
    id: "jingshan-park", locale: "en", name: "Jingshan Park", aliases: ["景山公园"], categoryCode: "park", tags: [], shortIntro: "A central-axis viewpoint.",
    coordinate: [116.3903973, 39.9244589], durationMinutes: 90, coordinatesCheckedAt: null,
  },
  {
    id: "beihai-park", locale: "en", name: "Beihai Park", aliases: ["北海公园"], categoryCode: "park", tags: [], shortIntro: "A historic imperial garden.",
    coordinate: [116.383, 39.925], durationMinutes: 120, coordinatesCheckedAt: null,
  },
]

function createProps(): MineViewProps {
  return {
    busy: null,
    message: null,
    mode: "preview",
    selectedDay: 2,
    selectedPlaceId: null,
    testIdentity: null,
    trip,
    places,
    onAddDay: vi.fn(async () => 3),
    onAddPlace: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => undefined),
    onRemoveStop: vi.fn(async () => undefined),
    onReorderStop: vi.fn(async () => undefined),
    onSelectDay: vi.fn(),
    onSelectPlace: vi.fn(),
    onSuggest: vi.fn(async () => undefined),
  }
}

describe("MineView", () => {
  afterEach(cleanup)

  it("shows the selected day and forwards itinerary selection", async () => {
    const props = createProps()
    render(<MineView {...props} />)

    expect(screen.getByRole("heading", { name: "Day 2 itinerary" })).toBeTruthy()
    await userEvent.click(screen.getAllByRole("button", { name: /Jingshan Park/ })[0])
    expect(props.onSelectPlace).toHaveBeenCalledWith("jingshan-park")
  })

  it("adds a reviewed attraction to the selected day and exposes order controls", async () => {
    const props = createProps()
    render(<MineView {...props} />)
    const user = userEvent.setup()

    await user.selectOptions(screen.getByLabelText("Add reviewed attraction"), "beihai-park")
    await user.click(screen.getByRole("button", { name: "Add to Day 2" }))
    expect(props.onAddPlace).toHaveBeenCalledWith("beihai-park", 2)
    expect(screen.getByRole("button", { name: "Remove Jingshan Park" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Move Jingshan Park down" })).toBeTruthy()
  })
})
