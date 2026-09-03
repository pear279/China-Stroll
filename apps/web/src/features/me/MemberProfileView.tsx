import { ArrowLeft, MessageCircle, Phone } from "lucide-react"
import { useNavigate, useParams } from "react-router-dom"
import type { MembershipControls } from "../../app-shell/types"
import { useLocale } from "../../lib/i18n"

const roleKey = {
  owner: "mine.roleOwner",
  editor: "mine.roleEditor",
  viewer: "mine.roleViewer",
} as const

export function MemberProfileView({ membership }: { membership: MembershipControls }) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const member = membership.members.find((item) => item.userId === userId) ?? null

  return (
    <section className="module-view secondary-view" aria-labelledby="member-heading">
      <header className="secondary-header">
        <button className="secondary-back" type="button" aria-label={t("common.back")} onClick={() => navigate("/me")}>
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <h1 id="member-heading">{member?.displayName ?? t("mine.sharedMembers")}</h1>
      </header>

      {!member ? (
        <div className="collection-empty" role="status">
          <p>{t("mine.memberNotFound")}</p>
        </div>
      ) : (
        <div className="member-profile-card">
          <span className="member-profile-avatar" aria-hidden="true">{(member.displayName[0] ?? "?").toUpperCase()}</span>
          <strong className="member-profile-name">{member.displayName}</strong>
          <span className="member-profile-role">{t(roleKey[member.role])}</span>

          <div className="member-profile-actions">
            <button type="button" disabled aria-label={t("mine.message")}>
              <MessageCircle aria-hidden="true" size={18} />
              <span>{t("mine.message")}</span>
            </button>
            <button type="button" disabled aria-label={t("mine.call")}>
              <Phone aria-hidden="true" size={18} />
              <span>{t("mine.call")}</span>
            </button>
          </div>
          <p className="member-profile-note">{t("mine.contactUnavailable")}</p>
        </div>
      )}
    </section>
  )
}
