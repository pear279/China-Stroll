import { ArrowLeft, ArrowUp, Check, ChevronRight, LoaderCircle, Plus } from "lucide-react"
import { useRef, useState } from "react"
import { Link } from "react-router-dom"
import type { AppMode } from "../../app-shell/types"
import type { Phrase } from "../../../../../packages/shared/src"
import { useLocale } from "../../lib/i18n"
import { commonPhrases } from "../../data/toolsContent"
import { api } from "../../lib/api"

type TranslationAIViewProps = {
  mode: AppMode
  accessToken: string | null
}

type Tab = "translate" | "chat"

type PhraseItem = Phrase & { id: string }

const defaultPhrases: PhraseItem[] = commonPhrases.map((phrase) => ({ ...phrase, id: `default-${phrase.en}` }))

export function TranslationAIView({ mode, accessToken }: TranslationAIViewProps) {
  const { t } = useLocale()
  const [tab, setTab] = useState<Tab>("translate")
  const signedIn = mode === "account" && Boolean(accessToken)

  return (
    <section className="module-view tools-view tools-ai-view" aria-labelledby="translation-heading">
      <header className="tools-ai-header">
        <div className="tools-ai-topbar">
          <Link className="tools-back" to="/tools" aria-label={t("common.back")}><ArrowLeft size={20} /></Link>
          <h1 id="translation-heading">{t("tools.translationAi")}</h1>
        </div>
        <div className="tools-mode-segment" role="tablist" aria-label={t("tools.modeTabs")}>
          <button type="button" role="tab" aria-selected={tab === "translate"} className={tab === "translate" ? "is-active" : undefined} onClick={() => setTab("translate")}>{t("tools.aiTranslation")}</button>
          <button type="button" role="tab" aria-selected={tab === "chat"} className={tab === "chat" ? "is-active" : undefined} onClick={() => setTab("chat")}>{t("tools.chat")}</button>
        </div>
      </header>

      <div hidden={tab !== "translate"}>
        <TranslationPanel signedIn={signedIn} accessToken={accessToken} />
      </div>
      <div hidden={tab !== "chat"}>
        <ChatPanel signedIn={signedIn} accessToken={accessToken} />
      </div>
    </section>
  )
}

type TranslationDraft = { en: string; zh: string; added: boolean }

function TranslationPanel({ signedIn, accessToken }: { signedIn: boolean; accessToken: string | null }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [phrases, setPhrases] = useState<PhraseItem[]>(defaultPhrases)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draft, setDraft] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<TranslationDraft | null>(null)

  async function translate() {
    const text = draft.trim()
    if (!text || busy || !signedIn) return
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const response = await api.translateText(accessToken as string, text, "en", "zh-CN")
      setResult({ en: text, zh: response.translatedText, added: false })
    } catch {
      setError(t("tools.translateError"))
    } finally {
      setBusy(false)
    }
  }

  function addPhrase() {
    if (!result) return
    const alreadyAdded = phrases.some((phrase) => phrase.en.trim().toLowerCase() === result.en.toLowerCase() && phrase.zh === result.zh)
    if (alreadyAdded) {
      setResult({ ...result, added: true })
      return
    }
    setPhrases((current) => [{ id: crypto.randomUUID(), en: result.en, zh: result.zh, pinyin: "" }, ...current])
    setResult({ ...result, added: true })
  }

  return (
    <div className="tools-ai-body">
      <div className="phrase-create">
        <button type="button" className="phrase-create-toggle" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <Plus aria-hidden="true" size={18} />
          {t("tools.createPhrase")}
        </button>
        {open && (
          <div className="phrase-create-body">
            <form className="translate-form" onSubmit={(event) => { event.preventDefault(); void translate() }}>
              <input className="translate-input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t("tools.translatePlaceholder")} aria-label={t("tools.translatePlaceholder")} />
              <button type="submit" className="translate-submit" disabled={!signedIn || busy || !draft.trim()}>{t("tools.translateAction")}</button>
            </form>
            {!signedIn && <p className="translate-hint">{t("tools.signInHint")}</p>}
            {error && <p className="translate-error" role="alert">{error}</p>}
            {result && (
              <div className="translate-result">
                <span className="translate-result-label">{t("tools.translationResultLabel")}</span>
                <p className="translate-result-text">{result.zh}</p>
                <button type="button" className="add-phrase-button" disabled={result.added} onClick={addPhrase}>
                  {result.added ? <Check aria-hidden="true" size={16} /> : <Plus aria-hidden="true" size={16} />}
                  {result.added ? t("tools.added") : t("tools.addPhrase")}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="phrase-heading">{t("tools.phrases")}</p>
        <div className="phrase-cards">
          {phrases.map((phrase) => (
            <PhraseCard
              key={phrase.id}
              phrase={phrase}
              expanded={expandedId === phrase.id}
              onToggle={() => setExpandedId((current) => current === phrase.id ? null : phrase.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PhraseCard({ phrase, expanded, onToggle }: { phrase: PhraseItem; expanded: boolean; onToggle: () => void }) {
  return (
    <div className={`phrase-card${expanded ? " is-open" : ""}`}>
      <button type="button" className="phrase-card-main" aria-expanded={expanded} onClick={onToggle}>
        <span>{phrase.en}</span>
        <ChevronRight aria-hidden="true" size={18} />
      </button>
      {expanded && (
        <div className="phrase-card-zh">
          <strong>{phrase.zh}</strong>
          {phrase.pinyin && <small>{phrase.pinyin}</small>}
        </div>
      )}
    </div>
  )
}

type ChatMessage = { role: "user" | "assistant"; content: string }

function ChatPanel({ signedIn, accessToken }: { signedIn: boolean; accessToken: string | null }) {
  const { t } = useLocale()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  function autoGrow() {
    const element = inputRef.current
    if (!element) return
    element.style.height = "auto"
    element.style.height = `${Math.min(element.scrollHeight, 104)}px`
  }

  async function send() {
    if (!signedIn || !accessToken || !input.trim() || busy) return
    const text = input.trim()
    setInput("")
    if (inputRef.current) inputRef.current.style.height = "auto"
    setMessages((current) => [...current, { role: "user", content: text }])
    setBusy(true)
    try {
      const reply = await api.chat(accessToken, text)
      setMessages((current) => [...current, { role: "assistant", content: reply.reply }])
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: t("tools.chatError") }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" role="log">
        {messages.length === 0 && <p className="chat-empty">{signedIn ? t("tools.chatEmpty") : t("tools.signInHint")}</p>}
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble"}>{message.content}</div>
        ))}
        {busy && <div className="chat-bubble"><LoaderCircle className="spin" size={15} /></div>}
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(event) => { setInput(event.target.value); autoGrow() }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault()
              void send()
            }
          }}
          placeholder={t("tools.chatPlaceholder")}
          aria-label={t("tools.chatPlaceholder")}
        />
        <button type="submit" disabled={!signedIn || busy || !input.trim()} aria-label={t("tools.chatSend")}><ArrowUp size={20} /></button>
      </form>
    </div>
  )
}
