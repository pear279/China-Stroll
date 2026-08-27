export type Coordinate = [longitude: number, latitude: number]

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
      placeId: SamplePlace["id"]
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
    coordinate: [116.397155, 39.916345],
    image: "/places/palace-museum.png",
  },
  {
    id: "jingshan-park",
    name: "Jingshan Park",
    nameZh: "景山公园",
    shortIntro: "Climb to the Central Axis viewpoint directly north of the Forbidden City.",
    durationMinutes: 90,
    coordinate: [116.396981, 39.925052],
    image: "/places/jingshan-park.png",
  },
  {
    id: "temple-of-heaven",
    name: "Temple of Heaven Park",
    nameZh: "天坛公园",
    shortIntro: "Explore the ceremonial spaces built for imperial rites and prayers for good harvests.",
    durationMinutes: 180,
    coordinate: [116.406609, 39.882201],
    image: "/places/temple-of-heaven.png",
  },
]

export function buildSampleSuggestion(stops: TripStop[]): Omit<AgentSuggestion, "id" | "tripId" | "baseVersion" | "expiresAt"> {
  const plannedOrder = ["forbidden-city", "jingshan-park", "temple-of-heaven"]
  const startTimes = ["09:00", "14:15", "16:15"]
  const changes: AgentChange[] = []

  plannedOrder.forEach((placeId, index) => {
    const stop = stops.find((item) => item.placeId === placeId)
    if (!stop) return
    changes.push({
      op: "update_stop",
      stopId: stop.id,
      startTime: startTimes[index],
      durationMinutes: samplePlaces.find((place) => place.id === placeId)?.durationMinutes ?? 90,
      sortOrder: index,
    })
  })

  return {
    intent: "Make the first day easier to follow",
    reason:
      "Start at the Palace Museum, continue north to Jingshan for the city view, then keep the Temple of Heaven as the final stop. The order reduces backtracking between the two adjacent northern sights.",
    changes,
    risks: [
      "Opening hours and ticket availability still need a same-day check.",
      "Travel time to the Temple of Heaven is not included yet.",
    ],
    status: "proposed",
  }
}
