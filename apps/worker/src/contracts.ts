import { z } from "zod"

export const localeSchema = z.enum(["en", "zh-CN"])

const samplePlaceIdSchema = z.enum(["forbidden-city", "jingshan-park", "temple-of-heaven"])

export const agentChangeSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_stop"),
    placeId: samplePlaceIdSchema,
    dayNumber: z.int().positive(),
    startTime: z.string(),
    sortOrder: z.int().nonnegative(),
  }),
  z.object({
    op: z.literal("update_stop"),
    stopId: z.uuid(),
    startTime: z.string(),
    durationMinutes: z.int().positive(),
    sortOrder: z.int().nonnegative(),
  }),
  z.object({
    op: z.literal("move_stop"),
    stopId: z.uuid(),
    dayNumber: z.int().positive(),
    sortOrder: z.int().nonnegative(),
  }),
  z.object({ op: z.literal("remove_stop"), stopId: z.uuid() }),
])

export const agentChangesSchema = z.array(agentChangeSchema)
export const suggestionStatusSchema = z.enum(["proposed", "confirmed", "rejected", "expired", "applied", "failed"])
export const suggestionRisksSchema = z.array(z.string())

export const tripCommandResultSchema = z.object({
  tripId: z.uuid(),
  version: z.int().positive(),
})

export const createTripSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startDate: z.iso.date().nullable().optional(),
  locale: localeSchema.default("en"),
  commandId: z.uuid(),
})

export const addStopSchema = z.object({
  placeId: samplePlaceIdSchema,
  dayNumber: z.int().positive().default(1),
  expectedVersion: z.int().positive(),
  commandId: z.uuid(),
})

export const suggestionRequestSchema = z.object({
  intent: z.string().trim().min(1).max(100).default("Make day one easier to follow"),
})

export const confirmSuggestionSchema = z.object({
  expectedVersion: z.int().positive(),
  commandId: z.uuid(),
})

export const placeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const placeListQuerySchema = z.object({
  locale: localeSchema.default("en"),
  category: z.string().trim().min(1).max(40).optional(),
  maxDurationMinutes: z.coerce.number().int().positive().max(1440).optional(),
})

export const placeDetailQuerySchema = z.object({
  locale: localeSchema.default("en"),
})

export const openingHoursSchema = z.object({
  timeZone: z.string().trim().min(1),
  weekly: z
    .array(
      z.object({
        days: z.array(z.int().min(0).max(6)),
        opens: z.string().regex(/^\d{2}:\d{2}$/),
        closes: z.string().regex(/^\d{2}:\d{2}$/),
        lastEntry: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      }),
    )
    .default([]),
  exceptions: z
    .array(
      z.object({
        date: z.iso.date(),
        closed: z.boolean().optional(),
        opens: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        closes: z.string().regex(/^\d{2}:\d{2}$/).optional(),
      }),
    )
    .default([]),
})

export function parseOpeningHours(value: unknown) {
  const parsed = openingHoursSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function isReviewOverdue(reviewDueAt: string | null, now: Date = new Date()) {
  if (!reviewDueAt) return true
  const due = new Date(reviewDueAt).getTime()
  return Number.isNaN(due) ? true : due <= now.getTime()
}

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "DUPLICATE_COMMAND"
  | "SUGGESTION_EXPIRED"
  | "DEPENDENCY_UNAVAILABLE"

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return { error: { code, message, details } }
}
