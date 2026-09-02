import { CalendarDays, Check, Languages, LoaderCircle, LocateFixed, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { resolvePlaceImage, type AgentSuggestion, type PlaceSummary, type PrivatePlaceInput, type ReservationDraft, type ReservationInput, type TripReservation, type TripSnapshot } from "../../../../../packages/shared/src"
import type { AppMode, DayEditFields, ItineraryEditControls, LocationSharingControls, MembershipControls, PrivatePlacesControls, ProfileControls } from "../../app-shell/types"
import { BottomSheet } from "../../components/BottomSheet"
import { useLocale } from "../../lib/i18n"
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
  testIdentity,
  trip,
  onAddDay,
  onConfirm,
  onRemoveStop,
  onCreateReservation,
  onUpdateReservation,
  onRemoveReservation,
  onSelectDay,
  onSelectPlace,
  onSuggest,
}: MineViewProps) {
  const [activeTab, setActiveTab] = useState<"stops" | "reservations">("stops")
  const { t, locale, setLocale } = useLocale()
  const navigate = useNavigate()
  const pendingSuggestion = trip.suggestions.find((item) => item.status === "proposed")
  const dayStops = [...trip.stops]
    .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
    .sort((left, right) => left.sortOrder - right.sortOrder)
  const displayName = profile.profile?.displayName || t("mine.traveler")
  const preferenceTags = profile.profile
    ? Object.values(profile.profile.travelPreferences).filter((value): value is string => typeof value === "string").slice(0, 5)
    : []

  async function handleAddDay() {
    const dayNumber = await onAddDay()
    if (dayNumber) onSelectDay(dayNumber)
  }

  return (
    <section className="module-view mine-view" aria-labelledby="mine-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">{mode === "preview" ? t("mine.eyebrowPreview") : testIdentity ? t("mine.eyebrowTest", { id: testIdentity }) : t("mine.eyebrowShared")}</span>
          <h1 id="mine-heading">{t("mine.title")}</h1>
          <p>{trip.name} · Version {trip.version}</p>
        </div>
        <div className="mine-header-actions">
          <button className="icon-button" type="button" aria-label="Switch language" onClick={() => setLocale(locale === "en" ? "zh" : "en")}>
            <Languages aria-hidden="true" size={19} />
            <span>{locale === "en" ? "中" : "EN"}</span>
          </button>
          <button className="date-chip" type="button" disabled={busy === "add-day"} onClick={() => void handleAddDay()}>
            <Plus aria-hidden="true" size={16} />{t("mine.addDay")}
          </button>
        </div>
      </header>

      <div className="mine-profile-header">
        <span className="mine-avatar" aria-hidden="true">{displayName[0] ?? "游"}</span>
        <div className="mine-profile-copy">
          <strong>{displayName}</strong>
          <span className="mine-profile-tags">
            {preferenceTags.length === 0 ? <em>{t("mine.noPrefs")}</em> : preferenceTags.map((tag) => <em key={tag}>{tag}</em>)}
          </span>
        </div>
      </div>

      <div className="day-tabs" aria-label={t("mine.dayTabs")}>
        {trip.days.map((day) => (
          <button
            className={selectedDay === day.dayNumber ? "is-active" : undefined}
            key={day.dayNumber}
            type="button"
            onClick={() => onSelectDay(day.dayNumber)}
          >
            <CalendarDays aria-hidden="true" size={15} />{t("common.dayN", { n: day.dayNumber })}<small>{day.date ?? t("mine.dateOpen")}</small>
          </button>
        ))}
      </div>

      <div className="mine-tab-toggle" role="group" aria-label="日程列表类型">
        <button type="button" className={activeTab === "stops" ? "is-active" : undefined} aria-pressed={activeTab === "stops"} onClick={() => setActiveTab("stops")}>{t("mine.stopsTab")}</button>
        <button type="button" className={activeTab === "reservations" ? "is-active" : undefined} aria-pressed={activeTab === "reservations"} onClick={() => setActiveTab("reservations")}>{t("mine.reservationsTab")}</button>
      </div>

      <DayEditor
        day={trip.days.find((day) => day.dayNumber === selectedDay) ?? null}
        busy={busy}
        onSave={(fields) => itineraryEditing.onEditDay(selectedDay, fields)}
      />

      {message && <div className="status-banner" role="status"><Check aria-hidden="true" size={18} />{message}</div>}

      <div className="mine-grid">
        {activeTab === "stops" && (
        <section className="itinerary-panel" aria-label={t("mine.stopsTab")}>
          {dayStops.length === 0 ? (
            <button className="mine-add-entry" type="button" onClick={() => navigate("/attractions")}>
              <Plus aria-hidden="true" size={18} />
              <span>{t("mine.addPlaceEntry")}</span>
              <small>{t("mine.noStops")}</small>
            </button>
          ) : (
            <ol className="mine-stop-list">
              {dayStops.map((stop) => (
                <li key={stop.id}>
                  <button className="mine-stop-card" type="button" onClick={() => stop.placeId && onSelectPlace(stop.placeId)}>
                    {stop.placeId && <img src={resolvePlaceImage(stop.placeId)} alt="" />}
                    <span className="mine-stop-copy">
                      <strong>{stop.name}{stop.privatePlaceId && <span className="private-badge">{t("map.private")}</span>}</strong>
                      <small>{stop.startTime ? stop.startTime.slice(0, 5) : t("map.timeOpen")} · {stop.durationMinutes ?? 90} {t("map.minutes")}</small>
                    </span>
                  </button>
                  <button className="remove-stop" type="button" aria-label={`${t("common.remove")} ${stop.name}`} onClick={() => void onRemoveStop(stop.id)}><Trash2 aria-hidden="true" size={16} /></button>
                </li>
              ))}
            </ol>
          )}
        </section>
        )}

        <section className="assistant-card" aria-labelledby="assistant-heading">
          <div className="assistant-icon"><Sparkles aria-hidden="true" size={22} /></div>
          <div><span className="eyebrow">{t("mine.assistantEyebrow")}</span><h2 id="assistant-heading">{pendingSuggestion ? t("mine.assistantReady") : t("mine.assistantPrompt")}</h2></div>
          {pendingSuggestion ? (
            <SuggestionPanel
              suggestion={pendingSuggestion}
              busy={busy === "confirm"}
              onConfirm={() => void onConfirm(pendingSuggestion)}
            />
          ) : (
            <>
              <p>{t("mine.assistantBody")}</p>
              <button className="assistant-button" disabled={trip.stops.length === 0 || busy === "suggest"} type="button" onClick={() => void onSuggest()}>
                {busy === "suggest" ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : <Sparkles aria-hidden="true" size={18} />}
                {t("mine.reviewDay")}
              </button>
            </>
          )}
        </section>

        {activeTab === "reservations" && (
        <section className="reservation-panel" aria-labelledby="reservations-heading">
          <div className="section-heading"><div><span className="eyebrow">{t("mine.bookingLog")}</span><h2 id="reservations-heading">{t("mine.reservations")}</h2></div><span className="count-chip">{t("mine.savedCount", { n: (trip.reservations ?? []).length })}</span></div>
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
  const { t } = useLocale()
  const checked = sharing.snapshot?.enabled ?? false
  const waiting = sharing.status === "loading" || sharing.status === "enabling" || sharing.status === "revoke-pending"
  const unavailable = mode === "preview"
    || (sharing.status === "dependency-unavailable" && !sharing.snapshot)
    || sharing.status === "revoke-failed"
  const recipients = Math.max(0, (sharing.snapshot?.activeMemberCount ?? 1) - 1)

  let statusText = t("mine.shareOff")
  let statusIsError = false
  if (mode === "preview") statusText = t("mine.sharePreview")
  else if (sharing.status === "loading") statusText = t("mine.shareChecking")
  else if (sharing.status === "enabling") statusText = t("mine.shareStarting")
  else if (sharing.status === "sharing") {
    statusText = recipients === 0
      ? t("mine.shareNoPeers")
      : t("mine.shareWith", { n: recipients })
  } else if (sharing.status === "expired") statusText = t("mine.shareExpired")
  else if (sharing.status === "permission-denied") {
    statusText = checked
      ? t("mine.shareDeniedActive")
      : t("mine.shareDeniedOff")
    statusIsError = true
  } else if (sharing.status === "upload-failed") {
    statusText = t("mine.shareUploadFailed")
    statusIsError = true
  } else if (sharing.status === "revoke-pending") statusText = t("mine.shareRevoking")
  else if (sharing.status === "revoke-failed") {
    statusText = t("mine.shareRevokeFailed")
    statusIsError = true
  } else if (sharing.status === "dependency-unavailable") {
    statusText = checked
      ? t("mine.shareDepActive")
      : t("mine.shareDepInactive")
    statusIsError = true
  }

  return (
    <section className="location-sharing-card" aria-labelledby="location-sharing-heading">
      <div className="location-sharing-heading">
        <div className="location-sharing-title">
          <LocateFixed aria-hidden="true" size={22} />
          <div><span className="eyebrow">{t("mine.locationEyebrow")}</span><h2 id="location-sharing-heading">{t("mine.currentLocation")}</h2></div>
        </div>
        <button
          aria-checked={checked}
          aria-label={t("mine.shareCurrent")}
          className="location-sharing-switch"
          disabled={waiting || unavailable}
          role="switch"
          type="button"
          onClick={() => void (checked ? sharing.onDisable() : sharing.onEnable())}
        >
          <span aria-hidden="true" />
        </button>
      </div>
      <strong className="location-sharing-label">{t("mine.shareCurrent")}</strong>
      <ul className="location-sharing-limits">
        <li>{t("mine.onlyWhileOpen")}</li>
        <li>{t("mine.visibleToMembers")}</li>
        <li>{t("mine.onePoint")}</li>
      </ul>
      <p className="location-safety-note">{t("mine.safetyNote")}</p>
      <div className={statusIsError ? "location-sharing-status is-error" : "location-sharing-status"} role={statusIsError ? "alert" : "status"}>
        {waiting && <LoaderCircle className="spin" aria-hidden="true" size={17} />}
        <span>{statusText}</span>
      </div>
      {sharing.snapshot && <small className="location-member-count">{t("mine.activeMembers", { n: sharing.snapshot.activeMemberCount })}</small>}
      {sharing.status === "revoke-failed" && (
        <button className="secondary-button location-retry-button" type="button" onClick={() => void sharing.onRetryDisable()}>
          {t("mine.retryRevoke")}
        </button>
      )}
    </section>
  )
}

const emptyReservation: ReservationInput = { category: "attraction", title: "", dayNumber: null, placeId: null, startsAt: null, endsAt: null, status: "planned", provider: null, confirmationCode: null, notes: "" }

function asLocalDateTime(value: string | null) {
  return value ? value.slice(0, 16) : ""
}

function ReservationManager({ busy, days, reservations, onCreate, onDraft, onUpdate, onRemove }: {  busy: string | null; days: TripSnapshot["days"]; reservations: TripReservation[]
  onCreate: (input: ReservationInput) => Promise<void>
  onDraft: (sourceText: string) => Promise<ReservationDraft | null>
  onUpdate: (id: string, input: ReservationInput) => Promise<void>; onRemove: (id: string) => Promise<void>
}) {
  const { t } = useLocale()
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
    if (!draft.title.trim()) return setFormError(t("mine.requireName"))
    if (draft.startsAt && draft.endsAt && draft.endsAt < draft.startsAt) return setFormError(t("mine.timeOrder"))
    setFormError(null)
    if (editingId) await onUpdate(editingId, draft)
    else await onCreate(draft)
    closeForm()
  }
  async function draftFromText() {
    if (!draftText.trim()) return setDraftNote(t("mine.draftNeedText"))
    setDrafting(true)
    setDraftNote(null)
    try {
      const parsed = await onDraft(draftText)
      if (!parsed) { setDraftNote(t("mine.draftFailed")); return }
      setDraft((current) => ({ ...current, ...parsed }))
      setDraftNote(t("mine.draftNote"))
    } finally {
      setDrafting(false)
    }
  }

  return (
    <div className="reservation-manager">
      <button className="primary-button reservation-add-button" type="button" onClick={startCreate}><Plus aria-hidden="true" size={16} />{t("mine.addReservation")}</button>
      {reservations.length === 0 ? (
        <p className="reservation-empty">{t("mine.noReservations")}</p>
      ) : (
        <ol className="reservation-list mine-reservation-window">{reservations.map((reservation) => <li key={reservation.id}><div className="reservation-card-copy"><strong>{reservation.title}</strong><span>{reservation.category === "restaurant" ? t("mine.restaurant") : reservation.category === "accommodation" ? t("mine.hotel") : t("mine.ticket")}{reservation.startsAt ? ` · ${new Date(reservation.startsAt).toLocaleString()}` : ""}</span>{reservation.provider && <small>{reservation.provider}{reservation.confirmationCode ? ` · ${reservation.confirmationCode}` : ""}</small>}</div><div className="reservation-actions"><button type="button" aria-label={`${t("common.details")} ${reservation.title}`} onClick={() => startEdit(reservation)}><Pencil aria-hidden="true" size={15} /></button><button className="remove-stop" type="button" aria-label={`${t("common.remove")} ${reservation.title}`} disabled={busy === "remove-reservation"} onClick={() => void onRemove(reservation.id)}><Trash2 aria-hidden="true" size={15} /></button></div></li>)}</ol>
      )}

      <BottomSheet open={formOpen} title={editingId ? t("mine.editReservation") : t("mine.addReservation")} onClose={closeForm}>
        <button className="secondary-button" type="button" onClick={() => setShowDraft((current) => !current)}>{t("mine.aiDraft")}</button>
        {showDraft && (
          <div className="reservation-draft-form">
            <label>{t("mine.aiDraft")}<textarea value={draftText} onChange={(event) => setDraftText(event.target.value)} placeholder={t("mine.aiDraftPlaceholder")} /></label>
            <button className="secondary-button" type="button" disabled={drafting} onClick={() => void draftFromText()}>{drafting ? <LoaderCircle className="spin" size={16} /> : <Sparkles size={16} />}{t("mine.generateDraft")}</button>
          </div>
        )}
        {draftNote && <p className="account-status" role="status">{draftNote}</p>}
        <div className="reservation-form" aria-label={editingId ? t("mine.editReservation") : t("mine.addReservation")}>
          <label>{t("mine.resType")}<select value={draft.category} onChange={(event) => setField("category", event.target.value as ReservationInput["category"])}><option value="restaurant">{t("mine.restaurant")}</option><option value="accommodation">{t("mine.hotel")}</option><option value="attraction">{t("mine.ticket")}</option></select></label>
          <label>{t("mine.resName")}<input value={draft.title} maxLength={200} onChange={(event) => setField("title", event.target.value)} /></label>
          <label>{t("mine.resDay")}<select value={draft.dayNumber ?? ""} onChange={(event) => setField("dayNumber", event.target.value ? Number(event.target.value) : null)}><option value="">{t("mine.noDay")}</option>{days.map((day) => <option key={day.id} value={day.dayNumber}>{t("common.dayN", { n: day.dayNumber })}</option>)}</select></label>
          <label>{t("mine.resCode")}<input value={draft.confirmationCode ?? ""} maxLength={200} onChange={(event) => setField("confirmationCode", event.target.value || null)} /></label>
          <label>{t("mine.resProvider")}<input value={draft.provider ?? ""} maxLength={200} onChange={(event) => setField("provider", event.target.value || null)} /></label>
          <label>{t("mine.resStart")}<input type="datetime-local" value={asLocalDateTime(draft.startsAt)} onChange={(event) => setField("startsAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
          <label>{t("mine.resEnd")}<input type="datetime-local" value={asLocalDateTime(draft.endsAt)} onChange={(event) => setField("endsAt", event.target.value ? new Date(event.target.value).toISOString() : null)} /></label>
          <label>{t("mine.resNotes")}<textarea value={draft.notes} maxLength={4000} onChange={(event) => setField("notes", event.target.value)} /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </div>
        <button className="bottom-sheet-primary" type="button" disabled={saving} onClick={() => void submit()}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t("mine.saveReservation")}</button>
      </BottomSheet>
    </div>
  )
}

function SuggestionPanel({ suggestion, busy, onConfirm }: { suggestion: AgentSuggestion; busy: boolean; onConfirm: () => void }) {
  const { t } = useLocale()
  return (
    <div className="suggestion-panel">
      <p>{suggestion.reason}</p>
      <ul>
        {suggestion.changes.map((change, index) => (
          <li key={`${change.op}-${index}`}>
            <Check aria-hidden="true" size={15} />
            {change.op === "update_stop" ? t("mine.stopStartsAt", { n: index + 1, time: change.startTime }) : t("mine.updateOrder")}
          </li>
        ))}
      </ul>
      {suggestion.risks[0] && <div className="risk-note"><strong>{t("mine.beforeConfirm")}</strong><span>{suggestion.risks[0]}</span></div>}
      <button className="primary-button" type="button" disabled={busy} onClick={onConfirm}>
        {busy ? <LoaderCircle className="spin" aria-hidden="true" size={18} /> : <Check aria-hidden="true" size={18} />}
        {t("mine.confirmChanges")}
      </button>
    </div>
  )
}

function DayEditor({ day, busy, onSave }: { day: TripSnapshot["days"][number] | null; busy: string | null; onSave: (fields: DayEditFields) => Promise<void> }) {
  const { t } = useLocale()
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
    <section className="day-editor" aria-label={t("mine.dayDetails", { n: day?.dayNumber ?? "" })}>
      <div className="form-heading"><strong>{t("mine.dayDetails", { n: day?.dayNumber ?? "" })}</strong></div>
      <div className="day-editor-fields">
        <label>{t("mine.date")}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>{t("mine.titleField")}<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={t("common.dayN", { n: day?.dayNumber ?? "" })} /></label>
      </div>
      <label>{t("mine.notesField")}<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder={t("mine.notesPlaceholder")} /></label>
      <button className="secondary-button" type="button" disabled={saving || busy !== null} onClick={() => void save()}>
        {saving ? <LoaderCircle className="spin" size={16} /> : <Check size={16} />}{t("mine.saveDayDetails")}
      </button>
    </section>
  )
}

function PrivatePlacesCard({ mode, controls, selectedDay }: { mode: AppMode; controls: PrivatePlacesControls; selectedDay: number }) {
  const { t } = useLocale()
  const [name, setName] = useState("")
  const [type, setType] = useState<PrivatePlaceInput["type"]>("other")
  const [address, setAddress] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  if (mode === "preview") {
    return (
      <section className="account-card private-places-card" aria-labelledby="private-places-heading">
        <div className="section-heading">
          <div><span className="eyebrow">{t("mine.privateEyebrow")}</span><h2 id="private-places-heading">{t("mine.hotelsStops")}</h2></div>
        </div>
        <p className="account-signin-note">{t("mine.privateSigninNote")}</p>
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
        <div><span className="eyebrow">{t("mine.privateEyebrow")}</span><h2 id="private-places-heading">{t("mine.hotelsStops")}</h2></div>
      </div>
      <div className="private-place-form">
        <label>{t("mine.privateName")}<input value={name} maxLength={200} onChange={(event) => setName(event.target.value)} placeholder={t("mine.privateNamePlaceholder")} /></label>
        <div className="profile-row">
          <label>{t("mine.placeType")}
            <select value={type} onChange={(event) => setType(event.target.value as PrivatePlaceInput["type"])}>
              <option value="other">{t("mine.typeOther")}</option><option value="hotel">{t("mine.typeHotel")}</option>
              <option value="restaurant">{t("mine.typeRestaurant")}</option><option value="meeting_point">{t("mine.typeMeeting")}</option>
            </select>
          </label>
          <label>{t("mine.address")}<input value={address} maxLength={400} onChange={(event) => setAddress(event.target.value)} placeholder={t("mine.addressOptional")} /></label>
        </div>
        <label>{t("mine.notesField")}<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder={t("mine.addressOptional")} /></label>
        <button className="secondary-button" type="button" disabled={saving || !name.trim()} onClick={() => void create()}>
          {saving ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}{t("mine.addPrivatePlace")}
        </button>
      </div>
      {controls.places.length > 0 && (
        <ul className="member-list">
          {controls.places.map((place) => (
            <li key={place.id}>
              <div className="member-copy">
                <strong>{place.name}</strong>
                <span>{place.type.replace("_", " ")}{place.address ? ` · ${place.address}` : ""}{place.coordinate ? "" : ` · ${t("mine.noCoordinate")}`}</span>
              </div>
              <button className="add-private-stop" type="button" onClick={() => void controls.onAddToDay(place.id, selectedDay)}>{t("mine.addToDayN", { n: selectedDay })}</button>
            </li>
          ))}
        </ul>
      )}
      <small className="private-places-note">{t("mine.privateNote")}</small>
    </section>
  )
}
