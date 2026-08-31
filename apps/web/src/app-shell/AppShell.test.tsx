import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlaceSummary, TripSnapshot } from "../../../../packages/shared/src"
import type { PlaceRepository } from "../data/placeRepository"
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

const repository: PlaceRepository = {
  listPlaces: vi.fn(async () => ({ locale: "en" as const, places: [palace, museum] })),
  getPlace: vi.fn(async () => ({
    id: palace.id,
    locale: "en" as const,
    name: palace.name,
    aliases: [],
    tags: palace.tags,
    shortIntro: palace.shortIntro,
    history: "Reviewed history",
    highlights: [],
    visitorTips: "Arrive early.",
    practicalNotes: "Bring water.",
    photoSpotNotes: "Morning light works best.",
    categoryCode: palace.categoryCode,
    coordinate: palace.coordinate,
    durationMinutes: palace.durationMinutes,
    coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
    reviewedAt: "2026-08-30T00:00:00.000Z",
    visitInformation: null,
  })),
  getGuide: vi.fn(async () => ({
    placeId: palace.id,
    locale: "en" as const,
    audience: "general" as const,
    segments: [],
    sources: [],
  })),
  askPlace: vi.fn(async () => ({
    answer: "Reviewed answer",
    answerMode: "reviewed-local" as const,
    generatedBy: "deterministic-retrieval" as const,
    sources: [],
    searchedAt: null,
    updatedAt: "2026-08-30T00:00:00.000Z",
    dependencyStatus: "ready" as const,
  })),
  recommendPlaces: vi.fn(async () => ({
    results: [],
    generatedBy: "deterministic" as const,
    updatedAt: "2026-08-30T00:00:00.000Z",
  })),
}

const props: AppShellProps = {
  busy: null,
  message: null,
  mode: "preview",
  locationSharing: {
    status: "dependency-unavailable",
    snapshot: null,
    onEnable: vi.fn(async () => undefined),
    onDisable: vi.fn(async () => undefined),
    onRetryDisable: vi.fn(async () => undefined),
  },
  placeRepository: repository,
  places: [palace, museum],
  placesState: "ready",
  savedPlaceIds: new Set(),
  testIdentity: null,
  trip,
  onAddPlace: vi.fn(async () => undefined),
  onAddDay: vi.fn(async () => null),
  onRemoveStop: vi.fn(async () => undefined),
  onReorderStop: vi.fn(async () => undefined),
  onCreateReservation: vi.fn(async () => undefined),
  onUpdateReservation: vi.fn(async () => undefined),
  onRemoveReservation: vi.fn(async () => undefined),
  onToggleSaved: vi.fn(async () => undefined),
  onConfirm: vi.fn(async () => undefined),
  onSuggest: vi.fn(async () => undefined),
  onExit: vi.fn(async () => undefined),
}

afterEach(cleanup)
afterEach(() => {
  vi.clearAllMocks()
})

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

  it("filters attractions through the shared search state", async () => {
    render(<MemoryRouter initialEntries={["/attractions"]}><AppShell {...props} /></MemoryRouter>)

    await userEvent.type(screen.getByRole("searchbox", { name: "Search reviewed places" }), "国博")

    expect(screen.getByRole("heading", { name: "National Museum of China" })).toBeTruthy()
    expect(screen.queryByRole("heading", { name: "The Palace Museum" })).toBeNull()
  })

  it("passes only the visible attractions into recommendation candidates", async () => {
    render(<MemoryRouter initialEntries={["/attractions"]}><AppShell {...props} /></MemoryRouter>)

    await userEvent.type(screen.getByRole("searchbox", { name: "Search reviewed places" }), "国博")
    await userEvent.click(screen.getByRole("button", { name: "History" }))
    await userEvent.click(screen.getByRole("button", { name: "Recommend places" }))

    expect(repository.recommendPlaces).toHaveBeenCalledWith(expect.objectContaining({
      candidatePlaceIds: ["national-museum-of-china"],
    }))
  })

  it("restores focus to the opener after closing place details", async () => {
    render(<MemoryRouter initialEntries={["/attractions"]}><AppShell {...props} /></MemoryRouter>)

    const user = userEvent.setup()
    const opener = screen.getByRole("button", { name: "Details for The Palace Museum" })

    await user.click(opener)
    expect(await screen.findByRole("dialog", { name: "The Palace Museum" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Close place details" }))

    expect(document.activeElement).toBe(opener)
  })
})
