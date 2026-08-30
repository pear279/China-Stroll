import { describe, expect, it } from "vitest"
import { placeCatalogSchema, placeQuestionResponseSchema } from "./place-contracts"

describe("place contracts", () => {
  it("rejects a web-grounded answer without clickable citations", () => {
    expect(() =>
      placeQuestionResponseSchema.parse({
        answer: "The rule changed.",
        answerMode: "web-grounded",
        generatedBy: "web-search",
        sources: [],
        updatedAt: null,
        searchedAt: "2026-08-30T12:00:00.000Z",
        dependencyStatus: "ready",
      }),
    ).toThrow("Web answers require a citation")
  })

  it("rejects a catalog that does not contain twenty entries per locale", () => {
    const result = placeCatalogSchema.safeParse({
      version: 1,
      checkedAt: "2026-08-30T00:00:00Z",
      reviewDueAt: "2026-09-29T00:00:00Z",
      locales: { en: [], "zh-CN": [] },
    })

    expect(result.success).toBe(false)
  })
})
