import { describe, expect, it, vi } from "vitest"
import { fetchExchangeQuote, translateText } from "./tools"

const noApiKeyConfig = {
  baseUrl: "https://example.invalid/v1",
  chatModel: "test-model",
  embeddingModel: "test-embedding",
  timeoutMs: 15000,
}

describe("exchange adapter", () => {
  it("returns null when no provider is configured", async () => {
    await expect(fetchExchangeQuote(undefined, "CNY", "USD")).resolves.toBeNull()
  })

  it("returns a validated quote from a provider", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ rates: { USD: 7.2 }, provider: "test-provider" }), { status: 200 }))
    const quote = await fetchExchangeQuote("https://provider.invalid", "CNY", "USD", fetcher)
    expect(quote).toMatchObject({ base: "CNY", quote: "USD", rate: 7.2, provider: "test-provider" })
  })

  it("returns null when the provider response is invalid", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ rates: {} }), { status: 200 }))
    await expect(fetchExchangeQuote("https://provider.invalid", "CNY", "USD", fetcher)).resolves.toBeNull()
  })
})

describe("translation adapter", () => {
  it("returns null without an API key", async () => {
    await expect(translateText(noApiKeyConfig, { text: "Hello", from: "en", to: "zh-CN" })).resolves.toBeNull()
  })

  it("returns the translated text from a model response", async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ translatedText: "你好" }) } }] }), { status: 200 }))
    await expect(translateText({ ...noApiKeyConfig, apiKey: "test-key" }, { text: "Hello", from: "en", to: "zh-CN" }, fetcher)).resolves.toBe("你好")
  })
})
