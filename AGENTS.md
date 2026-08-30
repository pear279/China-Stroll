# Project Working Rules

## Before Coding

1. Read `PRODUCT.md`, `ARCHITECTURE.md` and `TASKS.md` completely.
2. Read the directly relevant source files and references for the selected task.
3. Confirm the selected task is listed in `TASKS.md` and write a small implementation plan before editing code.
4. When legacy files under `references/` conflict with the root context files, the root context files win. Preserve legacy documents as history unless the task explicitly updates them.

## For Every Task

Follow `Plan → Execute → Verify → Update Context`.

- Work on one independently verifiable task at a time.
- Keep domain objects provider-neutral. `placeId`, WGS84 coordinates and product route types are authoritative.
- AI may propose but must not directly apply itinerary, reservation or privacy changes.
- All trip writes retain permission, expected-version, command-id and change-log checks.
- Add or update tests for normal, permission-denied, conflict and dependency-failure paths as applicable.
- User-facing work must include loading, empty, error and success feedback and be checked at 390px width.
- After verification, update `TASKS.md` and any changed decision in `ARCHITECTURE.md` in the same change.

## Data and Content Rules

- Do not infer opening times, ticket prices, booking rules or entrances from search snippets, aggregators or model output.
- Publish a place only when its content, localization, WGS84 coordinate and source mappings pass the documented gate.
- Keep unknown facts explicit; do not replace missing values with plausible placeholders.
- Do not expose service-role keys, AI secrets, access tokens or production connection strings in code, chat logs or committed files.

## Image Rules

- `data/processed/place-display-images` is the only approved place-display source.
- Never copy from `data/50景点图片附件` into the web public directory.
- Every place-image change must run the deterministic mapping check.
- `forbidden-city` maps to the `palace-museum` display source unless the product decision changes.
- Missing illustrations fail the build/check; they do not fall back to a real photo.

## Location-sharing Rules

- Sharing is off by default and requires an explicit user switch.
- Only accepted members of the same trip are associated users for the first version.
- Store only an expiring current point, not a location trail.
- Turning sharing off must stop browser updates and revoke server visibility.
- Removing a member must remove their ability to read location through RLS.
- Never describe location sharing as a safety guarantee.

## Local Environment

- Supported runtime: Node.js 22 or 24 on Apple silicon.
- Install dependencies on this Mac with `npm ci` from the committed lock file.
- Never copy `node_modules`, native bindings, `dist` or `.wrangler` state from another computer.
- Secrets belong in ignored local environment files or deployment secret stores.

## Verification Commands

Run the smallest relevant check during implementation and the full gate before completing a milestone:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

For database changes also run:

```bash
npm run db:verify
```

For UI changes, run the application, capture mobile and desktop screenshots, and verify against the Product Quality Gate.

## Before Shipping

- Review the feature against `PRODUCT.md` and its task acceptance criteria.
- Confirm security, RLS, permission denial, version conflict, weak-network and third-party failure states.
- Remove temporary logs, test-only production switches, hard-coded secrets, unapproved photographs and obsolete mocks.
- Confirm the formal basemap, image policy, privacy copy and attribution requirements.
- Do not report completion without current test/build evidence.
