import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it } from "vitest"
import { ToolsView } from "./ToolsView"

describe("ToolsView", () => {
  afterEach(cleanup)

  it("renders navigation, ride, and payment third-party links", () => {
    render(<ToolsView mode="account" accessToken="token" />)

    expect(screen.getByRole("link", { name: /Apple Maps/ }).getAttribute("href")).toContain("maps.apple.com")
    expect(screen.getByRole("link", { name: /滴滴/ }).getAttribute("href")).toContain("didiglobal")
    expect(screen.getByRole("link", { name: /WeChat Pay/ }).getAttribute("href")).toContain("pay.weixin.qq.com")
  })

  it("shows categorized service hotlines with tel links", () => {
    render(<ToolsView mode="account" accessToken="token" />)

    expect(screen.getByRole("link", { name: /政务服务便民热线/ }).getAttribute("href")).toBe("tel:12345")
    expect(screen.getByRole("link", { name: /铁路客服/ }).getAttribute("href")).toBe("tel:12306")
  })

  it("reveals the Chinese phrase when a common phrase is tapped", async () => {
    render(<ToolsView mode="preview" accessToken={null} />)

    await userEvent.click(screen.getByRole("button", { name: /Thank you/ }))
    expect(screen.getByText("谢谢")).toBeTruthy()
  })

  it("opens the full-screen AI chat with a back button", async () => {
    render(<ToolsView mode="account" accessToken="token" />)

    await userEvent.click(screen.getByRole("button", { name: /AI问答/ }))
    expect(screen.getByRole("button", { name: "返回" })).toBeTruthy()
    expect(screen.getByLabelText("输入问题")).toBeTruthy()
  })
})
