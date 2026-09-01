import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import type { PlaceSummary } from "../../../../../packages/shared/src"
import { ToolsView } from "./ToolsView"

const palace: PlaceSummary = {
  id: "forbidden-city",
  locale: "en",
  name: "The Palace Museum",
  shortIntro: "Imperial courtyards at the heart of Beijing.",
  categoryCode: "historic",
  tags: [],
  coordinate: [116.3907694, 39.9172757],
  durationMinutes: 240,
  coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
}

describe("ToolsView", () => {
  afterEach(cleanup)

  it("offers real emergency actions and helplines", () => {
    render(<ToolsView mode="account" accessToken="token" places={[palace]} />)

    expect(screen.getByRole("link", { name: /Police 110/ }).getAttribute("href")).toBe("tel:110")
    expect(screen.getByRole("link", { name: /Government service hotline 12345/ }).getAttribute("href")).toBe("tel:12345")
  })

  it("shows navigation links for a place with a coordinate and no booking claim", () => {
    render(<ToolsView mode="account" accessToken="token" places={[palace]} />)

    expect(screen.getByRole("link", { name: /Apple Maps/ }).getAttribute("href")).toContain("maps.apple.com")
    expect(screen.getByRole("link", { name: /Open Didi ride-hailing/ })).toBeTruthy()
    expect(screen.getByText(/does not create a booking/i)).toBeTruthy()
  })

  it("keeps common phrases available offline and requires sign-in for live translation", () => {
    render(<ToolsView mode="preview" accessToken={null} places={[palace]} />)

    expect(screen.getByText("Common phrases")).toBeTruthy()
    expect(screen.getByText(/Translation needs a signed-in account/i)).toBeTruthy()
  })

  it("does not invent an exchange rate before a live request", () => {
    render(<ToolsView mode="account" accessToken="token" places={[palace]} />)

    expect(screen.getByRole("button", { name: "Get rate" })).toBeTruthy()
    expect(screen.queryByText(/≈/)).toBeNull()
  })
})
