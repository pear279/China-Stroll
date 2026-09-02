import { ArrowDown, ArrowLeft, ArrowUp, CalendarDays, Check, Clock3, Compass, GripVertical, LoaderCircle, LocateFixed, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import type { AgentSuggestion, PlaceSummary, PrivatePlaceInput, ReservationDraft, ReservationInput, TransportMode, TripReservation, TripSnapshot } from "../../../../../packages/shared/src"
import type { AppMode, DayEditFields, ItineraryEditControls, LocationSharingControls, MembershipControls, PrivatePlacesControls, ProfileControls, StopEditFields } from "../../app-shell/types"
import { ProfileCard } from "./ProfileCard"
import { TripMembersCard } from "./TripMembersCard"

export type MineViewProps = {
  busy: string | null
  message: string | null
  mode: AppMode
  itineraryEditing: ItineraryEditControls
  locationSharing: LocationSharingControls
  membership: MembershipControls
  privatePlaces: PrivatePlacesControls
  profile: ProfileControls
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
  itineraryEditing,
  locationSharing,
  membership,
  privatePlaces,
  profile,
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
  const [editingStopId, setEditingStopId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"stops" | "reservations">("stops")
  const pendingSuggestion = trip.suggestions.find((item) => item.status === "proposed")
  const dayStops = [...trip.stops]
    .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const plannedPlaceIds = new Set(trip.stops.map((stop) => stop.placeId).filter(Boolean))
  const availablePlaces = places.filter((place) => !plannedPlaceIds.has(place.id))
  const displayName = profile.profile?.displayName || "旅行者"
  const preferenceTags = profile.profile
    ? Object.values(profile.profile.travelPreferences).filter((value): value is string => typeof value === "string").slice(0, 5)
    : []

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

      <div className="mine-profile-header">
        <span className="mine-avatar" aria-hidden="true">{displayName[0] ?? "游"}</span>
        <div className="mine-profile-copy">
          <strong>{displayName}</strong>
          <span className="mine-profile-tags">
            {preferenceTags.length === 0 ? <em>尚未设置偏好</em> : preferenceTags.map((tag) => <em key={tag}>{tag}</em>)}
          </span>
        </div>
      </div>

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

      <div className="mine-tab-toggle" role="group" aria-label="日程列表类型">
        <button type="button" className={activeTab === "stops" ? "is-active" : undefined} aria-pressed={activeTab === "stops"} onClick={() => setActiveTab("stops")}>景点列表</button>
        <button type="button" className={activeTab === "reservations" ? "is-active" : undefined} aria-pressed={activeTab === "reservations"} onClick={() => setActiveTab("reservations")}>预约列表</button>
      </div>

      <DayEditor
        day={trip.days.find((day) => day.dayNumber === selectedDay) ?? null}
        busy={busy}
        onSave={(fields) => itineraryEditing.onEditDay(selectedDay, fields)}
      />

      {message && <div className="status-banner" role="status"><Check aria-hidden="true" size={18} />{message}</div>}

      <div className="mine-grid">
        {activeTab === "stops" && (
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
                      <strong>{stop.name}{stop.privatePlaceId && <span className="private-badge">Private</span>}</strong>
                      <span><Clock3 aria-hidden="true" size={15} />{stop.startTime ? stop.startTime.slice(0, 5) : "Time open"} · {stop.durationMinutes ?? 90} min</span>
                    </span>
                  </button>
                  <div className="stop-actions" aria-label={`${stop.name} itinerary controls`}>
                    <span className="drag-handle" aria-label={`Drag ${stop.name} to reorder`} title="Drag to reorder"><GripVertical aria-hidden="true" size={17} /></span>
                    <button type="button" disabled={busy !== null} aria-label={`Edit ${stop.name}`} onClick={() => setEditingStopId(editingStopId === stop.id ? null : stop.id)}><Pencil aria-hidden="true" size={16} /></button>
                    <button type="button" disabled={busy !== null || index === 0} aria-label={`Move ${stop.name} up`} onClick={() => void onReorderStop(stop.id, index - 1)}><ArrowUp aria-hidden="true" size={16} /></button>
                    <button type="button" disabled={busy !== null || index === dayStops.length - 1} aria-label={`Move ${stop.name} down`} onClick={() => void onReorderStop(stop.id, index + 1)}><ArrowDown aria-hidden="true" size={16} /></button>
                    <button className="remove-stop" type="button" disabled={busy !== null} aria-label={`Remove ${stop.name}`} onClick={() => void onRemoveStop(stop.id)}><Trash2 aria-hidden="true" size={16} /></button>
                  </div>
                  {editingStopId === stop.id && (
                    <StopEditor
                      stop={stop}
                      days={trip.days}
                      busy={busy}
                      onMove={(dayNumber) => itineraryEditing.onMoveStopToDay(stop.id, dayNumber)}
                      onSave={(fields) => itineraryEditing.onEditStop(stop.id, fields)}
                    />
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>
        )}

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

        {activeTab === "reservations" && (
        <section className="reservation-panel" aria-labelledby="reservations-heading">
          <div className="section-heading"><div><span className="eyebrow">Booking log</span><h2 id="reservations-heading">Reservations</h2></div><span className="count-chip">{(trip.reservations ?? []).length} saved</span></div>
          <ReservationManager
            busy={busy}
            days={trip.days}
            reservations={(trip.reservations ?? []).filter((reservation) => reservation.dayNumber === selectedDay)}
            onCreate={onCreateReservation}
            onDraft={itineraryEditing.onDraftReservation}
            onRemove={onRemoveReservation}
            onUpdate={onUpdateReservation}
          />
        </section>
        )}

        <LocationSharingCard mode={mode} sharing={locationSharing} />

        <ProfileCard mode={mode} profile={profile.profile} status={profile.status} onSave={profile.onSave} />

        <TripMembersCard
          mode={mode}
          isOwner={membership.isOwner}
          members={membership.members}
          invitations={membership.invitations}
          status={membership.status}
          onCreateInvitation={membership.onCreateInvitation}
          onRevokeInvitation={membership.onRevokeInvitation}
          onRemoveMember={membership.onRemoveMember}
        />

        <PrivatePlacesCard mode={mode} controls={privatePlaces} selectedDay={selectedDay} />
      </div>
    </section>
  )
}

function LocationSharingCard({ mode, sharing }: { mode: AppMode; sharing: LocationSharingControls }) {
  const checked = sharing.snapshot?.enabled ?? false
  const waiting = sharing.status === "loading" || sharing.status === "enabling" || sharing.status === "revoke-pending"
  const unavailable = mode === "preview"
    || (sharing.status === "dependency-unavailable" && !sharing.snapshot)
    || sharing.status === "revoke-failed"
  const recipients = Math.max(0, (sharing.snapshot?.activeMemberCount ?? 1) - 1)

  let statusText = "Location sharing is off"
  let statusIsError = false
  if (mode === "preview") statusText = "Location sharing is unavailable in preview."
  else if (sharing.status === "loading") statusText = "Checking location sharing…"
  else if (sharing.status === "enabling") statusText = "Starting foreground location sharing…"
  else if (sharing.status === "sharing") {
    statusText = recipients === 0
      ? "No other active trip members can view your location right now."
      : `Sharing with ${recipients} other active trip ${recipients === 1 ? "member" : "members"}.`
  } else if (sharing.status === "expired") statusText = "Your last shared location expired. Sharing is off."
  else if (sharing.status === "permission-denied") {
    statusText = checked
      ? "Location permission was denied. No new updates are being sent; your last accepted point may remain visible until it expires or you turn sharing off."
      : "Location permission was denied. Location sharing is off."
    statusIsError = true
  } else if (sharing.status === "upload-failed") {
    statusText = "Your initial location could not be shared. Location sharing is off."
    statusIsError = true
  } else if (sharing.status === "revoke-pending") statusText = "Browser updates stopped. Revoking server visibility…"
  else if (sharing.status === "revoke-failed") {
    statusText = "Browser updates stopped, but server revocation failed. Retry to remove visibility."
    statusIsError = true
  } else if (sharing.status === "dependency-unavailable") {
    statusText = checked
      ? "The latest location update failed. Your last accepted point may remain visible until it expires or you turn sharing off."
      : "Location sharing is temporarily unavailable. Your map and itinerary still work."
    statusIsError = true
  }

  return (
    <section className="location-sharing-card" aria-labelledby="location-sharing-heading">
      <div className="location-sharing-heading">
        <div className="location-sharing-title">
          <LocateFixed aria-hidden="true" size={22} />
          <div><span className="eyebrow">Privacy control</span><h2 id="location-sharing-heading">Current location</h2></div>
        </div>
        <button
          aria-checked={checked}
          aria-label="Share my current location"
          className="location-sharing-switch"
          disabled={waiting || unavailable}
          role="switch"
          type="button"
          onClick={() => void (checked ? sharing.onDisable() : sharing.onEnable())}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <strong className="location-sharing-label">Share my current location</strong>
      <ul className="location-sharing-limits">
        <li>Only while this app is open</li>
        <li>Visible to active trip members only</li>
        <li>One current point with no location history</li>
      </ul>
      <p className="location-safety-note">This is a coordination aid, not a safety guarantee.</p>
      <div className={statusIsError ? "location-sharing-status is-error" : "location-sharing-status"} role={statusIsError ? "alert" : "status"}>
        {waiting && <LoaderCircle className="spin" aria-hidden="true" size={17} />}
        <span>{statusText}</span>
      </div>
      {sharing.snapshot && <small className="location-member-count">{sharing.snapshot.activeMemberCount} active trip {sharing.snapshot.activeMemberCount === 1 ? "member" : "members"}</small>}
      {sharing.status === "revoke-failed" && (
        <button className="secondary-button location-retry-button" type="button" onClick={() => void sharing.onRetryDisable()}>
          Retry revocation
        </button>
      )}
    </section>
  )
}

const emptyReservation: ReservationInput = { category: "attraction", title: "", dayNumber: null, placeId: null, startsAt: null, endsAt: null, status: "planned", provider: null, confirmationCode: null, notes: "" }

function asLocalDateTime(value: string | null) {
  return value ? value.slice(0, 16) : ""
}

function ReservationManager({ busy, days, reservations, onCreate, onDraft, onUpdate, onRemove }: {
  busy: string | null; days: TripSnapshot["days"]; reservations: TripReservation[]
  onCreate: (input: ReservationInput) => Promise<void>
  onDraft: (sourceText: string) => Promise<ReservationDraft | null>
  onUpdate: (id: string, input: ReservationInput) => Promise<void>; onRemove: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState<ReservationInput>(emptyReservation)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState("")
  const [showDraft, setShowDraft] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftNote, setDraftNote] = useState<string | null>(null)
  const saving = busy === "create-reservation" || busy === "update-reservation"
  function setField<Key extends keyof ReservationInput>(key: Key, value: ReservationInput[Key]) { setDraft((current) => ({ ...current, [key]: value })) }
  function startCreate() {
    setEditingId(null); setDraft(emptyReservation); setFormError(null); setDraftNote(null); setShowDraft(false)
    setFormOpen(true)
  }
  function startEdit(reservation: TripReservation) {
    setEditingId(reservation.id)
    setDraft({ ...reservation, startsAt: reservation.startsAt, endsAt: reservation.endsAt })
    setFormError(null); setDraftNote(null); setShowDraft(false)
    setFormOpen(true)
  }
  function closeForm() { setFormOpen(false); setEditingId(null); setDraft(emptyReservation); setFormError(null); setDraftNote(null) }
  async function submit() {
    if (!draft.title.trim()) return setFormError("请填写预约名称。")
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) return setFormError("结束时间需晚于开始时间。")
    setFormError(null)
    if (editingId) await onUpdate(editingId, draft)
    else await onCreate(draft)
    closeForm()
  }
  async function draftFromText() {
    if (!draftText.trim()) return setDraftNote("请先粘贴预约信息。")
    setDrafting(true)
    setDraftNote(null)
    try {
      const parsed = await onDraft(draftText)
      if (!parsed) { setDraftNote("无法解析，请手动填写。"); return }
      setDraft((current) => ({ ...current, ...parsed }))
      setDraftNote("已生成草稿，请核对后保存。")
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div className="reservation-manager">
      <button className="primary-button reservation-add-button" type="button" onClick={startCreate}><Plus aria-hidden="true" size={16} />添加预约</button>
      {reservations.length === 0 ? (
        <p className="reservation-empty">暂无预约，点击「添加预约」记录饭店、酒店或景点门票。</p>
      ) : (
        <ol className="reservation-list">{reservations.map((reservation) => <li key={reservation.id}><div><strong>{reservation.title}</strong><span>{categoryLabel(reservation.category)} · {reservation.status}{reservation.startsAt ? ` · ${new Date(reservation.startsAt).toLocaleString()}` : ""}</span>{reservation.provider && <small>{reservation.provider}{reservation.confirmationCode ? ` · ${reservation.confirmationCode}` : ""}</small>}</div><div className="reservation-actions"><button type="button" aria-label={`编辑 ${reservation.title}`} onClick={() => startEdit(reservation)}><Pencil aria-hidden="true" size={15} /></button><button className="remove-stop" type="button" aria-label={`移除 ${reservation.title}`} disabled={busy === "remove-reservation"} onClick={() => void onRemove(reservation.id)}><Trash2 aria-hidden="true" size={15} /></button></div></li>)}</ol>
      )}

      {formOpen && (
        <div className="reservation-overlay">
          <header className="reservation-overlay-header">
            <button type="button" aria-label="返回" onClick={closeForm}><ArrowLeft size={20} /></button>
            <strong>{editingId ? "编辑预约" : "添加预约"}</strong>
          </header>
          <div className="reservation-overlay-body">
            <button className="secondary-button" type="button" onClick={() => setShowDraft((current) => !current)}>AI 代填草稿</button>
            {showDraft && (
              <div className="reservation-draft-form">
                <label>粘贴预约信息<textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder="例如：9月3日15:00入住酒店，预约号12345" /></label>
                <button className="secondary-button" type="button" disabled={drafting} onClick={() => void draftFromText()}>{drafting ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}生成草稿</button>
              </div>
            )}
            {draftNote && <p className="account-status" role="status">{draftNote}</p>}
            <div className="reservation-form" aria-label={editingId ? "编辑预约" : "添加预约"}>
              <label>预约类型<select value={draft.category} onChange={(event) => setField("category", event.target.value as ReservationInput["category"])}><option value="restaurant">饭店</option><option value="accommodation">酒店</option><option value="attraction">景点门票</option></select></label>
              <label>名称<input value={draft.title} maxLength={200} onChange={(event) => setField("title", event.target.value)} placeholder="例如：故宫门票" /></label>
              <label>所属日程<select value={draft.dayNumber ?? ""} onChange={(event) => setField("dayNumber", event.target.value ? Number(event.target.value) : null)}><option value="">未关联日程</option>{days.map((day) => <option key={day.id} value={day.dayNumber}>第 {day.dayNumber} 天</option>)}</select></label>
              <label>预约编号<input value={draft.confirmationCode ?? ""} maxLength={200} onChange={(event) => setField("confirmationCode", event.target.value || null)} placeholder="可选" /></label>
              <label>提供方<input value={draft.provider ?? ""} maxLength={200} onChange={(event) => setField("provider", event.target.value || null)} placeholder="酒店 / 餐厅 / 景区" /></label>
              <label>开始时间<input type="datetime-local" value={asLocalDateTime(draft.startsAt)} onChange={(event) => setField("startsAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
              <label>结束时间<input type="datetime-local" value={asLocalDateTime(draft.endsAt)} onChange={(event) => setField("endsAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
              <label>备注<textarea value={draft.notes} maxLength={4000} onChange={(event) => setField("notes", event.target.value)} placeholder="备注信息" /></label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
            </div>
          </div>
          <div className="reservation-overlay-footer">
            <button className="primary-button" type="button" disabled={saving} onClick={() => void submit()}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}保存预约</button>
          </div>
        </div>
      )}
    </div>
  )
}

function categoryLabel(category: string) {
  if (category === "restaurant") return "饭店"
  if (category === "accommodation") return "酒店"
  if (category === "attraction") return "景点门票"
  return category.replace("_", " ")
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

function DayEditor({ day, busy, onSave }: { day: TripSnapshot["days"][number] | null; busy: string | null; onSave: (fields: DayEditFields) => Promise<void> }) {
  const [date, setDate] = useState(day?.date ?? "")
  const [title, setTitle] = useState(day?.title ?? "")
  const [notes, setNotes] = useState(day?.notes ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDate(day?.date ?? "")
    setTitle(day?.title ?? "")
    setNotes(day?.notes ?? "")
  }, [day?.id, day?.date, day?.title, day?.notes])

  async function save() {
    setSaving(true)
    try {
      await onSave({ date: date || null, title: title.trim() || null, notes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="day-editor" aria-label={`Day ${day?.dayNumber ?? ""} details`}>
      <div className="form-heading"><strong>Day {day?.dayNumber ?? ""} details</strong></div>
      <div className="day-editor-fields">
        <label>Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>Title<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={`Day ${day?.dayNumber ?? ""}`} /></label>
      </div>
      <label>Notes<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Anything to remember for this day" /></label>
      <button className="secondary-button" type="button" disabled={saving || busy !== null} onClick={() => void save()}>
        {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Save day details
      </button>
    </section>
  )
}

function StopEditor({ stop, days, busy, onMove, onSave }: {
  stop: TripSnapshot["stops"][number]
  days: TripSnapshot["days"]
  busy: string | null
  onMove: (dayNumber: number) => Promise<void>
  onSave: (fields: StopEditFields) => Promise<void>
}) {
  const [startTime, setStartTime] = useState(stop.startTime ? stop.startTime.slice(0, 5) : "")
  const [duration, setDuration] = useState(String(stop.durationMinutes ?? 90))
  const [transport, setTransport] = useState(stop.transportMode ?? "")
  const [notes, setNotes] = useState(stop.notes ?? "")
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      await onSave({
        startTime: startTime ? `${startTime}:00` : null,
        durationMinutes: Number(duration) || null,
        transportMode: (transport || null) as TransportMode | null,
        notes,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="stop-editor">
      <div className="stop-editor-fields">
        <label>Start time<input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} /></label>
        <label>Duration (min)<input type="number" min={1} max={1440} value={duration} onChange={(event) => setDuration(event.target.value)} /></label>
        <label>Transport
          <select value={transport} onChange={(event) => setTransport(event.target.value)}>
            <option value="">Not set</option><option value="walk">Walk</option><option value="transit">Transit</option>
            <option value="taxi">Taxi</option><option value="bike">Bike</option><option value="other">Other</option>
          </select>
        </label>
        <label>Move to day
          <select value={stop.dayNumber ?? 1} onChange={(event) => void onMove(Number(event.target.value))}>
            {days.map((day) => <option key={day.id} value={day.dayNumber}>Day {day.dayNumber}</option>)}
          </select>
        </label>
      </div>
      <label>Notes<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Private note for this stop" /></label>
      <button className="secondary-button" type="button" disabled={saving || busy !== null} onClick={() => void save()}>
        {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}Save stop
      </button>
    </div>
  )
}

function PrivatePlacesCard({ mode, controls, selectedDay }: { mode: AppMode; controls: PrivatePlacesControls; selectedDay: number }) {
  const [name, setName] = useState("")
  const [type, setType] = useState<PrivatePlaceInput["type"]>("other")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  if (mode === "preview") {
    return (
      <section className="account-card private-places-card" aria-labelledby="private-places-heading">
        <div className="section-heading">
          <div><span className="eyebrow">Private places</span><h2 id="private-places-heading">Hotels and stops</h2></div>
        </div>
        <p className="account-signin-note">Private places (hotels, restaurants, meeting points) need a signed-in account.</p>
      </section>
    )
  }

  async function create() {
    if (!name.trim()) return
    setSaving(true)
    try {
      await controls.onCreate({ name: name.trim(), type, address: address.trim() || null, coordinate: null, notes })
      setName(""); setAddress(""); setNotes("")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="account-card private-places-card" aria-labelledby="private-places-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Private places</span><h2 id="private-places-heading">Hotels and stops</h2></div>
      </div>
      <div className="private-place-form">
        <label>Name<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder="e.g. Courtyard Hotel" /></label>
        <div className="profile-row">
          <label>Place type
            <select value={type} onChange={(event) => setType(event.target.value as PrivatePlaceInput["type"])}>
              <option value="other">Other</option><option value="hotel">Hotel</option>
              <option value="restaurant">Restaurant</option><option value="meeting_point">Meeting point</option>
            </select>
          </label>
          <label>Address<input value={address} maxLength={400} onChange={(event) => setAddress(event.target.value)} placeholder="Optional" /></label>
        </div>
        <label>Notes<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" /></label>
        <button className="secondary-button" type="button" disabled={saving || !name.trim()} onClick={() => void create()}>
          {saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Add private place
        </button>
      </div>
      {controls.places.length > 0 && (
        <ul className="member-list">
          {controls.places.map((place) => (
            <li key={place.id}>
              <div className="member-copy">
                <strong>{place.name}</strong>
                <span>{place.type.replace("_", " ")}{place.address ? ` · ${place.address}` : ""}{place.coordinate ? "" : " · no coordinate"}</span>
              </div>
              <button className="add-private-stop" type="button" onClick={() => void controls.onAddToDay(place.id, selectedDay)}>Add to day {selectedDay}</button>
            </li>
          ))}
        </ul>
      )}
      <small className="private-places-note">Private places are your own trip stops, not reviewed attractions.</small>
    </section>
  )
}
