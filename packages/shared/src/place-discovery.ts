import type {
  PlaceCatalogEntry,
  PlaceQuestionResponse,
  PlaceRecommendation,
  PlaceRecommendationInput,
  PlaceSourceCitation,
  PlaceSummary,
} from "./place-contracts"

export type PlaceDiscoveryFilters = {
  query: string
  category: string
  maxDurationMinutes?: number
  coordinate?: [longitude: number, latitude: number] | null
  radiusKm?: number | null
}

const SUPPORTED_PREFERENCES = [
  "family",
  "history",
  "relaxed",
  "photography",
  "half-day",
] as const satisfies PlaceRecommendationInput["preferences"]

type SupportedPreference = (typeof SUPPORTED_PREFERENCES)[number]

const preferenceTerms: Record<SupportedPreference, string[]> = {
  family: [
    "family",
    "families",
    "kid",
    "kids",
    "child",
    "children",
    "stroller",
    "亲子",
    "家庭",
    "孩子",
    "儿童",
    "小朋友",
  ],
  history: [
    "history",
    "historic",
    "heritage",
    "museum",
    "museums",
    "ancient",
    "dynasty",
    "imperial",
    "culture",
    "历史",
    "古迹",
    "古建筑",
    "文化",
    "博物馆",
    "文物",
    "皇宫",
    "王府",
  ],
  relaxed: [
    "relaxed",
    "calm",
    "easy",
    "gentle",
    "leisurely",
    "park",
    "garden",
    "stroll",
    "轻松",
    "悠闲",
    "休闲",
    "散步",
    "公园",
    "园林",
  ],
  photography: [
    "photo",
    "photos",
    "photography",
    "photogenic",
    "viewpoint",
    "拍照",
    "摄影",
    "机位",
    "出片",
    "景观",
    "夜景",
  ],
  "half-day": [
    "half day",
    "half-day",
    "short",
    "quick",
    "morning",
    "afternoon",
    "半天",
    "半日",
    "短途",
    "几个小时",
    "上午",
    "下午",
  ],
}

const preferenceCategories: Record<SupportedPreference, string[]> = {
  family: ["park", "museum"],
  history: ["museum", "historic_building", "religious_site", "civic_landmark_square"],
  relaxed: ["park", "neighborhood", "commercial_district"],
  photography: ["park", "historic_building", "civic_landmark_square", "neighborhood"],
  "half-day": [],
}

const questionIntentAliases = {
  opening: ["opening", "open", "hours", "opening hours", "开放", "营业", "时间", "几点"],
  ticket: ["ticket", "tickets", "price", "cost", "fee", "门票", "票价", "费用", "多少钱"],
  booking: ["booking", "book", "reserve", "reservation", "预约", "预订", "订票", "recheck"],
  entrance: ["entrance", "entry", "gate", "access", "入口", "入场", "从哪进", "门口"],
  history: ["history", "historic", "dynasty", "past", "历史", "由来", "典故", "朝代"],
  photo: ["photo", "photos", "photography", "拍照", "摄影", "机位", "出片"],
  family: ["family", "kid", "kids", "child", "children", "亲子", "孩子", "儿童", "家庭"],
  duration: ["duration", "how long", "visit length", "多久", "多长时间", "逛多久", "半天"],
} as const

const genericEnglishPhraseStopwords = new Set([
  "a",
  "an",
  "and",
  "are",
  "at",
  "by",
  "for",
  "from",
  "how",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "what",
  "when",
  "where",
  "which",
  "who",
  "why",
])

function normalize(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase()
}

function normalizeForTokenization(value: string) {
  return normalize(value).replace(/[^\p{Script=Han}\p{Letter}\p{Number}\s-]+/gu, " ")
}

function extractSearchableText(place: PlaceSummary) {
  return normalize([
    place.name,
    ...(place.aliases ?? []),
    ...place.tags,
    place.shortIntro,
    ...(place.highlights ?? []),
  ].join(" "))
}

function tokenize(value: string) {
  return normalizeForTokenization(value).match(/[\p{Script=Han}]+|[\p{Letter}\p{Number}]{2,}/gu) ?? []
}

function isChineseToken(token: string) {
  return /^[\p{Script=Han}]+$/u.test(token)
}

function isMeaningfulEnglishPhrase(tokens: string[]) {
  if (tokens.length === 0) {
    return false
  }

  const nonStopwordCount = tokens.filter((token) => !genericEnglishPhraseStopwords.has(token)).length
  return nonStopwordCount >= 2
}

function detectIntentMatches(question: string, document: string) {
  const normalizedQuestion = normalizeForTokenization(question)
  const normalizedDocument = normalizeForTokenization(document)

  return Object.values(questionIntentAliases).reduce((count, aliases) => {
    const questionMatches = aliases.some((alias) => normalizedQuestion.includes(normalize(alias)))
    const documentMatches = aliases.some((alias) => normalizedDocument.includes(normalize(alias)))
    return questionMatches && documentMatches ? count + 1 : count
  }, 0)
}

function extractQuestionPhrases(question: string) {
  const normalizedQuestion = normalizeForTokenization(question)
  const fullQuestion = normalizedQuestion.replace(/\s+/g, " ").trim()
  const tokens = tokenize(question)
  const phrases = new Set<string>()

  if (fullQuestion.length > 0) {
    phrases.add(fullQuestion)
  }

  for (let index = 0; index < tokens.length - 1; index += 1) {
    const left = tokens[index]
    const right = tokens[index + 1]
    if (isChineseToken(left) || isChineseToken(right)) {
      continue
    }
    if (isMeaningfulEnglishPhrase([left, right])) {
      phrases.add(`${left} ${right}`)
    }
  }

  tokens.forEach((token) => {
    if (isChineseToken(token) && token.length >= 2) {
      phrases.add(token)
    }
  })

  return [...phrases]
}

function scoreDocument(question: string, document: { content: string }) {
  const normalizedDocument = normalizeForTokenization(document.content)
  const phraseScore = extractQuestionPhrases(question).some((phrase) =>
    phrase.length > 0 && normalizedDocument.includes(phrase)
  )
    ? 4
    : 0

  const intentScore = detectIntentMatches(question, document.content) * 3

  const questionTokens = new Set(tokenize(question))
  const documentTokens = new Set(tokenize(document.content))
  let overlapScore = 0
  questionTokens.forEach((token) => {
    if (documentTokens.has(token)) {
      overlapScore += 1
    }
  })

  return phraseScore + intentScore + overlapScore
}

function findSourcesById(sources: PlaceSourceCitation[], sourceIds: string[]) {
  const sourceIdsSet = new Set(sourceIds)
  return sources.filter((source) => sourceIdsSet.has(source.id))
}

function uniquePreferences(preferences: PlaceRecommendationInput["preferences"]) {
  return SUPPORTED_PREFERENCES.filter((preference) => preferences.includes(preference))
}

function uniquePlaceIds(placeIds: string[]) {
  const seen = new Set<string>()
  return placeIds.filter((placeId) => {
    if (seen.has(placeId)) {
      return false
    }
    seen.add(placeId)
    return true
  })
}

function matchesKeyword(place: PlaceSummary, preference: SupportedPreference) {
  const searchable = extractSearchableText(place)
  return preferenceTerms[preference].some((term) => searchable.includes(normalize(term)))
}

function matchesCategory(place: PlaceSummary, preference: SupportedPreference) {
  return preferenceCategories[preference].includes(place.categoryCode)
}

function formatReason(
  locale: PlaceRecommendationInput["locale"],
  signals: string[],
  place: PlaceSummary,
  planned: boolean,
) {
  const leadSignals = signals.filter((signal) =>
    SUPPORTED_PREFERENCES.includes(signal as SupportedPreference),
  )

  if (locale === "zh-CN") {
    const parts = [
      leadSignals.length > 0 ? `匹配偏好：${leadSignals.join("、")}` : `适合加入 ${place.name}`,
      `预计游览约 ${place.durationMinutes} 分钟`,
      planned ? "已在当前行程中" : "当前尚未加入行程",
    ]
    return parts.join("，")
  }

  const parts = [
    leadSignals.length > 0 ? `Matches ${leadSignals.join(", ")}` : `Fits ${place.name}`,
    `about ${place.durationMinutes} minutes`,
    planned ? "already planned" : "not yet planned",
  ]
  return parts.join("; ")
}

export function haversineKilometres(
  from: [longitude: number, latitude: number],
  to: [longitude: number, latitude: number],
): number {
  const radius = 6371
  const toRadians = (value: number) => (value * Math.PI) / 180
  const deltaLatitude = toRadians(to[1] - from[1])
  const deltaLongitude = toRadians(to[0] - from[0])
  const a =
    Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(toRadians(from[1])) * Math.cos(toRadians(to[1])) * Math.sin(deltaLongitude / 2) ** 2
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(a)))
}

export function filterPlaceSummaries(places: PlaceSummary[], filters: PlaceDiscoveryFilters) {
  const query = normalize(filters.query)

  return places.filter((place) => {
    const searchable = extractSearchableText(place)
    const withinRadius = !filters.coordinate || filters.radiusKm === null || filters.radiusKm === undefined
      ? true
      : haversineKilometres(filters.coordinate, place.coordinate) <= filters.radiusKm

    return (!query || searchable.includes(query))
      && (filters.category === "all" || place.categoryCode === filters.category)
      && (filters.maxDurationMinutes === undefined || place.durationMinutes <= filters.maxDurationMinutes)
      && withinRadius
  })
}

export function findReviewedAnswer(
  entry: PlaceCatalogEntry,
  question: string,
): PlaceQuestionResponse | null {
  const ranked = entry.searchDocuments
    .map((document) => ({ document, score: scoreDocument(question, document) }))
    .sort((left, right) => right.score - left.score || left.document.id.localeCompare(right.document.id))

  const match = ranked[0]
  if (!match || match.score < 3) {
    return null
  }

  const sources = findSourcesById(entry.guides.sources, match.document.sourceIds)
  if (sources.length === 0) {
    return null
  }

  return {
    answer: match.document.content,
    answerMode: "reviewed-local",
    generatedBy: "deterministic-retrieval",
    sources,
    updatedAt: match.document.updatedAt,
    searchedAt: null,
    dependencyStatus: "ready",
  }
}

export function inferPreferences(context: string): PlaceRecommendationInput["preferences"] {
  const normalizedContext = normalizeForTokenization(context)

  return SUPPORTED_PREFERENCES.filter((preference) =>
    preferenceTerms[preference].some((term) => normalizedContext.includes(normalize(term)))
  )
}

export function rankPlaceRecommendations(
  places: PlaceSummary[],
  input: PlaceRecommendationInput,
): PlaceRecommendation[] {
  const placeById = new Map(places.map((place) => [place.id, place]))
  const plannedIds = new Set(input.plannedPlaceIds)
  const activePreferences = uniquePreferences([
    ...input.preferences,
    ...inferPreferences(input.context),
  ])
  const activeRadiusKm = input.coordinate ? input.radiusKm : null

  const candidates = uniquePlaceIds(input.candidatePlaceIds).flatMap((placeId) => {
    const place = placeById.get(placeId)
    if (!place) {
      return []
    }
    if (input.availableMinutes !== null && place.durationMinutes > input.availableMinutes) {
      return []
    }

    const distance = input.coordinate && activeRadiusKm !== null
      ? haversineKilometres(input.coordinate, place.coordinate)
      : null
    if (distance !== null && activeRadiusKm !== null && distance > activeRadiusKm) {
      return []
    }

    const matchedSignals: string[] = []
    let score = 0

    for (const preference of activePreferences) {
      if (matchesKeyword(place, preference)) {
        score += 5
        if (!matchedSignals.includes(preference)) {
          matchedSignals.push(preference)
        }
      }

      if (matchesCategory(place, preference)) {
        score += 4
        if (!matchedSignals.includes(preference)) {
          matchedSignals.push(preference)
        }
      }
    }

    if (
      (input.availableMinutes !== null && place.durationMinutes <= input.availableMinutes)
      || (activePreferences.includes("half-day") && place.durationMinutes <= 240)
    ) {
      score += 3
      if (activePreferences.includes("half-day") && !matchedSignals.includes("half-day")) {
        matchedSignals.push("half-day")
      }
      if (!matchedSignals.includes("duration-fit")) {
        matchedSignals.push("duration-fit")
      }
    }

    if (distance !== null) {
      score += 3
      if (!matchedSignals.includes("nearby")) {
        matchedSignals.push("nearby")
      }
    }

    const planned = plannedIds.has(place.id)
    score += planned ? -4 : 1
    if (!planned) {
      matchedSignals.push("unplanned")
    }

    return [{
      placeId: place.id,
      score,
      matchedSignals,
      reason: formatReason(input.locale, matchedSignals, place, planned),
      reasonMode: "deterministic" as const,
    }]
  })

  return candidates
    .sort((left, right) => right.score - left.score || left.placeId.localeCompare(right.placeId))
    .slice(0, 5)
}
