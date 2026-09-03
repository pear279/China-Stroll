import { ChevronRight, ExternalLink, Languages, Phone } from "lucide-react"
import { useState } from "react"
import { Link } from "react-router-dom"
import { useLocale, type TranslationKey } from "../../lib/i18n"
import { hotlineCategories, navigationLinks, paymentLinks, rideLinks, type LinkIcon } from "../../data/toolsContent"

export function ToolsView() {
  const { t } = useLocale()

  return (
    <section className="module-view tools-view" aria-labelledby="tools-heading">
      <header className="tools-heading">
        <h1 id="tools-heading">{t("tools.title")}</h1>
      </header>

      <div className="tool-stack">
        <CompactLinkSection title={t("tools.navigation")} links={navigationLinks} />
        <CompactLinkSection title={t("tools.ride")} links={rideLinks} />
        <CompactLinkSection title={t("tools.payment")} links={paymentLinks} columns={2} />
        <TranslationAIEntry />
        <ServiceHelpSection />
      </div>
    </section>
  )
}

function CompactLinkSection({ title, links, columns = 3 }: { title: string; links: LinkIcon[]; columns?: 2 | 3 }) {
  return (
    <section className="tool-section" aria-labelledby={`tool-${title}`}>
      <h2 id={`tool-${title}`}>{title}</h2>
      <div className={`tool-links${columns === 2 ? " is-two" : ""}`}>
        {links.map((link) => (
          <a key={link.label} className="tool-link" href={link.url} target="_blank" rel="noreferrer">
            <span className="tool-link-monogram" aria-hidden="true">{link.label[0]}</span>
            <strong>{link.label}</strong>
            <ExternalLink className="tool-link-ext" aria-hidden="true" size={13} />
          </a>
        ))}
      </div>
    </section>
  )
}

function TranslationAIEntry() {
  const { t } = useLocale()
  return (
    <Link className="tool-ai-entry" to="/tools/translation">
      <span className="tool-ai-icon" aria-hidden="true"><Languages size={22} /></span>
      <span className="tool-ai-copy">
        <strong>{t("tools.translationAi")}</strong>
        <small>{t("tools.translationAiSub")}</small>
      </span>
      <ChevronRight className="tool-ai-chevron" aria-hidden="true" size={20} />
    </Link>
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
            <span className="hotline-name" title={item.label}>{item.label}</span>
            <a className="hotline-number" href={item.href}>{item.number}</a>
            <a className="hotline-call" href={item.href} aria-label={t("tools.callLabel", { name: item.label })}><Phone aria-hidden="true" size={15} />{t("tools.call")}</a>
          </div>
        ))}
      </div>
    </section>
  )
}
