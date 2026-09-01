import type { PlaceSummary } from "./place-contracts"
import { haversineKilometres } from "./place-discovery"

export * from "./place-contracts"
export * from "./place-discovery"

import { z } from "zod"

export type Coordinate = [longitude: number, latitude: number]

export type Locale = "en" | "zh-CN"

export type UserProfile = {
  userId: string
  displayName: string
  interfaceLocale: Locale
  contentLocale: Locale
  countryCode: string | null
  travelPreferences: Record<string, string | boolean | number>
}
export type UserProfileInput = Omit<UserProfile, "userId">
export type TripMemberRole = "owner" | "editor" | "viewer"
export type TripMemberSummary = { userId: string; displayName: string; role: TripMemberRole; joinedAt: string | null; isCurrentUser: boolean }
export type TripInvitationSummary = { id: string; tripId: string; role: Exclude<TripMemberRole, "owner">; expiresAt: string; useCount: number; maxUses: number; revokedAt: string | null }
export type TripInvitationPreview = { tripId: string; tripName: string; role: Exclude<TripMemberRole, "owner">; expiresAt: string; status: "ready" | "expired" | "revoked" | "consumed" }
export type CreateTripInvitationInput = { role: "editor" | "viewer"; expiresInHours: 1 | 24 | 72 | 168 }

const profilePreferenceValueSchema = z.union([z.string(), z.boolean(), z.number()])
export const localeSchema = z.enum(["en", "zh-CN"])
export const tripMemberRoleSchema = z.enum(["owner", "editor", "viewer"])
export const tripMemberEditableRoleSchema = z.enum(["editor", "viewer"])
export const invitationExpirySchema = z.union([z.literal(1), z.literal(24), z.literal(72), z.literal(168)])
export const travelPreferencesSchema = z.object({
  pace: profilePreferenceValueSchema.optional(), mobility: profilePreferenceValueSchema.optional(),
  interests: profilePreferenceValueSchema.optional(), dietary: profilePreferenceValueSchema.optional(),
}).strict().superRefine((preferences, context) => {
  if (new TextEncoder().encode(JSON.stringify(preferences)).byteLength > 2048) {
    context.addIssue({ code: "custom", message: "travel preferences must be at most 2 KiB when serialized" })
  }
})
const displayNameSchema = z.string().trim().min(1).max(80)
const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/).nullable()
export const userProfileInputSchema = z.object({ displayName: displayNameSchema, interfaceLocale: localeSchema, contentLocale: localeSchema, countryCode: countryCodeSchema, travelPreferences: travelPreferencesSchema })
export const userProfileSchema = userProfileInputSchema.extend({ userId: z.uuid() })
export const tripMemberSummarySchema = z.object({ userId: z.uuid(), displayName: displayNameSchema, role: tripMemberRoleSchema, joinedAt: z.iso.datetime({ offset: true }).nullable(), isCurrentUser: z.boolean() })
export const tripInvitationSummarySchema = z.object({ id: z.uuid(), tripId: z.uuid(), role: tripMemberEditableRoleSchema, expiresAt: z.iso.datetime({ offset: true }), useCount: z.int().nonnegative(), maxUses: z.int().positive(), revokedAt: z.iso.datetime({ offset: true }).nullable() })
export const tripInvitationPreviewSchema = z.object({ tripId: z.uuid(), tripName: z.string().trim().min(1).max(120), role: tripMemberEditableRoleSchema, expiresAt: z.iso.datetime({ offset: true }), status: z.enum(["ready", "expired", "revoked", "consumed"]) })
export const createTripInvitationSchema = z.object({ role: tripMemberEditableRoleSchema, expiresInHours: invitationExpirySchema })
export const invitationTokenSchema = z.string().min(43).max(128).regex(/^[A-Za-z0-9_-]+$/)
export const acceptTripInvitationSchema = z.object({ token: invitationTokenSchema })

export type LocationSharingStatus =
  | "loading"
  | "off"
  | "enabling"
  | "sharing"
  | "expired"
  | "permission-denied"
  | "upload-failed"
  | "revoke-pending"
  | "revoke-failed"
  | "dependency-unavailable"

export type SharedMemberLocation = {
  userId: string
  displayName: string
  initials: string
  coordinate: Coordinate
  updatedAt: string
  expiresAt: string
}

export type LocationSharingSnapshot = {
  tripId: string
  enabled: boolean
  status: LocationSharingStatus
  activeMemberCount: number
  expiresAt: string | null
  visibleLocations: SharedMemberLocation[]
}

export type SamplePlace = {
  id: "forbidden-city" | "temple-of-heaven" | "jingshan-park"
  name: string
  nameZh: string
  shortIntro: string
  durationMinutes: number
  coordinate: Coordinate
  image: string
}

export type TransportMode = "walk" | "transit" | "taxi" | "bike" | "other"

export type TripStop = {
  id: string
  tripId: string
  dayNumber: number | null
  placeId: string | null
  name: string
  coordinate: Coordinate | null
  startTime: string | null
  durationMinutes: number | null
  transportMode: TransportMode | null
  notes: string
  sortOrder: number
}

export type TripDay = {
  id: number
  dayNumber: number
  date: string | null
  title: string | null
  notes: string
}

export type ReservationCategory = "accommodation" | "transport" | "restaurant" | "attraction" | "activity"
export type ReservationStatus = "planned" | "confirmed" | "cancelled" | "completed"

export type TripReservation = {
  id: string
  tripId: string
  dayNumber: number | null
  placeId: string | null
  category: ReservationCategory
  title: string
  startsAt: string | null
  endsAt: string | null
  status: ReservationStatus
  provider: string | null
  confirmationCode: string | null
  notes: string
}

export type ReservationInput = Omit<TripReservation, "id" | "tripId">
export type ReservationDraft = Omit<ReservationInput, "dayNumber" | "placeId">

export type ExchangeQuote = {
  base: string
  quote: string
  rate: number
  provider: string
  retrievedAt: string
}

export type TranslationRequest = {
  text: string
  from: Locale
  to: Locale
}

export type TranslationResult = {
  translatedText: string
  from: Locale
  to: Locale
  provider: string
  generatedAt: string
}

export type Phrase = {
  en: string
  zh: string
  pinyin: string
}

export type AgentChange =
  | {
      op: "add_stop"
      placeId: string
      dayNumber: number
      startTime: string
      sortOrder: number
    }
  | {
      op: "update_stop"
      stopId: string
      startTime: string
      durationMinutes: number
      sortOrder: number
      transportMode?: TransportMode | null
      notes?: string
    }
  | {
      op: "move_stop"
      stopId: string
      dayNumber: number
      sortOrder: number
    }
  | { op: "remove_stop"; stopId: string }

export type AgentSuggestion = {
  id: string
  tripId: string
  baseVersion: number
  intent: string
  reason: string
  changes: AgentChange[]
  risks: string[]
  status: "proposed" | "confirmed" | "rejected" | "expired" | "applied" | "failed"
  expiresAt: string
}

export type TripSnapshot = {
  id: string
  name: string
  startDate: string | null
  endDate: string | null
  locale: "en" | "zh-CN"
  version: number
  days: TripDay[]
  stops: TripStop[]
  reservations?: TripReservation[]
  suggestions: AgentSuggestion[]
}

export const samplePlaces: SamplePlace[] = [
  {
    id: "forbidden-city",
    name: "The Palace Museum",
    nameZh: "故宫博物院",
    shortIntro: "Walk through the heart of the former imperial city and its monumental palace courtyards.",
    durationMinutes: 240,
    coordinate: [116.3907694, 39.9172757],
    image: "/places/forbidden-city.webp",
  },
  {
    id: "jingshan-park",
    name: "Jingshan Park",
    nameZh: "景山公园",
    shortIntro: "Climb to the Central Axis viewpoint directly north of the Forbidden City.",
    durationMinutes: 90,
    coordinate: [116.3903973, 39.9244589],
    image: "/places/jingshan-park.webp",
  },
  {
    id: "temple-of-heaven",
    name: "Temple of Heaven Park",
    nameZh: "天坛公园",
    shortIntro: "Explore the ceremonial spaces built for imperial rites and prayers for good harvests.",
    durationMinutes: 180,
    coordinate: [116.4028716, 39.8799066],
    image: "/places/temple-of-heaven.webp",
  },
]

const DAY_START_MINUTES = 9 * 60
const DEFAULT_DURATION_MINUTES = 90
const TRANSFER_MINUTES = 30
const LUNCH_START_MINUTES = 12 * 60
const LUNCH_MINUTES = 60
const DAY_END_MINUTES = 18 * 60

export function orderStopsByProximity(stops: TripStop[]): TripStop[] {
  const located = stops.filter((stop) => stop.coordinate)
  const unlocated = stops.filter((stop) => !stop.coordinate)
  if (located.length <= 2) return [...located, ...unlocated]

  const northernmost = located.reduce((best, stop) =>
    (stop.coordinate as Coordinate)[1] > (best.coordinate as Coordinate)[1] ? stop : best,
  )
  const ordered: TripStop[] = [northernmost]
  const remaining = located.filter((stop) => stop.id !== northernmost.id)

  while (remaining.length > 0) {
    const current = ordered[ordered.length - 1].coordinate as Coordinate
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    remaining.forEach((stop, index) => {
      const distance = haversineKilometres(current, stop.coordinate as Coordinate)
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
      }
    })
    ordered.push(remaining.splice(nearestIndex, 1)[0])
  }

  return [...ordered, ...unlocated]
}

function formatClock(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60) % 24
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

export function buildDayPlan(stops: TripStop[]): { changes: AgentChange[]; overflow: TripStop[] } {
  const ordered = orderStopsByProximity(stops)
  const changes: AgentChange[] = []
  const overflow: TripStop[] = []
  let cursor = DAY_START_MINUTES
  let lunchTaken = false

  ordered.forEach((stop, index) => {
    const duration = stop.durationMinutes ?? DEFAULT_DURATION_MINUTES
    if (!lunchTaken && cursor < LUNCH_START_MINUTES && cursor + duration > LUNCH_START_MINUTES) {
      cursor = LUNCH_START_MINUTES + LUNCH_MINUTES
      lunchTaken = true
    }
    if (cursor + duration > DAY_END_MINUTES && changes.length > 0) {
      overflow.push(stop)
      return
    }
    changes.push({
      op: "update_stop",
      stopId: stop.id,
      startTime: formatClock(cursor),
      durationMinutes: duration,
      sortOrder: index,
    })
    cursor += duration + TRANSFER_MINUTES
    if (cursor >= LUNCH_START_MINUTES) lunchTaken = true
  })

  return { changes, overflow }
}

export function buildSampleSuggestion(stops: TripStop[]): Omit<AgentSuggestion, "id" | "tripId" | "baseVersion" | "expiresAt"> {
  const firstDay = stops.filter((stop) => stop.dayNumber === null || stop.dayNumber === 1)
  const { changes, overflow } = buildDayPlan(firstDay)
  const ordered = orderStopsByProximity(firstDay)
  const risks = [
    "Opening hours and ticket availability still need a same-day check.",
    "Travel between places is estimated at 30 minutes and is not a routed journey.",
  ]

  if (overflow.length > 0) {
    risks.unshift(
      `The day runs past 18:00, so ${overflow.map((stop) => stop.name).join(" and ")} still needs a slot.`,
    )
  }

  const spread = measureSpreadKilometres(ordered)
  if (spread > 12) {
    risks.push(`These places span about ${Math.round(spread)} km, so plan extra travel time.`)
  }

  return {
    intent: "Make the first day easier to follow",
    reason:
      ordered.length > 1
        ? `Visit ${ordered.map((stop) => stop.name).join(", then ")}. The order follows the shortest hop between neighbouring places and keeps a break around midday.`
        : "One place is planned, so the day only needs a comfortable start time.",
    changes,
    risks,
    status: "proposed",
  }
}

export function measureSpreadKilometres(stops: TripStop[]): number {
  const located = stops.filter((stop) => stop.coordinate)
  let widest = 0
  for (let index = 1; index < located.length; index += 1) {
    widest = Math.max(
      widest,
      haversineKilometres(
        located[index - 1].coordinate as Coordinate,
        located[index].coordinate as Coordinate,
      ),
    )
  }
  return widest
}

export function resolvePlaceImage(placeId: string): string {
  return `/places/${placeId}.webp`
}

export function placeInitials(name: string): string {
  const words = name
    .replace(/^(the|a|an)\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return `${words[0][0]}${words[1][0]}`.toUpperCase()
}

export function formatDurationHours(durationMinutes: number): string {
  if (durationMinutes < 60) return `${durationMinutes} min`
  const hours = Math.round((durationMinutes / 60) * 2) / 2
  return hours === 1 ? "1 hr" : `${hours} hr`
}

export function collectPlaceCategories(places: PlaceSummary[]): string[] {
  return [...new Set(places.map((place) => place.categoryCode))].sort()
}

export function formatCategoryLabel(categoryCode: string): string {
  return categoryCode
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ")
}

export const durationFilters = [
  { label: "Any length", maxDurationMinutes: undefined },
  { label: "Up to 1 hr", maxDurationMinutes: 60 },
  { label: "Up to 2 hr", maxDurationMinutes: 120 },
  { label: "Up to 3 hr", maxDurationMinutes: 180 },
] as const
