import { useState } from "react"
import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  filterPlaceSummaries,
  type PlaceRecommendationResponse,
  type PlaceSummary,
} from "../../../../../packages/shared/src"
import { AttractionsView, type AttractionsViewProps } from "./AttractionsView"

const palace: PlaceSummary = {
  id: "forbidden-city",
  locale: "en",
  name: "The Palace Museum",
  shortIntro: "Imperial courtyards at the heart of Beijing.",
  categoryCode: "historic",
  tags: ["palace"],
  coordinate: [116.3907694, 39.9172757],
  durationMinutes: 240,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
  aliases: ["Forbidden City"],
  highlights: ["Imperial Garden"],
  reviewedAt: "2026-08-30T00:00:00.000Z",
  reviewDueAt: "2026-09-29T00:00:00.000Z",
}

const museum: PlaceSummary = {
  id: "national-museum-of-china",
  locale: "en",
  name: "National Museum of China",
  shortIntro: "Major history galleries on Tiananmen East.",
  categoryCode: "museum",
  tags: ["history"],
  coordinate: [116.407387, 39.905132],
  durationMinutes: 180,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
  aliases: ["国博"],
  highlights: ["Bronze gallery"],
  reviewedAt: "2026-08-30T00:00:00.000Z",
  reviewDueAt: "2026-09-29T00:00:00.000Z",
}

function createProps(): AttractionsViewProps {
  return {
    busy: null,
    categories: ["historic", "museum"],
    category: "all",
    locale: "en",
    locationStatus: "failed",
    maxDuration: undefined,
    nearbyRadius: 3,
    places: [palace, museum],
    placesState: "ready",
    plannedIds: new Set(),
    savedPlaceIds: new Set(),
    selectedDay: 1,
    tripDays: [{ id: 1, dayNumber: 1, date: "2026-09-01", title: null, notes: "" }, { id: 2, dayNumber: 2, date: "2026-09-02", title: null, notes: "" }],
    userCoordinate: null,
    visiblePlaces: [palace, museum],
    query: "",
    onAddPlace: vi.fn(async () => undefined),
    onCategory: vi.fn(),
    onDuration: vi.fn(),
    onOpenDetails: vi.fn(),
    onQuery: vi.fn(),
    onRecommendPlaces: vi.fn(async () =>
      ({
        results: [],
        generatedBy: "deterministic",
        updatedAt: "2026-08-31T00:00:00.000Z",
      }) satisfies PlaceRecommendationResponse,
    ),
    onRadius: vi.fn(),
    onRequestLocation: vi.fn(),
    onResetFilters: vi.fn(),
    onShowOnMap: vi.fn(),
    onToggleSaved: vi.fn(async () => undefined),
    onSelectDay: vi.fn(),
  }
}

function AttractionsHarness() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("all")
  const [maxDuration, setMaxDuration] = useState<number | undefined>()
  const [radius, setRadius] = useState<1 | 3 | 5 | 10 | 20>(3)
  const places = [palace, museum]
  const visiblePlaces = filterPlaceSummaries(places, {
    query,
    category,
    maxDurationMinutes: maxDuration,
    coordinate: null,
    radiusKm: null,
  })

  return (
    <AttractionsView
      {...createProps()}
      category={category}
      maxDuration={maxDuration}
      nearbyRadius={radius}
      places={places}
      query={query}
      visiblePlaces={visiblePlaces}
      onCategory={setCategory}
      onDuration={setMaxDuration}
      onQuery={setQuery}
      onRadius={setRadius}
      onResetFilters={() => {
        setQuery("")
        setCategory("all")
        setMaxDuration(undefined)
        setRadius(3)
      }}
    />
  )
}

afterEach(cleanup)

describe("AttractionsView", () => {
  it("keeps discovery usable when location is denied", async () => {
    const props = createProps()
    render(<AttractionsView {...props} />)

    expect(screen.getByText(/Location unavailable/)).toBeTruthy()
    expect(screen.getByRole("heading", { name: "The Palace Museum" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Details for The Palace Museum" }))
    expect(props.onOpenDetails).toHaveBeenCalledWith("forbidden-city")
  })

  it("shows a dedicated loading state", () => {
    render(
      <AttractionsView
        {...createProps()}
        placesState="loading"
        places={[]}
        visiblePlaces={[]}
      />,
    )

    expect(screen.getByText("Loading places…")).toBeTruthy()
  })

  it("searches reviewed fields and resets an empty result", async () => {
    const user = userEvent.setup()
    render(<AttractionsHarness />)

    const search = screen.getByRole("searchbox", { name: "Search places" })
    await user.type(search, "国博")
    expect(screen.getByRole("heading", { name: "National Museum of China" })).toBeTruthy()

    await user.clear(search)
    await user.type(search, "blue umbrella")
    expect(screen.getByRole("heading", { name: "No places match these filters." })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Reset filters" }))
    expect(screen.getAllByRole("article")).toHaveLength(2)
  })

  it("toggles between icon and list display modes", async () => {
    render(<AttractionsView {...createProps()} />)
    await userEvent.click(screen.getByRole("button", { name: "List" }))
    expect(screen.getByRole("button", { name: "List" }).getAttribute("aria-pressed")).toBe("true")
  })
})
