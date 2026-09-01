import { Check, Copy, Link2, LoaderCircle, Plus, Trash2, UserPlus, Users } from "lucide-react"
import { useState } from "react"
import type { CreateTripInvitationInput, TripInvitationSummary, TripMemberSummary } from "../../../../../packages/shared/src"
import type { AccountStateStatus, AppMode } from "../../app-shell/types"

type TripMembersCardProps = {
  mode: AppMode
  isOwner: boolean
  members: TripMemberSummary[]
  invitations: TripInvitationSummary[]
  status: AccountStateStatus
  onCreateInvitation: (input: CreateTripInvitationInput) => Promise<string | null>
  onRevokeInvitation: (invitationId: string) => Promise<void>
  onRemoveMember: (memberUserId: string) => Promise<void>
}

function invitationState(invitation: TripInvitationSummary): "active" | "expired" | "consumed" | "revoked" {
  if (invitation.revokedAt) return "revoked"
  if (invitation.useCount >= invitation.maxUses) return "consumed"
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return "expired"
  return "active"
}

const roleLabel: Record<string, string> = { owner: "Owner", editor: "Editor", viewer: "Viewer" }

export function TripMembersCard({
  mode,
  isOwner,
  members,
  invitations,
  status,
  onCreateInvitation,
  onRevokeInvitation,
  onRemoveMember,
}: TripMembersCardProps) {
  const [role, setRole] = useState<"editor" | "viewer">("viewer")
  const [expiresInHours, setExpiresInHours] = useState<1 | 24 | 72 | 168>(72)
  const [creating, setCreating] = useState(false)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  if (mode === "preview") {
    return (
      <section className="account-card members-card" aria-labelledby="members-heading">
        <div className="section-heading">
          <div><span className="eyebrow">Trip members</span><h2 id="members-heading">Travel group</h2></div>
          <Users aria-hidden="true" size={20} />
        </div>
        <p className="account-signin-note">Invite travel companions after signing in. Preview mode does not create members.</p>
      </section>
    )
  }

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

  const pendingInvitations = invitations.filter((invitation) => invitationState(invitation) === "active")

  return (
    <section className="account-card members-card" aria-labelledby="members-heading">
      <div className="section-heading">
        <div><span className="eyebrow">Trip members</span><h2 id="members-heading">Travel group</h2></div>
        <Users aria-hidden="true" size={20} />
      </div>

      {status === "loading" && <p className="account-status" role="status"><LoaderCircle className="spin" size={15} />Loading travel group…</p>}
      {status === "failed" && <p className="account-status is-error" role="alert">Could not load the travel group. Your itinerary is still available.</p>}

      {status === "ready" && (
        <>
          {members.length === 0 ? (
            <p className="account-status">No members yet. Invite a companion to share this trip.</p>
          ) : (
            <ul className="member-list">
              {members.map((member) => (
                <li key={member.userId}>
                  <div className="member-copy">
                    <strong>{member.displayName}{member.isCurrentUser && <span className="you-chip">You</span>}</strong>
                    <span>{roleLabel[member.role] ?? member.role}</span>
                  </div>
                  {isOwner && member.role !== "owner" && (
                    <button className="remove-member" type="button" aria-label={`Remove ${member.displayName}`} onClick={() => void onRemoveMember(member.userId)}>
                      <Trash2 aria-hidden="true" size={15} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}

          {isOwner && (
            <div className="invitation-create">
              <div className="invitation-row">
                <label>Role
                  <select value={role} onChange={(event) => setRole(event.target.value as "editor" | "viewer")}>
                    <option value="viewer">Viewer (read only)</option>
                    <option value="editor">Editor (can edit)</option>
                  </select>
                </label>
                <label>Expires in
                  <select value={expiresInHours} onChange={(event) => setExpiresInHours(Number(event.target.value) as 1 | 24 | 72 | 168)}>
                    <option value={24}>24 hours</option>
                    <option value={72}>3 days</option>
                    <option value={168}>7 days</option>
                  </select>
                </label>
              </div>
              <button className="secondary-button" type="button" disabled={creating} onClick={() => void createInvitation()}>
                {creating ? <LoaderCircle className="spin" size={16} /> : <Plus size={16} />}Create invitation link
              </button>
              {inviteUrl && (
                <div className="invite-url" role="status">
                  <div className="invite-url-row">
                    <input readOnly value={inviteUrl} aria-label="Invitation link" />
                    <button type="button" onClick={() => void copyInviteUrl()}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Copied" : "Copy"}</button>
                  </div>
                  <small><Link2 aria-hidden="true" size={12} />Share this link once. It is single-use and not shown again.</small>
                </div>
              )}
            </div>
          )}

          {isOwner && pendingInvitations.length > 0 && (
            <ul className="invitation-list">
              {pendingInvitations.map((invitation) => (
                <li key={invitation.id}>
                  <div className="member-copy">
                    <strong>{roleLabel[invitation.role]} invitation</strong>
                    <span>Expires {new Date(invitation.expiresAt).toLocaleString()}</span>
                  </div>
                  <button className="remove-member" type="button" aria-label="Revoke invitation" onClick={() => void onRevokeInvitation(invitation.id)}>
                    <Trash2 aria-hidden="true" size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isOwner && (
            <p className="account-status"><UserPlus aria-hidden="true" size={14} />Only the trip owner can invite or remove members.</p>
          )}
        </>
      )}
    </section>
  )
}
