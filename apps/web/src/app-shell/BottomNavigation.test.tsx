import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { BottomNavigation } from "./BottomNavigation"

describe("BottomNavigation", () => {
  it("shows four labelled routes and marks the current one", () => {
    render(
      <MemoryRouter initialEntries={["/map"]}>
        <BottomNavigation />
      </MemoryRouter>,
    )

    expect(screen.getAllByRole("link")).toHaveLength(4)
    expect(screen.getByRole("link", { name: "Attractions" }).getAttribute("href")).toBe("/attractions")
    expect(screen.getByRole("link", { name: /Map/ }).getAttribute("aria-current")).toBe("page")
    expect(screen.getByRole("link", { name: "Tools" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Mine" })).toBeTruthy()
  })
})
