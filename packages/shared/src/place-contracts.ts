import { z } from "zod"

const localeSchema = z.enum(["en", "zh-CN"])
const coordinateSchema = z.tuple([z.number().finite(), z.number().finite()])
const isoDatetimeSchema = z.iso.datetime()

export const openingHoursWindowSchema = z.object({
  days: z.array(z.number().int().min(0).max(6)),
  opens: z.string().min(1),
  closes: z.string().min(1),
  lastEntry: z.string().min(1).optional(),
})

export type OpeningHoursWindow = z.infer<typeof openingHoursWindowSchema>

export const openingHoursSchema = z.object({
  timeZone: z.string().min(1),
  weekly: z.array(openingHoursWindowSchema),
  exceptions: z.array(
    z.object({
      date: z.iso.date(),
      closed: z.boolean().optional(),
      opens: z.string().min(1).optional(),
      closes: z.string().min(1).optional(),
    }),
  ),
})

export type OpeningHours = z.infer<typeof openingHoursSchema>

export const placeSummarySchema = z.object({
  id: z.string().min(1),
  locale: localeSchema,
  name: z.string().min(1),
  shortIntro: z.string().min(1),
  categoryCode: z.string().min(1),
  tags: z.array(z.string()),
  coordinate: coordinateSchema,
  durationMinutes: z.number().int().positive(),
  coordinatesCheckedAt: isoDatetimeSchema.nullable(),
  aliases: z.array(z.string()).optional(),
  highlights: z.array(z.string()).optional(),
  reviewedAt: isoDatetimeSchema.nullable().optional(),
  reviewDueAt: isoDatetimeSchema.nullable().optional(),
})

export type PlaceSummary = z.infer<typeof placeSummarySchema>

export const placeCatalogSummarySchema = placeSummarySchema.extend({
  aliases: z.array(z.string()),
  highlights: z.array(z.string()),
  reviewedAt: isoDatetimeSchema.nullable(),
  reviewDueAt: isoDatetimeSchema.nullable(),
})

export type PlaceCatalogSummary = Omit<
  PlaceSummary,
  "aliases" | "highlights" | "reviewedAt" | "reviewDueAt"
> & {
  aliases: string[]
  highlights: string[]
  reviewedAt: string | null
  reviewDueAt: string | null
}

export const placeVisitInformationSchema = z.object({
  address: z.string().min(1),
  openingHoursText: z.string().min(1),
  openingHours: openingHoursSchema.nullable(),
  ticketNotes: z.string().min(1),
  bookingRequired: z.boolean().nullable(),
  bookingUrl: z.url().nullable(),
  reservationNotes: z.string().min(1),
  entranceNotes: z.string().min(1),
  checkedAt: isoDatetimeSchema.nullable(),
  reviewDueAt: isoDatetimeSchema.nullable(),
  needsRecheck: z.boolean(),
})

export type PlaceVisitInformation = z.infer<typeof placeVisitInformationSchema>

export const placeDetailSchema = z.object({
  id: z.string().min(1),
  locale: localeSchema,
  name: z.string().min(1),
  aliases: z.array(z.string()),
  tags: z.array(z.string()),
  shortIntro: z.string().min(1),
  history: z.string().min(1),
  highlights: z.array(z.string()),
  visitorTips: z.string().min(1),
  practicalNotes: z.string().min(1),
  photoSpotNotes: z.string().min(1),
  categoryCode: z.string().min(1),
  coordinate: coordinateSchema.nullable(),
  durationMinutes: z.number().int().positive(),
  coordinatesCheckedAt: isoDatetimeSchema.nullable(),
  reviewedAt: isoDatetimeSchema.nullable(),
  visitInformation: placeVisitInformationSchema.nullable(),
})

export type PlaceDetail = z.infer<typeof placeDetailSchema>

export const placeListResponseSchema = z.object({
  locale: localeSchema,
  places: z.array(placeSummarySchema),
})

export type PlaceListResponse = z.infer<typeof placeListResponseSchema>

export const guideSegmentSchema = z.object({
  id: z.number().int().positive(),
  type: z.enum(["overview", "history", "highlight", "family", "practical", "faq"]),
  audience: z.enum(["general", "child"]),
  title: z.string().nullable(),
  content: z.string().min(1),
  sequence: z.number().int().nonnegative(),
  updatedAt: isoDatetimeSchema,
})

export type GuideSegment = z.infer<typeof guideSegmentSchema>

export const guideSourceSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1),
  url: z.url().nullable(),
  checkedAt: isoDatetimeSchema.nullable(),
  reviewDueAt: isoDatetimeSchema.nullable(),
  needsRecheck: z.boolean(),
})

export type GuideSource = z.infer<typeof guideSourceSchema>

export const placeGuideResponseSchema = z.object({
  placeId: z.string().min(1),
  locale: localeSchema,
  audience: z.enum(["general", "child"]),
  segments: z.array(guideSegmentSchema),
  sources: z.array(guideSourceSchema),
})

export type PlaceGuideResponse = z.infer<typeof placeGuideResponseSchema>

export const placeSourceCitationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  url: z.url().startsWith("https://"),
  publisher: z.string().min(1).optional(),
  publishedAt: isoDatetimeSchema.nullable(),
  checkedAt: isoDatetimeSchema,
  reviewDueAt: isoDatetimeSchema.nullable(),
  needsRecheck: z.boolean(),
  sourceType: z.enum(["official", "reviewed-reference", "web"]),
})

export type PlaceSourceCitation = z.infer<typeof placeSourceCitationSchema>

export const placeQuestionRequestSchema = z.object({
  placeId: z.string().min(1),
  locale: localeSchema,
  question: z.string().min(1),
})

export type PlaceQuestionRequest = z.infer<typeof placeQuestionRequestSchema>

export const placeQuestionResponseSchema = z
  .object({
    answer: z.string().min(1),
    answerMode: z.enum([
      "reviewed-local",
      "model-grounded-local",
      "web-grounded",
      "unable-to-confirm",
    ]),
    generatedBy: z.enum(["deterministic-retrieval", "model", "web-search", "none"]),
    sources: z.array(placeSourceCitationSchema),
    updatedAt: isoDatetimeSchema.nullable(),
    searchedAt: isoDatetimeSchema.nullable(),
    dependencyStatus: z.enum([
      "ready",
      "ai-unavailable",
      "search-unavailable",
      "no-reliable-sources",
    ]),
    warning: z.string().optional(),
    sourceIds: z.array(z.number().int().positive()).optional(),
  })
  .superRefine((value, context) => {
    if (value.answerMode === "web-grounded" && value.sources.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["sources"],
        message: "Web answers require a citation",
      })
    }
  })

export type PlaceQuestionResponse = z.infer<typeof placeQuestionResponseSchema>

export const placeLibraryItemSchema = z.object({
  id: z.string().min(1),
  placeId: z.string().min(1),
  collectionName: z.string().nullable(),
  labels: z.array(z.string()),
  note: z.string(),
})

export type PlaceLibraryItem = z.infer<typeof placeLibraryItemSchema>

export const placeSearchDocumentSchema = z.object({
  id: z.string().min(1),
  section: z.string().min(1),
  content: z.string().min(1),
  sourceIds: z.array(z.string().min(1)),
  updatedAt: isoDatetimeSchema,
})

export type PlaceSearchDocument = z.infer<typeof placeSearchDocumentSchema>

export const placeCatalogGuidesSchema = z.object({
  placeId: z.string().min(1),
  locale: localeSchema,
  general: z.array(guideSegmentSchema),
  child: z.array(guideSegmentSchema),
  sources: z.array(placeSourceCitationSchema),
})

export type PlaceCatalogGuides = z.infer<typeof placeCatalogGuidesSchema>

export const placeCatalogEntrySchema = z.object({
  summary: placeCatalogSummarySchema,
  detail: placeDetailSchema,
  guides: placeCatalogGuidesSchema,
  searchDocuments: z.array(placeSearchDocumentSchema),
  displayImage: z.string().startsWith("/places/"),
})

export type PlaceCatalogEntry = z.infer<typeof placeCatalogEntrySchema>

function hasUniquePlaceIds(entries: PlaceCatalogEntry[]) {
  return new Set(entries.map((entry) => entry.summary.id)).size === entries.length
}

const placeCatalogLocaleEntriesSchema = z
  .array(placeCatalogEntrySchema)
  .length(20)
  .refine(hasUniquePlaceIds, "Catalog entries must have unique place IDs")

export const placeCatalogSchema = z.object({
  version: z.number().int().positive(),
  checkedAt: isoDatetimeSchema,
  reviewDueAt: isoDatetimeSchema,
  locales: z.object({
    en: placeCatalogLocaleEntriesSchema,
    "zh-CN": placeCatalogLocaleEntriesSchema,
  }),
})

export type PlaceCatalog = z.infer<typeof placeCatalogSchema>

export const placeRecommendationInputSchema = z.object({
  preferences: z.array(
    z.enum(["family", "history", "relaxed", "photography", "half-day"]),
  ),
  context: z.string(),
  locale: localeSchema,
  coordinate: coordinateSchema.nullable(),
  radiusKm: z.union([z.literal(1), z.literal(3), z.literal(5), z.null()]),
  availableMinutes: z.number().int().positive().nullable(),
  candidatePlaceIds: z.array(z.string().min(1)),
  plannedPlaceIds: z.array(z.string().min(1)),
})

export type PlaceRecommendationInput = z.infer<typeof placeRecommendationInputSchema>

export const placeRecommendationSchema = z.object({
  placeId: z.string().min(1),
  score: z.number(),
  matchedSignals: z.array(z.string()),
  reason: z.string().min(1),
  reasonMode: z.enum(["deterministic", "model"]),
})

export type PlaceRecommendation = z.infer<typeof placeRecommendationSchema>

export const placeRecommendationResponseSchema = z.object({
  results: z.array(placeRecommendationSchema),
  generatedBy: z.enum(["deterministic", "model"]),
  updatedAt: isoDatetimeSchema,
})

export type PlaceRecommendationResponse = z.infer<typeof placeRecommendationResponseSchema>
