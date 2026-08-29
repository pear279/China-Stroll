export type Coordinate = [longitude: number, latitude: number]

export type Locale = "en" | "zh-CN"

export type PlaceSummary = {
  id: string
  locale: Locale
  name: string
  shortIntro: string
  categoryCode: string
  tags: string[]
  coordinate: Coordinate
  durationMinutes: number
  coordinatesCheckedAt: string | null
}

export type OpeningHoursWindow = {
  days: number[]
  opens: string
  closes: string
  lastEntry?: string
}

export type OpeningHours = {
  timeZone: string
  weekly: OpeningHoursWindow[]
  exceptions: { date: string; closed?: boolean; opens?: string; closes?: string }[]
}

export type PlaceVisitInformation = {
  address: string
  openingHoursText: string
  openingHours: OpeningHours | null
  ticketNotes: string
  bookingRequired: boolean | null
  bookingUrl: string | null
  reservationNotes: string
  entranceNotes: string
  checkedAt: string | null
  reviewDueAt: string | null
  needsRecheck: boolean
}

export type PlaceDetail = {
  id: string
  locale: Locale
  name: string
  aliases: string[]
  tags: string[]
  shortIntro: string
  history: string
  highlights: string[]
  visitorTips: string
  practicalNotes: string
  photoSpotNotes: string
  categoryCode: string
  coordinate: Coordinate | null
  durationMinutes: number
  coordinatesCheckedAt: string | null
  reviewedAt: string | null
  visitInformation: PlaceVisitInformation | null
}

export type PlaceListResponse = {
  locale: Locale
  places: PlaceSummary[]
}

export type GuideSegment = {
  id: number
  type: "overview" | "history" | "highlight" | "family" | "practical" | "faq"
  audience: "general" | "child"
  title: string | null
  content: string
  sequence: number
  updatedAt: string
}

export type GuideSource = {
  id: number
  name: string
  url: string | null
  checkedAt: string | null
  reviewDueAt: string | null
  needsRecheck: boolean
}

export type PlaceGuideResponse = {
  placeId: string
  locale: Locale
  audience: "general" | "child"
  segments: GuideSegment[]
  sources: GuideSource[]
}

export type PlaceQuestionResponse = {
  answer: string
  sourceIds: number[]
  generatedBy: "model" | "guide-fallback"
  updatedAt: string | null
}

export type PlaceLibraryItem = {
  id: string
  placeId: string
  collectionName: string | null
  labels: string[]
  note: string
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

export type TripStop = {
  id: string
  tripId: string
  dayNumber: number | null
  placeId: string | null
  name: string
  coordinate: Coordinate | null
  startTime: string | null
  durationMinutes: number | null
  sortOrder: number
}

export type TripDay = {
  id: number
  dayNumber: number
  date: string | null
  title: string | null
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
    image: "/places/palace-museum.png",
  },
  {
    id: "jingshan-park",
    name: "Jingshan Park",
    nameZh: "景山公园",
    shortIntro: "Climb to the Central Axis viewpoint directly north of the Forbidden City.",
    durationMinutes: 90,
    coordinate: [116.3903973, 39.9244589],
    image: "/places/jingshan-park.png",
  },
  {
    id: "temple-of-heaven",
    name: "Temple of Heaven Park",
    nameZh: "天坛公园",
    shortIntro: "Explore the ceremonial spaces built for imperial rites and prayers for good harvests.",
    durationMinutes: 180,
    coordinate: [116.4028716, 39.8799066],
    image: "/places/temple-of-heaven.png",
  },
]

const DAY_START_MINUTES = 9 * 60
const DEFAULT_DURATION_MINUTES = 90
const TRANSFER_MINUTES = 30
const LUNCH_START_MINUTES = 12 * 60
const LUNCH_MINUTES = 60
const DAY_END_MINUTES = 18 * 60

export function haversineKilometres(from: Coordinate, to: Coordinate): number {
  const radius = 6371
  const toRadians = (value: number) => (value * Math.PI) / 180
  const deltaLatitude = toRadians(to[1] - from[1])
  const deltaLongitude = toRadians(to[0] - from[0])
  const a =
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(from[1])) * Math.cos(toRadians(to[1])) * Math.sin(deltaLongitude / 2) ** 2
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)))
}

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
  return `/places/${placeId === "forbidden-city" ? "palace-museum" : placeId}.jpg`
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
