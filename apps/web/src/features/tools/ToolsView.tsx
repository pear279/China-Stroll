import { ArrowLeftRight, Check, Copy, ExternalLink, Languages, LoaderCircle, MapPinned, Phone, WalletCards } from "lucide-react"
import { useState } from "react"
import type { ExchangeQuote, Locale, PlaceSummary, TranslationResult } from "../../../../../packages/shared/src"
import type { AppMode } from "../../app-shell/types"
import { commonPhrases, exchangeCurrencies, paymentGuidance, serviceContacts } from "../../data/toolsContent"
import { api } from "../../lib/api"
import { amapSearchUrl, appleMapsUrl, didiWebUrl, googleMapsUrl } from "../../lib/navigation"

type ToolsViewProps = {
  mode: AppMode
  accessToken: string | null
  places: PlaceSummary[]
}

export function ToolsView({ mode, accessToken, places }: ToolsViewProps) {
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "")

  return (
    <section className="module-view tools-view" aria-labelledby="tools-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">Practical support</span>
          <h1 id="tools-heading">Travel tools</h1>
          <p>Navigation, payment guidance, translation, and verified service numbers.</p>
        </div>
      </header>

      <div className="tool-grid">
        <NavigationSection places={places} placeId={placeId} onPlace={setPlaceId} />
        <PaymentSection />
        <TranslationSection mode={mode} accessToken={accessToken} />
        <ServiceHelpSection />
      </div>
    </section>
  )
}

function NavigationSection({ places, placeId, onPlace }: { places: PlaceSummary[]; placeId: string; onPlace: (id: string) => void }) {
  const place = places.find((item) => item.id === placeId) ?? null
  return (
    <article className="tool-card">
      <MapPinned aria-hidden="true" size={24} />
      <div><span className="eyebrow">Navigation and rides</span><h2>Open a reviewed place</h2></div>
      <label className="tool-select">
        Choose a place
        <select value={placeId} onChange={(event) => onPlace(event.target.value)}>
          {places.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
      </label>
      {place?.coordinate ? (
        <nav className="tool-links" aria-label="Navigation providers">
          <a href={appleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Apple Maps<ExternalLink aria-hidden="true" size={14} /></a>
          <a href={googleMapsUrl(place.name, place.coordinate)} target="_blank" rel="noreferrer">Google Maps<ExternalLink aria-hidden="true" size={14} /></a>
          <a href={amapSearchUrl(place.name)} target="_blank" rel="noreferrer">Amap<ExternalLink aria-hidden="true" size={14} /></a>
        </nav>
      ) : (
        <p className="tool-status">This place has no reviewed coordinate, so navigation links are unavailable.</p>
      )}
      <a className="tool-ride-link" href={didiWebUrl()} target="_blank" rel="noreferrer">Open Didi ride-hailing<ExternalLink aria-hidden="true" size={14} /></a>
      <small>Ride-hailing opens the provider's site or app. China Stroll does not create a booking.</small>
    </article>
  )
}

function PaymentSection() {
  const [base, setBase] = useState("CNY")
  const [quote, setQuote] = useState("USD")
  const [state, setState] = useState<{ status: "idle" | "loading" | "ready" | "unavailable"; quote: ExchangeQuote | null }>({ status: "idle", quote: null })

  async function fetchRate() {
    setState({ status: "loading", quote: null })
    try {
      const result = await api.getExchangeRate(base, quote)
      setState(result.available ? { status: "ready", quote: result.quote } : { status: "unavailable", quote: null })
    } catch {
      setState({ status: "unavailable", quote: null })
    }
  }

  return (
    <article className="tool-card">
      <WalletCards aria-hidden="true" size={24} />
      <div><span className="eyebrow">Payment and exchange</span><h2>{paymentGuidance.title}</h2></div>
      <p>{paymentGuidance.summary}</p>
      <ol className="tool-steps">
        {paymentGuidance.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <div className="exchange-controls">
        <label>From
          <select value={base} onChange={(event) => setBase(event.target.value)}>
            {exchangeCurrencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
          </select>
        </label>
        <label>To
          <select value={quote} onChange={(event) => setQuote(event.target.value)}>
            {exchangeCurrencies.map((currency) => <option key={currency.code} value={currency.code}>{currency.label}</option>)}
          </select>
        </label>
        <button className="secondary-button" type="button" disabled={state.status === "loading"} onClick={() => void fetchRate()}>
          {state.status === "loading" ? <LoaderCircle className="spin" size={16} /> : null}Get rate
        </button>
      </div>
      {state.status === "ready" && state.quote && (
        <p className="exchange-result" role="status">
          1 {state.quote.base} ≈ {state.quote.rate} {state.quote.quote} · {state.quote.provider} · {new Date(state.quote.retrievedAt).toLocaleTimeString()}
        </p>
      )}
      {state.status === "unavailable" && (
        <p className="tool-status" role="status">Live rates are unavailable right now. The payment guidance above still applies.</p>
      )}
      <small>{paymentGuidance.note}</small>
    </article>
  )
}

function TranslationSection({ mode, accessToken }: { mode: AppMode; accessToken: string | null }) {
  const [text, setText] = useState("")
  const [from, setFrom] = useState<Locale>("en")
  const [to, setTo] = useState<Locale>("zh-CN")
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle")
  const [copied, setCopied] = useState(false)

  const signedIn = mode === "account" && Boolean(accessToken)

  async function translate() {
    if (!signedIn || !text.trim()) return
    setStatus("loading")
    setCopied(false)
    try {
      setResult(await api.translateText(accessToken as string, text, from, to))
      setStatus("idle")
    } catch {
      setResult(null)
      setStatus("error")
    }
  }

  async function copyResult() {
    if (!result) return
    try {
      await navigator.clipboard?.writeText(result.translatedText)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className="tool-card">
      <Languages aria-hidden="true" size={24} />
      <div><span className="eyebrow">Translation and conversation</span><h2>Translate text</h2></div>
      {!signedIn ? (
        <p className="tool-status">Translation needs a signed-in account. Common phrases below stay available offline.</p>
      ) : (
        <>
          <label>Your text<textarea value={text} maxLength={4000} onChange={(event) => setText(event.target.value)} placeholder="Type or paste text to translate" /></label>
          <div className="translation-controls">
            <label>From
              <select value={from} onChange={(event) => setFrom(event.target.value as Locale)}>
                <option value="en">English</option><option value="zh-CN">中文</option>
              </select>
            </label>
            <button className="swap-button" type="button" aria-label="Swap languages" onClick={() => { setFrom(to); setTo(from) }}><ArrowLeftRight size={16} /></button>
            <label>To
              <select value={to} onChange={(event) => setTo(event.target.value as Locale)}>
                <option value="en">English</option><option value="zh-CN">中文</option>
              </select>
            </label>
          </div>
          <button className="secondary-button" type="button" disabled={status === "loading" || !text.trim()} onClick={() => void translate()}>
            {status === "loading" ? <LoaderCircle className="spin" size={16} /> : <Languages size={16} />}Translate
          </button>
          {status === "error" && <p className="tool-status" role="alert">Translation is temporarily unavailable. Common phrases remain usable.</p>}
          {result && (
            <div className="translation-result" role="status">
              <p>{result.translatedText}</p>
              <button type="button" onClick={() => void copyResult()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button>
            </div>
          )}
        </>
      )}
      <div className="phrase-pack">
        <strong>Common phrases</strong>
        <ul>
          {commonPhrases.map((phrase) => (
            <li key={phrase.en}><span>{phrase.en}</span><strong>{phrase.zh}</strong><small>{phrase.pinyin}</small></li>
          ))}
        </ul>
      </div>
    </article>
  )
}

function ServiceHelpSection() {
  return (
    <article className="tool-card emergency-card">
      <Phone aria-hidden="true" size={24} />
      <div><span className="eyebrow">Service help</span><h2>Emergency and helplines</h2></div>
      <nav aria-label="Emergency phone numbers">
        {serviceContacts.emergency.map((contact) => (
          <a key={contact.number} href={contact.href}>{contact.label} {contact.number}</a>
        ))}
      </nav>
      <nav aria-label="Service helplines">
        {serviceContacts.helplines.map((contact) => (
          <a key={contact.number} href={contact.href}>{contact.label} {contact.number}</a>
        ))}
      </nav>
      <small>{serviceContacts.note}</small>
    </article>
  )
}
