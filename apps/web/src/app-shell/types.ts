import type { AgentSuggestion, PlaceSummary, TripSnapshot } from "../../../../packages/shared/src"

export type AppMode = "preview" | "account"
export type PlacesState = "idle" | "loading" | "ready" | "failed"
export type LocationStatus = "idle" | "loading" | "ready" | "failed"
export type NearbyRadius = 1 | 3 | 5
export type ModulePath = "/attractions" | "/map" | "/tools" | "/me"

export type AppShellProps = {
  accessToken: string | null
  busy: string | null
  message: string | null
  mode: AppMode
  places: PlaceSummary[]
  placesState: PlacesState
  savedPlaceIds: Set<string>
  trip: TripSnapshot
  testIdentity: string | null
  onAddPlace: (placeId: string, dayNumber?: number) => Promise<void>
  onAddDay: () => Promise<void>
  onToggleSaved: (placeId: string) => Promise<void>
  onConfirm: (suggestion: AgentSuggestion) => Promise<void>
  onSuggest: () => Promise<void>
  onExit: () => Promise<void>
}
