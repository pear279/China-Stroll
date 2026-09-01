import type { Session } from "@supabase/supabase-js"
import { ArrowRight, CalendarDays, LoaderCircle, Sparkles, Users } from "lucide-react"
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { type AgentSuggestion, type CreateTripInvitationInput, type PlaceSummary, type ReservationDraft, type ReservationInput, type TripInvitationSummary, type TripMemberSummary, type TripSnapshot, type UserProfile, type UserProfileInput } from "../../../packages/shared/src"
import { AppShell } from "./app-shell/AppShell"
import type { AccountStateStatus, DayEditFields, StopEditFields } from "./app-shell/types"
import { createPlaceRepository } from "./data/placeRepository"
import { useLocationSharing } from "./features/location/useLocationSharing"
import { JoinTripView } from "./features/members/JoinTripView"
import { api, ApiRequestError } from "./lib/api"
import { isTestLoginEnabled, maskEmail, startEmailLogin, TEST_EMAIL_LABEL_KEY } from "./lib/auth"
import { addDemoDay, addDemoStop, applyDemoSuggestion, createDemoReservation, createDemoSuggestion, createDemoTrip, editDemoDay, editDemoStop, moveDemoStopToDay, refreshSampleCoordinates, removeDemoReservation, removeDemoStop, reorderDemoStops, updateDemoReservation } from "./lib/demo"
import { hasSupabaseConfig, supabase } from "./lib/supabase"

type Mode = "loading" | "signed-out" | "preview" | "account"

export function App() {
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>("loading")
  const [session, setSession] = useState<Session | null>(null)
  const [trip, setTrip] = useState<TripSnapshot | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [places, setPlaces] = useState<PlaceSummary[]>([])
  const [savedPlaceIds, setSavedPlaceIds] = useState<Set<string>>(() => new Set())
  const [placesState, setPlacesState] = useState<"idle" | "loading" | "ready" | "failed">("idle")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileStatus, setProfileStatus] = useState<AccountStateStatus>("idle")
  const [members, setMembers] = useState<TripMemberSummary[]>([])
  const [invitations, setInvitations] = useState<TripInvitationSummary[]>([])
  const [membershipStatus, setMembershipStatus] = useState<AccountStateStatus>("idle")
  const placeRepository = useMemo(
    () => (mode === "preview"
      ? createPlaceRepository("static")
      : createPlaceRepository("api", session?.access_token ?? null)),
    [mode, session?.access_token],
  )
  const locationSharing = useLocationSharing({
    accessToken: session?.access_token ?? null,
    tripId: trip?.id ?? null,
    enabled: mode === "account" && Boolean(session && trip),
  })

  const loadTrip = useCallback(async (accessToken: string, tripId: string) => {
    const nextTrip = await api.getTrip(accessToken, tripId)
    setTrip(nextTrip)
    return nextTrip
  }, [])

  useEffect(() => {
    const savedPreview = localStorage.getItem("china-stroll-preview-trip")
    if (savedPreview) {
      try {
        setTrip(refreshSampleCoordinates(JSON.parse(savedPreview) as TripSnapshot))
        setMode("preview")
        return
      } catch {
        localStorage.removeItem("china-stroll-preview-trip")
      }
    }
    if (!supabase) {
      setMode("signed-out")
      return
    }
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setMode(data.session ? "account" : "signed-out")
      const tripId = localStorage.getItem("china-stroll-trip-id")
      if (data.session && tripId) {
        void loadTrip(data.session.access_token, tripId).catch(() => localStorage.removeItem("china-stroll-trip-id"))
      }
    })
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setMode(nextSession ? "account" : "signed-out")
    })
    return () => data.subscription.unsubscribe()
  }, [loadTrip])

  useEffect(() => {
    if (mode === "preview" && trip) {
      localStorage.setItem("china-stroll-preview-trip", JSON.stringify(trip))
    }
  }, [mode, trip])

  useEffect(() => {
    if (mode !== "preview" && mode !== "account") return
    let active = true
    setPlacesState("loading")
    void placeRepository
      .listPlaces({ locale: "en" })
      .then((response) => {
        if (!active) return
        setPlaces(response.places)
        setPlacesState("ready")
      })
      .catch(() => {
        if (!active) return
        setPlaces([])
        setPlacesState("failed")
      })
    return () => {
      active = false
    }
  }, [mode, placeRepository])

  useEffect(() => {
    if (mode === "preview") {
      const saved = JSON.parse(localStorage.getItem("china-stroll-preview-saved-places") ?? "[]") as string[]
      setSavedPlaceIds(new Set(saved))
      return
    }
    if (mode !== "account" || !session) return
    let active = true
    void api.listSavedPlaces(session.access_token).then(({ items }) => {
      if (active) setSavedPlaceIds(new Set(items.map((item) => item.placeId)))
    }).catch(() => {
      if (active) setSavedPlaceIds(new Set())
    })
    return () => { active = false }
  }, [mode, session])

  useEffect(() => {
    if (mode !== "account" || !session) return
    let active = true
    setProfileStatus("loading")
    void api.getProfile(session.access_token)
      .then((nextProfile) => {
        if (active) {
          setProfile(nextProfile)
          setProfileStatus("ready")
        }
      })
      .catch(() => {
        if (active) setProfileStatus("failed")
      })
    return () => { active = false }
  }, [mode, session])

  useEffect(() => {
    if (mode !== "account" || !session || !trip) return
    let active = true
    setMembershipStatus("loading")
    void api.getTripMembers(session.access_token, trip.id)
      .then(async ({ members: nextMembers }) => {
        if (!active) return
        setMembers(nextMembers)
        const isOwner = nextMembers.some((member) => member.isCurrentUser && member.role === "owner")
        if (isOwner) {
          try {
            const { invitations: nextInvitations } = await api.getTripInvitations(session.access_token, trip.id)
            if (active) setInvitations(nextInvitations)
          } catch {
            if (active) setInvitations([])
          }
        } else {
          setInvitations([])
        }
        if (active) setMembershipStatus("ready")
      })
      .catch(() => {
        if (active) setMembershipStatus("failed")
      })
    return () => { active = false }
  }, [mode, session, trip?.id])

  async function run<T>(label: string, task: () => Promise<T>): Promise<T | undefined> {
    setBusy(label)
    setMessage(null)
    try {
      return await task()
    } catch (error) {
      setMessage(
        error instanceof ApiRequestError || error instanceof Error
          ? error.message
          : "Something went wrong. Your current plan was kept.",
      )
    } finally {
      setBusy(null)
    }
  }

  async function createTrip(name: string, startDate: string | null) {
    if (mode === "preview") {
      setTrip(createDemoTrip(name, startDate))
      return
    }
    if (!session) return
    await run("create-trip", async () => {
      const created = await api.createTrip(session.access_token, { name, startDate })
      localStorage.setItem("china-stroll-trip-id", created.tripId)
      await loadTrip(session.access_token, created.tripId)
    })
  }

  async function addPlace(placeId: string, dayNumber = 1) {
    if (!trip) return
    if (mode === "preview") {
      const place = places.find((item) => item.id === placeId)
      if (place) setTrip(addDemoStop(trip, place, dayNumber))
      return
    }
    if (!session) return
    await run(`add-${placeId}`, async () => {
      await api.addStop(session.access_token, trip, placeId, dayNumber)
      await loadTrip(session.access_token, trip.id)
    })
  }

  async function addDay(): Promise<number | null> {
    if (!trip) return null
    if (mode === "preview") {
      const nextTrip = addDemoDay(trip)
      setTrip(nextTrip)
      setMessage(`Day ${nextTrip.days.length} added. You can now build its itinerary.`)
      return nextTrip.days.length
    }
    if (!session) return null
    const nextTrip = await run("add-day", async () => {
      await api.addTripDay(session.access_token, trip)
      return loadTrip(session.access_token, trip.id)
    })
    if (!nextTrip) return null
    setMessage(`Day ${nextTrip.days.length} added. You can now build its itinerary.`)
    return nextTrip.days.length
  }

  async function removeStop(stopId: string) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(removeDemoStop(trip, stopId))
      setMessage("Stop removed from this itinerary.")
      return
    }
    if (!session) return
    await run("remove-stop", async () => {
      await api.applyTripChanges(session.access_token, trip, [{ op: "remove_stop", stopId }])
      await loadTrip(session.access_token, trip.id)
      setMessage("Stop removed from this itinerary.")
    })
  }

  async function reorderStop(stopId: string, targetIndex: number) {
    if (!trip) return
    const stop = trip.stops.find((item) => item.id === stopId)
    const dayNumber = stop?.dayNumber ?? 1
    const dayStops = [...trip.stops]
      .filter((item) => (item.dayNumber ?? 1) === dayNumber)
      .sort((left, right) => left.sortOrder - right.sortOrder)
    const currentIndex = dayStops.findIndex((item) => item.id === stopId)
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= dayStops.length || currentIndex === targetIndex) return

    if (mode === "preview") {
      setTrip(reorderDemoStops(trip, stopId, targetIndex))
      setMessage("Itinerary order updated.")
      return
    }
    if (!session) return
    const ordered = [...dayStops]
    const [moved] = ordered.splice(currentIndex, 1)
    ordered.splice(targetIndex, 0, moved)
    await run("reorder-stop", async () => {
      await api.applyTripChanges(session.access_token, trip, ordered.map((item, index) => ({
        op: "move_stop",
        stopId: item.id,
        dayNumber,
        sortOrder: index,
      })))
      await loadTrip(session.access_token, trip.id)
      setMessage("Itinerary order updated.")
    })
  }

  async function createReservation(input: ReservationInput) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(createDemoReservation(trip, input))
      setMessage("Reservation saved in this preview.")
      return
    }
    if (!session) return
    await run("create-reservation", async () => {
      await api.createReservation(session.access_token, trip, input)
      await loadTrip(session.access_token, trip.id)
      setMessage("Reservation saved for your travel group.")
    })
  }

  async function updateReservation(reservationId: string, input: ReservationInput) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(updateDemoReservation(trip, reservationId, input))
      setMessage("Reservation updated in this preview.")
      return
    }
    if (!session) return
    await run("update-reservation", async () => {
      await api.updateReservation(session.access_token, trip, reservationId, input)
      await loadTrip(session.access_token, trip.id)
      setMessage("Reservation updated for your travel group.")
    })
  }

  async function removeReservation(reservationId: string) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(removeDemoReservation(trip, reservationId))
      setMessage("Reservation removed from this preview.")
      return
    }
    if (!session) return
    await run("remove-reservation", async () => {
      await api.removeReservation(session.access_token, trip, reservationId)
      await loadTrip(session.access_token, trip.id)
      setMessage("Reservation removed from your travel group.")
    })
  }

  async function toggleSavedPlace(placeId: string) {
    const saved = savedPlaceIds.has(placeId)
    if (mode === "preview") {
      const next = new Set(savedPlaceIds)
      if (saved) next.delete(placeId)
      else next.add(placeId)
      setSavedPlaceIds(next)
      localStorage.setItem("china-stroll-preview-saved-places", JSON.stringify([...next]))
      return
    }
    if (!session) return
    if (saved) await api.removeSavedPlace(session.access_token, placeId)
    else await api.savePlace(session.access_token, placeId)
    setSavedPlaceIds((current) => {
      const next = new Set(current)
      if (saved) next.delete(placeId)
      else next.add(placeId)
      return next
    })
  }

  async function suggest() {
    if (!trip) return
    if (mode === "preview") {
      setTrip(createDemoSuggestion(trip))
      return
    }
    if (!session) return
    await run("suggest", async () => {
      await api.createSuggestion(session.access_token, trip.id)
      await loadTrip(session.access_token, trip.id)
    })
  }

  async function confirmSuggestion(suggestion: AgentSuggestion) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(applyDemoSuggestion(trip, suggestion.id))
      setMessage("Plan updated. Preview changes stay on this device.")
      return
    }
    if (!session) return
    await run("confirm", async () => {
      await api.confirmSuggestion(session.access_token, trip, suggestion.id)
      await loadTrip(session.access_token, trip.id)
      setMessage("Plan updated and saved for your travel group.")
    })
  }

  async function saveProfile(input: UserProfileInput) {
    if (mode !== "account" || !session) return
    await run("save-profile", async () => {
      const updated = await api.updateProfile(session.access_token, input)
      setProfile(updated)
      setMessage("Profile saved.")
    })
  }

  async function createInvitation(input: CreateTripInvitationInput): Promise<string | null> {
    if (mode !== "account" || !session || !trip) return null
    const result = await run("create-invitation", async () => {
      const created = await api.createTripInvitation(session.access_token, trip.id, input)
      setInvitations((current) => [created.invitation, ...current])
      return created.inviteUrl
    })
    return result ?? null
  }

  async function revokeInvitation(invitationId: string) {
    if (mode !== "account" || !session || !trip) return
    await run("revoke-invitation", async () => {
      await api.revokeTripInvitation(session.access_token, trip.id, invitationId)
      setInvitations((current) => current.filter((invitation) => invitation.id !== invitationId))
      setMessage("Invitation revoked.")
    })
  }

  async function removeMember(memberUserId: string) {
    if (mode !== "account" || !session || !trip) return
    await run("remove-member", async () => {
      await api.removeTripMember(session.access_token, trip.id, memberUserId)
      setMembers((current) => current.filter((member) => member.userId !== memberUserId))
      setMessage("Member removed. They can no longer see this trip.")
      await locationSharing.refresh()
    })
  }

  async function editStop(stopId: string, fields: StopEditFields) {
    if (!trip) return
    const stop = trip.stops.find((item) => item.id === stopId)
    if (mode === "preview") {
      if (stop) setTrip(editDemoStop(trip, stopId, fields))
      return
    }
    if (!session) return
    await run("edit-stop", async () => {
      await api.applyTripChanges(session.access_token, trip, [{
        op: "update_stop",
        stopId,
        startTime: fields.startTime ?? stop?.startTime ?? "09:00",
        durationMinutes: fields.durationMinutes ?? stop?.durationMinutes ?? 90,
        sortOrder: stop?.sortOrder ?? 0,
        transportMode: fields.transportMode,
        notes: fields.notes,
      }])
      await loadTrip(session.access_token, trip.id)
      setMessage("Stop updated.")
    })
  }

  async function moveStopToDay(stopId: string, dayNumber: number) {
    if (!trip) return
    const stop = trip.stops.find((item) => item.id === stopId)
    if (!stop || (stop.dayNumber ?? 1) === dayNumber) return
    if (mode === "preview") {
      setTrip(moveDemoStopToDay(trip, stopId, dayNumber))
      setMessage(`Moved to day ${dayNumber}.`)
      return
    }
    if (!session) return
    const targetSort = trip.stops.filter((item) => (item.dayNumber ?? 1) === dayNumber).length
    await run("move-stop", async () => {
      await api.applyTripChanges(session.access_token, trip, [{ op: "move_stop", stopId, dayNumber, sortOrder: targetSort }])
      await loadTrip(session.access_token, trip.id)
      setMessage(`Moved to day ${dayNumber}.`)
    })
  }

  async function editDay(dayNumber: number, fields: DayEditFields) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(editDemoDay(trip, dayNumber, fields))
      setMessage("Day details updated.")
      return
    }
    if (!session) return
    await run("edit-day", async () => {
      await api.updateTripDay(session.access_token, trip, dayNumber, fields)
      await loadTrip(session.access_token, trip.id)
      setMessage("Day details updated.")
    })
  }

  async function draftReservation(sourceText: string): Promise<ReservationDraft | null> {
    if (mode === "preview" || !session || !trip) return null
    try {
      return await api.createReservationDraft(session.access_token, trip.id, sourceText)
    } catch {
      return null
    }
  }

  if (mode === "loading") return <LoadingScreen />

  const joinToken = location.pathname.startsWith("/join/")
    ? decodeURIComponent(location.pathname.slice("/join/".length))
    : null
  if (joinToken) {
    return (
      <JoinTripView
        token={joinToken}
        accessToken={session?.access_token ?? null}
        onAccepted={async (tripId) => {
          localStorage.setItem("china-stroll-trip-id", tripId)
          if (session) await loadTrip(session.access_token, tripId)
          navigate("/me")
        }}
        onGoHome={() => navigate("/")}
      />
    )
  }

  if (mode === "signed-out") {
    return (
      <WelcomeScreen
        configured={hasSupabaseConfig}
        onAuthenticated={(nextSession) => {
          setSession(nextSession)
          setMode("account")
        }}
        onPreview={() => setMode("preview")}
      />
    )
  }
  const testIdentity = session?.user.is_anonymous
    ? sessionStorage.getItem(TEST_EMAIL_LABEL_KEY) ?? "Test visitor"
    : null
  if (!trip) return <CreateTripScreen busy={busy === "create-trip"} mode={mode} onCreate={createTrip} testIdentity={testIdentity} />

  return (
    <AppShell
      accessToken={session?.access_token ?? null}
      busy={busy}
      message={message}
      mode={mode}
      locationSharing={{
        status: locationSharing.status,
        snapshot: locationSharing.snapshot,
        onEnable: locationSharing.enable,
        onDisable: locationSharing.disable,
        onRetryDisable: locationSharing.retryDisable,
        onRefresh: locationSharing.refresh,
      }}
      itineraryEditing={{
        onEditStop: editStop,
        onMoveStopToDay: moveStopToDay,
        onEditDay: editDay,
        onDraftReservation: draftReservation,
      }}
      membership={{
        isOwner: members.some((member) => member.isCurrentUser && member.role === "owner"),
        members,
        invitations,
        status: membershipStatus,
        onCreateInvitation: createInvitation,
        onRevokeInvitation: revokeInvitation,
        onRemoveMember: removeMember,
      }}
      profile={{
        profile,
        status: profileStatus,
        onSave: saveProfile,
      }}
      placeRepository={placeRepository}
      places={places}
      placesState={placesState}
      savedPlaceIds={savedPlaceIds}
      testIdentity={testIdentity}
      trip={trip}
      onAddPlace={addPlace}
      onAddDay={addDay}
      onRemoveStop={removeStop}
      onReorderStop={reorderStop}
      onCreateReservation={createReservation}
      onUpdateReservation={updateReservation}
      onRemoveReservation={removeReservation}
      onToggleSaved={toggleSavedPlace}
      onConfirm={confirmSuggestion}
      onSuggest={suggest}
      onExit={async () => {
        setTrip(null)
        localStorage.removeItem("china-stroll-trip-id")
        localStorage.removeItem("china-stroll-preview-trip")
        sessionStorage.removeItem(TEST_EMAIL_LABEL_KEY)
        if (mode === "account") await supabase?.auth.signOut()
        setMode("signed-out")
      }}
    />
  )
}

function WelcomeScreen({
  configured,
  onAuthenticated,
  onPreview,
}: {
  configured: boolean
  onAuthenticated: (session: Session) => void
  onPreview: () => void
}) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !email) return
    setSubmitting(true)
    if (isTestLoginEnabled) {
      sessionStorage.setItem(TEST_EMAIL_LABEL_KEY, maskEmail(email))
    }
    const { data, error } = await startEmailLogin(
      supabase.auth,
      email,
      window.location.origin,
      isTestLoginEnabled,
    )
    if (error && isTestLoginEnabled) {
      sessionStorage.removeItem(TEST_EMAIL_LABEL_KEY)
    }
    setSubmitting(false)
    if (data.session) onAuthenticated(data.session)
    setStatus(
      error
        ? error.message
        : isTestLoginEnabled
          ? "Test session opened. Your email was not verified or sent."
          : "Check your email for a secure sign-in link.",
    )
  }

  return (
    <main className="welcome-layout">
      <section className="welcome-copy">
        <a className="brand" href="/" aria-label="China Stroll home">
          <span className="brand-seal">游</span>
          <span>China Stroll</span>
        </a>
        <div className="eyebrow">A calmer way through Beijing</div>
        <h1>Keep the family plan clear, even when the day changes.</h1>
        <p className="welcome-lede">
          Build one shared day, understand each place, and review every suggested change before it reaches your itinerary.
        </p>
        <div className="proof-row">
          <span><CalendarDays size={18} /> One shared day</span>
          <span><Users size={18} /> Family ready</span>
          <span><Sparkles size={18} /> You confirm AI changes</span>
        </div>
      </section>
      <section className="welcome-card" aria-labelledby="start-title">
        <div className="postcard-stack" aria-hidden="true">
          <img src="/places/forbidden-city.webp" alt="" />
          <span>BEIJING · 北京</span>
        </div>
        <h2 id="start-title">Start your first stroll</h2>
        {isTestLoginEnabled && (
          <p className="test-mode-note">Test mode is on. This temporary account cannot be recovered after sign-out.</p>
        )}
        {configured ? (
          <form onSubmit={signIn} className="auth-form">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
              {isTestLoginEnabled ? "Continue in test mode" : "Email me a sign-in link"}
            </button>
          </form>
        ) : (
          <p className="config-note">Account sign-in becomes available after local environment values are added.</p>
        )}
        {status && <p className="status-message" role="status">{status}</p>}
        <div className="or-divider"><span>or</span></div>
        <button className="secondary-button" type="button" onClick={onPreview}>Explore the three-place preview</button>
        <p className="privacy-note">
          {isTestLoginEnabled
            ? "Your email stays in this browser as a masked label and is not verified."
            : "Preview plans stay in this browser and are not shared."}
        </p>
      </section>
    </main>
  )
}

function CreateTripScreen({ busy, mode, onCreate, testIdentity }: { busy: boolean; mode: Mode; onCreate: (name: string, date: string | null) => Promise<void>; testIdentity: string | null }) {
  const [name, setName] = useState("Our first Beijing day")
  const [date, setDate] = useState("")
  return (
    <main className="create-layout">
      <div className="step-count">01 / 03</div>
      <section className="create-card">
        <div className="eyebrow">Create a shared trip</div>
        <h1>Give everyone one plan to follow.</h1>
        <p>You can add places first and decide exact times after seeing the day together.</p>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void onCreate(name, date || null)
          }}
        >
          <label htmlFor="trip-name">Trip name</label>
          <input id="trip-name" required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} />
          <label htmlFor="trip-date">First day <span>optional</span></label>
          <input id="trip-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <button className="primary-button" disabled={busy} type="submit">
            {busy ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
            Create trip
          </button>
        </form>
        {mode === "preview" && <p className="privacy-note">Preview mode keeps this plan on your device.</p>}
        {testIdentity && <p className="test-mode-note">Test session · {testIdentity} · This account cannot be recovered after sign-out.</p>}
      </section>
    </main>
  )
}

function LoadingScreen() {
  return <main className="loading-screen"><span className="brand-seal">游</span><LoaderCircle className="spin" size={24} /><span>Opening your stroll…</span></main>
}
