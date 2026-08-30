import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ToolsView } from "./ToolsView"

describe("ToolsView", () => {
  it("offers real emergency actions and no fake exchange button", () => {
    render(<ToolsView />)

    expect(screen.getByRole("link", { name: /Police 110/ }).getAttribute("href")).toBe("tel:110")
    expect(screen.getByRole("link", { name: /Medical 120/ }).getAttribute("href")).toBe("tel:120")
    expect(screen.getByText("Exchange rate connection is being prepared")).toBeTruthy()
    expect(screen.queryByRole("button", { name: /exchange/i })).toBeNull()
  })
})
