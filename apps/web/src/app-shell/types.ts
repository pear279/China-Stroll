import type { AgentSuggestion, CreateTripInvitationInput, LocationSharingSnapshot, LocationSharingStatus, PlaceSummary, PrivatePlace, PrivatePlaceInput, ReservationDraft, ReservationInput, TransportMode, TripInvitationSummary, TripMemberSummary, TripSnapshot, UserProfile, UserProfileInput } from "../../../../packages/shared/src"
import type { PlaceRepository } from "../data/placeRepository"

export type AppMode = "preview" | "account"
export type PlacesState = "idle" | "loading" | "ready" | "failed"
export type LocationStatus = "idle" | "loading" | "ready" | "failed"
export type AccountStateStatus = "idle" | "loading" | "ready" | "failed"
export type NearbyRadius = 1 | 3 | 5 | 10 | 20
export type ModulePath = "/attractions" | "/map" | "/tools" | "/me"

export type LocationSharingControls = {
  status: LocationSharingStatus
  snapshot: LocationSharingSnapshot | null
  onEnable: () => Promise<void>
  onDisable: () => Promise<void>
  onRetryDisable: () => Promise<void>
  onRefresh: () => Promise<void>
}

export type ProfileControls = {
  profile: UserProfile | null
  status: AccountStateStatus
  onSave: (input: UserProfileInput) => Promise<void>
}

export type MembershipControls = {
  isOwner: boolean
  members: TripMemberSummary[]
  invitations: TripInvitationSummary[]
  status: AccountStateStatus
  onCreateInvitation: (input: CreateTripInvitationInput) => Promise<string | null>
  onRevokeInvitation: (invitationId: string) => Promise<void>
  onRemoveMember: (memberUserId: string) => Promise<void>
}

export type StopEditFields = {
  startTime?: string | null
  durationMinutes?: number | null
  transportMode?: TransportMode | null
  notes?: string
}

export type DayEditFields = {
  date?: string | null
  title?: string | null
  notes?: string
}

export type ItineraryEditControls = {
  onEditStop: (stopId: string, fields: StopEditFields) => Promise<void>
  onMoveStopToDay: (stopId: string, dayNumber: number) => Promise<void>
  onEditDay: (dayNumber: number, fields: DayEditFields) => Promise<void>
  onDraftReservation: (sourceText: string) => Promise<ReservationDraft | null>
}

export type PrivatePlacesControls = {
  places: PrivatePlace[]
  onCreate: (input: PrivatePlaceInput) => Promise<void>
  onAddToDay: (privatePlaceId: string, dayNumber: number) => Promise<void>
}

export type AppShellProps = {
  accessToken: string | null
  busy: string | null
  message: string | null
  mode: AppMode
  itineraryEditing: ItineraryEditControls
  locationSharing: LocationSharingControls
  membership: MembershipControls
  privatePlaces: PrivatePlacesControls
  profile: ProfileControls
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
