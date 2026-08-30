import { Languages, MapPinned, Phone, ShieldCheck, WalletCards } from "lucide-react"

export function ToolsView() {
  return (
    <section className="module-view tools-view" aria-labelledby="tools-heading">
      <header className="module-heading">
        <div>
          <span className="eyebrow">Practical support</span>
          <h1 id="tools-heading">Travel tools</h1>
          <p>Fast access to navigation, payment guidance, language support, and verified emergency numbers.</p>
        </div>
      </header>

      <div className="tool-grid">
        <article className="tool-card">
          <MapPinned aria-hidden="true" size={24} />
          <div><span className="eyebrow">Navigation and rides</span><h2>Choose after selecting a place</h2></div>
          <p>Open Apple Maps, Google Maps, or Amap from a reviewed attraction. Ride-hailing provider integration is not connected yet.</p>
        </article>

        <article className="tool-card">
          <WalletCards aria-hidden="true" size={24} />
          <div><span className="eyebrow">Payment</span><h2>Keep a backup method</h2></div>
          <p>International cards may not work everywhere. Alipay and WeChat setup and merchant acceptance vary, so carry a backup payment method.</p>
        </article>

        <article className="tool-card">
          <Languages aria-hidden="true" size={24} />
          <div><span className="eyebrow">Exchange and translation</span><h2>Provider setup in progress</h2></div>
          <p>Exchange rate connection is being prepared</p>
          <p className="tool-status"><ShieldCheck aria-hidden="true" size={16} />AI translation and live conversation stay unavailable until a reviewed provider is connected.</p>
        </article>

        <article className="tool-card emergency-card">
          <Phone aria-hidden="true" size={24} />
          <div><span className="eyebrow">Emergency services in China</span><h2>Call for urgent help</h2></div>
          <nav aria-label="Emergency phone numbers">
            <a href="tel:110">Police 110</a>
            <a href="tel:119">Fire 119</a>
            <a href="tel:120">Medical 120</a>
          </nav>
          <small>For a hotel, restaurant, or attraction service line, verify the number on its official listing before calling.</small>
        </article>
      </div>
    </section>
  )
}
