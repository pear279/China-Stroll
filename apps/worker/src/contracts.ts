import { z } from "zod"

export const localeSchema = z.enum(["en", "zh-CN"])

export const placeIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

export const agentChangeSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("add_stop"),
    placeId: placeIdSchema,
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
  placeId: placeIdSchema,
  dayNumber: z.int().positive().default(1),
  expectedVersion: z.int().positive(),
  commandId: z.uuid(),
})

export const editTripStopsSchema = z.object({
  expectedVersion: z.int().positive(),
  commandId: z.uuid(),
  changes: agentChangesSchema.min(1).max(20),
})

export const addTripDaySchema = z.object({
  date: z.iso.date().nullable().optional(),
  title: z.string().trim().min(1).max(120).optional(),
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

export const placeListQuerySchema = z.object({
  locale: localeSchema.default("en"),
  category: z.string().trim().min(1).max(40).optional(),
  maxDurationMinutes: z.coerce.number().int().positive().max(1440).optional(),
})

export const placeDetailQuerySchema = z.object({
  locale: localeSchema.default("en"),
})

export const guideAudienceSchema = z.enum(["general", "child"])

export const placeGuideQuerySchema = z.object({
  locale: localeSchema.default("en"),
  audience: guideAudienceSchema.default("general"),
})

export const placeQuestionSchema = z.object({
  locale: localeSchema.default("en"),
  question: z.string().trim().min(2).max(500),
})

export const placeRecommendationSchema = z.object({
  preferences: z.array(z.enum(["family", "history", "relaxed", "photography", "half-day"])).max(5),
  context: z.string().trim().max(300),
  locale: localeSchema.default("en"),
  coordinate: z.tuple([z.number().finite(), z.number().finite()]).nullable(),
  radiusKm: z.union([z.literal(1), z.literal(3), z.literal(5), z.null()]),
  availableMinutes: z.number().int().min(30).max(720).nullable(),
  candidatePlaceIds: z.array(placeIdSchema).min(1).max(20),
  plannedPlaceIds: z.array(placeIdSchema).max(20),
})

export const savePlaceSchema = z.object({
  placeId: placeIdSchema,
  collectionName: z.string().trim().min(1).max(80).nullable().optional(),
  labels: z.array(z.string().trim().min(1).max(40)).max(10).default([]),
  note: z.string().trim().max(1000).default(""),
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
  | "RATE_LIMITED"
  | "DEPENDENCY_UNAVAILABLE"

export function apiError(code: ApiErrorCode, message: string, details?: unknown) {
  return { error: { code, message, details } }
}
