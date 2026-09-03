import { Check, ChevronLeft, ChevronRight, GripVertical, LoaderCircle, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { useNavigate } from "react-router-dom"
import { formatCategoryLabel, formatDurationHours, type Coordinate, type PlaceSummary, type ReservationDraft, type ReservationInput, type TripReservation, type TripSnapshot, type TripStop } from "../../../../../packages/shared/src"
import { haversineKilometres } from "../../lib/navigation"
import type { DayEditFields, ItineraryEditControls } from "../../app-shell/types"
import { BottomSheet } from "../../components/BottomSheet"
import { useLocale, type TranslationKey } from "../../lib/i18n"
import { addDays, addMonths, buildMonthDays, buildWeekDays, parseDateKey, toDateKey, WEEKDAY_LABELS, type CalendarDay } from "./itineraryCalendar"

export type ItinerarySectionProps = {
  busy: string | null
  message: string | null
  itineraryEditing: ItineraryEditControls
  places: PlaceSummary[]
  selectedDay: number
  trip: TripSnapshot
  userCoordinate: Coordinate | null
  completedStopIds: Set<string>
  completedReservationIds: Set<string>
  onAddDay: (date?: string | null) => Promise<number | null>
  onToggleStopCompleted: (stopId: string) => void
  onToggleReservationCompleted: (reservationId: string) => void
  onEditTripDates: (input: { startDate: string | null; endDate: string | null }) => Promise<void>
  onRemoveStop: (stopId: string) => Promise<void>
  onReorderStop: (stopId: string, targetIndex: number) => Promise<void>
  onCreateReservation: (input: ReservationInput) => Promise<void>
  onUpdateReservation: (reservationId: string, input: ReservationInput) => Promise<void>
  onRemoveReservation: (reservationId: string) => Promise<void>
  onSelectDay: (dayNumber: number) => void
}

export function ItinerarySection({
  busy,
  message,
  itineraryEditing,
  places,
  selectedDay,
  trip,
  userCoordinate,
  completedStopIds,
  completedReservationIds,
  onAddDay,
  onToggleStopCompleted,
  onToggleReservationCompleted,
  onEditTripDates,
  onRemoveStop,
  onReorderStop,
  onCreateReservation,
  onUpdateReservation,
  onRemoveReservation,
  onSelectDay,
}: ItinerarySectionProps) {
  const { t, locale } = useLocale()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<"week" | "month">("week")
  const [tab, setTab] = useState<"schedule" | "reservations">("schedule")
  const [editDayOpen, setEditDayOpen] = useState(false)
  const [editDatesOpen, setEditDatesOpen] = useState(false)

  const dayByNumber = useMemo(() => new Map(trip.days.map((day) => [day.dayNumber, day])), [trip.days])
  const selectedDayDate = dayByNumber.get(selectedDay)?.date ?? null
  const selectedDate = selectedDayDate ?? trip.startDate ?? toDateKey(new Date())
  const [anchorKey, setAnchorKey] = useState(selectedDate)

  const today = new Date()
  const anchor = parseDateKey(anchorKey)
  const calendarDays = viewMode === "week" ? buildWeekDays(anchor, today) : buildMonthDays(anchor, today)

  const contentDates = useMemo(() => {
    const dates = new Set<string>()
    for (const stop of trip.stops) {
      const date = dayByNumber.get(stop.dayNumber ?? 1)?.date
      if (date) dates.add(date)
    }
    for (const reservation of trip.reservations ?? []) {
      const date = dayByNumber.get(reservation.dayNumber ?? 1)?.date
      if (date) dates.add(date)
    }
    return dates
  }, [trip.stops, trip.reservations, dayByNumber])

  const dayStops = useMemo(
    () => [...trip.stops]
      .filter((stop) => (stop.dayNumber ?? 1) === selectedDay)
      .sort((left, right) => left.sortOrder - right.sortOrder),
    [trip.stops, selectedDay],
  )
  const selectedDayRecord = dayByNumber.get(selectedDay) ?? null

  function shift(direction: -1 | 1) {
    setAnchorKey(toDateKey(viewMode === "week" ? addDays(anchor, direction * 7) : addMonths(anchor, direction)))
  }

  async function selectDate(key: string) {
    setAnchorKey(key)
    const existing = trip.days.find((day) => day.date === key)
    if (existing) {
      onSelectDay(existing.dayNumber)
      return
    }
    const dayNumber = await onAddDay(key)
    if (dayNumber) onSelectDay(dayNumber)
  }

  return (
    <section className="mine-section itinerary-section" aria-labelledby="itinerary-section-heading">
      <div className="itinerary-heading-row">
        <h2 id="itinerary-section-heading" className="mine-section-title">{t("mine.myItinerary")}</h2>
        <button className="cal-edit-trip" type="button" aria-label={t("mine.editTripDates")} onClick={() => setEditDatesOpen(true)}>
          <Pencil aria-hidden="true" size={15} />
        </button>
      </div>

      {message && <div className="status-banner" role="status"><Check aria-hidden="true" size={18} />{message}</div>}

      <div className="cal-segment" role="group" aria-label={t("mine.calendarMode")}>
        <button type="button" className={viewMode === "week" ? "is-active" : undefined} aria-pressed={viewMode === "week"} onClick={() => setViewMode("week")}>{t("mine.week")}</button>
        <button type="button" className={viewMode === "month" ? "is-active" : undefined} aria-pressed={viewMode === "month"} onClick={() => setViewMode("month")}>{t("mine.month")}</button>
      </div>

      <div className="calendar-card">
        <div className="cal-toolbar">
          <button className="cal-nav" type="button" aria-label={t("mine.prevPeriod")} onClick={() => shift(-1)}><ChevronLeft aria-hidden="true" size={17} /></button>
          <span className="cal-title">{viewMode === "week" ? weekRangeTitle(calendarDays, locale) : monthTitle(anchor, locale)}</span>
          <button className="cal-nav" type="button" aria-label={t("mine.nextPeriod")} onClick={() => shift(1)}><ChevronRight aria-hidden="true" size={17} /></button>
        </div>
        <div className="cal-weekday-row" aria-hidden="true">
          {WEEKDAY_LABELS.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
        </div>
        <div className={viewMode === "week" ? "cal-grid cal-grid--week" : "cal-grid"}>
          {calendarDays.map((day) => (
            <CalendarCell
              key={day.key}
              day={day}
              selected={day.key === selectedDate}
              hasContent={contentDates.has(day.key)}
              locale={locale}
              onSelect={() => void selectDate(day.key)}
            />
          ))}
        </div>
      </div>

      <div className="cal-selected-row">
        <span className="cal-selected-date">{formatSelectedDate(selectedDate, locale)}</span>
        <button className="cal-edit-day" type="button" aria-label={t("mine.editDay")} onClick={() => setEditDayOpen(true)}>
          <MoreHorizontal aria-hidden="true" size={18} />
        </button>
      </div>

      <div className="cal-segment" role="group" aria-label={t("mine.contentMode")}>
        <button type="button" className={tab === "schedule" ? "is-active" : undefined} aria-pressed={tab === "schedule"} onClick={() => setTab("schedule")}>{t("mine.schedule")}</button>
        <button type="button" className={tab === "reservations" ? "is-active" : undefined} aria-pressed={tab === "reservations"} onClick={() => setTab("reservations")}>{t("mine.reservationsTab")}</button>
      </div>

      {tab === "schedule" ? (
        <>
          <button className="section-add-button" type="button" onClick={() => navigate("/attractions")}>
            <Plus aria-hidden="true" size={16} />{t("mine.addAttraction")}
          </button>
          {dayStops.length === 0 ? (
            <p className="list-empty" role="status">{t("mine.noPlacesPlanned")}</p>
          ) : (
            <ScheduleList
              stops={dayStops}
              places={places}
              userCoordinate={userCoordinate}
              completedStopIds={completedStopIds}
              onToggleCompleted={onToggleStopCompleted}
              onRemove={onRemoveStop}
              onReorder={onReorderStop}
            />
          )}
        </>
      ) : (
        <ReservationManager
          busy={busy}
          days={trip.days}
          reservations={(trip.reservations ?? []).filter((reservation) => reservation.dayNumber === selectedDay)}
          completedReservationIds={completedReservationIds}
          onToggleCompleted={onToggleReservationCompleted}
          onCreate={onCreateReservation}
          onDraft={itineraryEditing.onDraftReservation}
          onRemove={onRemoveReservation}
          onUpdate={onUpdateReservation}
        />
      )}

      <EditDaySheet
        open={editDayOpen}
        onClose={() => setEditDayOpen(false)}
        day={selectedDayRecord}
        busy={busy}
        onSave={(fields) => itineraryEditing.onEditDay(selectedDay, fields)}
      />
      <EditTripDatesSheet
        open={editDatesOpen}
        onClose={() => setEditDatesOpen(false)}
        startDate={trip.startDate}
        endDate={trip.endDate}
        onSave={onEditTripDates}
      />
    </section>
  )
}

function CalendarCell({ day, selected, hasContent, locale, onSelect }: {
  day: CalendarDay
  selected: boolean
  hasContent: boolean
  locale: "en" | "zh"
  onSelect: () => void
}) {
  const { t } = useLocale()
  const label = parseDateKey(day.key).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "long", day: "numeric", year: "numeric" })
  const className = [
    "cal-cell",
    !day.inCurrentMonth ? "is-muted" : undefined,
    selected ? "is-selected" : undefined,
    day.isToday ? "is-today" : undefined,
  ].filter(Boolean).join(" ")

  return (
    <button type="button" className={className} aria-pressed={selected} aria-label={day.isToday ? `${t("mine.today")} · ${label}` : label} onClick={onSelect}>
      <span className="cal-cell-num" aria-hidden="true">{day.day}</span>
      {hasContent && <span className="cal-cell-dot" aria-hidden="true" />}
    </button>
  )
}

const SCHEDULE_GAP = 8
const ITEM_STEP = 76

type DragState = { id: string; index: number; startY: number; dy: number; targetIndex: number; itemHeight: number }

function computeTargetIndex(clientY: number, dragId: string, stops: TripStop[], refs: Record<string, HTMLLIElement | null>) {
  let target = 0
  for (const stop of stops) {
    if (stop.id === dragId) continue
    const element = refs[stop.id]
    if (!element) continue
    const rect = element.getBoundingClientRect()
    if (rect.top + rect.height / 2 < clientY) target += 1
  }
  return Math.max(0, Math.min(stops.length - 1, target))
}

function shiftFor(index: number, drag: DragState | null) {
  if (!drag || index === drag.index) return 0
  if (drag.targetIndex > drag.index && index > drag.index && index <= drag.targetIndex) return -drag.itemHeight
  if (drag.targetIndex < drag.index && index >= drag.targetIndex && index < drag.index) return drag.itemHeight
  return 0
}

function stopMetaParts(stop: TripStop, place: PlaceSummary | undefined, userCoordinate: Coordinate | null): string[] {
  const parts: string[] = []
  if (place) parts.push(formatCategoryLabel(place.categoryCode))
  const duration = stop.durationMinutes ?? place?.durationMinutes ?? null
  if (duration != null && duration > 0) parts.push(formatDurationHours(duration))
  if (userCoordinate && stop.coordinate) parts.push(`${haversineKilometres(userCoordinate, stop.coordinate).toFixed(1)} km`)
  return parts
}

function ScheduleList({ stops, places, userCoordinate, completedStopIds, onToggleCompleted, onRemove, onReorder }: {
  stops: TripStop[]
  places: PlaceSummary[]
  userCoordinate: Coordinate | null
  completedStopIds: Set<string>
  onToggleCompleted: (stopId: string) => void
  onRemove: (stopId: string) => Promise<void>
  onReorder: (stopId: string, targetIndex: number) => Promise<void>
}) {
  const { t } = useLocale()
  const placeById = useMemo(() => new Map(places.map((place) => [place.id, place])), [places])
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  dragRef.current = drag
  const stopsRef = useRef(stops)
  stopsRef.current = stops
  const onReorderRef = useRef(onReorder)
  onReorderRef.current = onReorder
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({})

  useEffect(() => {
    function handleMove(event: PointerEvent) {
      const current = dragRef.current
      if (!current) return
      if (event.cancelable) event.preventDefault()
      const dy = event.clientY - current.startY
      const targetIndex = computeTargetIndex(event.clientY, current.id, stopsRef.current, rowRefs.current)
      setDrag({ ...current, dy, targetIndex })
    }
    function handleUp() {
      const current = dragRef.current
      if (!current) return
      setDrag(null)
      if (current.targetIndex !== current.index) {
        void onReorderRef.current(current.id, current.targetIndex)
      }
    }
    function handleCancel() {
      setDrag(null)
    }
    window.addEventListener("pointermove", handleMove)
    window.addEventListener("pointerup", handleUp)
    window.addEventListener("pointercancel", handleCancel)
    return () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleUp)
      window.removeEventListener("pointercancel", handleCancel)
    }
  }, [])

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, stop: TripStop) {
    if (event.pointerType === "mouse" && event.button !== 0) return
    const index = stopsRef.current.findIndex((item) => item.id === stop.id)
    const element = rowRefs.current[stop.id]
    const itemHeight = element ? element.getBoundingClientRect().height + SCHEDULE_GAP : ITEM_STEP
    event.preventDefault()
    setDrag({ id: stop.id, index, startY: event.clientY, dy: 0, targetIndex: index, itemHeight })
  }

  return (
    <ol className="schedule-list">
      {stops.map((stop, index) => {
        const isDragging = drag?.id === stop.id
        const shift = shiftFor(index, drag)
        const place = stop.placeId ? placeById.get(stop.placeId) : undefined
        const completed = completedStopIds.has(stop.id)
        const meta = stopMetaParts(stop, place, userCoordinate).join(" · ")
        return (
          <li
            key={stop.id}
            ref={(element) => { rowRefs.current[stop.id] = element }}
            className={`schedule-item${completed ? " is-completed" : ""}${isDragging ? " is-dragging" : ""}`}
            style={isDragging ? { transform: `translateY(${drag?.dy ?? 0}px)`, zIndex: 3 } : shift !== 0 ? { transform: `translateY(${shift}px)` } : undefined}
          >
            <button className="schedule-handle" type="button" aria-label={t("map.reorder", { name: stop.name })} onPointerDown={(event) => startDrag(event, stop)}>
              <GripVertical aria-hidden="true" size={16} />
            </button>
            <button
              className="task-checkbox"
              type="button"
              role="checkbox"
              aria-checked={completed}
              aria-label={completed ? t("mine.uncompleteStop", { name: stop.name }) : t("mine.completeStop", { name: stop.name })}
              onClick={() => onToggleCompleted(stop.id)}
            >
              {completed && <Check aria-hidden="true" size={14} />}
            </button>
            <div className="task-body">
              <strong className="task-name">{stop.name}{stop.privatePlaceId ? ` · ${t("map.private")}` : ""}</strong>
              {meta && <span className="task-meta">{meta}</span>}
            </div>
            <button className="task-remove" type="button" aria-label={`${t("common.remove")} ${stop.name}`} onClick={() => void onRemove(stop.id)}>
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function EditDaySheet({ open, onClose, day, busy, onSave }: {
  open: boolean
  onClose: () => void
  day: TripSnapshot["days"][number] | null
  busy: string | null
  onSave: (fields: DayEditFields) => Promise<void>
}) {
  const { t } = useLocale()
  const [date, setDate] = useState(day?.date ?? "")
  const [title, setTitle] = useState(day?.title ?? "")
  const [notes, setNotes] = useState(day?.notes ?? "")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setDate(day?.date ?? "")
    setTitle(day?.title ?? "")
    setNotes(day?.notes ?? "")
  }, [open, day?.date, day?.title, day?.notes])

  async function save() {
    setSaving(true)
    try {
      await onSave({ date: date || null, title: title.trim() || null, notes })
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} title={t("mine.editDay")} onClose={onClose}>
      <div className="edit-day-fields">
        <label>{t("mine.date")}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        <label>{t("mine.titleField")}<input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder={t("common.dayN", { n: day?.dayNumber ?? "" })} /></label>
        <label>{t("mine.notesField")}<input value={notes} maxLength={4000} onChange={(event) => setNotes(event.target.value)} placeholder={t("mine.notesPlaceholder")} /></label>
      </div>
      <button className="bottom-sheet-primary" type="button" disabled={saving || busy !== null} onClick={() => void save()}>
        {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t("common.save")}
      </button>
    </BottomSheet>
  )
}

function EditTripDatesSheet({ open, onClose, startDate, endDate, onSave }: {
  open: boolean
  onClose: () => void
  startDate: string | null
  endDate: string | null
  onSave: (input: { startDate: string | null; endDate: string | null }) => Promise<void>
}) {
  const { t } = useLocale()
  const [start, setStart] = useState(startDate ?? "")
  const [end, setEnd] = useState(endDate ?? "")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setStart(startDate ?? "")
    setEnd(endDate ?? "")
    setError(null)
  }, [open, startDate, endDate])

  async function save() {
    if (start && end && end < start) {
      setError(t("onboarding.datesInvalid"))
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onSave({ startDate: start || null, endDate: end || null })
    } finally {
      setSaving(false)
    }
  }

  return (
    <BottomSheet open={open} title={t("mine.editTripDates")} onClose={onClose}>
      <div className="edit-day-fields">
        <label>{t("mine.firstDay")}<input type="date" value={start} onChange={(event) => setStart(event.target.value)} /></label>
        <label>{t("mine.lastDay")}<input type="date" value={end} min={start || undefined} onChange={(event) => setEnd(event.target.value)} /></label>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="bottom-sheet-primary" type="button" disabled={saving} onClick={() => void save()}>
        {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t("common.save")}
      </button>
    </BottomSheet>
  )
}

function formatSelectedDate(key: string, locale: "en" | "zh"): string {
  return parseDateKey(key).toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { weekday: "short", month: "short", day: "numeric" })
}

function monthTitle(anchor: Date, locale: "en" | "zh"): string {
  return anchor.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", { month: "long", year: "numeric" })
}

function weekRangeTitle(days: CalendarDay[], locale: "en" | "zh"): string {
  const first = parseDateKey(days[0].key)
  const last = parseDateKey(days[days.length - 1].key)
  const options = { month: "short", day: "numeric" } as const
  const firstLabel = first.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", options)
  const lastLabel = last.toLocaleDateString(locale === "zh" ? "zh-CN" : "en-US", options)
  return `${firstLabel} – ${lastLabel}`
}

const emptyReservation: ReservationInput = { category: "attraction", title: "", dayNumber: null, placeId: null, startsAt: null, endsAt: null, status: "planned", provider: null, confirmationCode: null, notes: "" }

function timeFromIso(value: string | null): string {
  if (!value) return ""
  const date = new Date(value)
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function startsAtFromDayAndTime(dayDate: string | null | undefined, time: string): string | null {
  if (!dayDate || !time) return null
  const parsed = new Date(`${dayDate}T${time}`)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function reservationStatusKey(status: ReservationInput["status"]): TranslationKey {
  switch (status) {
    case "confirmed": return "mine.resStatusConfirmed"
    case "cancelled": return "mine.resStatusCancelled"
    case "completed": return "mine.resStatusCompleted"
    default: return "mine.resStatusPlanned"
  }
}

function ReservationManager({ busy, days, reservations, completedReservationIds, onToggleCompleted, onCreate, onDraft, onUpdate, onRemove }: {
  busy: string | null
  days: TripSnapshot["days"]
  reservations: TripReservation[]
  completedReservationIds: Set<string>
  onToggleCompleted: (reservationId: string) => void
  onCreate: (input: ReservationInput) => Promise<void>
  onDraft: (sourceText: string) => Promise<ReservationDraft | null>
  onUpdate: (id: string, input: ReservationInput) => Promise<void>
  onRemove: (id: string) => Promise<void>
}) {
  const { t, locale } = useLocale()
  const [draft, setDraft] = useState<ReservationInput>(emptyReservation)
  const [timeDraft, setTimeDraft] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [draftText, setDraftText] = useState("")
  const [showDraft, setShowDraft] = useState(false)
  const [drafting, setDrafting] = useState(false)
  const [draftNote, setDraftNote] = useState<string | null>(null)
  const saving = busy === "create-reservation" || busy === "update-reservation"

  function setField<Key extends keyof ReservationInput>(key: Key, value: ReservationInput[Key]) { setDraft((current) => ({ ...current, [key]: value })) }
  function startCreate() {
    setEditingId(null); setDraft(emptyReservation); setTimeDraft(""); setFormError(null); setDraftNote(null); setShowDraft(false)
    setFormOpen(true)
  }
  function startEdit(reservation: TripReservation) {
    setEditingId(reservation.id)
    setDraft({ ...reservation, startsAt: reservation.startsAt, endsAt: reservation.endsAt })
    setTimeDraft(timeFromIso(reservation.startsAt))
    setFormError(null); setDraftNote(null); setShowDraft(false)
    setFormOpen(true)
  }
  function closeForm() { setFormOpen(false); setEditingId(null); setDraft(emptyReservation); setTimeDraft(""); setFormError(null); setDraftNote(null) }
  async function submit() {
    if (!draft.title.trim()) return setFormError(t("mine.requireName"))
    setFormError(null)
    const day = days.find((item) => item.dayNumber === draft.dayNumber)
    const input = { ...draft, startsAt: startsAtFromDayAndTime(day?.date, timeDraft) }
    if (editingId) await onUpdate(editingId, input)
    else await onCreate(input)
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
      <button className="section-add-button" type="button" onClick={startCreate}>
        <Plus aria-hidden="true" size={16} />{t("mine.addReservation")}
      </button>

      {reservations.length === 0 ? (
        <p className="list-empty" role="status">{t("mine.noReservations")}</p>
      ) : (
        <ol className="reservation-list">
          {reservations.map((reservation) => {
            const completed = completedReservationIds.has(reservation.id)
            const meta = [reservation.startsAt ? new Date(reservation.startsAt).toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", { hour: "2-digit", minute: "2-digit" }) : null, t(reservationStatusKey(reservation.status))].filter(Boolean).join(" · ")
            return (
              <li key={reservation.id} className={`reservation-item${completed ? " is-completed" : ""}`}>
                <button className="task-checkbox" type="button" role="checkbox" aria-checked={completed} aria-label={completed ? t("mine.uncompleteStop", { name: reservation.title }) : t("mine.completeStop", { name: reservation.title })} onClick={() => onToggleCompleted(reservation.id)}>
                  {completed && <Check aria-hidden="true" size={14} />}
                </button>
                <button className="task-body task-body--clickable" type="button" onClick={() => startEdit(reservation)}>
                  <strong className="task-name">{reservation.title}</strong>
                  {meta && <span className="task-meta">{meta}</span>}
                </button>
                <button className="task-remove" type="button" aria-label={`${t("common.remove")} ${reservation.title}`} onClick={() => setConfirmId(reservation.id)}>
                  <Trash2 aria-hidden="true" size={15} />
                </button>
              </li>
            )
          })}
        </ol>
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
          <label>{t("mine.resType")}<select value={draft.category} onChange={(event) => setField("category", event.target.value as ReservationInput["category"])}><option value="accommodation">{t("mine.resTypeHotel")}</option><option value="restaurant">{t("mine.resTypeRestaurant")}</option><option value="attraction">{t("mine.resTypeAttraction")}</option><option value="activity">{t("mine.resTypeActivity")}</option><option value="transport">{t("mine.resTypeTransport")}</option></select></label>
          <label>{t("mine.resName")}<input value={draft.title} maxLength={200} onChange={(event) => setField("title", event.target.value)} /></label>
          <label>{t("mine.resDate")}<select value={draft.dayNumber ?? ""} onChange={(event) => setField("dayNumber", event.target.value ? Number(event.target.value) : null)}><option value="">{t("mine.noDay")}</option>{days.map((day) => <option key={day.id} value={day.dayNumber}>{day.date ? `${t("common.dayN", { n: day.dayNumber })} · ${day.date}` : t("common.dayN", { n: day.dayNumber })}</option>)}</select></label>
          <label>{t("mine.resTime")}<input type="time" value={timeDraft} onChange={(event) => setTimeDraft(event.target.value)} /></label>
          <label>{t("mine.resBookingNumber")}<input value={draft.confirmationCode ?? ""} maxLength={200} onChange={(event) => setField("confirmationCode", event.target.value || null)} /></label>
          <label>{t("mine.resPlace")}<input value={draft.provider ?? ""} maxLength={200} onChange={(event) => setField("provider", event.target.value || null)} /></label>
          <label>{t("mine.resNotes")}<textarea value={draft.notes} maxLength={4000} onChange={(event) => setField("notes", event.target.value)} /></label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
        </div>
        <button className="bottom-sheet-primary" type="button" disabled={saving} onClick={() => void submit()}>{saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t("mine.saveReservation")}</button>
      </BottomSheet>

      <BottomSheet open={confirmId !== null} title={t("mine.removeReservationTitle")} onClose={() => setConfirmId(null)}>
        <button className="bottom-sheet-primary" type="button" onClick={() => { const id = confirmId; setConfirmId(null); if (id) void onRemove(id) }}>{t("common.remove")}</button>
        <button className="bottom-sheet-secondary" type="button" onClick={() => setConfirmId(null)}>{t("common.cancel")}</button>
      </BottomSheet>
    </div>
  )
}
