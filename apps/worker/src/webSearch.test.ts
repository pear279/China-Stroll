import { describe, expect, it, vi } from "vitest"
import { isSafePublicHttpsUrl, TavilyWebSearchProvider } from "./webSearch"

describe("TavilyWebSearchProvider", () => {
  it("uses bounded safe search and returns cited public HTTPS results", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({
      answer: "Check the official visitor notice before leaving.",
      results: [{ title: "Visitor notice", url: "https://example.gov.cn/notice#today" }],
    })))
    const result = await new TavilyWebSearchProvider("test-key", fetcher).search("Palace Museum booking", "en")
    const init = fetcher.mock.calls[0]?.[1] as RequestInit
    expect(JSON.parse(String(init.body))).toMatchObject({ search_depth: "basic", max_results: 5, include_answer: "basic", include_raw_content: false, safe_search: true })
    expect(result.sources[0]?.url).toBe("https://example.gov.cn/notice")
  })

  it.each(["http://example.com", "https://localhost/a", "https://127.0.0.1/a", "https://[::1]/a", "file:///tmp/a"])("rejects unsafe citation %s", (url) => {
    expect(isSafePublicHttpsUrl(url)).toBe(false)
  })
})
