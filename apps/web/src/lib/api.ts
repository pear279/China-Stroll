import type { AgentSuggestion, TripSnapshot } from "../../../../packages/shared/src"

const baseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8787"

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
  }
}

async function request<T>(path: string, accessToken: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
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

export const api = {
  createTrip(accessToken: string, input: { name: string; startDate: string | null }) {
    return request<{ tripId: string; version: number }>("/v1/trips", accessToken, {
      method: "POST",
      body: JSON.stringify({ ...input, locale: "en", commandId: crypto.randomUUID() }),
    })
  },
  getTrip(accessToken: string, tripId: string) {
    return request<TripSnapshot>(`/v1/trips/${tripId}`, accessToken)
  },
  addStop(accessToken: string, trip: TripSnapshot, placeId: string) {
    return request<{ version: number }>(`/v1/trips/${trip.id}/stops`, accessToken, {
      method: "POST",
      body: JSON.stringify({
        placeId,
        dayNumber: 1,
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
