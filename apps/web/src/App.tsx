import type { Session } from "@supabase/supabase-js"
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock3,
  Compass,
  LoaderCircle,
  LogOut,
  MapPinned,
  Plus,
  Sparkles,
  Users,
} from "lucide-react"
import { FormEvent, lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react"
import { samplePlaces, type AgentSuggestion, type TripSnapshot } from "../../../packages/shared/src"
import { api, ApiRequestError } from "./lib/api"
import { addDemoStop, applyDemoSuggestion, createDemoSuggestion, createDemoTrip } from "./lib/demo"
import { hasSupabaseConfig, supabase } from "./lib/supabase"

const TravelMap = lazy(() =>
  import("./components/TravelMap").then((module) => ({ default: module.TravelMap })),
)

type Mode = "loading" | "signed-out" | "preview" | "account"

export function App() {
  const [mode, setMode] = useState<Mode>("loading")
  const [session, setSession] = useState<Session | null>(null)
  const [trip, setTrip] = useState<TripSnapshot | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadTrip = useCallback(async (accessToken: string, tripId: string) => {
    const nextTrip = await api.getTrip(accessToken, tripId)
    setTrip(nextTrip)
    return nextTrip
  }, [])

  useEffect(() => {
    const savedPreview = localStorage.getItem("china-stroll-preview-trip")
    if (savedPreview) {
      try {
        setTrip(JSON.parse(savedPreview) as TripSnapshot)
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

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    setMessage(null)
    try {
      await task()
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

  async function addPlace(placeId: string) {
    if (!trip) return
    if (mode === "preview") {
      setTrip(addDemoStop(trip, placeId))
      return
    }
    if (!session) return
    await run(`add-${placeId}`, async () => {
      await api.addStop(session.access_token, trip, placeId)
      await loadTrip(session.access_token, trip.id)
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

  if (mode === "loading") return <LoadingScreen />
  if (mode === "signed-out") {
    return (
      <WelcomeScreen
        configured={hasSupabaseConfig}
        onPreview={() => setMode("preview")}
      />
    )
  }
  if (!trip) return <CreateTripScreen busy={busy === "create-trip"} mode={mode} onCreate={createTrip} />

  return (
    <Planner
      busy={busy}
      message={message}
      mode={mode}
      trip={trip}
      onAddPlace={addPlace}
      onConfirm={confirmSuggestion}
      onSuggest={suggest}
      onExit={async () => {
        setTrip(null)
        localStorage.removeItem("china-stroll-trip-id")
        localStorage.removeItem("china-stroll-preview-trip")
        if (mode === "account") await supabase?.auth.signOut()
        setMode("signed-out")
      }}
    />
  )
}

function WelcomeScreen({ configured, onPreview }: { configured: boolean; onPreview: () => void }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function signIn(event: FormEvent) {
    event.preventDefault()
    if (!supabase || !email) return
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    })
    setSubmitting(false)
    setStatus(error ? error.message : "Check your email for a secure sign-in link.")
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
          <img src="/places/palace-museum.png" alt="" />
          <span>BEIJING · 北京</span>
        </div>
        <h2 id="start-title">Start your first stroll</h2>
        {configured ? (
          <form onSubmit={signIn} className="auth-form">
            <label htmlFor="email">Email address</label>
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            <button className="primary-button" disabled={submitting} type="submit">
              {submitting ? <LoaderCircle className="spin" size={18} /> : <ArrowRight size={18} />}
              Email me a sign-in link
            </button>
          </form>
        ) : (
          <p className="config-note">Account sign-in becomes available after local environment values are added.</p>
        )}
        {status && <p className="status-message" role="status">{status}</p>}
        <div className="or-divider"><span>or</span></div>
        <button className="secondary-button" type="button" onClick={onPreview}>Explore the three-place preview</button>
        <p className="privacy-note">Preview plans stay in this browser and are not shared.</p>
      </section>
    </main>
  )
}

function CreateTripScreen({ busy, mode, onCreate }: { busy: boolean; mode: Mode; onCreate: (name: string, date: string | null) => Promise<void> }) {
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
      </section>
    </main>
  )
}

function Planner({ busy, message, mode, trip, onAddPlace, onConfirm, onSuggest, onExit }: {
  busy: string | null
  message: string | null
  mode: Mode
  trip: TripSnapshot
  onAddPlace: (placeId: string) => Promise<void>
  onConfirm: (suggestion: AgentSuggestion) => Promise<void>
  onSuggest: () => Promise<void>
  onExit: () => Promise<void>
}) {
  const [selectedStopId, setSelectedStopId] = useState<string | null>(trip.stops[0]?.id ?? null)
  const pendingSuggestion = trip.suggestions.find((item) => item.status === "proposed")
  const plannedIds = useMemo(() => new Set(trip.stops.map((stop) => stop.placeId)), [trip.stops])

  useEffect(() => {
    if (!selectedStopId && trip.stops[0]) setSelectedStopId(trip.stops[0].id)
  }, [selectedStopId, trip.stops])

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="/" onClick={(event) => event.preventDefault()}>
          <span className="brand-seal">游</span><span>China Stroll</span>
        </a>
        <div className="trip-meta">
          <strong>{trip.name}</strong>
          <span>{mode === "preview" ? "Private preview" : "Shared trip"} · Version {trip.version}</span>
        </div>
        <button className="icon-button" type="button" onClick={() => void onExit()} aria-label="Leave trip"><LogOut size={19} /></button>
      </header>

      <main className="planner-grid">
        <section className="day-panel" aria-labelledby="day-heading">
          <div className="section-heading">
            <div><span className="eyebrow">Day 1</span><h1 id="day-heading">Your Beijing day</h1></div>
            <span className="date-chip"><CalendarDays size={16} />{trip.startDate ?? "Date open"}</span>
          </div>

          {message && <div className="status-banner" role="status"><Check size={18} />{message}</div>}

          {trip.stops.length === 0 ? (
            <div className="empty-plan"><Compass size={30} /><h2>Your day has room to breathe.</h2><p>Add one of the three verified sample places below.</p></div>
          ) : (
            <ol className="timeline">
              {[...trip.stops].sort((a, b) => a.sortOrder - b.sortOrder).map((stop, index) => (
                <li key={stop.id}>
                  <button className={selectedStopId === stop.id ? "timeline-card is-selected" : "timeline-card"} type="button" onClick={() => setSelectedStopId(stop.id)}>
                    <span className="timeline-number">{index + 1}</span>
                    <span className="timeline-copy"><strong>{stop.name}</strong><span><Clock3 size={15} />{stop.startTime ? stop.startTime.slice(0, 5) : "Time open"} · {stop.durationMinutes ?? 90} min</span></span>
                    <MapPinned size={19} />
                  </button>
                </li>
              ))}
            </ol>
          )}

          <div className="assistant-card">
            <div className="assistant-icon"><Sparkles size={22} /></div>
            <div><span className="eyebrow">Plan check</span><h2>{pendingSuggestion ? "A clearer order is ready" : "Want a clearer visit order?"}</h2></div>
            {pendingSuggestion ? (
              <SuggestionPanel suggestion={pendingSuggestion} busy={busy === "confirm"} onConfirm={() => void onConfirm(pendingSuggestion)} />
            ) : (
              <>
                <p>China Stroll can arrange the places already in your day. It will show the exact changes before saving.</p>
                <button className="assistant-button" disabled={trip.stops.length === 0 || busy === "suggest"} type="button" onClick={() => void onSuggest()}>
                  {busy === "suggest" ? <LoaderCircle className="spin" size={18} /> : <Sparkles size={18} />}
                  Review my day
                </button>
              </>
            )}
          </div>
        </section>

        <aside className="map-panel">
          <div className="map-panel-heading"><span className="eyebrow">Map and list stay together</span><h2>Your route at a glance</h2></div>
          <Suspense fallback={<div className="map-shell"><div className="map-status">Preparing map…</div></div>}>
            <TravelMap stops={trip.stops} selectedStopId={selectedStopId} onSelect={setSelectedStopId} />
          </Suspense>
        </aside>

        <section className="places-panel" aria-labelledby="places-heading">
          <div className="section-heading"><div><span className="eyebrow">Verified samples</span><h2 id="places-heading">Add a place</h2></div><span className="count-chip">{trip.stops.length} / 3 planned</span></div>
          <div className="place-grid">
            {samplePlaces.map((place) => {
              const planned = plannedIds.has(place.id)
              return (
                <article className="place-card" key={place.id}>
                  <img src={place.image} alt={`Archive stamp artwork for ${place.name}`} />
                  <div className="place-card-copy"><span className="place-zh">{place.nameZh}</span><h3>{place.name}</h3><p>{place.shortIntro}</p><div className="place-card-footer"><span><Clock3 size={15} />{Math.round(place.durationMinutes / 30) / 2} hr</span><button disabled={planned || busy === `add-${place.id}`} type="button" onClick={() => void onAddPlace(place.id)}>{planned ? <><Check size={16} /> Planned</> : <><Plus size={16} /> Add</>}</button></div></div>
                </article>
              )
            })}
          </div>
        </section>
      </main>
    </div>
  )
}

function SuggestionPanel({ suggestion, busy, onConfirm }: { suggestion: AgentSuggestion; busy: boolean; onConfirm: () => void }) {
  return (
    <div className="suggestion-panel">
      <p>{suggestion.reason}</p>
      <ul>{suggestion.changes.map((change, index) => <li key={`${change.op}-${index}`}><Check size={15} />{change.op === "update_stop" ? `Stop ${index + 1} starts at ${change.startTime}` : "Update visit order"}</li>)}</ul>
      <div className="risk-note"><strong>Before you confirm</strong><span>{suggestion.risks[0]}</span></div>
      <button className="primary-button" type="button" disabled={busy} onClick={onConfirm}>{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}Confirm these changes</button>
    </div>
  )
}

function LoadingScreen() {
  return <main className="loading-screen"><span className="brand-seal">游</span><LoaderCircle className="spin" size={24} /><span>Opening your stroll…</span></main>
}
