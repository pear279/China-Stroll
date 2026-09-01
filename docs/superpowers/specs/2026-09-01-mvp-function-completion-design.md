# China Stroll MVP Function Completion Design

Date: 2026-09-01  
Status: approved direction, pending written-spec confirmation

## Objective

Complete the remaining MVP capabilities across Attractions, Map, Tools, and Mine before running the final integrated acceptance and release gate. Work proceeds as vertical user journeys: each package includes its shared contracts, database or provider boundary, API, UI, state feedback, and minimum implementation checks.

The scope includes personal photo/travel records and basic offline reading. Public community, friend feeds, public records, automated booking, automated payment, native background location tracking, and non-Beijing expansion remain out of scope.

## Delivery Principles

- Complete usable product flows before visual or performance refinement.
- Retain small feature-level checks during development so later packages are not built on broken interfaces; defer exhaustive browser, weak-network, two-account, mobile, and release acceptance until all five packages are implemented.
- Keep `placeId`, WGS84 coordinates, and product route types provider-neutral.
- AI may create drafts and proposals but cannot directly change trips, reservations, membership, profiles, privacy, or records.
- Every trip mutation retains permission, expected-version, command-id, idempotency, and change-log checks.
- Unknown provider facts remain unknown; the UI must not invent rates, availability, phone numbers, opening times, prices, or booking rules.
- Public reviewed attractions and private user-created locations remain separate trust classes.

## Package 1 — Account, Profile, and Trip Members

### User experience

Mine gains a Profile section for display name, interface/content language, country code, and bounded travel preferences. It also gains a Trip Members section showing active members, role, current user, pending invitation links, and owner-only controls.

An owner creates a time-limited, single-use invitation for either `editor` or `viewer`. The app presents a shareable product URL containing the raw token only once. An authenticated recipient opens the link, reviews the trip name and assigned role, and explicitly accepts. Acceptance creates or reactivates the membership and consumes the invitation. The token is never stored in plaintext; only its hash is stored. The first version does not send invitation email and does not allow anonymous membership.

Owners may revoke an unused invitation or remove an active non-owner member. Removal immediately ends trip and location visibility through RLS. The only owner cannot be removed. Member and invitation changes never masquerade as ordinary itinerary writes and receive their own audited commands.

### Boundaries

- Shared contracts: profile, member, invitation preview, invitation creation result.
- Worker routes: profile read/update; member list; invitation create/preview/accept/revoke; member remove.
- Database commands: security-definer service-role functions with actor checks and transaction-safe invitation consumption.
- App state: a member refresh updates Mine and the location-sharing recipient count without requiring a reload.

### Failure handling

Expired, revoked, consumed, unauthorized, last-owner, dependency, and stale-membership states have distinct responses. Raw invitation tokens and access tokens are never logged.

## Package 2 — Complete Itinerary and Reservation Editing

### User experience

Mine allows editing a stop's day, start time, duration, transport mode, and private notes. A stop can move to another existing day and receives a valid destination sort order. Reordering, editing, moving, and deleting continue to update Attractions and Map through the shared trip snapshot.

Trip days gain editable date, title, and notes. The first version adds and edits days but does not delete a day containing content. Day writes use the same trip version boundary.

Reservation manual create, update, and delete remain available. An AI Draft action accepts pasted or typed booking information and returns a structured reservation draft. The draft is visibly uncommitted, editable, and saved only after the user presses the normal Save action. Provider failure leaves the user's source text and manual form usable.

### Boundaries

- Extend trip commands for stop field edits, cross-day moves, and day edits.
- Keep `TripStop.placeId` for reviewed/public places; private locations arrive in Package 4.
- Add a reservation-draft contract and Worker endpoint that cannot call a reservation write command.
- Refresh the trip after successful account-mode commands and apply equivalent deterministic transitions in preview mode.

### Failure handling

Permission denial, version conflicts, duplicate command IDs, invalid times, invalid day targets, and AI dependency failures preserve the current draft and offer refresh/retry guidance. Offline writes are not silently queued.

## Package 3 — Tools 1.0

### User experience

Tools becomes four working sections:

1. Navigation and rides: open Apple Maps, Google Maps, or Amap for a selected itinerary/place coordinate; expose provider web/app links for ride-hailing without claiming a booking was created.
2. Payment and exchange: reviewed payment setup guidance plus a timestamped currency conversion result for a bounded set of currencies.
3. Translation and conversation: text translation, swap languages, copy result, and reviewed common travel phrases. Voice capture and spoken output use browser capabilities only when available and remain optional enhancements, not prerequisites for text translation.
4. Service help: reviewed emergency numbers, saved official service contacts, and trip-context filtering for attractions, accommodations, restaurants, and transport reservations.

### Provider strategy

External services sit behind provider-neutral Worker adapters. Exchange results include base/quote currency, numeric rate, provider attribution, and retrieval time. Translation uses a bounded server-side model/provider adapter and never receives trip confirmation codes or private notes unless the user explicitly pastes that text into the translation field. Navigation and ride links are generated locally from product coordinates and approved provider URL templates.

If no production exchange provider is configured, the UI reports that live rates are unavailable and retains reviewed payment guidance. If translation is unavailable, common phrases remain usable offline. No fake exchange rate or translated text is displayed.

### Boundaries

- Shared contracts for exchange quotes, translation requests/results, phrase packs, and service contacts.
- Worker routes for exchange and text translation with input bounds, timeouts, safe errors, and rate limiting.
- Tool UI receives the selected place and active trip snapshot but filters private reservation fields before provider calls.

## Package 4 — Private Places, Restaurants, Hotels, and Map Integration

### Trust model

Reviewed public attractions remain in the curated `places` publishing pipeline. A separate private place table stores user-created trip locations for restaurants, hotels, meeting points, and other stops. Each private place has an opaque product `placeId`, owner/trip scope, name, type, optional address, optional WGS84 coordinate, notes, and timestamps. It is never returned by public place APIs or described as reviewed.

### User experience

Mine and Map allow an active member with edit permission to create a private place and add it to a selected day. Reservations may link to either a reviewed attraction or a trip-scoped private place through the product place identity boundary. Map renders private restaurant/hotel/meeting-point markers with a distinct style and trust label. Marker selection supports details, add/move to day, Navigate, and Cancel when a coordinate exists.

Locations without coordinates remain manageable in Mine and appear as text-only itinerary entries; the product never invents coordinates. The first version supports manual input and optional current-map pin selection. Supplier search/autocomplete may be added only behind a provider-neutral adapter and is not required for completion.

### Map completion

The existing MapLibre/mapcn wrapper remains the visual map boundary. The final acceptance records the formal basemap attribution, license, Beijing availability, and network fallback. Dotted itinerary ordering is still not described as a calculated road route.

## Package 5 — Private Records and Basic Offline Reading

### Private records

Authenticated users can attach a private text/photo record to a reviewed or private place and optionally associate it with a trip day. Visibility is fixed to `private` for this milestone. Metadata is stored in PostgreSQL and media in a private storage bucket with user-scoped policies and signed reads. The app validates file type and size, removes EXIF metadata before upload where supported, shows upload progress, and permits deletion. Records cannot be switched to friend/public visibility.

Preview mode stores text records and local object references only for the current browser session; it does not imply cloud backup. Account mode is the authoritative persistent flow.

### Offline reading

The PWA caches the application shell and the most recently successful read-only payloads for the active trip, reservations, saved/reviewed place detail, guide content, phrase packs, and emergency guidance. Cached data includes a saved timestamp and is visibly labeled offline/stale when served without a network connection.

Writes, membership changes, AI requests, location sharing, live rates, translation, and private photo uploads are unavailable offline and are never automatically replayed. A later online read refresh replaces the cached snapshot only after schema validation.

## Cross-Package Data Flow

1. Authenticated app loads profile, active trip, members, and reviewed places.
2. All four modules consume the same validated trip/place state.
3. Explicit user writes pass through typed API methods and server commands, then refresh the authoritative snapshot.
4. AI and external providers return drafts or read-only results; only a separate user action can invoke a mutation.
5. Successful read payloads update a versioned offline cache; failed or malformed responses do not overwrite the last valid cache.

## Development and Verification Strategy

During each package, run only the smallest checks that protect the changed interface: focused tests, TypeScript, lint for touched code, deterministic data/image checks when applicable, and database verification for migrations. These are implementation safeguards rather than product acceptance.

After all five packages are complete, run one unified acceptance phase:

- normal, empty, permission-denied, conflict, dependency-failure, offline, and weak-network flows;
- two authenticated accounts for invitation, member removal, trip permissions, and location sharing;
- 390px and desktop browser walkthroughs across all four modules;
- Apple Maps, Google Maps, Amap, basemap attribution, and Beijing network checks;
- image policy, private media access, source labeling, privacy copy, and secret/log inspection;
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run db:verify`;
- production deployment smoke test only after the local gate is green.

## Completion Criteria

The milestone is function-complete when every in-scope entry has a real or explicitly degraded user flow, no button claims an unavailable mutation succeeded, public and private place trust classes remain distinct, AI applies no writes, and all four modules can be used without relying on a future placeholder. The milestone is accepted only after the unified acceptance phase passes.

