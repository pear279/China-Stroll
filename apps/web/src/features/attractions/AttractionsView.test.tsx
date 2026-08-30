import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { PlaceSummary } from "../../../../../packages/shared/src"
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
  coordinatesCheckedAt: "2026-08-30",
}

function createProps(): AttractionsViewProps {
  return {
    busy: null,
    categories: ["historic"],
    category: "all",
    locationStatus: "failed",
    maxDuration: undefined,
    nearbyRadius: 3,
    places: [palace],
    placesState: "ready",
    plannedIds: new Set(),
    savedPlaceIds: new Set(),
    selectedDay: 1,
    userCoordinate: null,
    visiblePlaces: [palace],
    onAddPlace: vi.fn(async () => undefined),
    onCategory: vi.fn(),
    onDuration: vi.fn(),
    onOpenDetails: vi.fn(),
    onRadius: vi.fn(),
    onRequestLocation: vi.fn(),
    onShowOnMap: vi.fn(),
    onToggleSaved: vi.fn(async () => undefined),
  }
}

describe("AttractionsView", () => {
  it("keeps discovery usable when location is denied", async () => {
    const props = createProps()
    render(<AttractionsView {...props} />)

    expect(screen.getByText("Location is unavailable")).toBeTruthy()
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

    expect(screen.getByRole("status").textContent).toContain("Loading reviewed places")
  })
})
