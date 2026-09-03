import { ArrowLeft, LoaderCircle, LogIn, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"
import type { TripInvitationPreview } from "../../../../../packages/shared/src"
import { BrandMark } from "../../components/BrandMark"
import { api, ApiRequestError } from "../../lib/api"

type JoinTripViewProps = {
  token: string
  accessToken: string | null
  onAccepted: (tripId: string) => Promise<void>
  onGoHome: () => void
}

type JoinState = "loading" | "ready" | "unavailable" | "signed-out" | "error"

function statusMessage(status: TripInvitationPreview["status"]) {
  switch (status) {
    case "expired": return "This invitation link has expired. Ask the trip owner for a new one."
    case "revoked": return "This invitation link was revoked by the trip owner."
    case "consumed": return "This invitation link has already been used."
    default: return "This invitation link is no longer available."
  }
}

export function JoinTripView({ token, accessToken, onAccepted, onGoHome }: JoinTripViewProps) {
  const [state, setState] = useState<JoinState>("loading")
  const [preview, setPreview] = useState<TripInvitationPreview | null>(null)
  const [message, setMessage] = useState("")
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    if (!accessToken) {
      setState("signed-out")
      return
    }
    let active = true
    setState("loading")
    void api.previewTripInvitation(accessToken, token)
      .then((nextPreview) => {
        if (!active) return
        setPreview(nextPreview)
        setState(nextPreview.status === "ready" ? "ready" : "unavailable")
        if (nextPreview.status !== "ready") setMessage(statusMessage(nextPreview.status))
      })
      .catch((error) => {
        if (!active) return
        setState("error")
        setMessage(error instanceof ApiRequestError ? error.message : "This invitation link could not be opened.")
      })
    return () => { active = false }
  }, [accessToken, token])

  async function accept() {
    if (!accessToken) return
    setAccepting(true)
    try {
      const result = await api.acceptTripInvitation(accessToken, token)
      await onAccepted(result.tripId)
    } catch (error) {
      setState("unavailable")
      setMessage(error instanceof ApiRequestError ? error.message : "This invitation could not be accepted.")
    } finally {
      setAccepting(false)
    }
  }

  if (state === "signed-out") {
    return (
      <main className="join-layout">
        <section className="join-card">
          <span className="brand-seal" aria-hidden="true"><BrandMark /></span>
          <h1>Sign in to join</h1>
          <p>This invitation is for a shared trip. Sign in first, then open this link again to review and accept it.</p>
          <button className="primary-button" type="button" onClick={onGoHome}><LogIn size={17} />Go to sign in</button>
        </section>
      </main>
    )
  }

  return (
    <main className="join-layout">
      <section className="join-card" aria-live="polite">
        <span className="brand-seal" aria-hidden="true"><BrandMark /></span>
        {state === "loading" && <><LoaderCircle className="spin" size={22} /><h1>Opening invitation…</h1></>}
        {state === "ready" && preview && (
          <>
            <span className="eyebrow">Trip invitation</span>
            <h1>{preview.tripName}</h1>
            <p>You are invited to join as a <strong>{preview.role}</strong>.</p>
            <button className="primary-button" type="button" disabled={accepting} onClick={() => void accept()}>
              {accepting ? <LoaderCircle className="spin" size={17} /> : <UserPlus size={17} />}Accept and open this trip
            </button>
          </>
        )}
        {(state === "unavailable" || state === "error") && (
          <>
            <h1>Invitation unavailable</h1>
            <p>{message}</p>
            <button className="secondary-button" type="button" onClick={onGoHome}><ArrowLeft size={16} />Back to China Stroll</button>
          </>
        )}
      </section>
    </main>
  )
}
