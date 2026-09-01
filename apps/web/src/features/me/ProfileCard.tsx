import { Check, LoaderCircle, UserRound } from "lucide-react"
import { useEffect, useState } from "react"
import type { UserProfile, UserProfileInput } from "../../../../../packages/shared/src"
import type { AccountStateStatus, AppMode } from "../../app-shell/types"

type ProfileCardProps = {
  mode: AppMode
  profile: UserProfile | null
  status: AccountStateStatus
  onSave: (input: UserProfileInput) => Promise<void>
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

export function ProfileCard({ mode, profile, status, onSave }: ProfileCardProps) {
  const [draft, setDraft] = useState<UserProfileInput>(() => toInput(profile))
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    setDraft(toInput(profile))
  }, [profile])

  if (mode === "preview") {
    return (
      <section className="account-card profile-card" aria-labelledby="profile-heading">
        <div className="section-heading">
          <div><span className="eyebrow">Profile</span><h2 id="profile-heading">Your details</h2></div>
          <UserRound aria-hidden="true" size={20} />
        </div>
        <p className="account-signin-note">Profile and trip members need a signed-in account. Preview mode keeps plans on this device.</p>
      </section>
    )
  }

  async function submit() {
    const trimmed = draft.displayName.trim()
    if (!trimmed) {
      setFormError("Add a display name before saving.")
      return
    }
    setFormError(null)
    setSaving(true)
    try {
      await onSave({ ...draft, displayName: trimmed })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="account-card profile-card" aria-labelledby="profile-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Profile</span><h2 id="profile-heading">Your details</h2></div>
        <UserRound aria-hidden="true" size={20} />
      </div>

      {status === "loading" && <p className="account-status" role="status"><LoaderCircle className="spin" size={15} />Loading profile…</p>}
      {status === "failed" && <p className="account-status is-error" role="alert">Could not load your profile. Your itinerary is still available.</p>}

      {status === "ready" && (
        <div className="profile-form">
          <label>Display name
            <input value={draft.displayName} maxLength={80} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} placeholder="e.g. Alex Chen" />
          </label>
          <div className="profile-row">
            <label>App language
              <select value={draft.interfaceLocale} onChange={(event) => setDraft((current) => ({ ...current, interfaceLocale: event.target.value as UserProfileInput["interfaceLocale"] }))}>
                <option value="en">English</option>
                <option value="zh-CN">中文</option>
              </select>
            </label>
            <label>Content language
              <select value={draft.contentLocale} onChange={(event) => setDraft((current) => ({ ...current, contentLocale: event.target.value as UserProfileInput["contentLocale"] }))}>
                <option value="en">English</option>
                <option value="zh-CN">中文</option>
              </select>
            </label>
          </div>
          <div className="profile-row">
            <label>Country
              <input value={draft.countryCode ?? ""} maxLength={2} onChange={(event) => setDraft((current) => ({ ...current, countryCode: event.target.value.toUpperCase() || null }))} placeholder="US" />
            </label>
            <label>Pace
              <select
                value={typeof draft.travelPreferences.pace === "string" ? draft.travelPreferences.pace : ""}
                onChange={(event) => setDraft((current) => {
                  const preferences = { ...current.travelPreferences }
                  if (event.target.value) preferences.pace = event.target.value
                  else delete preferences.pace
                  return { ...current, travelPreferences: preferences }
                })}
              >
                <option value="">Not set</option>
                <option value="relaxed">Relaxed</option>
                <option value="moderate">Moderate</option>
                <option value="busy">Busy</option>
              </select>
            </label>
          </div>
          <label>Dietary notes
            <input value={typeof draft.travelPreferences.dietary === "string" ? draft.travelPreferences.dietary : ""} maxLength={200} onChange={(event) => setDraft((current) => ({ ...current, travelPreferences: { ...current.travelPreferences, dietary: event.target.value } }))} placeholder="e.g. vegetarian" />
          </label>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <button className="primary-button" type="button" disabled={saving} onClick={() => void submit()}>
            {saving ? <LoaderCircle className="spin" size={17} /> : <Check size={17} />}Save profile
          </button>
        </div>
      )}
    </section>
  )
}
