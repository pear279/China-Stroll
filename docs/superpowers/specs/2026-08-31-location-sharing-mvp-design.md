# Location Sharing MVP Design

## Goal

Allow an active trip member to explicitly share one expiring current WGS84 location with other active members of the same trip while the web app remains open. The feature helps a group coordinate; it is not a safety guarantee and does not store a movement trail.

## Scope

Included:

- Existing active trip members only; invitation and acceptance UX are out of scope.
- Default-off sharing switch, foreground browser geolocation, current-point upload, expiry, revoke, and same-trip member read.
- Mine privacy card and Map member-position layer.
- Member, permission, expiry, offline, and dependency-failure states.

Excluded:

- Background tracking, native mobile services, geofences, alerts, history, or public/friend sharing outside the trip.
- Invitation, acceptance, and member removal UI.

## Data and Privacy Model

`trip_member_locations` stores one current point per `(trip_id, user_id)`: WGS84 latitude/longitude, `updated_at`, `expires_at`, and enabled state. A newer upload replaces the existing point. The expiry is ten minutes after the accepted upload.

The data does not hold a location trail. Turning sharing off deletes or makes the caller's point immediately unavailable. A removed or inactive member cannot read locations through RLS. Active members can read only non-expired points belonging to the same trip; writers can only change their own point.

High-frequency current-point uploads do not alter `trips.version` or trip schedule change logs, preventing position refreshes from conflicting with itinerary edits. Switch and revocation operations retain minimal auditable server records without exposing coordinates in logs.

## API Boundary

- `GET /v1/trips/:tripId/location-sharing`: authenticated member status, active-member summary, and visible non-expired member locations.
- `PUT /v1/trips/:tripId/location-sharing`: toggle the caller's sharing state. Disabling revokes their visible current point.
- `PUT /v1/trips/:tripId/location-sharing/current-location`: accept finite WGS84 coordinates only for an active member with sharing enabled; refresh the ten-minute expiry.

The Worker authenticates every request and maps RLS/permission/dependency failures to explicit API responses. No service-role key, raw token, or coordinate history is returned to browser logs.

## Client Interaction

Mine owns the sharing switch. Before enabling, it explains that sharing occurs only while the app is open, is limited to active trip members, has no history, and is not a safety guarantee. Enable requests foreground location permission, writes an initial point, then starts a replaceable `watchPosition` controller. Successful state states the number of active sharing recipients.

Map reads the same sharing state and renders visible members as distinct current-location markers with identity and last-update/expiry context. It never shows a route or historical path.

Turning off stops the browser watch before requesting the server revocation. The UI reports success only after the revoke succeeds. If revocation fails, it remains visibly pending and offers retry; it must not pretend the location is already private.

## Failure Handling

- Browser location denied/unavailable: leave sharing off and keep map/itinerary usable.
- Initial upload fails: stop the watch, return the switch to off, and report the failure.
- Subsequent upload fails: keep the last known server expiry visible, show retry/dependency state, and do not extend a point locally.
- Expiry: the server excludes the point from member reads; UI identifies it as expired rather than displaying stale current location.
- No active peers: explain that no other active trip member can currently view a shared point.

## Verification

- SQL/RLS assertions for self-write, same-trip active-member read, cross-trip/non-member denial, expiration, and revocation.
- Worker tests for authenticated validation, disabled-upload denial, and dependency errors.
- Browser tests for default-off, permission grant/denial, upload, marker visibility, expiry display, and revoke retry.
- Mobile check at 390px verifies the privacy explanation and controls have no horizontal overflow.
