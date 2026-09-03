import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { UserProfile } from "../../../../../packages/shared/src"
import type { ProfileControls, ProfileExtras } from "../../app-shell/types"
import { EditProfileView } from "./EditProfileView"

const profile: UserProfile = {
  userId: "user-1",
  displayName: "Alex Chen",
  interfaceLocale: "en",
  contentLocale: "zh-CN",
  countryCode: "US",
  travelPreferences: { pace: "relaxed" },
}

const extras: ProfileExtras = { avatar: null, title: null, phone: "", email: "" }

function renderEdit() {
  const props = {
    message: null,
    profile: {
      profile,
      status: "ready" as const,
      onSave: vi.fn(async () => undefined),
    } satisfies ProfileControls,
    profileExtras: extras,
    onSaveProfileExtras: vi.fn(),
    onExit: vi.fn(async () => undefined),
  }
  render(
    <MemoryRouter>
      <EditProfileView {...props} />
    </MemoryRouter>,
  )
  return props
}

describe("EditProfileView", () => {
  afterEach(cleanup)

  it("saves the trimmed display name and keeps loaded preferences", async () => {
    const props = renderEdit()
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText("Nickname"))
    await user.type(screen.getByLabelText("Nickname"), "  Alex   ")
    await user.click(screen.getAllByRole("button", { name: "Save" })[1])
    expect(props.profile.onSave).toHaveBeenCalledWith(expect.objectContaining({
      displayName: "Alex",
      contentLocale: "zh-CN",
      countryCode: "US",
      travelPreferences: { pace: "relaxed" },
    }))
    expect(props.onSaveProfileExtras).toHaveBeenCalled()
  })

  it("lets a user pick a traveler title and enter contact details", async () => {
    const props = renderEdit()
    const user = userEvent.setup()
    await user.selectOptions(screen.getByLabelText("Traveler title"), "food")
    await user.type(screen.getByLabelText("Phone"), "+1 555")
    await user.type(screen.getByLabelText("Email"), "alex@example.com")
    await user.click(screen.getAllByRole("button", { name: "Save" })[1])

    expect(props.onSaveProfileExtras).toHaveBeenCalledWith(expect.objectContaining({
      title: "food",
      phone: "+1 555",
      email: "alex@example.com",
    }))
  })

  it("refuses to save an empty display name", async () => {
    const props = renderEdit()
    const user = userEvent.setup()
    await user.clear(screen.getByLabelText("Nickname"))
    await user.click(screen.getAllByRole("button", { name: "Save" })[1])
    expect(props.profile.onSave).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toBeTruthy()
  })

  it("exposes sign out without touching the itinerary", async () => {
    const props = renderEdit()
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }))
    expect(props.onExit).toHaveBeenCalledTimes(1)
  })
})
