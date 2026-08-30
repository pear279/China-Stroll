import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlaceSummary, TripSnapshot } from "../../../../packages/shared/src"
import { AppShell } from "./AppShell"
import type { AppShellProps } from "./types"

vi.mock("../components/TravelMap", () => ({
  TravelMap: () => <div aria-label="Test map" />,
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
  name: "Beijing family trip",
  startDate: "2026-09-01",
  endDate: null,
  locale: "en",
  version: 2,
  days: [{ id: 1, dayNumber: 1, date: "2026-09-01", title: null }],
  stops: [],
  suggestions: [],
}

const props: AppShellProps = {
  accessToken: null,
  busy: null,
  message: null,
  mode: "preview",
  places: [palace],
  placesState: "ready",
  savedPlaceIds: new Set(),
  testIdentity: null,
  trip,
  onAddPlace: vi.fn(async () => undefined),
  onAddDay: vi.fn(async () => undefined),
  onToggleSaved: vi.fn(async () => undefined),
  onConfirm: vi.fn(async () => undefined),
  onSuggest: vi.fn(async () => undefined),
  onExit: vi.fn(async () => undefined),
}

afterEach(cleanup)

describe("AppShell", () => {
  it.each([
    ["/attractions", "Reviewed attractions"],
    ["/map", "Map and nearby places"],
    ["/tools", "Travel tools"],
    ["/me", "My trip"],
  ])("renders %s", async (path, heading) => {
    render(<MemoryRouter initialEntries={[path]}><AppShell {...props} /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: heading })).toBeTruthy()
  })

  it("redirects unknown paths to Attractions", async () => {
    render(<MemoryRouter initialEntries={["/unknown"]}><AppShell {...props} /></MemoryRouter>)
    expect(await screen.findByRole("heading", { name: "Reviewed attractions" })).toBeTruthy()
  })

  it("keeps a selected place when moving from Attractions to Map", async () => {
    render(<MemoryRouter initialEntries={["/attractions"]}><AppShell {...props} /></MemoryRouter>)

    await userEvent.click(screen.getByRole("button", { name: "Show The Palace Museum on map" }))

    expect(await screen.findByRole("heading", { name: "Map and nearby places" })).toBeTruthy()
    expect(screen.getByRole("dialog", { name: "The Palace Museum map actions" })).toBeTruthy()
  })
})
