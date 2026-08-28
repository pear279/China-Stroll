import { describe, expect, it } from "vitest"
import {
  addStopSchema,
  agentChangesSchema,
  createTripSchema,
  isReviewOverdue,
  parseOpeningHours,
  placeIdSchema,
  placeListQuerySchema,
  tripCommandResultSchema,
} from "./contracts"

describe("worker contracts", () => {
  it("accepts a place beyond the first three samples", () => {
    const result = addStopSchema.safeParse({
      placeId: "summer-palace",
      dayNumber: 1,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
    })
    expect(result.success).toBe(true)
  })

  it("still rejects a malformed place identifier", () => {
    const result = addStopSchema.safeParse({
      placeId: "Summer Palace",
      dayNumber: 1,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
    })
    expect(result.success).toBe(false)
  })

  it("lets a suggestion add any published place", () => {
    const result = agentChangesSchema.safeParse([
      { op: "add_stop", placeId: "summer-palace", dayNumber: 2, startTime: "09:00", sortOrder: 0 },
    ])
    expect(result.success).toBe(true)
  })

  it("normalizes a valid trip request", () => {
    const result = createTripSchema.parse({
      name: "  Beijing family days  ",
      startDate: "2026-10-02",
      commandId: crypto.randomUUID(),
    })
    expect(result.name).toBe("Beijing family days")
    expect(result.locale).toBe("en")
  })

  it("rejects malformed database change data", () => {
    const result = agentChangesSchema.safeParse([{ op: "update_stop", stopId: "not-a-uuid" }])
    expect(result.success).toBe(false)
  })

  it("keeps only the public command result", () => {
    const result = tripCommandResultSchema.parse({
      tripId: crypto.randomUUID(),
      version: 2,
      internalCommandId: crypto.randomUUID(),
    })
    expect(Object.keys(result)).toEqual(["tripId", "version"])
  })
})

describe("place contracts", () => {
  it("accepts a short identifier and rejects unsafe input", () => {
    expect(placeIdSchema.safeParse("temple-of-heaven").success).toBe(true)
    expect(placeIdSchema.safeParse("Temple Of Heaven").success).toBe(false)
    expect(placeIdSchema.safeParse("../../etc/passwd").success).toBe(false)
  })

  it("defaults the list language and reads a numeric duration filter", () => {
    const result = placeListQuerySchema.parse({ maxDurationMinutes: "120" })
    expect(result.locale).toBe("en")
    expect(result.maxDurationMinutes).toBe(120)
  })

  it("keeps a valid opening hours object and drops a malformed one", () => {
    const valid = parseOpeningHours({
      timeZone: "Asia/Shanghai",
      weekly: [{ days: [1, 2, 3], opens: "08:30", closes: "17:00", lastEntry: "16:00" }],
      exceptions: [{ date: "2026-10-01", closed: true }],
    })
    expect(valid?.weekly[0].opens).toBe("08:30")
    expect(parseOpeningHours({ timeZone: "Asia/Shanghai", weekly: [{ days: [1], opens: "8:30", closes: "17:00" }] })).toBeNull()
    expect(parseOpeningHours(null)).toBeNull()
  })

  it("treats a missing or passed review date as overdue", () => {
    const now = new Date("2026-08-28T00:00:00Z")
    expect(isReviewOverdue(null, now)).toBe(true)
    expect(isReviewOverdue("2026-08-01T00:00:00Z", now)).toBe(true)
    expect(isReviewOverdue("2026-12-01T00:00:00Z", now)).toBe(false)
  })
})
