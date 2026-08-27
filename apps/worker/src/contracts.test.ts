import { describe, expect, it } from "vitest"
import { addStopSchema, agentChangesSchema, createTripSchema, tripCommandResultSchema } from "./contracts"

describe("worker contracts", () => {
  it("rejects an unsupported place", () => {
    const result = addStopSchema.safeParse({
      placeId: "summer-palace",
      dayNumber: 1,
      expectedVersion: 1,
      commandId: crypto.randomUUID(),
    })
    expect(result.success).toBe(false)
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
