import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { PlaceSummary, ReservationDraft, TripSnapshot } from "../../../../../packages/shared/src"
import { ItinerarySection, type ItinerarySectionProps } from "./ItinerarySection"

const trip: TripSnapshot = {
  id: "trip-1",
  name: "Beijing family trip",
  startDate: "2026-09-03",
  endDate: "2026-09-06",
  travelerCount: 2,
  locale: "en",
  version: 2,
  days: [
    { id: 1, dayNumber: 1, date: "2026-09-03", title: null, notes: "" },
    { id: 2, dayNumber: 2, date: "2026-09-04", title: null, notes: "" },
  ],
  stops: [{
    id: "stop-1",
    tripId: "trip-1",
    dayNumber: 1,
    placeId: "beihai-park",
    name: "Beihai Park",
    coordinate: [116.383, 39.925],
    startTime: null,
    durationMinutes: 150,
    transportMode: null,
    privatePlaceId: null,
    notes: "",
    sortOrder: 0,
  }],
  reservations: [],
  suggestions: [],
}

const places: PlaceSummary[] = [
  {
    id: "beihai-park", locale: "en", name: "Beihai Park", aliases: ["北海公园"], categoryCode: "park", tags: [],
    shortIntro: "A historic imperial garden.", coordinate: [116.383, 39.925], durationMinutes: 150, coordinatesCheckedAt: null,
  },
]

function createProps(overrides: Partial<ItinerarySectionProps> = {}): ItinerarySectionProps {
  return {
    busy: null,
    message: null,
    selectedDay: 1,
    trip,
    places,
    userCoordinate: null,
    completedStopIds: new Set(),
    completedReservationIds: new Set(),
    itineraryEditing: {
      onEditStop: vi.fn(async () => undefined),
      onMoveStopToDay: vi.fn(async () => undefined),
      onEditDay: vi.fn(async () => undefined),
      onDraftReservation: vi.fn(async () => null),
    },
    onAddDay: vi.fn(async () => 3),
    onToggleStopCompleted: vi.fn(),
    onToggleReservationCompleted: vi.fn(),
    onEditTripDates: vi.fn(async () => undefined),
    onRemoveStop: vi.fn(async () => undefined),
    onReorderStop: vi.fn(async () => undefined),
    onCreateReservation: vi.fn(async () => undefined),
    onUpdateReservation: vi.fn(async () => undefined),
    onRemoveReservation: vi.fn(async () => undefined),
    onSelectDay: vi.fn(),
    ...overrides,
  }
}

function renderSection(props: ItinerarySectionProps = createProps()) {
  return render(<MemoryRouter><ItinerarySection {...props} /></MemoryRouter>)
}

describe("ItinerarySection", () => {
  afterEach(cleanup)

  it("defaults to Week view and toggles to Month", async () => {
    renderSection()

    expect(screen.getByRole("button", { name: "Week" }).getAttribute("aria-pressed")).toBe("true")
    await userEvent.click(screen.getByRole("button", { name: "Month" }))
    expect(screen.getByRole("button", { name: "Month" }).getAttribute("aria-pressed")).toBe("true")
  })

  it("selects an existing day when its calendar date is tapped", async () => {
    const props = createProps()
    renderSection(props)

    await userEvent.click(screen.getByRole("button", { name: "September 4, 2026" }))
    expect(props.onSelectDay).toHaveBeenCalledWith(2)
    expect(props.onAddDay).not.toHaveBeenCalled()
  })

  it("creates a day for a tapped date that has no day yet", async () => {
    const props = createProps()
    renderSection(props)

    await userEvent.click(screen.getByRole("button", { name: "September 5, 2026" }))
    expect(props.onAddDay).toHaveBeenCalledWith("2026-09-05")
    expect(props.onSelectDay).toHaveBeenCalledWith(3)
  })

  it("renders the selected day's stops as task-list cards", () => {
    renderSection()

    expect(screen.getByRole("checkbox", { name: "Mark Beihai Park as completed" })).toBeTruthy()
    expect(screen.getByText("Beihai Park")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Remove Beihai Park" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Reorder Beihai Park" })).toBeTruthy()
  })

  it("toggles a stop's completion through the checkbox", async () => {
    const props = createProps()
    renderSection(props)

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Beihai Park as completed" }))
    expect(props.onToggleStopCompleted).toHaveBeenCalledWith("stop-1")
  })

  it("renders a completed stop with a check, line-through and dimmed card", () => {
    const { container } = renderSection(createProps({ completedStopIds: new Set(["stop-1"]) }))

    expect(screen.getByRole("checkbox", { name: "Mark Beihai Park as not completed" }).getAttribute("aria-checked")).toBe("true")
    expect(container.querySelector(".schedule-item.is-completed")).toBeTruthy()
  })

  it("removes a stop from the schedule", async () => {
    const props = createProps()
    renderSection(props)

    await userEvent.click(screen.getByRole("button", { name: "Remove Beihai Park" }))
    expect(props.onRemoveStop).toHaveBeenCalledWith("stop-1")
  })

  it("shows a single Add attraction entry and a light empty state", () => {
    renderSection(createProps({ trip: { ...trip, stops: [] } }))

    expect(screen.getByRole("button", { name: "Add attraction" })).toBeTruthy()
    expect(screen.getByText("No places planned yet.")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Add" })).toBeNull()
  })

  it("saves edited day details from the Edit day sheet", async () => {
    const props = createProps()
    renderSection(props)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Edit day" }))
    const dialog = await screen.findByRole("dialog", { name: "Edit day" })
    await user.type(within(dialog).getByLabelText("Title"), "Museum morning")
    await user.click(within(dialog).getByRole("button", { name: "Save" }))

    expect(props.itineraryEditing.onEditDay).toHaveBeenCalledWith(1, expect.objectContaining({ title: "Museum morning" }))
  })

  it("saves a reservation from the Reservations tab", async () => {
    const props = createProps()
    renderSection(props)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Reservations" }))
    await user.click(screen.getByRole("button", { name: "Add reservation" }))
    const dialog = await screen.findByRole("dialog", { name: "Add reservation" })
    await user.type(within(dialog).getByLabelText("Name"), "Museum entry")
    await user.selectOptions(within(dialog).getByLabelText("Type"), "attraction")
    await user.click(within(dialog).getByRole("button", { name: "Save reservation" }))

    expect(props.onCreateReservation).toHaveBeenCalledWith(expect.objectContaining({ title: "Museum entry", category: "attraction" }))
  })

  it("drafts a reservation from pasted text without saving it", async () => {
    const props = createProps()
    props.itineraryEditing.onDraftReservation = vi.fn(async (): Promise<ReservationDraft | null> => ({
      category: "accommodation",
      title: "Hotel check-in",
      startsAt: null,
      endsAt: null,
      status: "planned",
      provider: "Example Hotel",
      confirmationCode: "12345",
      notes: "",
    }))
    renderSection(props)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Reservations" }))
    await user.click(screen.getByRole("button", { name: "Add reservation" }))
    await user.click(screen.getByRole("button", { name: "AI draft" }))
    await user.type(screen.getByLabelText("AI draft"), "Hotel check-in, confirmation 12345")
    await user.click(screen.getByRole("button", { name: "Generate draft" }))

    expect(props.itineraryEditing.onDraftReservation).toHaveBeenCalledWith("Hotel check-in, confirmation 12345")
    expect(await screen.findByText(/Draft generated/i)).toBeTruthy()
    expect(props.onCreateReservation).not.toHaveBeenCalled()
  })

  it("renders a reservation as a task card and toggles its completion", async () => {
    const props = createProps({ trip: { ...trip, reservations: [{
      id: "res-1", tripId: "trip-1", dayNumber: 1, placeId: null, category: "attraction", title: "Forbidden City ticket",
      startsAt: "2026-09-03T09:30:00.000Z", endsAt: null, status: "confirmed", provider: null, confirmationCode: null, notes: "",
    }] } })
    renderSection(props)

    await userEvent.click(screen.getByRole("button", { name: "Reservations" }))
    expect(screen.getByRole("checkbox", { name: "Mark Forbidden City ticket as completed" })).toBeTruthy()
    expect(screen.getByText("Forbidden City ticket")).toBeTruthy()

    await userEvent.click(screen.getByRole("checkbox", { name: "Mark Forbidden City ticket as completed" }))
    expect(props.onToggleReservationCompleted).toHaveBeenCalledWith("res-1")
  })

  it("confirms before removing a reservation", async () => {
    const props = createProps({ trip: { ...trip, reservations: [{
      id: "res-1", tripId: "trip-1", dayNumber: 1, placeId: null, category: "restaurant", title: "Dinner · TRB Hutong",
      startsAt: "2026-09-03T18:30:00.000Z", endsAt: null, status: "planned", provider: null, confirmationCode: null, notes: "",
    }] } })
    renderSection(props)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Reservations" }))
    await user.click(screen.getByRole("button", { name: "Remove Dinner · TRB Hutong" }))
    const dialog = await screen.findByRole("dialog", { name: "Remove reservation?" })
    await user.click(within(dialog).getByRole("button", { name: "Remove" }))

    expect(props.onRemoveReservation).toHaveBeenCalledWith("res-1")
  })
})
