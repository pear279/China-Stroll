/// <reference types="node" />
// @vitest-environment node
import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import {
  placeCatalogEntrySchema,
  placeCatalogSchema,
  placeQuestionResponseSchema,
} from "./place-contracts"

function buildCitation() {
  return {
    id: "source-palace-museum",
    name: "Palace Museum",
    url: "https://www.dpm.org.cn/",
    publishedAt: null,
    checkedAt: "2026-08-30T12:00:00.000Z",
    reviewDueAt: "2026-09-29T12:00:00.000Z",
    needsRecheck: false,
    sourceType: "official" as const,
  }
}

function buildCatalogEntry(locale: "en" | "zh-CN" = "en", placeId = "forbidden-city") {
  return {
    summary: {
      id: placeId,
      locale,
      name: locale === "en" ? "The Palace Museum" : "故宫博物院",
      shortIntro: "Reviewed summary",
      categoryCode: "museum",
      tags: ["history"],
      coordinate: [116.3907694, 39.9172757] as [number, number],
      durationMinutes: 240,
      coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
      aliases: ["Palace Museum"],
      highlights: ["Imperial courtyards"],
      reviewedAt: "2026-08-30T00:00:00.000Z",
      reviewDueAt: "2026-09-29T00:00:00.000Z",
    },
    detail: {
      id: placeId,
      locale,
      name: locale === "en" ? "The Palace Museum" : "故宫博物院",
      aliases: ["Palace Museum"],
      tags: ["history"],
      shortIntro: "Reviewed summary",
      history: "Reviewed history",
      highlights: ["Imperial courtyards"],
      visitorTips: "Arrive early.",
      practicalNotes: "Bring ID.",
      photoSpotNotes: "Climb the gate tower.",
      categoryCode: "museum",
      coordinate: [116.3907694, 39.9172757] as [number, number],
      durationMinutes: 240,
      coordinatesCheckedAt: "2026-08-30T00:00:00.000Z",
      reviewedAt: "2026-08-30T00:00:00.000Z",
      visitInformation: {
        address: "4 Jingshan Front St",
        openingHoursText: "08:30-17:00",
        openingHours: null,
        ticketNotes: "Tickets required.",
        bookingRequired: true,
        bookingUrl: "https://www.dpm.org.cn/",
        reservationNotes: "Book ahead.",
        entranceNotes: "Use Meridian Gate.",
        checkedAt: "2026-08-30T00:00:00.000Z",
        reviewDueAt: "2026-09-29T00:00:00.000Z",
        needsRecheck: false,
      },
    },
    guides: {
      placeId,
      locale,
      general: [
        {
          id: 1,
          type: "overview" as const,
          audience: "general" as const,
          title: "Overview",
          content: "Reviewed guide segment.",
          sequence: 0,
          updatedAt: "2026-08-30T00:00:00.000Z",
        },
      ],
      child: [
        {
          id: 2,
          type: "family" as const,
          audience: "child" as const,
          title: "For children",
          content: "Reviewed family guide segment.",
          sequence: 0,
          updatedAt: "2026-08-30T00:00:00.000Z",
        },
      ],
      sources: [buildCitation()],
    },
    searchDocuments: [
      {
        id: "search-overview",
        section: "overview",
        content: "Reviewed document content.",
        sourceIds: ["source-palace-museum"],
        updatedAt: "2026-08-30T00:00:00.000Z",
      },
    ],
    displayImage: "/places/forbidden-city.webp",
  }
}

function buildCatalog() {
  const en = Array.from({ length: 20 }, (_, index) =>
    buildCatalogEntry("en", `en-place-${index + 1}`),
  )
  const zh = Array.from({ length: 20 }, (_, index) =>
    buildCatalogEntry("zh-CN", `zh-place-${index + 1}`),
  )

  return {
    version: 1,
    checkedAt: "2026-08-30T00:00:00.000Z",
    reviewDueAt: "2026-09-29T00:00:00.000Z",
    locales: {
      en,
      "zh-CN": zh,
    },
  }
}

describe("place contracts", () => {
  it("validates the generated browser catalog", async () => {
    const url = new URL("../../../apps/web/public/data/places-v1.json", import.meta.url)
    const payload = JSON.parse(await readFile(url, "utf8"))
    const catalog = placeCatalogSchema.parse(payload)
    expect(catalog.locales.en).toHaveLength(20)
    expect(catalog.locales["zh-CN"]).toHaveLength(20)
    expect(catalog.locales.en.every((entry) => entry.displayImage.startsWith("/places/"))).toBe(true)
  })

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

  it("rejects a web-grounded answer without web search state", () => {
    const result = placeQuestionResponseSchema.safeParse({
      answer: "Check the latest update.",
      answerMode: "web-grounded",
      generatedBy: "none",
      sources: [buildCitation()],
      updatedAt: null,
      searchedAt: null,
      dependencyStatus: "ready",
    })

    expect(result.success).toBe(false)
  })

  it("rejects a reviewed-local answer that claims web search metadata", () => {
    const result = placeQuestionResponseSchema.safeParse({
      answer: "The reviewed guide says to enter at Meridian Gate.",
      answerMode: "reviewed-local",
      generatedBy: "deterministic-retrieval",
      sources: [],
      updatedAt: "2026-08-30T00:00:00.000Z",
      searchedAt: "2026-08-30T12:00:00.000Z",
      dependencyStatus: "ready",
      sourceIds: [1],
    })

    expect(result.success).toBe(false)
  })

  it("rejects an unable-to-confirm answer that still claims a ready response", () => {
    const result = placeQuestionResponseSchema.safeParse({
      answer: "The available reviewed guide cannot confirm this yet.",
      answerMode: "unable-to-confirm",
      generatedBy: "none",
      sources: [],
      updatedAt: null,
      searchedAt: null,
      dependencyStatus: "ready",
    })

    expect(result.success).toBe(false)
  })

  it("rejects a catalog entry whose nested place identities differ", () => {
    const result = placeCatalogEntrySchema.safeParse({
      ...buildCatalogEntry(),
      detail: {
        ...buildCatalogEntry().detail,
        id: "temple-of-heaven",
      },
    })

    expect(result.success).toBe(false)
  })

  it("rejects a catalog entry whose nested locales differ", () => {
    const result = placeCatalogEntrySchema.safeParse({
      ...buildCatalogEntry(),
      guides: {
        ...buildCatalogEntry().guides,
        locale: "zh-CN",
      },
    })

    expect(result.success).toBe(false)
  })

  it("rejects a catalog bucket whose nested locale does not match the locale key", () => {
    const catalog = buildCatalog()
    catalog.locales.en[0] = buildCatalogEntry("zh-CN", "en-place-1")

    const result = placeCatalogSchema.safeParse(catalog)

    expect(result.success).toBe(false)
  })
})
