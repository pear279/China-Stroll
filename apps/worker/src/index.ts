import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { z } from "zod"
import { buildSampleSuggestion, type AgentSuggestion, type Coordinate, type PlaceDetail, type PlaceSummary, type TripSnapshot } from "../../../packages/shared/src"
import type { Database } from "../../../supabase/database.types"
import {
  addStopSchema,
  agentChangesSchema,
  apiError,
  confirmSuggestionSchema,
  createTripSchema,
  isReviewOverdue,
  localeSchema,
  parseOpeningHours,
  placeDetailQuerySchema,
  placeIdSchema,
  placeListQuerySchema,
  suggestionRisksSchema,
  suggestionRequestSchema,
  suggestionStatusSchema,
  tripCommandResultSchema,
} from "./contracts"

export type WorkerBindings = {
  SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
  SUPABASE_PUBLISHABLE_KEY?: string
  WEB_ORIGIN: string
}

type Variables = {
  user: User
  accessToken: string
  admin: SupabaseClient<Database>
  userClient: SupabaseClient<Database>
}

export const PROTECTED_PREFIXES = ["/v1/trips", "/v1/trip-invitations"] as const

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
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
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

app.get("/v1/trips/:tripId", async (context) => {
  const tripId = context.req.param("tripId")
  const client = context.get("userClient")
  const [tripResult, dayResult, stopResult, suggestionResult] = await Promise.all([
    client.from("trips").select("id,name,start_date,end_date,locale,version").eq("id", tripId).maybeSingle(),
    client.from("trip_days").select("id,day_number,day_date,title").eq("trip_id", tripId).order("day_number"),
    client.from("trip_stops").select("id,trip_id,trip_day_id,place_id,snapshot_name,snapshot_latitude,snapshot_longitude,start_time,duration_minutes,sort_order").eq("trip_id", tripId).order("sort_order"),
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

app.post("/v1/trips/:tripId/agent-suggestions", async (context) => {
  const parsed = suggestionRequestSchema.safeParse(await context.req.json().catch(() => ({})))
  if (!parsed.success) {
    return context.json(apiError("VALIDATION_FAILED", "Describe the change in one short sentence.", z.flattenError(parsed.error)), 400)
  }

  const tripId = context.req.param("tripId")
  const client = context.get("userClient")
  const [tripResult, stopResult, dayResult] = await Promise.all([
    client.from("trips").select("id,version").eq("id", tripId).maybeSingle(),
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
  const draft = buildSampleSuggestion(stops)
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
  if (error.code === "PGRST116" || message.includes("not_found")) {
    return apiErrorResponse(context, 404, "NOT_FOUND", "The requested trip item was not found.")
  }
  return apiErrorResponse(context, 503, "DEPENDENCY_UNAVAILABLE", "The trip service is temporarily unavailable.")
}

function apiErrorResponse(
  context: { json: (body: ReturnType<typeof apiError>, status: 400 | 401 | 403 | 404 | 409 | 410 | 503) => Response },
  status: 400 | 401 | 403 | 404 | 409 | 410 | 503,
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
