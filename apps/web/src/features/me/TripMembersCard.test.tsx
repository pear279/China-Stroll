import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { TripInvitationSummary, TripMemberSummary } from "../../../../../packages/shared/src"
import { TripMembersCard } from "./TripMembersCard"

const members: TripMemberSummary[] = [
  { userId: "user-1", displayName: "Alex Chen", role: "owner", joinedAt: null, isCurrentUser: true },
  { userId: "user-2", displayName: "Sam", role: "editor", joinedAt: "2026-09-01T00:00:00.000Z", isCurrentUser: false },
]

const invitation: TripInvitationSummary = {
  id: "inv-1",
  tripId: "trip-1",
  role: "viewer",
  expiresAt: "2099-01-01T00:00:00.000Z",
  useCount: 0,
  maxUses: 1,
  revokedAt: null,
}

function renderCard(overrides: Partial<Parameters<typeof TripMembersCard>[0]> = {}) {
  const props = {
    mode: "account" as const,
    isOwner: true,
    members,
    invitations: [],
    status: "ready" as const,
    onCreateInvitation: vi.fn(async () => null),
    onRevokeInvitation: vi.fn(async () => undefined),
    onRemoveMember: vi.fn(async () => undefined),
    ...overrides,
  }
  render(<TripMembersCard {...props} />)
  return props
}

describe("TripMembersCard", () => {
  afterEach(cleanup)

  it("explains preview mode does not create members", () => {
    render(
      <TripMembersCard
        mode="preview"
        isOwner={false}
        members={[]}
        invitations={[]}
        status="idle"
        onCreateInvitation={vi.fn(async () => null)}
        onRevokeInvitation={vi.fn(async () => undefined)}
        onRemoveMember={vi.fn(async () => undefined)}
      />,
    )
    expect(screen.getByText(/does not create members/i)).toBeTruthy()
  })

  it("renders members with roles and the current user badge", () => {
    renderCard()
    expect(screen.getByText("Alex Chen")).toBeTruthy()
    expect(screen.getByText("You")).toBeTruthy()
    expect(screen.getByText("Editor")).toBeTruthy()
    expect(screen.getByText("Sam")).toBeTruthy()
  })

  it("creates an invitation and shows the one-time link", async () => {
    const onCreateInvitation = vi.fn(async () => "http://localhost:5173/join/abc123")
    renderCard({ onCreateInvitation })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Create invitation link" }))
    expect(onCreateInvitation).toHaveBeenCalledWith({ role: "viewer", expiresInHours: 72 })
    expect(screen.getByLabelText("Invitation link")).toBeTruthy()
  })

  it("forwards revoke and remove actions", async () => {
    const onRevokeInvitation = vi.fn(async () => undefined)
    const onRemoveMember = vi.fn(async () => undefined)
    renderCard({ invitations: [invitation], onRevokeInvitation, onRemoveMember })
    const user = userEvent.setup()
    await user.click(screen.getByRole("button", { name: "Remove Sam" }))
    expect(onRemoveMember).toHaveBeenCalledWith("user-2")
    await user.click(screen.getByRole("button", { name: "Revoke invitation" }))
    expect(onRevokeInvitation).toHaveBeenCalledWith("inv-1")
  })

  it("hides owner controls from non-owners", () => {
    renderCard({ isOwner: false })
    expect(screen.getByText(/only the trip owner/i)).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Create invitation link" })).toBeNull()
    expect(screen.queryByRole("button", { name: "Remove Sam" })).toBeNull()
  })
})
