import { z } from "zod"
import type { Locale, PlaceSourceCitation } from "../../../packages/shared/src"

const tavilyResponseSchema = z.object({
  answer: z.string().trim().min(1).optional(),
  results: z.array(z.object({
    title: z.string().trim().min(1),
    url: z.string().trim().min(1),
    content: z.string().optional(),
  })).default([]),
})

export interface WebSearchProvider {
  search(query: string, locale: Locale): Promise<{
    answer: string
    sources: PlaceSourceCitation[]
    searchedAt: string
  }>
}

type Fetcher = typeof fetch

function isPrivateIpv4(hostname: string) {
  const values = hostname.split(".").map(Number)
  if (values.length !== 4 || values.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return false
  return values[0] === 10
    || values[0] === 127
    || values[0] === 0
    || (values[0] === 169 && values[1] === 254)
    || (values[0] === 172 && values[1] >= 16 && values[1] <= 31)
    || (values[0] === 192 && values[1] === 168)
}

export function isSafePublicHttpsUrl(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== "https:" || url.username || url.password || !hostname) return false
    if (hostname === "localhost" || hostname.endsWith(".localhost") || isPrivateIpv4(hostname)) return false
    if (hostname.includes(":")) {
      const normalized = hostname.replace(/^\[|\]$/g, "")
      if (normalized === "::1" || normalized.startsWith("fe80:") || normalized.startsWith("fc") || normalized.startsWith("fd")) return false
    }
    return true
  } catch {
    return false
  }
}

export class TavilyWebSearchProvider implements WebSearchProvider {
  constructor(private readonly apiKey: string | undefined, private readonly fetcher: Fetcher = fetch) {}

  async search(query: string, _locale: Locale) {
    if (!this.apiKey) throw new Error("web_search_api_key_missing")
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    try {
      const response = await this.fetcher("https://api.tavily.com/search", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          search_depth: "basic",
          topic: "general",
          max_results: 5,
          include_answer: "basic",
          include_raw_content: false,
          include_images: false,
          safe_search: true,
        }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`web_search_status_${response.status}`)
      const payload = tavilyResponseSchema.safeParse(await response.json())
      if (!payload.success || !payload.data.answer) throw new Error("web_search_malformed_response")
      const searchedAt = new Date().toISOString()
      const sources = payload.data.results
        .filter((result) => isSafePublicHttpsUrl(result.url))
        .slice(0, 5)
        .map((result, index) => {
          const url = new URL(result.url)
          url.hash = ""
          return {
            id: `web-${index + 1}-${url.hostname}`,
            name: result.title,
            publisher: url.hostname,
            url: url.toString(),
            publishedAt: null,
            checkedAt: searchedAt,
            reviewDueAt: null,
            needsRecheck: false,
            sourceType: "web" as const,
          }
        })
      if (sources.length === 0) throw new Error("web_search_no_reliable_sources")
      return { answer: payload.data.answer, sources, searchedAt }
    } finally {
      clearTimeout(timeout)
    }
  }
}
