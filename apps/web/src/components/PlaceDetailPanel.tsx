import {
  ArrowLeft,
  Bookmark,
  CalendarCheck,
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  DoorOpen,
  ExternalLink,
  Info,
  Landmark,
  LoaderCircle,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Ticket,
  type LucideIcon,
} from "lucide-react"
import { FormEvent, KeyboardEvent, ReactNode, useEffect, useRef, useState } from "react"
import { BottomSheet } from "./BottomSheet"
import {
  type GuideSource,
  resolvePlaceImage,
  type PlaceDetail,
  type PlaceGuideResponse,
  type PlaceQuestionResponse,
  type PlaceSummary,
  type TripDay,
} from "../../../../packages/shared/src"
import type { PlaceRepository } from "../data/placeRepository"
import { amapSearchUrl, appleMapsUrl, baiduMapsUrl, googleMapsUrl } from "../lib/navigation"
import { useLocale } from "../lib/i18n"
import { PlaceSources, type PlaceDisplaySource } from "./PlaceSources"

type Props = {
  place: PlaceSummary
  days: TripDay[]
  planned: boolean
  repository: PlaceRepository
  saved: boolean
  onClose: () => void
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
  onAddDay: () => Promise<number | null>
  onToggleSaved: (placeId: string) => Promise<void>
}

type InfoItem = {
  id: string
  icon: LucideIcon
  title: string
  content: ReactNode
}

export function PlaceDetailPanel({
  place,
  days,
  planned,
  repository,
  saved,
  onClose,
  onAdd,
  onAddDay,
  onToggleSaved,
}: Props) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [guide, setGuide] = useState<PlaceGuideResponse | null>(null)
  const [audience, setAudience] = useState<"general" | "child">("general")
  const [showDaySheet, setShowDaySheet] = useState(false)
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null)
  const [openGuideId, setOpenGuideId] = useState<number | null>(null)
  const [showSources, setShowSources] = useState(false)
  const [question, setQuestion] = useState("")
  const [questionResponse, setQuestionResponse] = useState<PlaceQuestionResponse | null>(null)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [busy, setBusy] = useState<string | null>(null)
  const detailRequestId = useRef(0)
  const questionRequestId = useRef(0)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const { t } = useLocale()

  function toGuideDisplaySources(sources: GuideSource[]): PlaceDisplaySource[] {
    return sources
      .filter((source): source is PlaceGuideResponse["sources"][number] & { url: string } => Boolean(source.url))
      .map((source) => ({
        id: `guide-${source.id}`,
        name: source.name,
        url: source.url,
        publishedAt: null,
        checkedAt: source.checkedAt,
        reviewDueAt: source.reviewDueAt,
        needsRecheck: source.needsRecheck,
        sourceType: "reviewed-reference",
      }))
  }

  function formatDateTime(value: string | null) {
    return value ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : t("detail.timeUnavailable")
  }

  function formatUpdated(value: string | null | undefined) {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return value.slice(0, 10)
    return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  function questionModeLabel(response: PlaceQuestionResponse) {
    if (response.answerMode === "reviewed-local" || response.answerMode === "model-grounded-local") {
      return t("detail.fromReviewed")
    }
    if (response.answerMode === "web-grounded") {
      return t("detail.webInformation")
    }
    if (response.dependencyStatus === "search-unavailable") {
      return t("detail.searchUnavailable")
    }
    if (response.dependencyStatus === "no-reliable-sources") {
      return t("detail.noReliableSources")
    }
    return response.answer
  }

  useEffect(() => {
    const requestId = detailRequestId.current + 1
    detailRequestId.current = requestId
    setStatus("loading")
    setQuestionResponse(null)
    setQuestionError(null)
    Promise.all([
      repository.getPlace(place.id),
      repository.getGuide(place.id, "en", audience),
    ])
      .then(([nextDetail, nextGuide]) => {
        if (detailRequestId.current !== requestId) return
        setDetail(nextDetail)
        setGuide(nextGuide)
        setStatus("ready")
      })
      .catch(() => {
        if (detailRequestId.current !== requestId) return
        setDetail(null)
        setGuide(null)
        setStatus("failed")
      })
    return () => {
      detailRequestId.current += 1
      questionRequestId.current += 1
    }
  }, [audience, place.id, repository])

  useEffect(() => {
    closeButtonRef.current?.focus()
  }, [])

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    try { await task() } finally { setBusy(null) }
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault()
    if (!question.trim()) return
    const requestId = questionRequestId.current + 1
    questionRequestId.current = requestId
    await run("question", async () => {
      try {
        const response = await repository.askPlace({
          placeId: place.id,
          locale: "en",
          question: question.trim(),
        })
        if (questionRequestId.current !== requestId) return
        setQuestionResponse(response)
        setQuestionError(null)
      } catch {
        if (questionRequestId.current !== requestId) return
        setQuestionResponse(null)
        setQuestionError(t("detail.questionFailed"))
      }
    })
  }

  function trapFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab" || !dialogRef.current) {
      return
    }

    const focusableElements = [...dialogRef.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )]

    if (focusableElements.length === 0) {
      event.preventDefault()
      return
    }

    const first = focusableElements[0]
    const last = focusableElements[focusableElements.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
      return
    }

    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  const guideSources = guide ? toGuideDisplaySources(guide.sources) : []
  const visitInformation = detail?.visitInformation ?? null

  const infoItems: InfoItem[] = []
  if (detail) {
    if (detail.history) infoItems.push({ id: "history", icon: Landmark, title: t("detail.history"), content: <p>{detail.history}</p> })
    if (detail.visitorTips) infoItems.push({ id: "visit-advice", icon: Compass, title: t("detail.visitAdvice"), content: <p>{detail.visitorTips}</p> })
    if (detail.practicalNotes) infoItems.push({ id: "practical-notes", icon: Info, title: t("detail.practicalNotes"), content: <p>{detail.practicalNotes}</p> })
    if (detail.photoSpotNotes) infoItems.push({ id: "photo-notes", icon: Camera, title: t("detail.photoNotes"), content: <p>{detail.photoSpotNotes}</p> })
    if (detail.highlights.length > 0) {
      infoItems.push({
        id: "highlights",
        icon: Sparkles,
        title: t("detail.highlights"),
        content: <ul className="info-sheet-list">{detail.highlights.map((item) => <li key={item}>{item}</li>)}</ul>,
      })
    }
    if (visitInformation) {
      if (visitInformation.address) infoItems.push({ id: "address", icon: MapPin, title: t("detail.address"), content: <p>{visitInformation.address}</p> })
      if (visitInformation.openingHoursText) {
        infoItems.push({
          id: "hours",
          icon: Clock3,
          title: t("detail.hours"),
          content: (
            <>
              <p>{visitInformation.openingHoursText}</p>
              {visitInformation.needsRecheck && <p className="detail-warning">{t("detail.openingRecheck")}</p>}
            </>
          ),
        })
      }
      if (visitInformation.ticketNotes) {
        infoItems.push({
          id: "tickets",
          icon: Ticket,
          title: t("detail.tickets"),
          content: (
            <>
              <p>{visitInformation.ticketNotes}</p>
              {visitInformation.bookingUrl && (
                <a className="detail-inline-link" href={visitInformation.bookingUrl} target="_blank" rel="noreferrer">
                  {t("detail.bookingPage")} <ExternalLink aria-hidden="true" size={14} />
                </a>
              )}
            </>
          ),
        })
      }
      if (visitInformation.reservationNotes) infoItems.push({ id: "reservation", icon: CalendarCheck, title: t("detail.reservation"), content: <p>{visitInformation.reservationNotes}</p> })
      if (visitInformation.entranceNotes) infoItems.push({ id: "entrance", icon: DoorOpen, title: t("detail.entrance"), content: <p>{visitInformation.entranceNotes}</p> })
    }
  }

  const activeInfo = activeInfoId ? infoItems.find((item) => item.id === activeInfoId) ?? null : null

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        className={showDaySheet || activeInfo ? "detail-panel is-locked" : "detail-panel"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
        onKeyDown={trapFocus}
      >
        <div className="detail-hero-wrap">
          <button ref={closeButtonRef} className="detail-back" type="button" onClick={onClose} aria-label={t("common.back")}><ArrowLeft size={20} /></button>
          <img className="detail-hero" src={resolvePlaceImage(place.id)} alt={`${place.name} display artwork`} />
        </div>
        <div className="detail-content">
          <span className="eyebrow">{t("detail.eyebrow")}</span>
          <h2 id="place-detail-title">{detail?.name ?? place.name}</h2>
          <p className="detail-intro">{detail?.shortIntro ?? place.shortIntro}</p>
          <div className="detail-actions">
            <button type="button" className={saved ? "is-active" : ""} disabled={busy === "save"} onClick={() => void run("save", () => onToggleSaved(place.id))}>
              {saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? t("detail.favorited") : t("detail.favorite")}
            </button>
            <button type="button" disabled={planned || busy === "add"} onClick={() => setShowDaySheet(true)}>
              {planned ? <Check size={17} /> : <Plus size={17} />}{planned ? t("attr.planned") : t("attr.joinItinerary")}
            </button>
          </div>

          <BottomSheet open={showDaySheet} title={t("attr.joinItinerary")} onClose={() => setShowDaySheet(false)}>
            {days.map((day) => (
              <button key={day.id} type="button" className="bottom-sheet-option" onClick={() => void run("add", async () => { await onAdd(place.id, day.dayNumber); setShowDaySheet(false) })}>
                {t("common.dayN", { n: day.dayNumber })}{day.date ? ` · ${day.date}` : ""}
              </button>
            ))}
            <button type="button" className="bottom-sheet-primary" onClick={() => void run("add", async () => { const nextDay = await onAddDay(); if (nextDay) await onAdd(place.id, nextDay); setShowDaySheet(false) })}>
              <Plus size={16} />{t("detail.createDay")}
            </button>
            <button type="button" className="bottom-sheet-secondary" onClick={() => setShowDaySheet(false)}>{t("common.cancel")}</button>
          </BottomSheet>

          {activeInfo && (
            <BottomSheet open title={activeInfo.title} onClose={() => setActiveInfoId(null)}>
              <div className="info-sheet-content">{activeInfo.content}</div>
            </BottomSheet>
          )}

          {detail && infoItems.length > 0 && (
            <div className="detail-info-grid">
              {infoItems.map((item) => (
                <button key={item.id} className="detail-info-item" type="button" onClick={() => setActiveInfoId(item.id)}>
                  <item.icon aria-hidden="true" size={18} />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          )}

          <div className="guide-heading">
            <h3>{t("detail.guide")}</h3>
            <div className="guide-mode-toggle" role="group" aria-label={t("detail.guideMode")}>
              <button type="button" className={audience === "general" ? "is-active" : undefined} aria-pressed={audience === "general"} onClick={() => { setAudience("general"); setOpenGuideId(null) }}>{t("detail.standard")}</button>
              <button type="button" className={audience === "child" ? "is-active" : undefined} aria-pressed={audience === "child"} onClick={() => { setAudience("child"); setOpenGuideId(null) }}>{t("detail.kids")}</button>
            </div>
          </div>
          {status === "loading" && <p className="detail-state"><LoaderCircle className="spin" size={18} />{t("detail.loadingGuide")}</p>}
          {status === "failed" && <p className="detail-state">{t("detail.guideUnavailable")}</p>}
          {guide?.segments.map((segment) => {
            const expanded = openGuideId === segment.id
            return (
              <div className="guide-accordion-item" key={segment.id}>
                <button className="guide-accordion-header" type="button" aria-expanded={expanded} onClick={() => setOpenGuideId(expanded ? null : segment.id)}>
                  <span>{segment.title ?? segment.type}</span>
                  {expanded ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
                </button>
                {expanded && <p className="guide-accordion-body">{segment.content}</p>}
              </div>
            )
          })}

          {guideSources.length > 0 && (
            <div className="guide-sources-block">
              <button className="sources-toggle" type="button" aria-expanded={showSources} onClick={() => setShowSources((current) => !current)}>
                <span>{t("detail.sourcesLastUpdated")}</span>
                {showSources ? <ChevronUp aria-hidden="true" size={18} /> : <ChevronDown aria-hidden="true" size={18} />}
              </button>
              {showSources && (
                <div className="sources-body">
                  <ul className="sources-list">
                    {guideSources.map((source) => (
                      <li key={source.id}>
                        <a href={source.url} target="_blank" rel="noreferrer">{source.name} <ExternalLink aria-hidden="true" size={13} /></a>
                      </li>
                    ))}
                  </ul>
                  {place.reviewedAt && <small className="sources-updated">{t("detail.updatedAt", { date: formatUpdated(place.reviewedAt) })}</small>}
                </div>
              )}
            </div>
          )}

          <form className="place-question" onSubmit={submitQuestion}>
            <label htmlFor="place-question">{t("detail.askAbout")}</label>
            <div>
              <input id="place-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={t("detail.askPlaceholderQ")} />
              <button type="submit" aria-label={t("detail.askAria")} disabled={!question.trim() || busy === "question"}>
                {busy === "question" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
              </button>
            </div>
            <small>{t("detail.askNote")}</small>
            {questionError && <p className="place-answer place-answer-error" role="status">{questionError}</p>}
            {questionResponse && (
              <div className="place-answer" role="status" aria-live="polite">
                <strong className="place-answer-label">{questionModeLabel(questionResponse)}</strong>
                {questionResponse.answerMode === "web-grounded" && (
                  <p className="place-answer-meta">{t("detail.retrieved", { time: formatDateTime(questionResponse.searchedAt) })}</p>
                )}
                {questionResponse.warning && <p className="place-answer-meta">{questionResponse.warning}</p>}
                {(questionResponse.answerMode === "reviewed-local"
                  || questionResponse.answerMode === "model-grounded-local"
                  || questionResponse.answerMode === "web-grounded") && (
                  <p>{questionResponse.answer}</p>
                )}
                {questionResponse.sources.length > 0 && <PlaceSources sources={questionResponse.sources} />}
              </div>
            )}
          </form>

          {place.coordinate && <nav className="navigation-links" aria-label={t("detail.openNavigation")}><a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps <ExternalLink size={14} /></a><a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={14} /></a><a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">{t("map.amap")} <ExternalLink size={14} /></a><a href={baiduMapsUrl(place.name)} target="_blank" rel="noreferrer">{t("map.baidu")} <ExternalLink size={14} /></a></nav>}
        </div>
      </section>
    </div>
  )
}
