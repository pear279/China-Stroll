import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { JoinTripView } from "./JoinTripView"

const { previewTripInvitation, acceptTripInvitation } = vi.hoisted(() => ({
  previewTripInvitation: vi.fn(),
  acceptTripInvitation: vi.fn(),
}))

vi.mock("../../lib/api", () => ({
  api: { previewTripInvitation, acceptTripInvitation },
  ApiRequestError: class ApiRequestError extends Error {},
}))

function renderJoin(overrides: Partial<Parameters<typeof JoinTripView>[0]> = {}) {
  const props = {
    token: "raw-token",
    accessToken: "access-token",
    onAccepted: vi.fn(async () => undefined),
    onGoHome: vi.fn(),
    ...overrides,
  }
  render(<JoinTripView {...props} />)
  return props
}

describe("JoinTripView", () => {
  afterEach(() => {
    cleanup()
    previewTripInvitation.mockReset()
    acceptTripInvitation.mockReset()
  })

  it("asks an unauthenticated visitor to sign in", async () => {
    renderJoin({ accessToken: null })
    expect(await screen.findByText("Sign in to join")).toBeTruthy()
    expect(previewTripInvitation).not.toHaveBeenCalled()
  })

  it("reviews the trip and role before accepting", async () => {
    previewTripInvitation.mockResolvedValue({
      tripId: "trip-1",
      tripName: "Family trip",
      role: "viewer",
      expiresAt: "2099-01-01T00:00:00.000Z",
      status: "ready",
    })
    renderJoin()
    expect(await screen.findByText("Family trip")).toBeTruthy()
    expect(screen.getByText(/as a/i)).toBeTruthy()
    expect(screen.getByText("viewer")).toBeTruthy()
  })

  it("accepts explicitly and opens the joined trip", async () => {
    previewTripInvitation.mockResolvedValue({
      tripId: "trip-1",
      tripName: "Family trip",
      role: "editor",
      expiresAt: "2099-01-01T00:00:00.000Z",
      status: "ready",
    })
    acceptTripInvitation.mockResolvedValue({
      tripId: "trip-1",
      version: 2,
      invitationId: "inv-1",
      member: { userId: "user-1", role: "editor" },
    })
    const { onAccepted } = renderJoin()
    await screen.findByText("Family trip")
    await userEvent.click(screen.getByRole("button", { name: "Accept and open this trip" }))
    expect(acceptTripInvitation).toHaveBeenCalledWith("access-token", "raw-token")
    expect(onAccepted).toHaveBeenCalledWith("trip-1")
  })

  it("explains an expired invitation and keeps navigation available", async () => {
    previewTripInvitation.mockResolvedValue({
      tripId: "trip-1",
      tripName: "Family trip",
      role: "viewer",
      expiresAt: "2020-01-01T00:00:00.000Z",
      status: "expired",
    })
    renderJoin()
    expect(await screen.findByText("Invitation unavailable")).toBeTruthy()
    expect(screen.getByText(/expired/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Back to China Stroll" })).toBeTruthy()
  })
})
