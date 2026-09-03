import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlaceSummary } from "../../../../../packages/shared/src"
import { SavedPlacesView } from "./SavedPlacesView"

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

function renderSaved(savedPlaceIds: Set<string>, places: PlaceSummary[] = [palace]) {
  return render(
    <MemoryRouter>
      <SavedPlacesView
        busy={null}
        places={places}
        plannedIds={new Set()}
        savedPlaceIds={savedPlaceIds}
        selectedDay={1}
        userCoordinate={null}
        onAddPlace={vi.fn(async () => undefined)}
        onOpenDetails={vi.fn()}
        onShowOnMap={vi.fn()}
        onToggleSaved={vi.fn(async () => undefined)}
      />
    </MemoryRouter>,
  )
}

describe("SavedPlacesView", () => {
  afterEach(cleanup)

  it("shows a light empty state with an Explore attractions entry", () => {
    renderSaved(new Set())

    expect(screen.getByRole("heading", { name: "Saved places" })).toBeTruthy()
    expect(screen.getByText("No saved places yet.")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Explore attractions" })).toBeTruthy()
  })

  it("reuses the compact place card for a saved place", async () => {
    const onToggleSaved = vi.fn(async () => undefined)
    render(
      <MemoryRouter>
        <SavedPlacesView
          busy={null}
          places={[palace]}
          plannedIds={new Set()}
          savedPlaceIds={new Set(["forbidden-city"])}
          selectedDay={1}
          userCoordinate={null}
          onAddPlace={vi.fn(async () => undefined)}
          onOpenDetails={vi.fn()}
          onShowOnMap={vi.fn()}
          onToggleSaved={onToggleSaved}
        />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "The Palace Museum" })).toBeTruthy()
    await userEvent.click(screen.getByRole("button", { name: "Remove The Palace Museum from saved places" }))
    expect(onToggleSaved).toHaveBeenCalledWith("forbidden-city")
  })
})
