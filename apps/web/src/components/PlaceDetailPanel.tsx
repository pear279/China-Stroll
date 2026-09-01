import { ArrowLeft, Bookmark, Check, ExternalLink, LoaderCircle, Plus, Send } from "lucide-react"
import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react"
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
import { amapSearchUrl, appleMapsUrl, googleMapsUrl } from "../lib/navigation"
import { PlaceSources, type PlaceDisplaySource } from "./PlaceSources"

type Props = {
  place: PlaceSummary
  days: TripDay[]
  planned: boolean
  repository: PlaceRepository
  saved: boolean
  onClose: () => void
  onAdd: (placeId: string, dayNumber: number) => Promise<void>
  onToggleSaved: (placeId: string) => Promise<void>
}

export function PlaceDetailPanel({
  place,
  days,
  planned,
  repository,
  saved,
  onClose,
  onAdd,
  onToggleSaved,
}: Props) {
  const [detail, setDetail] = useState<PlaceDetail | null>(null)
  const [guide, setGuide] = useState<PlaceGuideResponse | null>(null)
  const [audience, setAudience] = useState<"general" | "child">("general")
  const [dayNumber, setDayNumber] = useState(days[0]?.dayNumber ?? 1)
  const [question, setQuestion] = useState("")
  const [questionResponse, setQuestionResponse] = useState<PlaceQuestionResponse | null>(null)
  const [questionError, setQuestionError] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [busy, setBusy] = useState<string | null>(null)
  const detailRequestId = useRef(0)
  const questionRequestId = useRef(0)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)

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
    return value ? `${value.slice(0, 10)} ${value.slice(11, 16)}` : "time unavailable"
  }

  function questionModeLabel(response: PlaceQuestionResponse) {
    if (response.answerMode === "reviewed-local" || response.answerMode === "model-grounded-local") {
      return "From reviewed information"
    }
    if (response.answerMode === "web-grounded") {
      return "Web information"
    }
    if (response.dependencyStatus === "search-unavailable") {
      return "Online search requires the API service for questions not covered by the reviewed guide."
    }
    if (response.dependencyStatus === "no-reliable-sources") {
      return "No reliable sources were found, so this answer cannot be confirmed."
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
        setQuestionError("Questions are temporarily unavailable. Reviewed details and external links still work.")
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
  const detailSections = detail ? [
    { title: "History", content: detail.history },
    { title: "Visit advice", content: detail.visitorTips },
    { title: "Practical notes", content: detail.practicalNotes },
    { title: "Photo notes", content: detail.photoSpotNotes },
  ] : []
  const visitInformation = detail?.visitInformation ?? null

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section
        ref={dialogRef}
        className="detail-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="place-detail-title"
        onKeyDown={trapFocus}
      >
        <button ref={closeButtonRef} className="detail-back" type="button" onClick={onClose} aria-label="返回"><ArrowLeft size={20} /></button>
        <img className="detail-hero" src={resolvePlaceImage(place.id)} alt={`${place.name} display artwork`} />
        <div className="detail-content">
          <span className="eyebrow">Reviewed place guide</span>
          <h2 id="place-detail-title">{detail?.name ?? place.name}</h2>
          <p className="detail-intro">{detail?.shortIntro ?? place.shortIntro}</p>
          <div className="detail-actions">
            <button type="button" className={saved ? "is-active" : ""} disabled={busy === "save"} onClick={() => void run("save", () => onToggleSaved(place.id))}>
              {saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? "已收藏" : "收藏景点"}
            </button>
            <select aria-label="日程" value={dayNumber} onChange={(event) => setDayNumber(Number(event.target.value))}>
              {(days.length ? days : [{ id: 0, dayNumber: 1, date: null, title: null, notes: "" }]).map((day) => <option key={day.dayNumber} value={day.dayNumber}>第 {day.dayNumber} 天</option>)}
            </select>
            <button type="button" disabled={planned || busy === "add"} onClick={() => void run("add", () => onAdd(place.id, dayNumber))}>
              {planned ? <Check size={17} /> : <Plus size={17} />}{planned ? "已加入" : "加入日程"}
            </button>
          </div>

          {detail && (
            <div className="detail-facts">
              {detailSections.map((section) => (
                <div key={section.title}>
                  <h3>{section.title}</h3>
                  <p>{section.content}</p>
                </div>
              ))}
              {detail.highlights.length > 0 && <div><h3>Highlights</h3><ul>{detail.highlights.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              {visitInformation && (
                <>
                  <div>
                    <h3>Address</h3>
                    <p>{visitInformation.address}</p>
                  </div>
                  <div>
                    <h3>Hours</h3>
                    <p>{visitInformation.openingHoursText}</p>
                    {visitInformation.needsRecheck && (
                      <p className="detail-warning">Opening information needs rechecking</p>
                    )}
                  </div>
                  <div>
                    <h3>Tickets</h3>
                    <p>{visitInformation.ticketNotes}</p>
                    {visitInformation.bookingUrl && (
                      <a className="detail-inline-link" href={visitInformation.bookingUrl} target="_blank" rel="noreferrer">
                        Official booking page <ExternalLink aria-hidden="true" size={14} />
                      </a>
                    )}
                  </div>
                  <div>
                    <h3>Reservation</h3>
                    <p>{visitInformation.reservationNotes}</p>
                  </div>
                  <div>
                    <h3>Entrance</h3>
                    <p>{visitInformation.entranceNotes}</p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="guide-heading">
            <h3>景点导览</h3>
            <div className="guide-mode-toggle" role="group" aria-label="导览模式">
              <button type="button" className={audience === "general" ? "is-active" : undefined} aria-pressed={audience === "general"} onClick={() => setAudience("general")}>普通模式</button>
              <button type="button" className={audience === "child" ? "is-active" : undefined} aria-pressed={audience === "child"} onClick={() => setAudience("child")}>儿童模式</button>
            </div>
          </div>
          {status === "loading" && <p className="detail-state"><LoaderCircle className="spin" size={18} />Loading reviewed guide…</p>}
          {status === "failed" && <p className="detail-state">The detailed guide is unavailable. The place summary and navigation still work.</p>}
          {guide?.segments.map((segment) => <article className="guide-segment" key={segment.id}><h4>{segment.title ?? segment.type}</h4><p>{segment.content}</p></article>)}
          {guideSources.length > 0 && (
            <div className="guide-sources-block">
              <p className="guide-source">Reviewed sources</p>
              <PlaceSources sources={guideSources} />
            </div>
          )}

          <form className="place-question" onSubmit={submitQuestion}>
            <label htmlFor="place-question">Ask about this place</label>
            <div>
              <input id="place-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should I notice first?" />
              <button type="submit" aria-label="Ask" disabled={!question.trim() || busy === "question"}>
                {busy === "question" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}
              </button>
            </div>
            <small>Preview answers use reviewed local material first and cite any live web retrieval.</small>
            {questionError && <p className="place-answer place-answer-error" role="status">{questionError}</p>}
            {questionResponse && (
              <div className="place-answer" role="status" aria-live="polite">
                <strong className="place-answer-label">{questionModeLabel(questionResponse)}</strong>
                {questionResponse.answerMode === "web-grounded" && (
                  <p className="place-answer-meta">Retrieved {formatDateTime(questionResponse.searchedAt)}</p>
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

          {place.coordinate && <nav className="navigation-links" aria-label="Open external navigation"><a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps <ExternalLink size={14} /></a><a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={14} /></a><a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">Amap search <ExternalLink size={14} /></a></nav>}
        </div>
      </section>
    </div>
  )
}
