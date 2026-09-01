import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { UserProfile } from "../../../../../packages/shared/src"
import { ProfileCard } from "./ProfileCard"

const profile: UserProfile = {
  userId: "user-1",
  displayName: "Alex Chen",
  interfaceLocale: "en",
  contentLocale: "zh-CN",
  countryCode: "US",
  travelPreferences: { pace: "relaxed" },
}

describe("ProfileCard", () => {
  afterEach(cleanup)

  it("explains that a signed-in account is required in preview mode", () => {
    render(<ProfileCard mode="preview" profile={null} status="idle" onSave={vi.fn(async () => undefined)} />)
    expect(screen.getByText(/signed-in account/i)).toBeTruthy()
  })

  it("shows an error without hiding the itinerary", () => {
    render(<ProfileCard mode="account" profile={null} status="failed" onSave={vi.fn(async () => undefined)} />)
    expect(screen.getByRole("alert")).toBeTruthy()
    expect(screen.getByText(/itinerary is still available/i)).toBeTruthy()
  })

  it("saves the trimmed display name and keeps loaded preferences", async () => {
    const onSave = vi.fn(async () => undefined)
    render(<ProfileCard mode="account" profile={profile} status="ready" onSave={onSave} />)
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText("Display name"))
    await user.type(screen.getByLabelText("Display name"), "  Alex   ")
    await user.click(screen.getByRole("button", { name: "Save profile" }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Alex",
      contentLocale: "zh-CN",
      countryCode: "US",
      travelPreferences: { pace: "relaxed" },
    }))
  })

  it("keeps the draft and refuses to save an empty display name", async () => {
    const onSave = vi.fn(async () => undefined)
    render(<ProfileCard mode="account" profile={profile} status="ready" onSave={onSave} />)
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText("Display name"))
    await user.click(screen.getByRole("button", { name: "Save profile" }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toBeTruthy()
  })
})
