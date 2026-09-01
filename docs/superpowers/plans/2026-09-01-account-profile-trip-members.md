# Account, Profile, and Trip Members Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let authenticated users manage their profile and let trip owners create, revoke, accept, and administer secure trip membership invitations.

**Architecture:** Profile writes use the existing self-only `user_profiles` RLS boundary. Membership changes use service-role-only, actor-aware database commands; invitation tokens are returned once, stored only as SHA-256 hashes, and accepted only by an authenticated user. Mine consumes typed account/profile/member state and refreshes location-sharing context after membership changes.

**Tech Stack:** React 19, TypeScript, Hono, Supabase PostgreSQL 17/Auth/RLS, Web Crypto/Node-compatible SHA-256, Zod, Vitest, transactional SQL tests.

**Spec:** `docs/superpowers/specs/2026-09-01-mvp-function-completion-design.md`

## Global Constraints

- Only authenticated users can preview or accept an invitation.
- Raw invitation tokens are shown only in the create response and URL; database rows and logs contain only hashes.
- Only an active trip owner can create/revoke invitations or remove members; the owner cannot be removed.
- Acceptance creates/reactivates exactly one active membership and consumes the invitation atomically.
- Member removal immediately ends trip and location reads through existing RLS.
- Profile and membership mutations are explicit user actions; AI has no path to either command.
- Add normal, permission-denied, expired/revoked/consumed, conflict, and dependency-failure coverage before completing the package.

---

### Task 1: Shared Profile and Membership Contracts

**Files:**
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/src/index.test.ts`
- Modify: `apps/worker/src/contracts.ts`
- Modify: `apps/worker/src/contracts.test.ts`

**Interfaces:**
- Produces: `UserProfile`, `UserProfileInput`, `TripMemberSummary`, `TripInvitationSummary`, `TripInvitationPreview`, `CreateTripInvitationInput`, and matching Zod schemas.
- Consumes: existing `Locale`, trip role vocabulary (`owner | editor | viewer`), UUID identifiers, ISO timestamps.

- [ ] **Step 1: Write failing shared-contract tests**

Add assertions equivalent to:

```ts
expect(userProfileInputSchema.parse({
  displayName: "Alex Chen",
  interfaceLocale: "en",
  contentLocale: "zh-CN",
  countryCode: "US",
  travelPreferences: { pace: "relaxed", mobility: "stroller" },
})).toMatchObject({ displayName: "Alex Chen", countryCode: "US" })

expect(() => createTripInvitationSchema.parse({ role: "owner" })).toThrow()
expect(acceptTripInvitationSchema.parse({ token: "a".repeat(43) }).token).toHaveLength(43)
```

- [ ] **Step 2: Verify tests fail because the contracts do not exist**

Run: `npx vitest run packages/shared/src/index.test.ts apps/worker/src/contracts.test.ts`  
Expected: FAIL with missing exports/schemas.

- [ ] **Step 3: Add exact shared types and bounded schemas**

Use these public shapes:

```ts
export type UserProfile = {
  userId: string
  displayName: string
  interfaceLocale: Locale
  contentLocale: Locale
  countryCode: string | null
  travelPreferences: Record<string, string | boolean | number>
}

export type UserProfileInput = Omit<UserProfile, "userId">
export type TripMemberRole = "owner" | "editor" | "viewer"
export type TripMemberSummary = {
  userId: string
  displayName: string
  role: TripMemberRole
  joinedAt: string | null
  isCurrentUser: boolean
}

export type TripInvitationSummary = {
  id: string
  tripId: string
  role: Exclude<TripMemberRole, "owner">
  expiresAt: string
  useCount: number
  maxUses: number
  revokedAt: string | null
}

export type TripInvitationPreview = {
  tripId: string
  tripName: string
  role: Exclude<TripMemberRole, "owner">
  expiresAt: string
  status: "ready" | "expired" | "revoked" | "consumed"
}

export type CreateTripInvitationInput = {
  role: "editor" | "viewer"
  expiresInHours: 1 | 24 | 72 | 168
}
```

Limit display names to 1–80 trimmed characters, country codes to uppercase ISO-like two-letter values, preference keys to an allowlist (`pace`, `mobility`, `interests`, `dietary`) with a serialized maximum of 2 KiB, and raw tokens to 43–128 URL-safe characters.

- [ ] **Step 4: Run contracts tests**

Run: `npx vitest run packages/shared/src/index.test.ts apps/worker/src/contracts.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit contracts**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.test.ts apps/worker/src/contracts.ts apps/worker/src/contracts.test.ts
git commit -m "feat: define profile and member contracts"
```

### Task 2: Atomic Invitation and Member Commands

**Files:**
- Create: `supabase/migrations/20260901090000_add_mvp_member_commands.sql`
- Create: `supabase/tests/mvp_member_commands.sql`
- Modify: `supabase/database.types.ts`
- Modify: `scripts/verify-local-database.sh`

**Interfaces:**
- Produces RPCs: `create_mvp_trip_invitation`, `preview_mvp_trip_invitation`, `accept_mvp_trip_invitation`, `revoke_mvp_trip_invitation`, `remove_mvp_trip_member`.
- Consumes: SHA-256 token hash supplied by Worker, authenticated actor UUID, `trip_members` owner/editor/viewer model, existing active-membership RLS.

- [ ] **Step 1: Write transactional SQL failures first**

Create fixtures for owner, editor, viewer, outsider, and recipient. Assert:

```sql
-- outsider cannot create or revoke
-- editor cannot remove a member
-- owner cannot be removed
-- expired/revoked/consumed token cannot be accepted
-- accepting once creates one active member and increments use_count once
-- accepting concurrently cannot exceed max_uses
-- removing a member makes private.current_trip_role(trip_id) return null
```

Use exception assertions that require `FORBIDDEN`, `INVITATION_EXPIRED`, `INVITATION_UNAVAILABLE`, or `MEMBER_CONFLICT` instead of accepting any failure.

- [ ] **Step 2: Run database verification and observe missing RPC failures**

Run: `npm run db:verify`  
Expected: FAIL because member RPCs are absent.

- [ ] **Step 3: Implement service-role-only commands**

All commands receive `p_actor_user_id`. Creation receives a precomputed `p_token_hash`, role, expiry, and command ID. Acceptance locks the invitation row `FOR UPDATE`, checks expiry/revocation/usage, upserts `trip_members` to active, increments `use_count`, and returns trip/member JSON in one transaction. Removal deletes the member's current location and sharing preference before marking membership removed; existing RLS then denies subsequent reads.

Revoke direct execute for `anon` and `authenticated`; grant only to `service_role`. Add generated function signatures to `database.types.ts`.

- [ ] **Step 4: Add the test file to both clean database passes**

Update `scripts/verify-local-database.sh` so `mvp_member_commands.sql` runs in the same ordered test list on both rebuilds.

- [ ] **Step 5: Run the database gate**

Run: `npm run db:verify`  
Expected: both rebuilds and all permission/command assertions PASS with no rollback residue.

- [ ] **Step 6: Commit database commands**

```bash
git add supabase/migrations/20260901090000_add_mvp_member_commands.sql supabase/tests/mvp_member_commands.sql supabase/database.types.ts scripts/verify-local-database.sh
git commit -m "feat: add secure trip member commands"
```

### Task 3: Profile and Member Worker Endpoints

**Files:**
- Modify: `apps/worker/src/index.ts`
- Modify: `apps/worker/src/index.test.ts`
- Modify: `apps/worker/src/pages.test.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/lib/api.test.ts`

**Interfaces:**
- Produces web API methods: `getProfile`, `updateProfile`, `getTripMembers`, `createTripInvitation`, `previewTripInvitation`, `acceptTripInvitation`, `revokeTripInvitation`, `removeTripMember`.
- Consumes Task 1 schemas/types and Task 2 RPCs.

- [ ] **Step 1: Write failing route and transport tests**

Cover exact paths:

```text
GET   /v1/profile
PUT   /v1/profile
GET   /v1/trips/:tripId/members
POST  /v1/trips/:tripId/invitations
DELETE /v1/trips/:tripId/invitations/:invitationId
GET   /v1/trip-invitations/:token
POST  /v1/trip-invitations/:token/accept
DELETE /v1/trips/:tripId/members/:memberUserId
```

Assert authentication on every path; require the Worker to hash tokens before RPC calls; assert no response or logged error contains the raw token except the successful invitation-create response URL.

- [ ] **Step 2: Run focused tests and observe missing routes**

Run: `npx vitest run apps/worker/src/index.test.ts apps/worker/src/pages.test.ts apps/web/src/lib/api.test.ts`  
Expected: FAIL with 404/missing API methods.

- [ ] **Step 3: Implement profile routes**

Read the caller's self-scoped profile, returning normalized defaults when no row exists. Update through an upsert constrained to the authenticated user's ID and return the normalized `UserProfile`.

- [ ] **Step 4: Implement member and invitation routes**

Generate invitation tokens with `crypto.getRandomValues(new Uint8Array(32))`, encode URL-safe base64 without padding, hash with SHA-256, and pass only the hexadecimal hash to database commands. Create response:

```ts
{ invitation: TripInvitationSummary, inviteUrl: `${webOrigin}/join/${token}` }
```

Preview/accept hashes the URL token before lookup. Member list joins only profile display names for active same-trip members. Map command errors to stable 400/403/404/409/410/503 responses.

- [ ] **Step 5: Implement typed web transport**

Use existing authenticated `request` helpers. Never add `Authorization: Bearer null`; invitation preview requires a real session.

- [ ] **Step 6: Run focused tests, typecheck, and lint**

Run:

```bash
npx vitest run apps/worker/src/index.test.ts apps/worker/src/pages.test.ts apps/web/src/lib/api.test.ts
npm run typecheck
npm run lint
```

Expected: PASS with zero lint warnings.

- [ ] **Step 7: Commit endpoints**

```bash
git add apps/worker/src/index.ts apps/worker/src/index.test.ts apps/worker/src/pages.test.ts apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts
git commit -m "feat: expose profiles and trip membership"
```

### Task 4: Profile, Invitations, and Members in Mine

**Files:**
- Create: `apps/web/src/features/me/ProfileCard.tsx`
- Create: `apps/web/src/features/me/TripMembersCard.tsx`
- Create: `apps/web/src/features/me/ProfileCard.test.tsx`
- Create: `apps/web/src/features/me/TripMembersCard.test.tsx`
- Create: `apps/web/src/features/members/JoinTripView.tsx`
- Create: `apps/web/src/features/members/JoinTripView.test.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/app-shell/AppShell.tsx`
- Modify: `apps/web/src/app-shell/types.ts`
- Modify: `apps/web/src/features/me/MineView.tsx`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes Task 3 API methods and Task 1 public types.
- Produces refreshed `profile`, `members`, and `invitations` account state plus `/join/:token` route behavior.

- [ ] **Step 1: Write failing profile, member, and join-flow tests**

Cover:

```text
profile loading → edit → save success
profile validation failure keeps draft
owner creates editor/viewer link and can copy/revoke it
editor/viewer sees members but no owner controls
owner removes non-owner and list refreshes
join route shows trip/role → explicit accept → loads joined trip
expired/revoked/consumed/dependency states retain sign-out/navigation controls
preview mode clearly says account features require sign-in and creates no fake members
```

- [ ] **Step 2: Run focused UI tests and observe missing components**

Run: `npx vitest run apps/web/src/features/me/ProfileCard.test.tsx apps/web/src/features/me/TripMembersCard.test.tsx apps/web/src/features/members/JoinTripView.test.tsx`  
Expected: FAIL with missing modules.

- [ ] **Step 3: Implement isolated cards and join page**

`ProfileCard` owns only the editable draft and reports saves upward. `TripMembersCard` renders account data and sends explicit create/revoke/remove callbacks. `JoinTripView` never accepts on page load; acceptance requires a button and shows the assigned role before mutation.

- [ ] **Step 4: Integrate account state in App**

Load profile/members/invitations after the active trip is available. After accept/remove, refresh the trip, members, and location-sharing snapshot; do not fabricate account state in preview. Keep independent loading/error state so a profile failure does not hide itinerary editing.

- [ ] **Step 5: Add feedback and responsive styles**

Provide non-color-only loading, empty, error, success, copy-link, expired, no-members, and permission-denied states. Keep controls usable at 390px with minimum 44px touch targets.

- [ ] **Step 6: Run focused UI and shell checks**

Run:

```bash
npx vitest run apps/web/src/features/me/ProfileCard.test.tsx apps/web/src/features/me/TripMembersCard.test.tsx apps/web/src/features/members/JoinTripView.test.tsx apps/web/src/features/me/MineView.test.tsx apps/web/src/app-shell/AppShell.test.tsx
npm run typecheck
npm run lint
```

Expected: PASS. Exhaustive two-account and 390px browser acceptance remains in Package 6.

- [ ] **Step 7: Commit Mine integration**

```bash
git add apps/web/src/features/me apps/web/src/features/members apps/web/src/App.tsx apps/web/src/app-shell apps/web/src/styles.css
git commit -m "feat: manage profiles and trip members"
```

### Task 5: Package Context and Interface Checkpoint

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `TASKS.md`
- Modify: `docs/superpowers/plans/2026-09-01-mvp-function-completion-roadmap.md`

**Interfaces:**
- Consumes all completed Package 1 changes.
- Produces authoritative member/profile architecture and marks Package 1 ready for Package 2 without claiming final product acceptance.

- [ ] **Step 1: Run Package 1's minimum implementation gate**

Run:

```bash
npm run typecheck
npm run lint
npm test
npm run db:verify
git diff --check
```

Expected: PASS. Do not run or claim the final two-account/mobile/release acceptance here.

- [ ] **Step 2: Check security and interface invariants**

Confirm from current code/tests that raw tokens are absent from database/logs, owners cannot be removed, removed members lose RLS reads, invitation acceptance is atomic, profile writes are self-only, and location-sharing recipient state refreshes after membership changes.

- [ ] **Step 3: Update authoritative context**

Document the implemented routes, token hashing boundary, invitation lifecycle, member removal/RLS behavior, and Package 1 progress. Check the Package 1 roadmap item but leave final MVP tasks unchecked.

- [ ] **Step 4: Commit context**

```bash
git add ARCHITECTURE.md TASKS.md docs/superpowers/plans/2026-09-01-mvp-function-completion-roadmap.md
git commit -m "docs: record profile and member package"
```

