import { Check, CheckCircle2, Copy, Heart, Languages, Link2, LoaderCircle, Pencil, Plus } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { Coordinate, CreateTripInvitationInput, PlaceSummary, ReservationInput, TripSnapshot } from "../../../../../packages/shared/src"
import type { AppMode, ItineraryEditControls, MembershipControls, ProfileControls, ProfileExtras } from "../../app-shell/types"
import { BottomSheet } from "../../components/BottomSheet"
import { useLocale } from "../../lib/i18n"
import { ItinerarySection } from "./ItinerarySection"
import { travelerTitleKey } from "./profileMeta"

export type MineViewProps = {
  mode: AppMode
  profile: ProfileControls
  membership: MembershipControls
  profileExtras: ProfileExtras
  trip: TripSnapshot
  busy: string | null
  message: string | null
  itineraryEditing: ItineraryEditControls
  places: PlaceSummary[]
  selectedDay: number
  userCoordinate: Coordinate | null
  completedStopIds: Set<string>
  completedReservationIds: Set<string>
  onAddDay: (date?: string | null) => Promise<number | null>
  onToggleStopCompleted: (stopId: string) => void
  onToggleReservationCompleted: (reservationId: string) => void
  onEditTripDates: (input: { startDate: string | null; endDate: string | null }) => Promise<void>
  onRemoveStop: (stopId: string) => Promise<void>
  onReorderStop: (stopId: string, targetIndex: number) => Promise<void>
  onCreateReservation: (input: ReservationInput) => Promise<void>
  onUpdateReservation: (reservationId: string, input: ReservationInput) => Promise<void>
  onRemoveReservation: (reservationId: string) => Promise<void>
  onSelectDay: (dayNumber: number) => void
}

export function MineView({
  mode,
  profile,
  membership,
  profileExtras,
  trip,
  busy,
  message,
  itineraryEditing,
  places,
  selectedDay,
  userCoordinate,
  completedStopIds,
  completedReservationIds,
  onAddDay,
  onToggleStopCompleted,
  onToggleReservationCompleted,
  onEditTripDates,
  onRemoveStop,
  onReorderStop,
  onCreateReservation,
  onUpdateReservation,
  onRemoveReservation,
  onSelectDay,
}: MineViewProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [languageOpen, setLanguageOpen] = useState(false)

  return (
    <section className="module-view mine-view" aria-labelledby="mine-heading">
      <header className="mine-heading">
        <h1 id="mine-heading">{t("mine.title")}</h1>
      </header>

      <ProfileSummaryCard
        profile={profile.profile}
        profileExtras={profileExtras}
        onEdit={() => navigate("/me/edit-profile")}
      />

      <QuickOptions
        onSaved={() => navigate("/me/saved")}
        onVisited={() => navigate("/me/visited")}
        onLanguage={() => setLanguageOpen(true)}
      />

      <SharedMembersSection
        mode={mode}
        membership={membership}
        onOpenMember={(userId) => navigate(`/me/member/${userId}`)}
      />

      <ItinerarySection
        busy={busy}
        message={message}
        itineraryEditing={itineraryEditing}
        places={places}
        selectedDay={selectedDay}
        trip={trip}
        userCoordinate={userCoordinate}
        completedStopIds={completedStopIds}
        completedReservationIds={completedReservationIds}
        onAddDay={onAddDay}
        onToggleStopCompleted={onToggleStopCompleted}
        onToggleReservationCompleted={onToggleReservationCompleted}
        onEditTripDates={onEditTripDates}
        onRemoveStop={onRemoveStop}
        onReorderStop={onReorderStop}
        onCreateReservation={onCreateReservation}
        onUpdateReservation={onUpdateReservation}
        onRemoveReservation={onRemoveReservation}
        onSelectDay={onSelectDay}
      />

      <LanguageSheet open={languageOpen} onClose={() => setLanguageOpen(false)} />
    </section>
  )
}

function ProfileSummaryCard({ profile, profileExtras, onEdit }: { profile: ProfileControls["profile"]; profileExtras: ProfileExtras; onEdit: () => void }) {
  const { t } = useLocale()
  const displayName = profile?.displayName || t("mine.traveler")
  const country = profile?.countryCode || "—"
  const language = profile?.interfaceLocale === "zh-CN" ? t("mine.languageChinese") : t("mine.languageEnglish")

  return (
    <section className="profile-summary" aria-label={t("mine.editProfile")}>
      <div className="profile-summary-avatar-wrap">
        {profileExtras.avatar ? (
          <img className="profile-summary-avatar profile-summary-avatar--img" src={profileExtras.avatar} alt="" />
        ) : (
          <span className="profile-summary-avatar" aria-hidden="true">{(displayName[0] ?? "游").toUpperCase()}</span>
        )}
        <button className="profile-summary-edit" type="button" aria-label={t("mine.editProfile")} onClick={onEdit}>
          <Pencil aria-hidden="true" size={13} />
        </button>
      </div>
      <div className="profile-summary-copy">
        <strong className="profile-summary-name">{displayName}</strong>
        <div className="profile-summary-meta">
          <span>{country}</span>
          <span className="profile-summary-sep" aria-hidden="true">·</span>
          <span>{language}</span>
          <span className="profile-summary-title">{t(travelerTitleKey(profileExtras.title))}</span>
        </div>
      </div>
    </section>
  )
}

function QuickOptions({ onSaved, onVisited, onLanguage }: { onSaved: () => void; onVisited: () => void; onLanguage: () => void }) {
  const { t } = useLocale()
  return (
    <div className="quick-options">
      <button type="button" onClick={onSaved}>
        <Heart aria-hidden="true" size={21} />
        <span>{t("mine.saved")}</span>
      </button>
      <button type="button" onClick={onVisited}>
        <CheckCircle2 aria-hidden="true" size={21} />
        <span>{t("mine.visited")}</span>
      </button>
      <button type="button" onClick={onLanguage}>
        <Languages aria-hidden="true" size={21} />
        <span>{t("mine.language")}</span>
      </button>
    </div>
  )
}

function SharedMembersSection({ mode, membership, onOpenMember }: { mode: AppMode; membership: MembershipControls; onOpenMember: (userId: string) => void }) {
  const { t } = useLocale()
  const [inviteOpen, setInviteOpen] = useState(false)

  return (
    <section className="mine-section" aria-labelledby="shared-members-heading">
      <h2 className="mine-section-title" id="shared-members-heading">{t("mine.sharedMembers")}</h2>
      <div className="shared-members-row">
        <button className="shared-member shared-member--add" type="button" aria-label={t("mine.addMember")} onClick={() => setInviteOpen(true)}>
          <Plus aria-hidden="true" size={22} />
        </button>
        {membership.members.map((member) => (
          <button className="shared-member" type="button" aria-label={member.displayName} key={member.userId} onClick={() => onOpenMember(member.userId)}>
            <span className="shared-member-avatar" aria-hidden="true">{(member.displayName[0] ?? "?").toUpperCase()}</span>
          </button>
        ))}
      </div>
      <InviteMemberSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        mode={mode}
        isOwner={membership.isOwner}
        onCreateInvitation={membership.onCreateInvitation}
      />
    </section>
  )
}

function LanguageSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, locale, setLocale } = useLocale()
  return (
    <BottomSheet open={open} title={t("mine.language")} onClose={onClose}>
      <button className="bottom-sheet-option" type="button" aria-pressed={locale === "en"} onClick={() => { setLocale("en"); onClose() }}>
        <span>{t("mine.languageEnglish")}</span>
        {locale === "en" && <Check aria-hidden="true" size={18} />}
      </button>
      <button className="bottom-sheet-option" type="button" aria-pressed={locale === "zh"} onClick={() => { setLocale("zh"); onClose() }}>
        <span>{t("mine.languageChinese")}</span>
        {locale === "zh" && <Check aria-hidden="true" size={18} />}
      </button>
    </BottomSheet>
  )
}

function InviteMemberSheet({ open, onClose, mode, isOwner, onCreateInvitation }: {
  open: boolean
  onClose: () => void
  mode: AppMode
  isOwner: boolean
  onCreateInvitation: (input: CreateTripInvitationInput) => Promise<string | null>
}) {
  const { t } = useLocale()
  const [role, setRole] = useState<"editor" | "viewer">("viewer")
  const [expiresInHours, setExpiresInHours] = useState<1 | 24 | 72 | 168>(72)
  const [creating, setCreating] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) {
      setInviteUrl(null)
      setCopied(false)
      setCreating(false)
    }
  }, [open])

  async function createInvitation() {
    setCreating(true)
    try {
      const url = await onCreateInvitation({ role, expiresInHours })
      if (url) {
        setInviteUrl(url)
        setCopied(false)
      }
    } finally {
      setCreating(false)
    }
  }

  async function copyInviteUrl() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard?.writeText(inviteUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <BottomSheet open={open} title={t("mine.inviteMember")} onClose={onClose}>
      {mode === "preview" ? (
        <p className="account-status">{t("mine.previewMembers")}</p>
      ) : !isOwner ? (
        <p className="account-status">{t("mine.ownerOnlyInvite")}</p>
      ) : (
        <>
          <div className="invite-sheet-fields">
            <label>{t("mine.role")}
              <select value={role} onChange={(event) => setRole(event.target.value as "editor" | "viewer")}>
                <option value="viewer">{t("mine.roleViewer")}</option>
                <option value="editor">{t("mine.roleEditor")}</option>
              </select>
            </label>
            <label>{t("mine.expiresIn")}
              <select value={expiresInHours} onChange={(event) => setExpiresInHours(Number(event.target.value) as 1 | 24 | 72 | 168)}>
                <option value={24}>{t("mine.expires24h")}</option>
                <option value={72}>{t("mine.expires3d")}</option>
                <option value={168}>{t("mine.expires7d")}</option>
              </select>
            </label>
          </div>
          <button className="bottom-sheet-primary" type="button" disabled={creating} onClick={() => void createInvitation()}>
            {creating ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />}{t("mine.createInviteLink")}
          </button>
          {inviteUrl && (
            <div className="invite-url" role="status">
              <div className="invite-url-row">
                <input readOnly value={inviteUrl} aria-label="Invitation link" />
                <button type="button" onClick={() => void copyInviteUrl()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t("mine.copied") : t("mine.copyInvite")}</button>
              </div>
              <small><Link2 aria-hidden="true" size={12} />{t("mine.inviteOneTime")}</small>
            </div>
          )}
        </>
      )}
    </BottomSheet>
  )
}
