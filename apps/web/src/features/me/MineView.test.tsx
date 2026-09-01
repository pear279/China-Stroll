import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { LocationSharingSnapshot, PlaceSummary, ReservationDraft, TripSnapshot } from "../../../../../packages/shared/src"
import { MineView, type MineViewProps } from "./MineView"

const trip: TripSnapshot = {
  id: "trip-1",
  name: "Beijing family trip",
  startDate: "2026-09-01",
  endDate: null,
  locale: "en",
  version: 2,
  days: [
    { id: 1, dayNumber: 1, date: "2026-09-01", title: null, notes: "" },
    { id: 2, dayNumber: 2, date: "2026-09-02", title: null, notes: "" },
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
    transportMode: null, privatePlaceId: null,
    notes: "",
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

const offLocationSnapshot: LocationSharingSnapshot = {
  tripId: "trip-1",
  enabled: false,
  status: "off",
  activeMemberCount: 3,
  expiresAt: null,
  visibleLocations: [],
}

function createProps(): MineViewProps {
  return {
    busy: null,
    message: null,
    mode: "account",
    selectedDay: 2,
    selectedPlaceId: null,
    testIdentity: null,
    trip,
    places,
    locationSharing: {
      status: "off",
      snapshot: offLocationSnapshot,
      onEnable: vi.fn(async () => undefined),
      onDisable: vi.fn(async () => undefined),
      onRetryDisable: vi.fn(async () => undefined),
      onRefresh: vi.fn(async () => undefined),
    },
    membership: {
      isOwner: true,
      members: [],
      invitations: [],
      status: "idle",
      onCreateInvitation: vi.fn(async () => null),
      onRevokeInvitation: vi.fn(async () => undefined),
      onRemoveMember: vi.fn(async () => undefined),
    },
    profile: {
      profile: null,
      status: "idle",
      onSave: vi.fn(async () => undefined),
    },
    itineraryEditing: {
      onEditStop: vi.fn(async () => undefined),
      onMoveStopToDay: vi.fn(async () => undefined),
      onEditDay: vi.fn(async () => undefined),
      onDraftReservation: vi.fn(async () => null),
    },
    privatePlaces: {
      places: [],
      onCreate: vi.fn(async () => undefined),
      onAddToDay: vi.fn(async () => undefined),
    },
    onAddDay: vi.fn(async () => 3),
    onAddPlace: vi.fn(async () => undefined),
    onConfirm: vi.fn(async () => undefined),
    onRemoveStop: vi.fn(async () => undefined),
    onReorderStop: vi.fn(async () => undefined),
    onCreateReservation: vi.fn(async () => undefined),
    onUpdateReservation: vi.fn(async () => undefined),
    onRemoveReservation: vi.fn(async () => undefined),
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

  it("saves a user-entered reservation draft", async () => {
    const props = createProps()
    render(<MineView {...props} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "预约列表" }))
    await user.type(screen.getByLabelText("Reservation title"), "Museum entry")
    await user.selectOptions(screen.getByLabelText("Type"), "attraction")
    await user.click(screen.getByRole("button", { name: "Save reservation" }))

    expect(props.onCreateReservation).toHaveBeenCalledWith(expect.objectContaining({ title: "Museum entry", category: "attraction" }))
  })

  it("renders location sharing off by default with explicit privacy limits", () => {
    render(<MineView {...createProps()} />)

    expect(screen.getByRole("switch", { name: "Share my current location" }).getAttribute("aria-checked")).toBe("false")
    expect(screen.getByText("Location sharing is off")).toBeTruthy()
    expect(screen.getByText("Only while this app is open")).toBeTruthy()
    expect(screen.getByText(/active trip members only/i)).toBeTruthy()
    expect(screen.getByText(/no location history/i)).toBeTruthy()
    expect(screen.getByText(/not a safety guarantee/i)).toBeTruthy()
  })

  it("shows successful sharing and the number of active recipients", () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      status: "sharing",
      snapshot: { ...offLocationSnapshot, enabled: true, status: "sharing" },
    }
    render(<MineView {...props} />)

    expect(screen.getByRole("switch", { name: "Share my current location" }).getAttribute("aria-checked")).toBe("true")
    expect(screen.getByText("Sharing with 2 other active trip members.")).toBeTruthy()
  })

  it("explains when no active peer can receive a shared point", () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      status: "sharing",
      snapshot: { ...offLocationSnapshot, enabled: true, status: "sharing", activeMemberCount: 1 },
    }
    render(<MineView {...props} />)

    expect(screen.getByText("No other active trip members can view your location right now.")).toBeTruthy()
  })

  it("keeps permission denial visible without blocking the rest of Mine", () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      status: "permission-denied",
      snapshot: { ...offLocationSnapshot, status: "permission-denied" },
    }
    render(<MineView {...props} />)

    expect(screen.getByRole("alert").textContent).toContain("Location permission was denied")
    expect(screen.getByRole("heading", { name: "Day 2 itinerary" })).toBeTruthy()
  })

  it("offers a retry when server revocation fails", async () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      status: "revoke-failed",
      snapshot: { ...offLocationSnapshot, enabled: true, status: "revoke-failed" },
    }
    render(<MineView {...props} />)

    expect(screen.getByRole("alert").textContent).toContain("server revocation failed")
    await userEvent.click(screen.getByRole("button", { name: "Retry revocation" }))
    expect(props.locationSharing.onRetryDisable).toHaveBeenCalledTimes(1)
  })

  it("still allows a traveler to turn sharing off after a live upload dependency failure", async () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      status: "dependency-unavailable",
      snapshot: { ...offLocationSnapshot, enabled: true, status: "dependency-unavailable" },
    }
    render(<MineView {...props} />)

    const sharingSwitch = screen.getByRole("switch", { name: "Share my current location" }) as HTMLButtonElement
    expect(sharingSwitch.disabled).toBe(false)
    await userEvent.click(sharingSwitch)
    expect(props.locationSharing.onDisable).toHaveBeenCalledTimes(1)
  })

  it("uses a deterministic unavailable state in preview without member or coordinate placeholders", () => {
    const props = createProps()
    props.locationSharing = {
      ...props.locationSharing,
      status: "dependency-unavailable",
      snapshot: null,
    }
    props.mode = "preview"
    render(<MineView {...props} />)

    expect((screen.getByRole("switch", { name: "Share my current location" }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText("Location sharing is unavailable in preview.")).toBeTruthy()
    expect(screen.queryByText(/demo member/i)).toBeNull()
  })

  it("saves edited day details", async () => {
    const props = createProps()
    render(<MineView {...props} />)
    const user = userEvent.setup()

    await user.type(screen.getByLabelText("Title"), "Museum morning")
    await user.click(screen.getByRole("button", { name: "Save day details" }))

    expect(props.itineraryEditing.onEditDay).toHaveBeenCalledWith(2, expect.objectContaining({ title: "Museum morning" }))
  })

  it("edits a stop's transport and notes through the inline editor", async () => {
    const props = createProps()
    render(<MineView {...props} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Edit Jingshan Park" }))
    await user.selectOptions(screen.getByLabelText("Transport"), "taxi")
    await user.click(screen.getByRole("button", { name: "Save stop" }))

    expect(props.itineraryEditing.onEditStop).toHaveBeenCalledWith(
      "stop-1",
      expect.objectContaining({ transportMode: "taxi" }),
    )
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
    render(<MineView {...props} />)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "预约列表" }))
    await user.click(screen.getByRole("button", { name: "Draft from pasted text" }))
    await user.type(screen.getByLabelText("Paste booking details"), "Hotel check-in, confirmation 12345")
    await user.click(screen.getByRole("button", { name: "Draft fields" }))

    expect(props.itineraryEditing.onDraftReservation).toHaveBeenCalledWith("Hotel check-in, confirmation 12345")
    expect(await screen.findByText(/Draft is unsaved/i)).toBeTruthy()
    expect(props.onCreateReservation).not.toHaveBeenCalled()
  })
})
