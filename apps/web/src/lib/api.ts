import type {
  AgentSuggestion,
  AgentChange,
  Locale,
  PlaceDetail,
  PlaceGuideResponse,
  PlaceLibraryItem,
  PlaceListResponse,
  PlaceQuestionRequest,
  PlaceQuestionResponse,
  PlaceRecommendationInput,
  PlaceRecommendationResponse,
  TripSnapshot,
} from "../../../../packages/shared/src"

export function resolveApiBaseUrl(isProduction: boolean, configuredUrl?: string) {
  return isProduction ? "" : configuredUrl ?? "http://localhost:8787"
}

const baseUrl = import.meta.env.DEV
  ? resolveApiBaseUrl(false, import.meta.env.VITE_API_BASE_URL)
  : ""

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string }
  }

  if (!response.ok) {
    throw new ApiRequestError(
      payload.error?.message ?? "The request could not be completed.",
      payload.error?.code ?? "UNKNOWN",
      response.status,
    )
  }
  return payload as T
}

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  headers.set("Authorization", `Bearer ${accessToken}`)
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })
  return readResponse<T>(response)
}

async function optionalAuthRequest<T>(path: string, accessToken: string | null, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  headers.set("Content-Type", "application/json")
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`)
  }
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
  })
  return readResponse<T>(response)
}

async function publicRequest<T>(path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { "Content-Type": "application/json" },
  })
  return readResponse<T>(response)
}

export function buildPlaceListPath(filters: {
  locale?: Locale
  category?: string
  maxDurationMinutes?: number
} = {}) {
  const query = new URLSearchParams()
  if (filters.locale) query.set("locale", filters.locale)
  if (filters.category) query.set("category", filters.category)
  if (filters.maxDurationMinutes) query.set("maxDurationMinutes", String(filters.maxDurationMinutes))
  const search = query.toString()
  return search ? `/v1/places?${search}` : "/v1/places"
}

export const api = {
  listPlaces(filters: { locale?: Locale; category?: string; maxDurationMinutes?: number } = {}) {
    return publicRequest<PlaceListResponse>(buildPlaceListPath(filters))
  },
  getPlace(placeId: string, locale: Locale = "en") {
    return publicRequest<PlaceDetail>(`/v1/places/${encodeURIComponent(placeId)}?locale=${locale}`)
  },
  getPlaceGuide(placeId: string, locale: Locale = "en", audience: "general" | "child" = "general") {
    return publicRequest<PlaceGuideResponse>(
      `/v1/places/${encodeURIComponent(placeId)}/guide?locale=${locale}&audience=${audience}`,
    )
  },
  askPlace(accessToken: string | null, input: PlaceQuestionRequest) {
    return optionalAuthRequest<PlaceQuestionResponse>(
      `/v1/places/${encodeURIComponent(input.placeId)}/questions`,
      accessToken,
      {
      method: "POST",
      body: JSON.stringify({ question: input.question, locale: input.locale }),
    },
    )
  },
  recommendPlaces(accessToken: string | null, input: PlaceRecommendationInput) {
    return optionalAuthRequest<PlaceRecommendationResponse>("/v1/place-recommendations", accessToken, {
      method: "POST",
      body: JSON.stringify(input),
    })
  },
  listSavedPlaces(accessToken: string) {
    return request<{ items: PlaceLibraryItem[] }>("/v1/place-library", accessToken)
  },
  savePlace(accessToken: string, placeId: string) {
    return request<PlaceLibraryItem>("/v1/place-library", accessToken, {
      method: "POST",
      body: JSON.stringify({ placeId, labels: [], note: "" }),
    })
  },
  removeSavedPlace(accessToken: string, placeId: string) {
    return request<void>(`/v1/place-library/${encodeURIComponent(placeId)}`, accessToken, { method: "DELETE" })
  },
  createTrip(accessToken: string, input: { name: string; startDate: string | null }) {
    return request<{ tripId: string; version: number }>("/v1/trips", accessToken, {
      method: "POST",
      body: JSON.stringify({ ...input, locale: "en", commandId: crypto.randomUUID() }),
    })
  },
  getTrip(accessToken: string, tripId: string) {
    return request<TripSnapshot>(`/v1/trips/${tripId}`, accessToken)
  },
  addStop(accessToken: string, trip: TripSnapshot, placeId: string, dayNumber = 1) {
    return request<{ version: number }>(`/v1/trips/${trip.id}/stops`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        placeId,
        dayNumber,
        expectedVersion: trip.version,
        commandId: crypto.randomUUID(),
      }),
    })
  },
  applyTripChanges(accessToken: string, trip: TripSnapshot, changes: AgentChange[]) {
    return request<{ version: number }>(`/v1/trips/${trip.id}/stops`, accessToken, {
      method: "PATCH",
      body: JSON.stringify({ expectedVersion: trip.version, commandId: crypto.randomUUID(), changes }),
    })
  },
  addTripDay(accessToken: string, trip: TripSnapshot, date: string | null = null) {
    return request<{ version: number }>(`/v1/trips/${trip.id}/days`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        date,
        expectedVersion: trip.version,
        commandId: crypto.randomUUID(),
      }),
    })
  },
  createSuggestion(accessToken: string, tripId: string) {
    return request<AgentSuggestion>(`/v1/trips/${tripId}/agent-suggestions`, accessToken, {
      method: "POST",
      body: JSON.stringify({ intent: "Make day one easier to follow" }),
    })
  },
  confirmSuggestion(accessToken: string, trip: TripSnapshot, suggestionId: string) {
    return request<{ version: number }>(
      `/v1/trips/${trip.id}/agent-suggestions/${suggestionId}/confirm`,
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({ expectedVersion: trip.version, commandId: crypto.randomUUID() }),
      },
    )
  },
}
