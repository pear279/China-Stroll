import { Bookmark, Check, ExternalLink, LoaderCircle, Plus, Send, X } from "lucide-react"
import { FormEvent, useEffect, useState } from "react"
import { resolvePlaceImage, type PlaceDetail, type PlaceGuideResponse, type PlaceSummary, type TripDay } from "../../../../packages/shared/src"
import type { PlaceRepository } from "../data/placeRepository"
import { amapSearchUrl, appleMapsUrl, googleMapsUrl } from "../lib/navigation"

type Props = {
  place: PlaceSummary
  accessToken: string | null
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
  accessToken,
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
  const [answer, setAnswer] = useState<string | null>(null)
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading")
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setStatus("loading")
    setAnswer(null)
    Promise.all([
      repository.getPlace(place.id),
      repository.getGuide(place.id, "en", audience),
    ])
      .then(([nextDetail, nextGuide]) => {
        if (!active) return
        setDetail(nextDetail)
        setGuide(nextGuide)
        setStatus("ready")
      })
      .catch(() => {
        if (!active) return
        setDetail(null)
        setGuide(null)
        setStatus("failed")
      })
    return () => { active = false }
  }, [audience, place.id, repository])

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label)
    try { await task() } finally { setBusy(null) }
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault()
    if (!accessToken || !question.trim()) return
    await run("question", async () => {
      const response = await repository.askPlace({
        placeId: place.id,
        locale: "en",
        question: question.trim(),
      })
      setAnswer(response.answer)
    })
  }

  return (
    <div className="detail-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="detail-panel" role="dialog" aria-modal="true" aria-labelledby="place-detail-title">
        <button className="detail-close" type="button" onClick={onClose} aria-label="Close place details"><X size={20} /></button>
        <img className="detail-hero" src={resolvePlaceImage(place.id)} alt={`${place.name} display artwork`} />
        <div className="detail-content">
          <span className="eyebrow">Reviewed place guide</span>
          <h2 id="place-detail-title">{detail?.name ?? place.name}</h2>
          <p className="detail-intro">{detail?.shortIntro ?? place.shortIntro}</p>
          <div className="detail-actions">
            <button type="button" className={saved ? "is-active" : ""} disabled={busy === "save"} onClick={() => void run("save", () => onToggleSaved(place.id))}>
              {saved ? <Check size={17} /> : <Bookmark size={17} />}{saved ? "Saved" : "Save"}
            </button>
            <select aria-label="Trip day" value={dayNumber} onChange={(event) => setDayNumber(Number(event.target.value))}>
              {(days.length ? days : [{ id: 0, dayNumber: 1, date: null, title: null }]).map((day) => <option key={day.dayNumber} value={day.dayNumber}>Day {day.dayNumber}</option>)}
            </select>
            <button type="button" disabled={planned || busy === "add"} onClick={() => void run("add", () => onAdd(place.id, dayNumber))}>
              {planned ? <Check size={17} /> : <Plus size={17} />}{planned ? "Planned" : "Add to trip"}
            </button>
          </div>

          {detail && (
            <div className="detail-facts">
              {detail.highlights.length > 0 && <div><h3>Highlights</h3><ul>{detail.highlights.map((item) => <li key={item}>{item}</li>)}</ul></div>}
              {detail.visitorTips && <div><h3>Visit advice</h3><p>{detail.visitorTips}</p></div>}
              {detail.photoSpotNotes && <div><h3>Photo notes</h3><p>{detail.photoSpotNotes}</p></div>}
            </div>
          )}

          <div className="guide-heading">
            <h3>AI-ready audio guide</h3>
            <select value={audience} onChange={(event) => setAudience(event.target.value as "general" | "child")} aria-label="Guide audience">
              <option value="general">General</option><option value="child">For children</option>
            </select>
          </div>
          {status === "loading" && <p className="detail-state"><LoaderCircle className="spin" size={18} />Loading reviewed guide…</p>}
          {status === "failed" && <p className="detail-state">The detailed guide is unavailable. The place summary and navigation still work.</p>}
          {guide?.segments.map((segment) => <article className="guide-segment" key={segment.id}><h4>{segment.title ?? segment.type}</h4><p>{segment.content}</p></article>)}
          {guide && guide.sources.length > 0 && <p className="guide-source">Sources checked {guide.sources.map((source) => source.name).join(" · ")}</p>}

          <form className="place-question" onSubmit={submitQuestion}>
            <label htmlFor="place-question">Ask about this place</label>
            <div><input id="place-question" value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="What should I notice first?" disabled={!accessToken} /><button type="submit" disabled={!accessToken || !question.trim() || busy === "question"}>{busy === "question" ? <LoaderCircle className="spin" size={17} /> : <Send size={17} />}</button></div>
            {!accessToken && <small>Sign in to ask questions. Reviewed guide content remains public.</small>}
            {answer && <p className="place-answer">{answer}</p>}
          </form>

          {place.coordinate && <nav className="navigation-links" aria-label="Open external navigation"><a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps <ExternalLink size={14} /></a><a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps <ExternalLink size={14} /></a><a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">Amap search <ExternalLink size={14} /></a></nav>}
        </div>
      </section>
    </div>
  )
}
