import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactElement } from "react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { api } from "../../lib/api"
import { ToolsView } from "./ToolsView"
import { TranslationAIView } from "./TranslationAIView"

function renderInRouter(node: ReactElement) {
  return render(<MemoryRouter initialEntries={["/tools"]}>{node}</MemoryRouter>)
}

describe("ToolsView", () => {
  afterEach(cleanup)

  it("renders navigation, ride, and payment third-party links", () => {
    renderInRouter(<ToolsView />)

    expect(screen.getByRole("link", { name: /Apple Maps/ }).getAttribute("href")).toContain("maps.apple.com")
    expect(screen.getByRole("link", { name: /DiDi/ }).getAttribute("href")).toContain("didiglobal")
    expect(screen.getByRole("link", { name: /WeChat Pay/ }).getAttribute("href")).toContain("pay.weixin.qq.com")
  })

  it("shows categorized service hotlines with tel links", () => {
    renderInRouter(<ToolsView />)

    expect(screen.getByRole("link", { name: /政务服务便民热线/ }).getAttribute("href")).toBe("tel:12345")
    expect(screen.getByRole("link", { name: /铁路客服/ }).getAttribute("href")).toBe("tel:12306")
  })

  it("links to the Translation & AI secondary page as a single entry", () => {
    renderInRouter(<ToolsView />)

    expect(screen.getByRole("link", { name: /Translation & AI/ }).getAttribute("href")).toBe("/tools/translation")
  })
})

describe("TranslationAIView", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("shows the two mode tabs and a back link", () => {
    renderInRouter(<TranslationAIView mode="account" accessToken="token" />)

    expect(screen.getByRole("tab", { name: "AI Translation" })).toBeTruthy()
    expect(screen.getByRole("tab", { name: "AI Chat" })).toBeTruthy()
    expect(screen.getByRole("link", { name: "Back" }).getAttribute("href")).toBe("/tools")
  })

  it("expands and collapses Create common phrase", async () => {
    renderInRouter(<TranslationAIView mode="account" accessToken="token" />)

    const toggle = screen.getByRole("button", { name: /Create common phrase/ })
    expect(screen.queryByPlaceholderText("Type something to translate")).toBeNull()
    await userEvent.click(toggle)
    expect(screen.getByPlaceholderText("Type something to translate")).toBeTruthy()
    await userEvent.click(toggle)
    expect(screen.queryByPlaceholderText("Type something to translate")).toBeNull()
  })

  it("translates text and adds it as a new common phrase", async () => {
    vi.spyOn(api, "translateText").mockResolvedValue({ translatedText: "你好", from: "en", to: "zh-CN", provider: "test", generatedAt: "2026-09-03T00:00:00.000Z" })
    renderInRouter(<TranslationAIView mode="account" accessToken="token" />)

    await userEvent.click(screen.getByRole("button", { name: /Create common phrase/ }))
    await userEvent.type(screen.getByPlaceholderText("Type something to translate"), "Hello")
    expect(screen.queryByText("Translation")).toBeNull()

    await userEvent.click(screen.getByRole("button", { name: "Translate" }))
    expect(await screen.findByText("你好")).toBeTruthy()

    await userEvent.click(screen.getByRole("button", { name: "Add to common phrases" }))
    expect(screen.getByRole("button", { name: "Hello" })).toBeTruthy()
  })

  it("expands a default phrase to reveal its Chinese", async () => {
    renderInRouter(<TranslationAIView mode="preview" accessToken={null} />)

    await userEvent.click(screen.getByRole("button", { name: /Thank you/ }))
    expect(screen.getByText("谢谢")).toBeTruthy()
  })

  it("switches to AI Chat, sends a message, and shows the reply", async () => {
    vi.spyOn(api, "chat").mockResolvedValue({ reply: "Take Line 2 west.", generatedAt: "2026-09-03T00:00:00.000Z" })
    renderInRouter(<TranslationAIView mode="account" accessToken="token" />)

    await userEvent.click(screen.getByRole("tab", { name: "AI Chat" }))
    const input = screen.getByPlaceholderText("Ask something...")
    await userEvent.type(input, "How do I get to Qianmen?")
    await userEvent.click(screen.getByRole("button", { name: "Send" }))

    expect(await screen.findByText("Take Line 2 west.")).toBeTruthy()
    expect(screen.getByText("How do I get to Qianmen?")).toBeTruthy()
  })

  it("keeps an expanded phrase when switching modes and back", async () => {
    renderInRouter(<TranslationAIView mode="preview" accessToken={null} />)

    await userEvent.click(screen.getByRole("button", { name: /Thank you/ }))
    expect(screen.getByText("谢谢")).toBeTruthy()

    await userEvent.click(screen.getByRole("tab", { name: "AI Chat" }))
    expect(screen.getByRole("tab", { name: "AI Chat" }).getAttribute("aria-selected")).toBe("true")

    await userEvent.click(screen.getByRole("tab", { name: "AI Translation" }))
    expect(screen.getByText("谢谢")).toBeTruthy()
  })
})
