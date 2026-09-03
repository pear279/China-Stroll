import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TripSnapshot, UserProfile } from "../../../../../packages/shared/src"
import type { MembershipControls, ProfileControls } from "../../app-shell/types"
import { MineView, type MineViewProps } from "./MineView"

const trip: TripSnapshot = {
  id: "trip-1",
  name: "Beijing family trip",
  startDate: "2026-09-01",
  endDate: null,
  travelerCount: 2,
  locale: "en",
  version: 2,
  days: [
    { id: 1, dayNumber: 1, date: "2026-09-01", title: null, notes: "" },
    { id: 2, dayNumber: 2, date: "2026-09-02", title: null, notes: "" },
  ],
  stops: [],
  reservations: [],
  suggestions: [],
}

const profileData: UserProfile = {
  userId: "user-1",
  displayName: "Alex Chen",
  interfaceLocale: "en",
  contentLocale: "en",
  countryCode: "US",
  travelPreferences: { pace: "relaxed" },
}

function createProps(): MineViewProps {
  return {
    mode: "account",
    trip,
    profileExtras: { avatar: null, title: null, phone: "", email: "" },
    profile: {
      profile: profileData,
      status: "ready",
      onSave: vi.fn(async () => undefined),
    } satisfies ProfileControls,
    membership: {
      isOwner: true,
      members: [
        { userId: "user-1", displayName: "Alex Chen", role: "owner", joinedAt: null, isCurrentUser: true },
        { userId: "user-2", displayName: "Sam", role: "editor", joinedAt: "2026-09-01T00:00:00.000Z", isCurrentUser: false },
      ],
      invitations: [],
      status: "ready",
      onCreateInvitation: vi.fn(async () => "http://localhost:5173/join/abc123"),
      onRevokeInvitation: vi.fn(async () => undefined),
      onRemoveMember: vi.fn(async () => undefined),
    } satisfies MembershipControls,
    busy: null,
    message: null,
    itineraryEditing: {
      onEditStop: vi.fn(async () => undefined),
      onMoveStopToDay: vi.fn(async () => undefined),
      onEditDay: vi.fn(async () => undefined),
      onDraftReservation: vi.fn(async () => null),
    },
    places: [],
    selectedDay: 1,
    userCoordinate: null,
    completedStopIds: new Set(),
    completedReservationIds: new Set(),
    onAddDay: vi.fn(async () => 1),
    onToggleStopCompleted: vi.fn(),
    onToggleReservationCompleted: vi.fn(),
    onEditTripDates: vi.fn(async () => undefined),
    onRemoveStop: vi.fn(async () => undefined),
    onReorderStop: vi.fn(async () => undefined),
    onCreateReservation: vi.fn(async () => undefined),
    onUpdateReservation: vi.fn(async () => undefined),
    onRemoveReservation: vi.fn(async () => undefined),
    onSelectDay: vi.fn(),
  }
}

function renderMine(props: MineViewProps = createProps()) {
  return render(<MemoryRouter><MineView {...props} /></MemoryRouter>)
}

describe("MineView", () => {
  afterEach(cleanup)

  it("renders the My trip heading and a compact profile card", () => {
    renderMine()

    expect(screen.getByRole("heading", { name: "My trip" })).toBeTruthy()
    expect(screen.getByText("Alex Chen")).toBeTruthy()
    expect(screen.getByRole("button", { name: "Edit profile" })).toBeTruthy()
  })

  it("shows country, language and a light traveler-title badge on one row", () => {
    renderMine()

    expect(screen.getByText("US")).toBeTruthy()
    expect(screen.getByText("English")).toBeTruthy()
    expect(screen.getByText("Culture Explorer")).toBeTruthy()
  })

  it("presents Saved, Visited and Language as one quick-options row", () => {
    renderMine()

    expect(screen.getByRole("button", { name: "Saved" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Visited" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Language" })).toBeTruthy()
  })

  it("shows shared members with Add member first", () => {
    renderMine()

    expect(screen.getByRole("heading", { name: "Shared members" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add member" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Sam" })).toBeTruthy()
  })

  it("renders the My itinerary section inline with a single Add entry", () => {
    renderMine()

    expect(screen.getByRole("heading", { name: "My itinerary" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Week" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Add attraction" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: /Beijing family trip/ })).toBeNull()
  })

  it("opens the language sheet and selects Chinese", async () => {
    renderMine()
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Language" }))
    const dialog = await screen.findByRole("dialog", { name: "Language" })
    expect(within(dialog).getByText("English")).toBeTruthy()
    expect(within(dialog).getByText("中文")).toBeTruthy()

    await user.click(within(dialog).getByRole("button", { name: "中文" }))
    expect(screen.queryByRole("dialog", { name: "Language" })).toBeNull()
  })

  it("creates an invitation link from the Add member sheet", async () => {
    const props = createProps()
    renderMine(props)
    const user = userEvent.setup()

    await user.click(screen.getByRole("button", { name: "Add member" }))
    const dialog = await screen.findByRole("dialog", { name: "Invite a member" })

    await user.click(within(dialog).getByRole("button", { name: "Create invitation link" }))
    expect(props.membership.onCreateInvitation).toHaveBeenCalledWith({ role: "viewer", expiresInHours: 72 })
    expect(within(dialog).getByLabelText("Invitation link")).toBeTruthy()
  })

  it("keeps the Add member sheet honest for non-owners", async () => {
    const props = createProps()
    props.membership = { ...props.membership, isOwner: false }
    renderMine(props)

    await userEvent.click(screen.getByRole("button", { name: "Add member" }))
    expect(await screen.findByText(/only the trip owner/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Create invitation link" })).toBeNull()
  })
})
