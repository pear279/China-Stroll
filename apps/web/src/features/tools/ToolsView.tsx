import { ArrowLeft, ExternalLink, LoaderCircle, MessageCircle, Send } from "lucide-react"
import { useState } from "react"
import type { AppMode } from "../../app-shell/types"
import { useLocale, type TranslationKey } from "../../lib/i18n"
import { commonPhrases, hotlineCategories, navigationLinks, paymentLinks, rideLinks, type LinkIcon } from "../../data/toolsContent"
import { api } from "../../lib/api"

type ToolsViewProps = {
  mode: AppMode
  accessToken: string | null
}

export function ToolsView({ mode, accessToken }: ToolsViewProps) {
  const { t } = useLocale()
  const [showChat, setShowChat] = useState(false)

  return (
    <section className="module-view tools-view" aria-labelledby="tools-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">{t("tools.eyebrow")}</span>
          <h1 id="tools-heading">{t("tools.title")}</h1>
        </div>
      </header>

      <div className="tool-stack">
        <LinkSection title={t("tools.navigation")} links={navigationLinks} />
        <LinkSection title={t("tools.ride")} links={rideLinks} note={t("tools.thirdPartyNote")} />
        <PaymentSection />
        <TranslationSection mode={mode} accessToken={accessToken} onOpenChat={() => setShowChat(true)} />
        <ServiceHelpSection />
      </div>

      {showChat && <ChatPanel accessToken={accessToken} onClose={() => setShowChat(false)} />}
    </section>
  )
}

function LinkSection({ title, links, note }: { title: string; links: LinkIcon[]; note?: string }) {
  return (
    <section className="tool-section" aria-labelledby={`tool-${title}`}>
      <h2 id={`tool-${title}`}>{title}</h2>
      <div className="tool-icon-links">
        {links.map((link) => (
          <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
            <span className="tool-link-monogram" aria-hidden="true">{link.label[0]}</span>
            <strong>{link.label}</strong>
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
      {note && <small className="tool-section-note">{note}</small>}
    </section>
  )
}

function PaymentSection() {
  const { t } = useLocale()
  return (
    <section className="tool-section" aria-labelledby="tool-payment">
      <h2 id="tool-payment">{t("tools.payment")}</h2>
      <div className="tool-icon-links">
        {paymentLinks.map((link) => (
          <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
            <span className="tool-link-monogram" aria-hidden="true">{link.label[0]}</span>
            <strong>{link.label}</strong>
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
      <p className="tool-section-copy">{t("tools.paymentSummary")}</p>
      <small className="tool-section-note">{t("tools.paymentNote")}</small>
    </section>
  )
}

function TranslationSection({ mode, accessToken, onOpenChat }: { mode: AppMode; accessToken: string | null; onOpenChat: () => void }) {
  const { t } = useLocale()
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null)
  const signedIn = mode === "account" && Boolean(accessToken)

  return (
    <section className="tool-section" aria-labelledby="tool-translation">
      <h2 id="tool-translation">{t("tools.translate")}</h2>

      <div className="phrase-list">
        {commonPhrases.map((phrase) => {
          const expanded = selectedPhrase === phrase.en
          return (
            <button key={phrase.en} type="button" className={expanded ? "is-expanded" : undefined} onClick={() => setSelectedPhrase(expanded ? null : phrase.en)}>
              <span>{phrase.en}</span>
              {expanded ? <strong>{phrase.zh}</strong> : null}
              {expanded && <small>{phrase.pinyin}</small>}
            </button>
          )
        })}
      </div>
      <small className="tool-section-note">{t("tools.phraseNote")}</small>

      <button className="tool-chat-button" type="button" onClick={onOpenChat}>
        <MessageCircle aria-hidden="true" size={17} />
        {t("tools.chat")}
        {!signedIn && <small>{t("tools.needLogin")}</small>}
      </button>
    </section>
  )
}

const hotlineCategoryKeys: Record<string, TranslationKey> = {
  "常用": "tools.hotlineCommon",
  "景点": "tools.hotlineAttractions",
  "饭店": "tools.hotlineRestaurants",
  "酒店": "tools.hotlineHotels",
}

function ServiceHelpSection() {
  const { t } = useLocale()
  const [activeCategory, setActiveCategory] = useState(hotlineCategories[0].label)
  const category = hotlineCategories.find((item) => item.label === activeCategory) ?? hotlineCategories[0]

  return (
    <section className="tool-section" aria-labelledby="tool-service">
      <h2 id="tool-service">{t("tools.hotlines")}</h2>
      <div className="hotline-segment" role="tablist" aria-label={t("tools.hotlineTabs")}>
        {hotlineCategories.map((item) => (
          <button key={item.label} type="button" role="tab" aria-selected={activeCategory === item.label} className={activeCategory === item.label ? "is-active" : undefined} onClick={() => setActiveCategory(item.label)}>{t(hotlineCategoryKeys[item.label])}</button>
        ))}
      </div>
      <div className="hotline-items">
        {category.items.map((item) => (
          <div key={`${category.label}-${item.number}`} className="hotline-item">
            <div className="hotline-item-copy">
              <span>{item.label}</span>
              <strong>{item.number}</strong>
            </div>
            <a href={item.href} className="hotline-call" aria-label={t("tools.callLabel", { name: item.label })}>{t("tools.call")}</a>
          </div>
        ))}
      </div>
      <small className="tool-section-note">{t("tools.serviceNote")}</small>
    </section>
  )
}

type ChatMessage = { role: "user" | "assistant"; content: string }

function ChatPanel({ accessToken, onClose }: { accessToken: string | null; onClose: () => void }) {
  const { t } = useLocale()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)

  async function send() {
    if (!accessToken || !input.trim() || busy) return
    const text = input.trim()
    setInput("")
    setMessages((current) => [...current, { role: "user", content: text }])
    setBusy(true)
    try {
      const result = await api.chat(accessToken, text)
      setMessages((current) => [...current, { role: "assistant", content: result.reply }])
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: t("tools.chatError") }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-overlay">
      <header className="chat-header">
        <button type="button" aria-label={t("common.back")} onClick={onClose}><ArrowLeft size={20} /></button>
        <strong>{t("tools.chatHeader")}</strong>
      </header>
      <div className="chat-messages" role="log">
        {messages.length === 0 && <p className="chat-empty">{t("tools.chatEmpty")}</p>}
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble"}>{message.content}</div>
        ))}
        {busy && <div className="chat-bubble"><LoaderCircle className="spin" size={15} /></div>}
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder={t("tools.chatInput")} aria-label={t("tools.chatInput")} />
        <button type="submit" disabled={busy || !input.trim()} aria-label={t("tools.chatSend")}><Send size={17} /></button>
      </form>
    </div>
  )
}
