import { ArrowLeft, ExternalLink, LoaderCircle, MessageCircle, Send } from "lucide-react"
import { useState } from "react"
import type { AppMode } from "../../app-shell/types"
import { commonPhrases, hotlineCategories, navigationLinks, paymentGuidance, paymentLinks, rideLinks, serviceNote, type LinkIcon } from "../../data/toolsContent"
import { api } from "../../lib/api"

type ToolsViewProps = {
  mode: AppMode
  accessToken: string | null
}

export function ToolsView({ mode, accessToken }: ToolsViewProps) {
  const [showChat, setShowChat] = useState(false)

  return (
    <section className="module-view tools-view" aria-labelledby="tools-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">工具</span>
          <h1 id="tools-heading">工具</h1>
        </div>
      </header>

      <div className="tool-stack">
        <LinkSection title="导航" links={navigationLinks} />
        <LinkSection title="打车" links={rideLinks} note="跳转第三方平台，China Stroll 不代下单。" />
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
  return (
    <section className="tool-section" aria-labelledby="tool-payment">
      <h2 id="tool-payment">支付</h2>
      <div className="tool-icon-links">
        {paymentLinks.map((link) => (
          <a key={link.label} href={link.url} target="_blank" rel="noreferrer">
            <span className="tool-link-monogram" aria-hidden="true">{link.label[0]}</span>
            <strong>{link.label}</strong>
            <ExternalLink aria-hidden="true" size={14} />
          </a>
        ))}
      </div>
      <p className="tool-section-copy">{paymentGuidance.summary}</p>
      <small className="tool-section-note">{paymentGuidance.note}</small>
    </section>
  )
}

function TranslationSection({ mode, accessToken, onOpenChat }: { mode: AppMode; accessToken: string | null; onOpenChat: () => void }) {
  const [selectedPhrase, setSelectedPhrase] = useState<string | null>(null)
  const signedIn = mode === "account" && Boolean(accessToken)

  return (
    <section className="tool-section" aria-labelledby="tool-translation">
      <h2 id="tool-translation">AI翻译 / 对话</h2>

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
      <small className="tool-section-note">点击常用语显示对应中文，便于展示给当地人看。</small>

      <button className="tool-chat-button" type="button" onClick={onOpenChat}>
        <MessageCircle aria-hidden="true" size={17} />
        AI问答
        {!signedIn && <small>需登录</small>}
      </button>
    </section>
  )
}

function ServiceHelpSection() {
  return (
    <section className="tool-section" aria-labelledby="tool-service">
      <h2 id="tool-service">服务热线</h2>
      {hotlineCategories.map((category) => (
        <div key={category.label} className="hotline-category">
          <h3>{category.label}</h3>
          <div className="hotline-items">
            {category.items.map((item) => (
              <a key={`${category.label}-${item.number}`} href={item.href}>
                <span>{item.label}</span>
                <strong>{item.number}</strong>
              </a>
            ))}
          </div>
        </div>
      ))}
      <small className="tool-section-note">{serviceNote}</small>
    </section>
  )
}

type ChatMessage = { role: "user" | "assistant"; content: string }

function ChatPanel({ accessToken, onClose }: { accessToken: string | null; onClose: () => void }) {
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
      setMessages((current) => [...current, { role: "assistant", content: "暂时无法回答，请稍后再试。" }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="chat-overlay">
      <header className="chat-header">
        <button type="button" aria-label="返回" onClick={onClose}><ArrowLeft size={20} /></button>
        <strong>AI问答</strong>
      </header>
      <div className="chat-messages" role="log">
        {messages.length === 0 && <p className="chat-empty">问一问出行、语言、文化等日常问题。</p>}
        {messages.map((message, index) => (
          <div key={index} className={message.role === "user" ? "chat-bubble chat-bubble--user" : "chat-bubble"}>{message.content}</div>
        ))}
        {busy && <div className="chat-bubble"><LoaderCircle className="spin" size={15} /></div>}
      </div>
      <form className="chat-input" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="输入问题…" aria-label="输入问题" />
        <button type="submit" disabled={busy || !input.trim()} aria-label="发送"><Send size={17} /></button>
      </form>
    </div>
  )
}
