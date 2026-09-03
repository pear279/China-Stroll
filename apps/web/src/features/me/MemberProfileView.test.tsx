import { cleanup, render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { MembershipControls } from "../../app-shell/types"
import { MemberProfileView } from "./MemberProfileView"

const membership: MembershipControls = {
  isOwner: true,
  members: [
    { userId: "user-1", displayName: "Alex Chen", role: "owner", joinedAt: null, isCurrentUser: true },
    { userId: "user-2", displayName: "Sam", role: "editor", joinedAt: "2026-09-01T00:00:00.000Z", isCurrentUser: false },
  ],
  invitations: [],
  status: "ready",
  onCreateInvitation: vi.fn(async () => null),
  onRevokeInvitation: vi.fn(async () => undefined),
  onRemoveMember: vi.fn(async () => undefined),
}

describe("MemberProfileView", () => {
  afterEach(cleanup)

  it("shows a member's nickname and role with disabled contact actions", () => {
    render(
      <MemoryRouter initialEntries={["/me/member/user-2"]}>
        <Routes>
          <Route path="/me/member/:userId" element={<MemberProfileView membership={membership} />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "Sam" })).toBeTruthy()
    expect(screen.getByText("Editor")).toBeTruthy()
    expect((screen.getByRole("button", { name: "Message" }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole("button", { name: "Call" }) as HTMLButtonElement).disabled).toBe(true)
  })
})
