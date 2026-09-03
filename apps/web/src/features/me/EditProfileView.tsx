import { ArrowLeft, Camera, Check, LoaderCircle, LogOut } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import type { UserProfile, UserProfileInput } from "../../../../../packages/shared/src"
import type { ProfileControls, ProfileExtras } from "../../app-shell/types"
import { useLocale } from "../../lib/i18n"
import { TRAVELER_TITLES, travelerTitleKey, type TravelerTitle } from "./profileMeta"

type EditProfileViewProps = {
  message: string | null
  profile: ProfileControls
  profileExtras: ProfileExtras
  onSaveProfileExtras: (extras: ProfileExtras) => void
  onExit: () => Promise<void>
}

const emptyInput: UserProfileInput = {
  displayName: "",
  interfaceLocale: "en",
  contentLocale: "en",
  countryCode: null,
  travelPreferences: {},
}

function toInput(profile: UserProfile | null): UserProfileInput {
  return profile
    ? {
        displayName: profile.displayName,
        interfaceLocale: profile.interfaceLocale,
        contentLocale: profile.contentLocale,
        countryCode: profile.countryCode,
        travelPreferences: { ...profile.travelPreferences },
      }
    : emptyInput
}

export function EditProfileView({ message, profile, profileExtras, onSaveProfileExtras, onExit }: EditProfileViewProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [draft, setDraft] = useState<UserProfileInput>(() => toInput(profile.profile))
  const [avatar, setAvatar] = useState<string | null>(profileExtras.avatar)
  const [title, setTitle] = useState<TravelerTitle>(profileExtras.title ?? "culture")
  const [phone, setPhone] = useState(profileExtras.phone)
  const [email, setEmail] = useState(profileExtras.email)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    setDraft(toInput(profile.profile))
  }, [profile.profile])

  async function submit() {
    const trimmed = draft.displayName.trim()
    if (!trimmed) {
      setFormError(t("onboarding.nicknameRequired"))
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      await profile.onSave({ ...draft, displayName: trimmed })
      onSaveProfileExtras({ avatar, title, phone: phone.trim(), email: email.trim() })
      navigate("/me")
    } finally {
      setSaving(false)
    }
  }

  async function exit() {
    setExiting(true)
    try {
      await onExit()
    } finally {
      setExiting(false)
    }
  }

  function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : null)
    reader.readAsDataURL(file)
    event.target.value = ""
  }

  const displayName = draft.displayName.trim() || profile.profile?.displayName || t("mine.traveler")

  return (
    <section className="module-view secondary-view" aria-labelledby="edit-profile-heading">
      <header className="secondary-header">
        <button className="secondary-back" type="button" aria-label={t("common.back")} onClick={() => navigate("/me")}>
          <ArrowLeft aria-hidden="true" size={18} />
        </button>
        <h1 id="edit-profile-heading">{t("mine.editProfile")}</h1>
        <button className="secondary-header-save" type="button" aria-label={t("common.save")} disabled={saving} onClick={() => void submit()}>
          {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}
        </button>
      </header>

      {message && <div className="status-banner" role="status"><Check aria-hidden="true" size={18} />{message}</div>}

      <div className="edit-profile-card">
        <div className="edit-profile-avatar">
          {avatar ? (
            <img className="edit-profile-avatar-img" src={avatar} alt="" />
          ) : (
            <span className="edit-profile-avatar-fallback" aria-hidden="true">{(displayName[0] ?? "游").toUpperCase()}</span>
          )}
          <button className="edit-profile-avatar-camera" type="button" aria-label={t("mine.changeAvatar")} onClick={() => fileRef.current?.click()}>
            <Camera aria-hidden="true" size={15} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onAvatarChange} />
        </div>

        {profile.status === "loading" && <p className="account-status" role="status"><LoaderCircle className="spin" size={15} />{t("attr.loadingShort")}</p>}
        {profile.status === "failed" && <p className="account-status is-error" role="alert">{t("mine.profileLoadFailed")}</p>}

        <div className="profile-form">
          <label>{t("onboarding.nicknameLabel")}
            <input value={draft.displayName} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="e.g. Alex Chen" />
          </label>
          <label>{t("mine.country")}
            <input value={draft.countryCode ?? ""} maxLength={2} onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() || null }))} placeholder="US" />
          </label>
          <label>{t("mine.language")}
            <select value={draft.interfaceLocale} onChange={(event) => setDraft((current) => ({ ...current, interfaceLocale: event.target.value as UserProfileInput["interfaceLocale"] }))}>
              <option value="en">English</option>
              <option value="zh-CN">中文</option>
            </select>
          </label>
          <label>{t("mine.travelerTitleLabel")}
            <select value={title} onChange={(event) => setTitle(event.target.value as TravelerTitle)}>
              {TRAVELER_TITLES.map((id) => <option key={id} value={id}>{t(travelerTitleKey(id))}</option>)}
            </select>
          </label>
          <span className="form-section-label">{t("mine.contactInfo")}</span>
          <div className="profile-row">
            <label>{t("mine.phone")}
              <input type="tel" value={phone} maxLength={40} onChange={(event) => setPhone(event.target.value)} placeholder="+1 555 000 0000" />
            </label>
            <label>{t("mine.email")}
              <input type="email" value={email} maxLength={200} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
            </label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="primary-button" type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}{t("common.save")}
          </button>
          <button className="secondary-button" type="button" disabled={exiting} onClick={() => void exit()}>
            {exiting ? <LoaderCircle className="spin" size={16} /> : <LogOut size={16} />}{t("common.signOut")}
          </button>
        </div>
      </div>
    </section>
  )
}
