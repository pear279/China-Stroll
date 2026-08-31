import { ArrowDown, ArrowUp, CalendarDays, Check, Clock3, Compass, GripVertical, LoaderCircle, Pencil, Plus, Sparkles, Trash2, Users, X } from "lucide-react"
import { useState } from "react"
import type { AgentSuggestion, PlaceSummary, ReservationInput, TripReservation, TripSnapshot } from "../../../../../packages/shared/src"
import type { AppMode } from "../../app-shell/types"

export type MineViewProps = {
  busy: string | null
  message: string | null
  mode: AppMode
  selectedDay: number
  selectedPlaceId: string | null
  testIdentity: string | null
  trip: TripSnapshot
  places: PlaceSummary[]
  onAddDay: () => Promise<number | null>
  onAddPlace: (placeId: string, dayNumber?: number) => Promise<void>
  onConfirm: (suggestion: AgentSuggestion) => Promise<void>
  onRemoveStop: (stopId: string) => Promise<void>
  onReorderStop: (stopId: string, targetIndex: number) => Promise<void>
  onCreateReservation: (input: ReservationInput) => Promise<void>
  onUpdateReservation: (reservationId: string, input: ReservationInput) => Promise<void>
  onRemoveReservation: (reservationId: string) => Promise<void>
  onSelectDay: (dayNumber: number) => void
  onSelectPlace: (placeId: string) => void
  onSuggest: () => Promise<void>
}

export function MineView({
  busy,
  message,
  mode,
  selectedDay,
  selectedPlaceId,
  testIdentity,
  trip,
  places,
  onAddDay,
  onAddPlace,
  onConfirm,
  onRemoveStop,
  onReorderStop,
  onCreateReservation,
  onUpdateReservation,
  onRemoveReservation,
  onSelectDay,
  onSelectPlace,
  onSuggest,
}: MineViewProps) {
  const [placeToAdd, setPlaceToAdd] = useState("")
  const [draggedStopId, setDraggedStopId] = useState<string | null>(null)
  const pendingSuggestion = trip.suggestions.find((item) => item.status === "proposed")
  const dayStops = [...trip.stops]
    .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const plannedPlaceIds = new Set(trip.stops.map((stop) => stop.placeId).filter(Boolean))
  const availablePlaces = places.filter((place) => !plannedPlaceIds.has(place.id))

  async function handleAddDay() {
    const dayNumber = await onAddDay()
    if (dayNumber) onSelectDay(dayNumber)
  }

  async function handleAddPlace() {
    if (!placeToAdd) return
    await onAddPlace(placeToAdd, selectedDay)
    setPlaceToAdd("")
  }

  return (
    <section className="module-view mine-view" aria-labelledby="mine-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">{mode === "preview" ? "Private preview" : testIdentity ? `Test session · ${testIdentity}` : "Shared trip"}</span>
          <h1 id="mine-heading">My trip</h1>
          <p>{trip.name} · Version {trip.version}</p>
        </div>
        <button className="date-chip" type="button" disabled={busy === "add-day"} onClick={() => void handleAddDay()}>
          <Plus aria-hidden="true" size={16} />Add day
        </button>
      </header>

      <div className="day-tabs" aria-label="Trip days">
        {trip.days.map((day) => (
          <button
            className={selectedDay === day.dayNumber ? "is-active" : undefined}
            key={day.dayNumber}
            type="button"
            onClick={() => onSelectDay(day.dayNumber)}
          >
            <CalendarDays aria-hidden="true" size={15} />Day {day.dayNumber}<small>{day.date ?? "Date open"}</small>
          </button>
        ))}
      </div>

      {message && <div className="status-banner" role="status"><Check aria-hidden="true" size={18} />{message}</div>}

      <div className="mine-grid">
        <section className="itinerary-panel" aria-labelledby="itinerary-heading">
          <div className="section-heading">
            <div><span className="eyebrow">Schedule</span><h2 id="itinerary-heading">Day {selectedDay} itinerary</h2></div>
            <span className="count-chip">{dayStops.length} stops</span>
          </div>
          <div className="itinerary-editor">
            <label>
              Add reviewed attraction
              <select value={placeToAdd} disabled={busy !== null || availablePlaces.length === 0} onChange={(event) => setPlaceToAdd(event.target.value)}>
                <option value="">{availablePlaces.length === 0 ? "All reviewed attractions are scheduled" : "Choose a reviewed attraction"}</option>
                {availablePlaces.map((place) => <option key={place.id} value={place.id}>{place.name}{place.aliases?.[0] ? ` · ${place.aliases[0]}` : ""}</option>)}
              </select>
            </label>
            <button className="primary-button" type="button" disabled={!placeToAdd || busy !== null} onClick={() => void handleAddPlace()}>
              <Plus aria-hidden="true" size={17} />Add to Day {selectedDay}
            </button>
          </div>
          {dayStops.length === 0 ? (
            <div className="empty-plan"><Compass aria-hidden="true" size={28} /><p>This day is open. Add a reviewed attraction when you are ready.</p></div>
          ) : (
            <ol className="timeline">
              {dayStops.map((stop, index) => (
                <li
                  className={draggedStopId === stop.id ? "is-dragging" : undefined}
                  draggable={busy === null}
                  key={stop.id}
                  onDragEnd={() => setDraggedStopId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDragStart={() => setDraggedStopId(stop.id)}
                  onDrop={() => {
                    if (draggedStopId) void onReorderStop(draggedStopId, index)
                    setDraggedStopId(null)
                  }}
                >
                  <button
                    className={selectedPlaceId === stop.placeId ? "timeline-card is-selected" : "timeline-card"}
                    type="button"
                    onClick={() => stop.placeId && onSelectPlace(stop.placeId)}
                  >
                    <span className="timeline-number">{index + 1}</span>
                    <span className="timeline-copy">
                      <strong>{stop.name}</strong>
                      <span><Clock3 aria-hidden="true" size={15} />{stop.startTime ? stop.startTime.slice(0, 5) : "Time open"} · {stop.durationMinutes ?? 90} min</span>
                    </span>
                  </button>
                  <div className="stop-actions" aria-label={`${stop.name} itinerary controls`}>
                    <span className="drag-handle" aria-label={`Drag ${stop.name} to reorder`} title="Drag to reorder"><GripVertical aria-hidden="true" size={17} /></span>
                    <button type="button" disabled={busy !== null || index === 0} aria-label={`Move ${stop.name} up`} onClick={() => void onReorderStop(stop.id, index - 1)}><ArrowUp aria-hidden="true" size={16} /></button>
                    <button type="button" disabled={busy !== null || index === dayStops.length - 1} aria-label={`Move ${stop.name} down`} onClick={() => void onReorderStop(stop.id, index + 1)}><ArrowDown aria-hidden="true" size={16} /></button>
                    <button className="remove-stop" type="button" disabled={busy !== null} aria-label={`Remove ${stop.name}`} onClick={() => void onRemoveStop(stop.id)}><Trash2 aria-hidden="true" size={16} /></button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="assistant-card" aria-labelledby="assistant-heading">
          <div className="assistant-icon"><Sparkles aria-hidden="true" size={22} /></div>
          <div><span className="eyebrow">Plan check</span><h2 id="assistant-heading">{pendingSuggestion ? "A clearer order is ready" : "Want a clearer visit order?"}</h2></div>
          {pendingSuggestion ? (
            <SuggestionPanel
              suggestion={pendingSuggestion}
              busy={busy === "confirm"}
              onConfirm={() => void onConfirm(pendingSuggestion)}
            />
          ) : (
            <>
              <p>China Stroll can arrange places already in your day and show every change before saving.</p>
              <button className="assistant-button" disabled={trip.stops.length === 0 || busy === "suggest"} type="button" onClick={() => void onSuggest()}>
                {busy === "suggest" ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : <Sparkles aria-hidden="true" size={18} />}
                Review my day
              </button>
            </>
          )}
        </section>

        <section className="reservation-panel" aria-labelledby="reservations-heading">
          <div className="section-heading"><div><span className="eyebrow">Booking log</span><h2 id="reservations-heading">Reservations</h2></div><span className="count-chip">{(trip.reservations ?? []).length} saved</span></div>
          <ReservationManager
            busy={busy}
            days={trip.days}
            places={places}
            reservations={trip.reservations ?? []}
            onCreate={onCreateReservation}
            onRemove={onRemoveReservation}
            onUpdate={onUpdateReservation}
          />
        </section>

        <section className="mine-empty-card" aria-labelledby="members-heading">
          <Users aria-hidden="true" size={22} />
          <h2 id="members-heading">Trip members</h2>
          <p>Location sharing will remain off until associated users, consent, access control, and revocation are available.</p>
        </section>
      </div>
    </section>
  )
}

const emptyReservation: ReservationInput = { category: "attraction", title: "", dayNumber: null, placeId: null, startsAt: null, endsAt: null, status: "planned", provider: null, confirmationCode: null, notes: "" }

function asLocalDateTime(value: string | null) {
  return value ? value.slice(0, 16) : ""
}

function ReservationManager({ busy, days, places, reservations, onCreate, onUpdate, onRemove }: {
  busy: string | null; days: TripSnapshot["days"]; places: PlaceSummary[]; reservations: TripReservation[]
  onCreate: (input: ReservationInput) => Promise<void>; onUpdate: (id: string, input: ReservationInput) => Promise<void>; onRemove: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<ReservationInput>(emptyReservation)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const saving = busy === "create-reservation" || busy === "update-reservation"
  function setField<Key extends keyof ReservationInput>(key: Key, value: ReservationInput[Key]) { setDraft((current) => ({ ...current, [key]: value })) }
  function startEdit(reservation: TripReservation) {
    setEditingId(reservation.id)
    setDraft({ ...reservation, startsAt: reservation.startsAt, endsAt: reservation.endsAt })
    setFormError(null)
  }
  async function submit() {
    if (!draft.title.trim()) return setFormError("Give this reservation a title before saving.")
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) return setFormError("End time must be after start time.")
    setFormError(null)
    if (editingId) await onUpdate(editingId, draft)
    else await onCreate(draft)
    setDraft(emptyReservation); setEditingId(null)
  }
  return <div className="reservation-manager">
    <div className="reservation-form" aria-label={editingId ? "Edit reservation" : "New reservation"}>
      <div className="form-heading"><strong>{editingId ? "Edit reservation" : "Add reservation"}</strong>{editingId && <button type="button" aria-label="Cancel reservation edit" onClick={() => { setEditingId(null); setDraft(emptyReservation); setFormError(null) }}><X aria-hidden="true" size={15} />Cancel</button>}</div>
      <label>Reservation title<input value={draft.title} maxLength={200} onChange={(event) => setField("title", event.target.value)} placeholder="e.g. Palace Museum entry" /></label>
      <div className="reservation-fields">
        <label>Type<select value={draft.category} onChange={(event) => setField("category", event.target.value as ReservationInput["category"])}><option value="accommodation">Accommodation</option><option value="transport">Transport</option><option value="restaurant">Restaurant</option><option value="attraction">Attraction ticket</option><option value="activity">Activity</option></select></label>
        <label>Status<select value={draft.status} onChange={(event) => setField("status", event.target.value as ReservationInput["status"])}><option value="planned">Planned</option><option value="confirmed">Confirmed</option><option value="cancelled">Cancelled</option><option value="completed">Completed</option></select></label>
        <label>Trip day<select value={draft.dayNumber ?? ""} onChange={(event) => setField("dayNumber", event.target.value ? Number(event.target.value) : null)}><option value="">Not linked to a day</option>{days.map((day) => <option key={day.id} value={day.dayNumber}>Day {day.dayNumber}</option>)}</select></label>
        <label>Related attraction<select value={draft.placeId ?? ""} onChange={(event) => setField("placeId", event.target.value || null)}><option value="">Not linked to an attraction</option>{places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}</select></label>
        <label>Start time<input type="datetime-local" value={asLocalDateTime(draft.startsAt)} onChange={(event) => setField("startsAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
        <label>End time<input type="datetime-local" value={asLocalDateTime(draft.endsAt)} onChange={(event) => setField("endsAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
        <label>Provider<input value={draft.provider ?? ""} maxLength={200} onChange={(event) => setField("provider", event.target.value || null)} placeholder="Hotel, airline, venue…" /></label>
        <label>Confirmation code<input value={draft.confirmationCode ?? ""} maxLength={200} onChange={(event) => setField("confirmationCode", event.target.value || null)} /></label>
      </div>
      <label>Notes<textarea value={draft.notes} maxLength={4000} onChange={(event) => setField("notes", event.target.value)} placeholder="Anything you need to remember" /></label>
      {formError && <p className="form-error" role="alert">{formError}</p>}
      <button className="primary-button" type="button" disabled={saving} onClick={() => void submit()}>{saving ? <LoaderCircle className="spin" aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={17} />}{editingId ? "Update reservation" : "Save reservation"}</button>
    </div>
    {reservations.length === 0 ? <p className="reservation-empty">No reservation records yet. Add tickets, dining, hotel, or transport details here.</p> : <ol className="reservation-list">{reservations.map((reservation) => <li key={reservation.id}><div><strong>{reservation.title}</strong><span>{reservation.category.replace("_", " ")} · {reservation.status}{reservation.startsAt ? ` · ${new Date(reservation.startsAt).toLocaleString()}` : ""}</span>{reservation.provider && <small>{reservation.provider}{reservation.confirmationCode ? ` · ${reservation.confirmationCode}` : ""}</small>}</div><div className="reservation-actions"><button type="button" aria-label={`Edit ${reservation.title}`} onClick={() => startEdit(reservation)}><Pencil aria-hidden="true" size={15} /></button><button className="remove-stop" type="button" aria-label={`Remove ${reservation.title}`} disabled={busy === "remove-reservation"} onClick={() => void onRemove(reservation.id)}><Trash2 aria-hidden="true" size={15} /></button></div></li>)}</ol>}
  </div>
}

function SuggestionPanel({ suggestion, busy, onConfirm }: { suggestion: AgentSuggestion; busy: boolean; onConfirm: () => void }) {
  return (
    <div className="suggestion-panel">
      <p>{suggestion.reason}</p>
      <ul>
        {suggestion.changes.map((change, index) => (
          <li key={`${change.op}-${index}`}>
            <Check aria-hidden="true" size={15} />
            {change.op === "update_stop" ? `Stop ${index + 1} starts at ${change.startTime}` : "Update visit order"}
          </li>
        ))}
      </ul>
      {suggestion.risks[0] && <div className="risk-note"><strong>Before you confirm</strong><span>{suggestion.risks[0]}</span></div>}
      <button className="primary-button" type="button" disabled={busy} onClick={onConfirm}>
        {busy ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : <Check aria-hidden="true" size={18} />}
        Confirm these changes
      </button>
    </div>
  )
}
