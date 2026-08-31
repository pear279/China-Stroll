import { describe, expect, it, vi } from "vitest"
import { answerPlaceQuestion } from "./placeIntelligence"

const sources = [{ id: "1", name: "Official guide", url: "https://example.gov.cn/guide", checkedAt: "2026-08-30T00:00:00Z", reviewDueAt: null, publishedAt: null, needsRecheck: false, sourceType: "official" as const }]

describe("answerPlaceQuestion", () => {
  it("uses reviewed content before web search", async () => {
    const search = { search: vi.fn() }
    const answer = await answerPlaceQuestion({ placeName: "Palace Museum", locale: "en", question: "Tell me its history", sources, search, documents: [{ id: "guide", section: "History", content: "Its history is reviewed.", sourceIds: ["1"], updatedAt: "2026-08-30T00:00:00Z" }] })
    expect(answer.answerMode).toBe("reviewed-local")
    expect(search.search).not.toHaveBeenCalled()
  })

  it("uses cited web search only after no local match", async () => {
    const search = { search: vi.fn(async () => ({ answer: "Current official notice", sources, searchedAt: "2026-08-31T00:00:00Z" })) }
    const answer = await answerPlaceQuestion({ placeName: "Palace Museum", locale: "en", question: "What changed today", sources, search, documents: [] })
    expect(answer).toMatchObject({ answerMode: "web-grounded", generatedBy: "web-search" })
    expect(search.search).toHaveBeenCalledOnce()
  })
})
