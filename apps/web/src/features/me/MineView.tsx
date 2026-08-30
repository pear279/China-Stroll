import { CalendarDays, Check, Clock3, Compass, LoaderCircle, Plus, Sparkles, Users } from "lucide-react"
import type { AgentSuggestion, TripSnapshot } from "../../../../../packages/shared/src"
import type { AppMode } from "../../app-shell/types"

export type MineViewProps = {
  busy: string | null
  message: string | null
  mode: AppMode
  selectedDay: number
  selectedPlaceId: string | null
  testIdentity: string | null
  trip: TripSnapshot
  onAddDay: () => Promise<void>
  onConfirm: (suggestion: AgentSuggestion) => Promise<void>
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
  onAddDay,
  onConfirm,
  onSelectDay,
  onSelectPlace,
  onSuggest,
}: MineViewProps) {
  const pendingSuggestion = trip.suggestions.find((item) => item.status === "proposed")
  const dayStops = [...trip.stops]
    .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
    .sort((left, right) => left.sortOrder - right.sortOrder)

  return (
    <section className="module-view mine-view" aria-labelledby="mine-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">{mode === "preview" ? "Private preview" : testIdentity ? `Test session · ${testIdentity}` : "Shared trip"}</span>
          <h1 id="mine-heading">My trip</h1>
          <p>{trip.name} · Version {trip.version}</p>
        </div>
        <button className="date-chip" type="button" disabled={busy === "add-day"} onClick={() => void onAddDay()}>
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
          {dayStops.length === 0 ? (
            <div className="empty-plan"><Compass aria-hidden="true" size={28} /><p>This day is open. Add a reviewed attraction when you are ready.</p></div>
          ) : (
            <ol className="timeline">
              {dayStops.map((stop, index) => (
                <li key={stop.id}>
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

        <section className="mine-empty-card" aria-labelledby="reservations-heading">
          <CalendarDays aria-hidden="true" size={22} />
          <h2 id="reservations-heading">Reservations</h2>
          <p>No reservation records yet. Ticket, dining, and hotel templates will be added after the data workflow is connected.</p>
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
