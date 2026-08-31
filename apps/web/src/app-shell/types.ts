import type { AgentSuggestion, LocationSharingSnapshot, LocationSharingStatus, PlaceSummary, ReservationInput, TripSnapshot } from "../../../../packages/shared/src"
import type { PlaceRepository } from "../data/placeRepository"

export type AppMode = "preview" | "account"
export type PlacesState = "idle" | "loading" | "ready" | "failed"
export type LocationStatus = "idle" | "loading" | "ready" | "failed"
export type NearbyRadius = 1 | 3 | 5
export type ModulePath = "/attractions" | "/map" | "/tools" | "/me"

export type LocationSharingControls = {
  status: LocationSharingStatus
  snapshot: LocationSharingSnapshot | null
  onEnable: () => Promise<void>
  onDisable: () => Promise<void>
  onRetryDisable: () => Promise<void>
}

export type AppShellProps = {
  busy: string | null
  message: string | null
  mode: AppMode
  locationSharing: LocationSharingControls
  placeRepository: PlaceRepository
  places: PlaceSummary[]
  placesState: PlacesState
  savedPlaceIds: Set<string>
  trip: TripSnapshot
  testIdentity: string | null
  onAddPlace: (placeId: string, dayNumber?: number) => Promise<void>
  onAddDay: () => Promise<number | null>
  onRemoveStop: (stopId: string) => Promise<void>
  onReorderStop: (stopId: string, targetIndex: number) => Promise<void>
  onCreateReservation: (input: ReservationInput) => Promise<void>
  onUpdateReservation: (reservationId: string, input: ReservationInput) => Promise<void>
  onRemoveReservation: (reservationId: string) => Promise<void>
  onToggleSaved: (placeId: string) => Promise<void>
  onConfirm: (suggestion: AgentSuggestion) => Promise<void>
  onSuggest: () => Promise<void>
  onExit: () => Promise<void>
}
