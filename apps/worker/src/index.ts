import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { Hono, type Context } from "hono"
import { cors } from "hono/cors"
import { z } from "zod"
import {
  buildSampleSuggestion,
  type AgentSuggestion,
  type Coordinate,
  type GuideSegment,
  type GuideSource,
  type LocationSharingSnapshot,
  type PlaceDetail,
  type PlaceGuideResponse,
  type PlaceLibraryItem,
  type PlaceQuestionResponse,
  type PlaceRecommendationInput,
  type PlaceRecommendationResponse,
  type PlaceSourceCitation,
  type PlaceSummary,
  type ReservationCategory,
  type ReservationStatus,
  type TripSnapshot,
  type UserProfile,
} from "../../../packages/shared/src"
import type { Database } from "../../../supabase/database.types"
import {
  addStopSchema,
  addTripDaySchema,
  acceptInvitationResultSchema,
  createReservationSchema,
  deleteReservationSchema,
  agentChangesSchema,
  apiError,
  confirmSuggestionSchema,
  createInvitationResultSchema,
  createTripInvitationSchema,
  createTripSchema,
  currentLocationResponseSchema,
  currentLocationSchema,
  editTripStopsSchema,
  invitationTokenSchema,
  isReviewOverdue,
  localeSchema,
  locationSharingToggleResponseSchema,
  locationSharingToggleSchema,
  parseOpeningHours,
  placeDetailQuerySchema,
  placeGuideQuerySchema,
  placeIdSchema,
  placeListQuerySchema,
  placeQuestionSchema,
  placeRecommendationSchema,
  removeMemberResultSchema,
  revokeInvitationResultSchema,
  savePlaceSchema,
  suggestionRisksSchema,
  suggestionRequestSchema,
  suggestionStatusSchema,
  tripCommandResultSchema,
  tripInvitationPreviewSchema,
  tripInvitationSummarySchema,
  tripMemberSummarySchema,
  updateReservationSchema,
  userProfileInputSchema,
} from "./contracts"
import { generateRecommendationExplanations, generateTripSuggestion, siliconFlowConfigFromBindings } from "./siliconflow"
import { answerPlaceQuestion } from "./placeIntelligence"
import { TavilyWebSearchProvider } from "./webSearch"
import { rankPlaceRecommendations } from "../../../packages/shared/src/place-discovery"

type WorkerSecretBindings = {
  SUPABASE_SERVICE_ROLE_KEY: string
  SILICONFLOW_API_KEY?: string
  TAVILY_API_KEY?: string
}

type WidenConfiguredBindings = {
  [Key in keyof Cloudflare.Env]?: Cloudflare.Env[Key] extends string ? string : Cloudflare.Env[Key]
}

export type WorkerBindings = WidenConfiguredBindings & WorkerSecretBindings & {
  SUPABASE_URL: string
  WEB_ORIGIN: string
}

type Variables = {
  user: User
  accessToken: string
  admin: SupabaseClient<Database>
  userClient: SupabaseClient<Database>
}

type WorkerContext = Context<{ Bindings: WorkerBindings; Variables: Variables }>

export const PROTECTED_PREFIXES = ["/v1/trips", "/v1/trip-invitations", "/v1/place-library", "/v1/profile"] as const

export function requiresAuthentication(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}


const app = new Hono<{ Bindings: WorkerBindings; Variables: Variables }>()

app.use(
  "*",
  cors({
    origin: (origin, context) => (origin === context.env.WEB_ORIGIN ? origin : ""),
    allowHeaders: ["Authorization", "Content-Type", "Idempotency-Key"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
)

app.use("/v1/*", async (context, next) => {
  await next()
  if (requiresAuthentication(new URL(context.req.url).pathname)) {
    context.header("Cache-Control", "private, no-store")
  }
})

app.use("/v1/*", async (context, next) => {
  const contentLength = Number(context.req.header("Content-Length") ?? 0)
  if (contentLength > 65_536) {
    return context.json(apiError("VALIDATION_FAILED", "The request is too large."), 400)
  }
  await next()
})

app.get("/health", (context) => context.json({ status: "ok", service: "china-stroll-api" }))

function createPublicClient(env: WorkerBindings) {
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.SUPABASE_SERVICE_ROLE_KEY
  if (!env.SUPABASE_URL || !key) return null
  return createClient<Database>(env.SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function consumePlaceIntelligenceLimit(context: {
  env: WorkerBindings
  req: { header: (name: string) => string | undefined }
}) {
  const authorization = context.req.header("Authorization")
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined
  let userId: string | undefined
  if (token && context.env.SUPABASE_URL && context.env.SUPABASE_SERVICE_ROLE_KEY) {
    const authClient = createClient<Database>(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data } = await authClient.auth.getUser(token)
    userId = data.user?.id
  }
  if (context.env.ALLOW_ANONYMOUS_PLACE_AI !== "true" && !userId) return "unauthenticated" as const
  const limiter = context.env.PLACE_AI_RATE_LIMITER
  if (!limiter) return "dependency-unavailable" as const
  const key = userId ?? context.req.header("CF-Connecting-IP") ?? "anonymous"
  return (await limiter.limit({ key })).success ? "ok" as const : "rate-limited" as const
}

app.get("/v1/places", async (context) => {
  const parsed = placeListQuerySchema.safeParse({
    locale: context.req.query("locale") ?? undefined,
    category: context.req.query("category") ?? undefined,
    maxDurationMinutes: context.req.query("maxDurationMinutes") ?? undefined,
  })
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the place filters.", z.flattenError(parsed.error)), 400)
  }

  const client = createPublicClient(context.env)
  if (!client) {
    return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The place service is temporarily unavailable."), 503)
  }

  let query = client
    .from("places")
    .select(
      "id,category_code,latitude,longitude,recommended_duration_minutes,coordinate_system,coordinates_checked_at,external_ids,place_localizations!inner(locale,name,short_intro,tags)",
    )
    .eq("status", "published")
    .eq("place_localizations.locale", parsed.data.locale)
    .eq("place_localizations.review_status", "published")
    .eq("coordinate_system", "WGS84")
    .not("coordinates_checked_at", "is", null)
    .not("latitude", "is", null)
    .not("longitude", "is", null)

  if (parsed.data.category) query = query.eq("category_code", parsed.data.category)
  if (parsed.data.maxDurationMinutes) {
    query = query.lte("recommended_duration_minutes", parsed.data.maxDurationMinutes)
  }

  const { data, error } = await query.order("id")
  if (error) return mapDatabaseError(context, error)

  const places: PlaceSummary[] = (data ?? []).flatMap((place) => {
    const localization = Array.isArray(place.place_localizations)
      ? place.place_localizations[0]
      : place.place_localizations
    if (!localization || place.latitude == null || place.longitude == null) return []
    return [
      {
        id: place.id,
        locale: parsed.data.locale,
        name: localization.name,
        shortIntro: localization.short_intro,
        categoryCode: place.category_code,
        tags: localization.tags ?? [],
        coordinate: [place.longitude, place.latitude] satisfies Coordinate,
        durationMinutes: place.recommended_duration_minutes,
        coordinatesCheckedAt: place.coordinates_checked_at,
      },
    ]
  })

  context.header("Cache-Control", "public, max-age=300")
  return context.json({ locale: parsed.data.locale, places })
})

async function loadPublishedGuide(
  client: SupabaseClient<Database>,
  placeId: string,
  locale: "en" | "zh-CN",
  audience: "general" | "child" = "general",
) {
  const [placeResult, segmentResult, sourceResult] = await Promise.all([
    client
      .from("place_localizations")
      .select("name,updated_at")
      .eq("place_id", placeId)
      .eq("locale", locale)
      .eq("review_status", "published")
      .maybeSingle(),
    client
      .from("guide_segments")
      .select("id,segment_type,audience,title,content,sequence,updated_at")
      .eq("place_id", placeId)
      .eq("locale", locale)
      .eq("audience", audience)
      .eq("review_status", "published")
      .order("sequence"),
    client
      .from("place_sources")
      .select("id,source_name,source_url,checked_at,review_due_at")
      .eq("place_id", placeId)
      .eq("status", "published")
      .order("id"),
  ])
  return { placeResult, segmentResult, sourceResult }
}

app.get("/v1/places/:placeId/guide", async (context) => {
  const placeId = placeIdSchema.safeParse(context.req.param("placeId"))
  const parsed = placeGuideQuerySchema.safeParse({
    locale: context.req.query("locale") ?? undefined,
    audience: context.req.query("audience") ?? undefined,
  })
  if (!placeId.success || !parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the guide request."), 400)
  }
  const client = createPublicClient(context.env)
  if (!client) {
    return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The guide service is temporarily unavailable."), 503)
  }
  const { placeResult, segmentResult, sourceResult } = await loadPublishedGuide(
    client,
    placeId.data,
    parsed.data.locale,
    parsed.data.audience,
  )
  if (placeResult.error || segmentResult.error || sourceResult.error) {
    return mapDatabaseError(context, placeResult.error ?? segmentResult.error ?? sourceResult.error as { message: string })
  }
  if (!placeResult.data) return context.json(apiError("NOT_FOUND", "Guide not found."), 404)

  const segments: GuideSegment[] = (segmentResult.data ?? []).map((segment) => ({
    id: segment.id,
    type: segment.segment_type as GuideSegment["type"],
    audience: segment.audience as GuideSegment["audience"],
    title: segment.title,
    content: segment.content,
    sequence: segment.sequence,
    updatedAt: segment.updated_at,
  }))
  const sources: GuideSource[] = (sourceResult.data ?? []).map((source) => ({
    id: source.id,
    name: source.source_name,
    url: source.source_url,
    checkedAt: source.checked_at,
    reviewDueAt: source.review_due_at,
    needsRecheck: isReviewOverdue(source.review_due_at),
  }))
  const response: PlaceGuideResponse = {
    placeId: placeId.data,
    locale: parsed.data.locale,
    audience: parsed.data.audience,
    segments,
    sources,
  }
  context.header("Cache-Control", "public, max-age=300")
  return context.json(response)
})

app.get("/v1/places/:placeId", async (context) => {
  const placeId = placeIdSchema.safeParse(context.req.param("placeId"))
  const parsed = placeDetailQuerySchema.safeParse({ locale: context.req.query("locale") ?? undefined })
  if (!placeId.success || !parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the place identifier and language."), 400)
  }

  const client = createPublicClient(context.env)
  if (!client) {
    return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The place service is temporarily unavailable."), 503)
  }

  const [placeResult, localizationResult, visitResult] = await Promise.all([
    client
      .from("places")
      .select("id,category_code,latitude,longitude,recommended_duration_minutes,coordinate_system,coordinates_checked_at,external_ids")
      .eq("id", placeId.data)
      .eq("status", "published")
      .maybeSingle(),
    client
      .from("place_localizations")
      .select("locale,name,aliases,tags,short_intro,history,highlights,visitor_tips,practical_notes,photo_spot_notes,reviewed_at")
      .eq("place_id", placeId.data)
      .eq("locale", parsed.data.locale)
      .eq("review_status", "published")
      .maybeSingle(),
    client
      .from("place_visit_information")
      .select("address,opening_hours_text,opening_hours,ticket_notes,booking_required,booking_url,reservation_notes,entrance_notes,checked_at,review_due_at")
      .eq("place_id", placeId.data)
      .eq("locale", parsed.data.locale)
      .eq("status", "published")
      .maybeSingle(),
  ])

  if (placeResult.error) return mapDatabaseError(context, placeResult.error)
  if (localizationResult.error) return mapDatabaseError(context, localizationResult.error)
  if (visitResult.error) return mapDatabaseError(context, visitResult.error)
  if (!placeResult.data || !localizationResult.data) {
    return context.json(apiError("NOT_FOUND", "Place not found."), 404)
  }

  const visit = visitResult.data
  const detail: PlaceDetail = {
    id: placeResult.data.id,
    locale: parsed.data.locale,
    name: localizationResult.data.name,
    aliases: localizationResult.data.aliases ?? [],
    tags: localizationResult.data.tags ?? [],
    shortIntro: localizationResult.data.short_intro,
    history: localizationResult.data.history,
    highlights: localizationResult.data.highlights ?? [],
    visitorTips: localizationResult.data.visitor_tips,
    practicalNotes: localizationResult.data.practical_notes,
    photoSpotNotes: localizationResult.data.photo_spot_notes,
    categoryCode: placeResult.data.category_code,
    coordinate:
      placeResult.data.latitude == null || placeResult.data.longitude == null
        ? null
        : ([placeResult.data.longitude, placeResult.data.latitude] satisfies Coordinate),
    durationMinutes: placeResult.data.recommended_duration_minutes,
    coordinatesCheckedAt: placeResult.data.coordinates_checked_at,
    reviewedAt: localizationResult.data.reviewed_at,
    visitInformation: visit
      ? {
          address: visit.address,
          openingHoursText: visit.opening_hours_text,
          openingHours: parseOpeningHours(visit.opening_hours),
          ticketNotes: visit.ticket_notes,
          bookingRequired: visit.booking_required,
          bookingUrl: visit.booking_url,
          reservationNotes: visit.reservation_notes,
          entranceNotes: visit.entrance_notes,
          checkedAt: visit.checked_at,
          reviewDueAt: visit.review_due_at,
          needsRecheck: isReviewOverdue(visit.review_due_at),
        }
      : null,
  }

  context.header("Cache-Control", "public, max-age=300")
  return context.json(detail)
})

app.use("/v1/*", async (context, next) => {
  const pathname = new URL(context.req.url).pathname
  if (!requiresAuthentication(pathname)) {
    return next()
  }

  const authorization = context.req.header("Authorization")
  const accessToken = authorization?.startsWith("Bearer ") ? authorization.slice(7) : null

  if (!accessToken) {
    return context.json(apiError("UNAUTHENTICATED", "Sign in before changing a trip."), 401)
  }

  if (!context.env.SUPABASE_URL || !context.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(JSON.stringify({ message: "server_configuration_missing" }))
    return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The trip service is temporarily unavailable."), 503)
  }

  const authClient = createClient<Database>(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await authClient.auth.getUser(accessToken)

  if (error || !data.user) {
    return context.json(apiError("UNAUTHENTICATED", "Your session is no longer valid."), 401)
  }

  context.set("user", data.user)
  context.set("accessToken", accessToken)
  context.set("admin", authClient)
  context.set(
    "userClient",
    createClient<Database>(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  )
  await next()
})

app.get("/v1/place-library", async (context) => {
  const { data, error } = await context
    .get("admin")
    .from("place_library_items")
    .select("id,place_id,collection_name,labels,note")
    .eq("user_id", context.get("user").id)
    .not("place_id", "is", null)
    .order("created_at", { ascending: false })
  if (error) return mapDatabaseError(context, error)
  const items: PlaceLibraryItem[] = (data ?? []).flatMap((item) => item.place_id ? [{
    id: item.id,
    placeId: item.place_id,
    collectionName: item.collection_name,
    labels: item.labels,
    note: item.note,
  }] : [])
  return context.json({ items })
})

app.post("/v1/place-library", async (context) => {
  const parsed = savePlaceSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the saved place."), 400)
  }
  const admin = context.get("admin")
  const userId = context.get("user").id
  const { data: existing, error: lookupError } = await admin
    .from("place_library_items")
    .select("id")
    .eq("user_id", userId)
    .eq("place_id", parsed.data.placeId)
    .maybeSingle()
  if (lookupError) return mapDatabaseError(context, lookupError)
  const values = {
    user_id: userId,
    place_id: parsed.data.placeId,
    source: "product" as const,
    collection_name: parsed.data.collectionName ?? null,
    labels: parsed.data.labels,
    note: parsed.data.note,
  }
  const query = existing
    ? admin.from("place_library_items").update(values).eq("id", existing.id)
    : admin.from("place_library_items").insert(values)
  const { data, error } = await query
    .select("id,place_id,collection_name,labels,note")
    .single()
  if (error) return mapDatabaseError(context, error)
  if (!data.place_id) return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The saved place is incomplete."), 500)
  return context.json({
    id: data.id,
    placeId: data.place_id,
    collectionName: data.collection_name,
    labels: data.labels,
    note: data.note,
  } satisfies PlaceLibraryItem, 201)
})

app.delete("/v1/place-library/:placeId", async (context) => {
  const placeId = placeIdSchema.safeParse(context.req.param("placeId"))
  if (!placeId.success) return context.json(apiError("VALIDATION_FAILED", "Check the saved place."), 400)
  const { error } = await context
    .get("admin")
    .from("place_library_items")
    .delete()
    .eq("user_id", context.get("user").id)
    .eq("place_id", placeId.data)
  if (error) return mapDatabaseError(context, error)
  return context.body(null, 204)
})

app.post("/v1/places/:placeId/questions", async (context) => {
  const placeId = placeIdSchema.safeParse(context.req.param("placeId"))
  const parsed = placeQuestionSchema.safeParse(await context.req.json().catch(() => null))
  if (!placeId.success || !parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Ask one question about this place."), 400)
  }
  const client = createPublicClient(context.env)
  if (!client) return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The guide service is temporarily unavailable."), 503)
  const [placeResult, documentResult, sourceResult] = await Promise.all([
    client.from("place_localizations")
      .select("name")
      .eq("place_id", placeId.data)
      .eq("locale", parsed.data.locale)
      .eq("review_status", "published")
      .maybeSingle(),
    client.from("place_search_documents")
      .select("id,section,content,source_ids,updated_at")
      .eq("place_id", placeId.data)
      .eq("locale", parsed.data.locale)
      .eq("status", "published"),
    client.from("place_sources")
      .select("id,source_name,source_url,source_type,published_at,checked_at,review_due_at")
      .eq("place_id", placeId.data)
      .eq("status", "published"),
  ])
  if (placeResult.error || documentResult.error || sourceResult.error) {
    return mapDatabaseError(context, placeResult.error ?? documentResult.error ?? sourceResult.error as { message: string })
  }
  if (!placeResult.data) return context.json(apiError("NOT_FOUND", "Guide not found."), 404)
  const sources: PlaceSourceCitation[] = (sourceResult.data ?? []).flatMap((source) => {
    if (!source.source_url?.startsWith("https://") || !source.checked_at) return []
    return [{
      id: String(source.id),
      name: source.source_name,
      url: source.source_url,
      publishedAt: source.published_at,
      checkedAt: source.checked_at,
      reviewDueAt: source.review_due_at,
      needsRecheck: isReviewOverdue(source.review_due_at),
      sourceType: source.source_type === "official" ? "official" : "reviewed-reference",
    }]
  })
  const documents = (documentResult.data ?? []).map((document) => ({
    id: String(document.id),
    section: document.section,
    content: document.content,
    sourceIds: document.source_ids.map(String),
    updatedAt: document.updated_at,
  }))
  const hasLocalMatch = documents.some((document) => {
    const terms = parsed.data.question.toLocaleLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []
    const text = `${document.section} ${document.content}`.toLocaleLowerCase()
    return terms.some((term) => text.includes(term))
  })
  if (!hasLocalMatch && context.env.TAVILY_API_KEY) {
    const limit = await consumePlaceIntelligenceLimit(context)
    if (limit === "unauthenticated") return context.json(apiError("UNAUTHENTICATED", "Sign in before using external place intelligence."), 401)
    if (limit === "rate-limited") return context.json(apiError("RATE_LIMITED", "Please wait before asking another external place question."), 429)
    if (limit === "dependency-unavailable") return context.json(apiError("DEPENDENCY_UNAVAILABLE", "External place intelligence is temporarily unavailable."), 503)
  }
  const response: PlaceQuestionResponse = await answerPlaceQuestion({
    placeName: placeResult.data.name,
    question: parsed.data.question,
    locale: parsed.data.locale,
    documents,
    sources,
    search: !hasLocalMatch && context.env.TAVILY_API_KEY
      ? new TavilyWebSearchProvider(context.env.TAVILY_API_KEY)
      : undefined,
  })
  return context.json(response)
})

app.post("/v1/place-recommendations", async (context) => {
  const parsed = placeRecommendationSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the recommendation preferences and place list."), 400)
  }
  const client = createPublicClient(context.env)
  if (!client) return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The place service is temporarily unavailable."), 503)
  const candidateIds = [...new Set(parsed.data.candidatePlaceIds)]
  const { data, error } = await client
    .from("places")
    .select("id,category_code,latitude,longitude,recommended_duration_minutes,coordinates_checked_at,place_localizations!inner(locale,name,short_intro,tags)")
    .eq("status", "published")
    .eq("place_localizations.locale", parsed.data.locale)
    .eq("place_localizations.review_status", "published")
    .eq("coordinate_system", "WGS84")
    .in("id", candidateIds)
  if (error) return mapDatabaseError(context, error)
  const places = (data ?? []).flatMap((place) => {
    const localization = Array.isArray(place.place_localizations) ? place.place_localizations[0] : place.place_localizations
    if (!localization || place.latitude == null || place.longitude == null) return []
    return [{
      id: place.id,
      locale: parsed.data.locale,
      name: localization.name,
      shortIntro: localization.short_intro,
      categoryCode: place.category_code,
      tags: localization.tags ?? [],
      coordinate: [place.longitude, place.latitude] as [number, number],
      durationMinutes: place.recommended_duration_minutes,
      coordinatesCheckedAt: place.coordinates_checked_at,
    }]
  })
  if (places.length !== candidateIds.length) {
    return context.json(apiError("VALIDATION_FAILED", "One or more requested places are not published in this locale."), 400)
  }
  const input: PlaceRecommendationInput = { ...parsed.data, candidatePlaceIds: candidateIds, plannedPlaceIds: [...new Set(parsed.data.plannedPlaceIds)] }
  const results = rankPlaceRecommendations(places, input)
  const siliconFlow = siliconFlowConfigFromBindings(context.env)
  let generatedBy: PlaceRecommendationResponse["generatedBy"] = "deterministic"
  if (siliconFlow.apiKey && results.length > 0) {
    const limit = await consumePlaceIntelligenceLimit(context)
    if (limit === "unauthenticated") return context.json(apiError("UNAUTHENTICATED", "Sign in before using external place intelligence."), 401)
    if (limit === "rate-limited") return context.json(apiError("RATE_LIMITED", "Please wait before asking for another external recommendation."), 429)
    if (limit === "dependency-unavailable") return context.json(apiError("DEPENDENCY_UNAVAILABLE", "External place intelligence is temporarily unavailable."), 503)
    const names = new Map(places.map((place) => [place.id, place.name]))
    const explanations = await generateRecommendationExplanations(siliconFlow, {
      locale: input.locale,
      candidates: results.slice(0, 5).map((result) => ({ placeId: result.placeId, name: names.get(result.placeId) ?? result.placeId, matchedSignals: result.matchedSignals, reason: result.reason })),
    }).catch(() => null)
    if (explanations) {
      const explanationById = new Map(explanations.map((item) => [item.placeId, item.reason]))
      results.forEach((result) => {
        const reason = explanationById.get(result.placeId)
        if (reason) {
          result.reason = reason
          result.reasonMode = "model"
        }
      })
      generatedBy = "model"
    }
  }
  const response: PlaceRecommendationResponse = {
    results,
    generatedBy,
    updatedAt: new Date().toISOString(),
  }
  return context.json(response)
})

app.post("/v1/trips", async (context) => {
  const parsed = createTripSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the trip name and date.", z.flattenError(parsed.error)), 400)
  }

  const { data, error } = await context.get("admin").rpc("create_mvp_trip", {
    p_actor_id: context.get("user").id,
    p_command_id: parsed.data.commandId,
    p_locale: parsed.data.locale,
    p_name: parsed.data.name,
    p_start_date: parsed.data.startDate ?? undefined,
  })

  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data), 201)
})

app.post("/v1/trips/:tripId/days", async (context) => {
  const parsed = addTripDaySchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the new trip day."), 400)
  }
  const { data, error } = await context.get("admin").rpc("add_mvp_trip_day", {
    p_actor_id: context.get("user").id,
    p_command_id: parsed.data.commandId,
    p_day_date: parsed.data.date ?? undefined,
    p_expected_version: parsed.data.expectedVersion,
    p_title: parsed.data.title ?? undefined,
    p_trip_id: context.req.param("tripId"),
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data), 201)
})

app.get("/v1/trips/:tripId", async (context) => {
  const tripId = context.req.param("tripId")
  const client = context.get("userClient")
  const [tripResult, dayResult, stopResult, reservationResult, suggestionResult] = await Promise.all([
    client.from("trips").select("id,name,start_date,end_date,locale,version").eq("id", tripId).maybeSingle(),
    client.from("trip_days").select("id,day_number,day_date,title").eq("trip_id", tripId).order("day_number"),
    client.from("trip_stops").select("id,trip_id,trip_day_id,place_id,snapshot_name,snapshot_latitude,snapshot_longitude,start_time,duration_minutes,sort_order").eq("trip_id", tripId).order("sort_order"),
    client.from("reservations").select("id,trip_id,trip_day_id,place_id,category,title,starts_at,ends_at,status,provider,confirmation_code,notes").eq("trip_id", tripId).order("starts_at", { ascending: true }),
    client.from("agent_suggestions").select("id,trip_id,base_version,intent,reason,changes,risks,status,expires_at").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(5),
  ])

  if (tripResult.error) return mapDatabaseError(context, tripResult.error)
  if (!tripResult.data) return context.json(apiError("NOT_FOUND", "Trip not found."), 404)
  const dayById = new Map((dayResult.data ?? []).map((day) => [day.id, day.day_number]))
  const snapshot: TripSnapshot = {
    id: tripResult.data.id,
    name: tripResult.data.name,
    startDate: tripResult.data.start_date,
    endDate: tripResult.data.end_date,
    locale: localeSchema.parse(tripResult.data.locale),
    version: Number(tripResult.data.version),
    days: (dayResult.data ?? []).map((day) => ({
      id: day.id,
      dayNumber: day.day_number,
      date: day.day_date,
      title: day.title,
    })),
    stops: (stopResult.data ?? []).map((stop) => ({
      id: stop.id,
      tripId: stop.trip_id,
      dayNumber: stop.trip_day_id ? dayById.get(stop.trip_day_id) ?? null : null,
      placeId: stop.place_id,
      name: stop.snapshot_name,
      coordinate:
        stop.snapshot_longitude == null || stop.snapshot_latitude == null
          ? null
          : [stop.snapshot_longitude, stop.snapshot_latitude],
      startTime: stop.start_time,
      durationMinutes: stop.duration_minutes,
      sortOrder: stop.sort_order,
    })),
    reservations: (reservationResult.data ?? []).map((reservation) => ({
      id: reservation.id,
      tripId: reservation.trip_id,
      dayNumber: reservation.trip_day_id ? dayById.get(reservation.trip_day_id) ?? null : null,
      placeId: reservation.place_id,
      category: reservation.category as ReservationCategory,
      title: reservation.title,
      startsAt: reservation.starts_at,
      endsAt: reservation.ends_at,
      status: reservation.status as ReservationStatus,
      provider: reservation.provider,
      confirmationCode: reservation.confirmation_code,
      notes: reservation.notes,
    })),
    suggestions: (suggestionResult.data ?? []).map((suggestion) => ({
      id: suggestion.id,
      tripId: suggestion.trip_id,
      baseVersion: Number(suggestion.base_version),
      intent: suggestion.intent,
      reason: suggestion.reason,
      changes: agentChangesSchema.parse(suggestion.changes),
      risks: suggestionRisksSchema.parse(suggestion.risks),
      status: suggestionStatusSchema.parse(suggestion.status),
      expiresAt: suggestion.expires_at,
    })),
  }

  return context.json(snapshot)
})

async function readLocationSharingSnapshot(
  userClient: SupabaseClient<Database>,
  admin: SupabaseClient<Database>,
  userId: string,
  tripId: string,
): Promise<
  | { snapshot: LocationSharingSnapshot; error?: never; notFound?: never }
  | { snapshot?: never; error: { message: string; code?: string }; notFound?: never }
  | { snapshot?: never; error?: never; notFound: true }
> {
  const now = new Date()
  const nowIso = now.toISOString()
  const [preferenceResult, memberResult, locationResult] = await Promise.all([
    userClient
      .from("trip_location_sharing_preferences")
      .select("enabled,enabled_at,expires_at,updated_at")
      .eq("trip_id", tripId)
      .eq("user_id", userId)
      .maybeSingle(),
    userClient
      .from("trip_members")
      .select("user_id")
      .eq("trip_id", tripId)
      .eq("status", "active"),
    userClient
      .from("trip_member_locations")
      .select("user_id,latitude,longitude,sharing_enabled,updated_at,expires_at")
      .eq("trip_id", tripId)
      .eq("sharing_enabled", true)
      .gt("expires_at", nowIso),
  ])

  const readError = preferenceResult.error ?? memberResult.error ?? locationResult.error
  if (readError) return { error: readError }

  const activeMemberIds = new Set((memberResult.data ?? []).map((member) => member.user_id))
  if (!activeMemberIds.has(userId)) return { notFound: true }

  const peerLocations = (locationResult.data ?? []).filter((location) =>
    location.user_id !== userId
      && activeMemberIds.has(location.user_id)
      && location.sharing_enabled
      && new Date(location.expires_at).getTime() > now.getTime(),
  )
  const peerIds = [...new Set(peerLocations.map((location) => location.user_id))]
  const profileResult = peerIds.length > 0
    ? await admin.from("user_profiles").select("user_id,display_name").in("user_id", peerIds)
    : { data: [], error: null }
  if (profileResult.error) return { error: profileResult.error }

  const displayNameByUserId = new Map(
    (profileResult.data ?? []).map((profile) => [profile.user_id, profile.display_name?.trim() || "Trip member"]),
  )
  const preference = preferenceResult.data
  const preferenceExpiresAt = preference?.expires_at ?? null
  const preferenceIsActive = Boolean(
    preference?.enabled
      && preferenceExpiresAt
      && new Date(preferenceExpiresAt).getTime() > now.getTime(),
  )
  const status = preferenceIsActive
    ? "sharing"
    : preference?.enabled
      ? "expired"
      : "off"

  return {
    snapshot: {
      tripId,
      enabled: preferenceIsActive,
      status,
      activeMemberCount: activeMemberIds.size,
      expiresAt: preferenceExpiresAt,
      visibleLocations: peerLocations.map((location) => {
        const displayName = displayNameByUserId.get(location.user_id) ?? "Trip member"
        const words = displayName.split(/\s+/).filter(Boolean)
        const initials = words.length > 1
          ? `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase()
          : displayName.slice(0, 1).toUpperCase()
        return {
          userId: location.user_id,
          displayName,
          initials,
          coordinate: [location.longitude, location.latitude],
          updatedAt: location.updated_at,
          expiresAt: location.expires_at,
        }
      }),
    },
  }
}

async function locationSharingSnapshotResponse(
  context: WorkerContext,
) {
  const tripId = context.req.param("tripId")
  if (!tripId) return context.json(apiError("VALIDATION_FAILED", "Choose a trip."), 400)
  const result = await readLocationSharingSnapshot(
    context.get("userClient"),
    context.get("admin"),
    context.get("user").id,
    tripId,
  )
  if (result.error) return mapDatabaseError(context, result.error)
  if (result.notFound) return context.json(apiError("NOT_FOUND", "Trip not found."), 404)
  return context.json(result.snapshot)
}

app.get("/v1/trips/:tripId/location-sharing", locationSharingSnapshotResponse)

app.put("/v1/trips/:tripId/location-sharing", async (context) => {
  const parsed = locationSharingToggleSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Choose whether to share your location."), 400)
  }
  const { data, error } = await context.get("admin").rpc("set_mvp_location_sharing", {
    p_actor_id: context.get("user").id,
    p_enabled: parsed.data.enabled,
    p_trip_id: context.req.param("tripId"),
  })
  if (error) return mapDatabaseError(context, error)
  locationSharingToggleResponseSchema.parse(data)
  return locationSharingSnapshotResponse(context)
})

app.put("/v1/trips/:tripId/location-sharing/current-location", async (context) => {
  const parsed = currentLocationSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Share a valid current location."), 400)
  }
  const { data, error } = await context.get("admin").rpc("upsert_mvp_current_location", {
    p_actor_id: context.get("user").id,
    p_latitude: parsed.data.latitude,
    p_longitude: parsed.data.longitude,
    p_trip_id: context.req.param("tripId"),
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(currentLocationResponseSchema.parse(data))
})

app.post("/v1/trips/:tripId/stops", async (context) => {
  const parsed = addStopSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Choose a supported place and refresh the trip.", z.flattenError(parsed.error)), 400)
  }

  const { data, error } = await context.get("admin").rpc("apply_mvp_trip_changes", {
    p_actor_id: context.get("user").id,
    p_changes: [{ op: "add_stop", placeId: parsed.data.placeId, dayNumber: parsed.data.dayNumber }],
    p_command_id: parsed.data.commandId,
    p_expected_version: parsed.data.expectedVersion,
    p_trip_id: context.req.param("tripId"),
  })

  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data))
})

app.patch("/v1/trips/:tripId/stops", async (context) => {
  const parsed = editTripStopsSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Check the itinerary changes."), 400)
  }
  const { data, error } = await context.get("admin").rpc("apply_mvp_trip_changes", {
    p_actor_id: context.get("user").id,
    p_changes: parsed.data.changes,
    p_change_type: "edit_itinerary",
    p_command_id: parsed.data.commandId,
    p_expected_version: parsed.data.expectedVersion,
    p_trip_id: context.req.param("tripId"),
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data))
})

app.post("/v1/trips/:tripId/reservations", async (context) => {
  const parsed = createReservationSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Check the reservation details."), 400)
  const { expectedVersion, commandId, ...input } = parsed.data
  const { data, error } = await context.get("admin").rpc("apply_mvp_reservation_command", {
    p_actor_id: context.get("user").id, p_trip_id: context.req.param("tripId"), p_expected_version: expectedVersion,
    p_command_id: commandId, p_operation: "create", p_input: input,
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data), 201)
})

app.patch("/v1/trips/:tripId/reservations/:reservationId", async (context) => {
  const parsed = updateReservationSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Check the reservation details."), 400)
  const { expectedVersion, commandId, ...input } = parsed.data
  const { data, error } = await context.get("admin").rpc("apply_mvp_reservation_command", {
    p_actor_id: context.get("user").id, p_trip_id: context.req.param("tripId"), p_expected_version: expectedVersion,
    p_command_id: commandId, p_operation: "update", p_reservation_id: context.req.param("reservationId"), p_input: input,
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data))
})

app.delete("/v1/trips/:tripId/reservations/:reservationId", async (context) => {
  const parsed = deleteReservationSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Refresh the trip before deleting this reservation."), 400)
  const { data, error } = await context.get("admin").rpc("apply_mvp_reservation_command", {
    p_actor_id: context.get("user").id, p_trip_id: context.req.param("tripId"), p_expected_version: parsed.data.expectedVersion,
    p_command_id: parsed.data.commandId, p_operation: "delete", p_reservation_id: context.req.param("reservationId"),
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data))
})

function generateInvitationToken() {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  let binary = ""
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

async function hashInvitationToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

app.get("/v1/profile", async (context) => {
  const userId = context.get("user").id
  const { data, error } = await context
    .get("admin")
    .from("user_profiles")
    .select("display_name,interface_locale,content_locale,country_code,travel_preferences")
    .eq("user_id", userId)
    .maybeSingle()
  if (error) return mapDatabaseError(context, error)
  const profile: UserProfile = {
    userId,
    displayName: data?.display_name ?? "",
    interfaceLocale: localeSchema.parse(data?.interface_locale ?? "en"),
    contentLocale: localeSchema.parse(data?.content_locale ?? "en"),
    countryCode: data?.country_code ?? null,
    travelPreferences: (data?.travel_preferences ?? {}) as Record<string, string | boolean | number>,
  }
  return context.json(profile)
})

app.put("/v1/profile", async (context) => {
  const parsed = userProfileInputSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Check your profile details."), 400)
  const userId = context.get("user").id
  const input = parsed.data
  const { error } = await context
    .get("admin")
    .from("user_profiles")
    .upsert({
      user_id: userId,
      display_name: input.displayName,
      interface_locale: input.interfaceLocale,
      content_locale: input.contentLocale,
      country_code: input.countryCode,
      travel_preferences: input.travelPreferences,
    }, { onConflict: "user_id" })
  if (error) return mapDatabaseError(context, error)
  const profile: UserProfile = {
    userId,
    displayName: input.displayName,
    interfaceLocale: input.interfaceLocale,
    contentLocale: input.contentLocale,
    countryCode: input.countryCode,
    travelPreferences: input.travelPreferences,
  }
  return context.json(profile)
})

app.get("/v1/trips/:tripId/members", async (context) => {
  const tripId = context.req.param("tripId")
  const userId = context.get("user").id
  const { data: members, error } = await context
    .get("admin")
    .from("trip_members")
    .select("user_id,role,joined_at")
    .eq("trip_id", tripId)
    .eq("status", "active")
  if (error) return mapDatabaseError(context, error)
  if (!members?.some((member) => member.user_id === userId)) {
    return context.json(apiError("NOT_FOUND", "Trip not found."), 404)
  }
  const memberIds = members.map((member) => member.user_id)
  const { data: profiles, error: profileError } = await context
    .get("admin")
    .from("user_profiles")
    .select("user_id,display_name")
    .in("user_id", memberIds)
  if (profileError) return mapDatabaseError(context, profileError)
  const displayNameById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile.display_name]))
  const summaries = members.map((member) =>
    tripMemberSummarySchema.parse({
      userId: member.user_id,
      displayName: displayNameById.get(member.user_id) ?? "Trip member",
      role: member.role,
      joinedAt: member.joined_at,
      isCurrentUser: member.user_id === userId,
    }),
  )
  return context.json({ members: summaries })
})

app.get("/v1/trips/:tripId/invitations", async (context) => {
  const tripId = context.req.param("tripId")
  const userId = context.get("user").id
  const { data: tripRow, error: tripError } = await context
    .get("admin")
    .from("trips")
    .select("owner_id")
    .eq("id", tripId)
    .maybeSingle()
  if (tripError) return mapDatabaseError(context, tripError)
  if (!tripRow || tripRow.owner_id !== userId) {
    return context.json(apiError("FORBIDDEN", "Only the trip owner can manage invitations."), 403)
  }
  const { data, error } = await context
    .get("admin")
    .from("trip_invitations")
    .select("id,trip_id,role,expires_at,use_count,max_uses,revoked_at")
    .eq("trip_id", tripId)
  if (error) return mapDatabaseError(context, error)
  const invitations = (data ?? []).map((invitation) =>
    tripInvitationSummarySchema.parse({
      id: invitation.id,
      tripId: invitation.trip_id,
      role: invitation.role,
      expiresAt: invitation.expires_at,
      useCount: invitation.use_count,
      maxUses: invitation.max_uses,
      revokedAt: invitation.revoked_at,
    }),
  )
  return context.json({ invitations })
})

app.post("/v1/trips/:tripId/invitations", async (context) => {
  const parsed = createTripInvitationSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) return context.json(apiError("VALIDATION_FAILED", "Choose a role and an expiry for the invitation."), 400)
  const token = generateInvitationToken()
  const tokenHash = await hashInvitationToken(token)
  const { data, error } = await context.get("admin").rpc("create_mvp_trip_invitation", {
    p_actor_id: context.get("user").id,
    p_trip_id: context.req.param("tripId"),
    p_command_id: crypto.randomUUID(),
    p_token_hash: tokenHash,
    p_role: parsed.data.role,
    p_expires_in_hours: parsed.data.expiresInHours,
  })
  if (error) return mapDatabaseError(context, error)
  const result = createInvitationResultSchema.parse(data)
  const webOrigin = context.env.WEB_ORIGIN.replace(/\/$/, "")
  return context.json({ invitation: result.invitation, inviteUrl: `${webOrigin}/join/${token}` }, 201)
})

app.get("/v1/trip-invitations/:token", async (context) => {
  const token = invitationTokenSchema.safeParse(context.req.param("token"))
  if (!token.success) return context.json(apiError("VALIDATION_FAILED", "This invitation link is not valid."), 400)
  const tokenHash = await hashInvitationToken(token.data)
  const { data, error } = await context.get("admin").rpc("preview_mvp_trip_invitation", {
    p_actor_id: context.get("user").id,
    p_token_hash: tokenHash,
  })
  if (error) return mapDatabaseError(context, error)
  return context.json(tripInvitationPreviewSchema.parse(data))
})

app.post("/v1/trip-invitations/:token/accept", async (context) => {
  const token = invitationTokenSchema.safeParse(context.req.param("token"))
  if (!token.success) return context.json(apiError("VALIDATION_FAILED", "This invitation link is not valid."), 400)
  const tokenHash = await hashInvitationToken(token.data)
  const { data, error } = await context.get("admin").rpc("accept_mvp_trip_invitation", {
    p_actor_id: context.get("user").id,
    p_token_hash: tokenHash,
    p_command_id: crypto.randomUUID(),
  })
  if (error) return mapDatabaseError(context, error)
  const result = acceptInvitationResultSchema.parse(data)
  return context.json({
    tripId: result.tripId,
    version: result.version,
    invitationId: result.invitationId,
    member: result.member,
  })
})

app.delete("/v1/trips/:tripId/invitations/:invitationId", async (context) => {
  const { data, error } = await context.get("admin").rpc("revoke_mvp_trip_invitation", {
    p_actor_id: context.get("user").id,
    p_trip_id: context.req.param("tripId"),
    p_invitation_id: context.req.param("invitationId"),
    p_command_id: crypto.randomUUID(),
  })
  if (error) return mapDatabaseError(context, error)
  const result = revokeInvitationResultSchema.parse(data)
  return context.json({ tripId: result.tripId, invitationId: result.invitationId, revokedAt: result.revokedAt })
})

app.delete("/v1/trips/:tripId/members/:memberUserId", async (context) => {
  const { data, error } = await context.get("admin").rpc("remove_mvp_trip_member", {
    p_actor_id: context.get("user").id,
    p_trip_id: context.req.param("tripId"),
    p_member_user_id: context.req.param("memberUserId"),
    p_command_id: crypto.randomUUID(),
  })
  if (error) return mapDatabaseError(context, error)
  const result = removeMemberResultSchema.parse(data)
  return context.json({ tripId: result.tripId, removedUserId: result.removedUserId })
})

app.post("/v1/trips/:tripId/agent-suggestions", async (context) => {
  const parsed = suggestionRequestSchema.safeParse(await context.req.json().catch(() => ({})))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Describe the change in one short sentence.", z.flattenError(parsed.error)), 400)
  }

  const tripId = context.req.param("tripId")
  const client = context.get("userClient")
  const [tripResult, stopResult, dayResult] = await Promise.all([
    client.from("trips").select("id,locale,version").eq("id", tripId).maybeSingle(),
    client.from("trip_stops").select("id,trip_id,trip_day_id,place_id,snapshot_name,snapshot_latitude,snapshot_longitude,start_time,duration_minutes,sort_order").eq("trip_id", tripId),
    client.from("trip_days").select("id,day_number").eq("trip_id", tripId),
  ])
  if (tripResult.error) return mapDatabaseError(context, tripResult.error)
  if (!tripResult.data) return context.json(apiError("NOT_FOUND", "Trip not found."), 404)

  const dayById = new Map((dayResult.data ?? []).map((day) => [day.id, day.day_number]))
  const stops = (stopResult.data ?? []).map((stop) => ({
    id: stop.id,
    tripId: stop.trip_id,
    dayNumber: stop.trip_day_id ? dayById.get(stop.trip_day_id) ?? null : null,
    placeId: stop.place_id,
    name: stop.snapshot_name,
    coordinate:
      stop.snapshot_longitude == null || stop.snapshot_latitude == null
        ? null
        : ([stop.snapshot_longitude, stop.snapshot_latitude] satisfies Coordinate),
    startTime: stop.start_time,
    durationMinutes: stop.duration_minutes,
    sortOrder: stop.sort_order,
  }))
  const modelDraft = await generateTripSuggestion(siliconFlowConfigFromBindings(context.env), {
    intent: parsed.data.intent,
    locale: localeSchema.parse(tripResult.data.locale),
    stops,
  }).catch((error) => {
    console.error(JSON.stringify({ message: "siliconflow_suggestion_failed", errorName: error instanceof Error ? error.name : "UnknownError" }))
    return null
  })
  const knownStopIds = new Set(stops.map((stop) => stop.id))
  const safeModelDraft = modelDraft?.changes.every(
    (change) => change.op === "update_stop" && knownStopIds.has(change.stopId),
  )
    ? modelDraft
    : null
  const draft = safeModelDraft
    ? { intent: parsed.data.intent, ...safeModelDraft, status: "proposed" as const }
    : buildSampleSuggestion(stops)
  if (draft.changes.length === 0) {
    return context.json(apiError("VALIDATION_FAILED", "Add at least one sample place before asking for a plan."), 400)
  }

  const { data, error } = await context
    .get("admin")
    .from("agent_suggestions")
    .insert({
      trip_id: tripId,
      base_version: tripResult.data.version,
      requested_by: context.get("user").id,
      intent: parsed.data.intent,
      reason: draft.reason,
      changes: draft.changes,
      risks: draft.risks,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    })
    .select("id,trip_id,base_version,intent,reason,changes,risks,status,expires_at")
    .single()

  if (error) return mapDatabaseError(context, error)
  const suggestion: AgentSuggestion = {
    id: data.id,
    tripId: data.trip_id,
    baseVersion: Number(data.base_version),
    intent: data.intent,
    reason: data.reason,
    changes: agentChangesSchema.parse(data.changes),
    risks: suggestionRisksSchema.parse(data.risks),
    status: suggestionStatusSchema.parse(data.status),
    expiresAt: data.expires_at,
  }
  return context.json(suggestion, 201)
})

app.post("/v1/trips/:tripId/agent-suggestions/:suggestionId/confirm", async (context) => {
  const parsed = confirmSuggestionSchema.safeParse(await context.req.json().catch(() => null))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Refresh the trip before confirming this plan.", z.flattenError(parsed.error)), 400)
  }

  const admin = context.get("admin")
  const suggestionId = context.req.param("suggestionId")
  const { data: suggestion, error: suggestionError } = await admin
    .from("agent_suggestions")
    .select("status,expires_at")
    .eq("id", suggestionId)
    .eq("trip_id", context.req.param("tripId"))
    .maybeSingle()

  if (suggestionError) return mapDatabaseError(context, suggestionError)
  if (!suggestion) return context.json(apiError("NOT_FOUND", "Suggestion not found."), 404)
  if (suggestion.status === "proposed" && new Date(suggestion.expires_at).getTime() <= Date.now()) {
    const { error: expireError } = await admin
      .from("agent_suggestions")
      .update({ status: "expired", decided_at: new Date().toISOString() })
      .eq("id", suggestionId)
    if (expireError) return mapDatabaseError(context, expireError)
    return context.json(apiError("SUGGESTION_EXPIRED", "This suggestion expired. Generate a new one."), 410)
  }

  const { data, error } = await admin.rpc("confirm_mvp_agent_suggestion", {
    p_actor_id: context.get("user").id,
    p_command_id: parsed.data.commandId,
    p_expected_version: parsed.data.expectedVersion,
    p_suggestion_id: suggestionId,
    p_trip_id: context.req.param("tripId"),
  })

  if (error) return mapDatabaseError(context, error)
  return context.json(tripCommandResultSchema.parse(data))
})

function mapDatabaseError(context: Parameters<typeof apiErrorResponse>[0], error: { message: string; code?: string }) {
  const message = error.message.toLowerCase()
  if (message.includes("version_conflict")) {
    return apiErrorResponse(context, 409, "VERSION_CONFLICT", "The trip changed. Refresh before trying again.")
  }
  if (message.includes("forbidden")) {
    return apiErrorResponse(context, 403, "FORBIDDEN", "You do not have permission to edit this trip.")
  }
  if (message.includes("suggestion_expired")) {
    return apiErrorResponse(context, 410, "SUGGESTION_EXPIRED", "This suggestion expired. Generate a new one.")
  }
  if (message.includes("invitation_expired")) {
    return apiErrorResponse(context, 410, "INVITATION_EXPIRED", "This invitation link has expired.")
  }
  if (message.includes("invitation_unavailable")) {
    return apiErrorResponse(context, 410, "INVITATION_UNAVAILABLE", "This invitation is no longer available.")
  }
  if (message.includes("member_conflict")) {
    return apiErrorResponse(context, 409, "MEMBER_CONFLICT", "That membership change cannot be applied.")
  }
  if (error.code === "PGRST116" || message.includes("not_found")) {
    return apiErrorResponse(context, 404, "NOT_FOUND", "The requested trip item was not found.")
  }
  if (message.includes("validation_failed")) {
    return apiErrorResponse(context, 400, "VALIDATION_FAILED", "That change cannot be applied to this trip.")
  }
  return apiErrorResponse(context, 503, "DEPENDENCY_UNAVAILABLE", "The trip service is temporarily unavailable.")
}

function apiErrorResponse(
  context: { json: (body: ReturnType<typeof apiError>, status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503) => Response },
  status: 400 | 401 | 403 | 404 | 409 | 410 | 429 | 503,
  code: Parameters<typeof apiError>[0],
  message: string,
) {
  return context.json(apiError(code, message), status)
}

app.onError((error, context) => {
  const requestId = crypto.randomUUID()
  console.error(
    JSON.stringify({
      message: "request_failed",
      requestId,
      method: context.req.method,
      path: new URL(context.req.url).pathname,
      errorName: error instanceof Error ? error.name : "UnknownError",
    }),
  )
  return context.json(apiError("DEPENDENCY_UNAVAILABLE", "The trip service is temporarily unavailable.", { requestId }), 503)
})

export default app
