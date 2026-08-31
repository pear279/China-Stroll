# Task 6 Report

Date: 2026-08-31
Task: Task 6 — Complete Attractions 1.0, milestone slice for place detail, sources, and preview Q&A
Scope confirmed from `TASKS.md` and `task-6-brief.md`: remove the preview access-token gate for reviewed local Q&A, render trust/source states exactly, preserve save/add/navigation behaviors, and cover signed-out behavior with focused tests.

## Small Plan

1. Add failing tests for place detail sections, clickable HTTPS citations, preview Q&A trust modes, failure preservation, and signed-out behavior through the injected repository.
2. Refactor `PlaceDetailPanel` to load detail/guide from the repository with stale-request protection, render reviewed fact/source sections, and allow preview questions without an auth gate.
3. Add reusable source rendering, wire any shell prop changes needed without regressing focus/action flows, then run focused tests followed by `typecheck` and `lint`.

## RED / GREEN Log

- RED 1: Added `PlaceDetailPanel` tests for reviewed sections, clickable citations, signed-out preview Q&A, web-grounded trust mode, unable-to-confirm trust modes, and draft preservation on failure. `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx` failed because the panel did not render full detail sections, disabled signed-out questions, had no accessible `Ask` button, and rendered guide sources as plain text.
- RED 2: Added `AppShell` focus-restoration regression coverage. `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx apps/web/src/app-shell/AppShell.test.tsx` failed because the shell did not restore focus after closing place details.
- GREEN: Refactored the panel to use repository-backed detail/guide/question loading with stale-request guards, added reusable source cards and exact trust-mode rendering, removed the preview auth gate for reviewed local questions, and restored opener focus in `AppShell`. Focused tests passed.

## Files

- Updated: `apps/web/src/components/PlaceDetailPanel.tsx`
- Added: `apps/web/src/components/PlaceDetailPanel.test.tsx`
- Added: `apps/web/src/components/PlaceSources.tsx`
- Updated: `apps/web/src/app-shell/AppShell.tsx`
- Updated: `apps/web/src/app-shell/AppShell.test.tsx`
- Updated: `apps/web/src/app-shell/types.ts`
- Updated: `apps/web/src/App.tsx`
- Updated: `apps/web/src/styles.css`
- Updated: `TASKS.md`

## Verification

- `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx apps/web/src/data/placeRepository.test.ts apps/web/src/app-shell/AppShell.test.tsx` ✅ 3 files, 20 tests passed
- `npm run typecheck` ✅
- `npm run lint` ✅
- `git diff --check` ✅

## Self-review

- Verified the panel preserves Save/Add/navigation flows while moving detail/guide/question reads behind the injected repository.
- Checked that signed-out preview still submits local reviewed questions and that web-grounded answers show retrieval time plus clickable HTTPS citations.
- Confirmed focus returns to the opener after closing details and recorded the verified Task 6 slice in `TASKS.md`.
- No architecture decision changed, so `ARCHITECTURE.md` did not need an update for this slice.

## Concerns

- I did not rerun desktop/mobile screenshots or a full build gate in this subtask; the scoped verification here is the requested focused tests plus fresh `typecheck` and `lint`.

## Fix Round 1

### RED / GREEN Evidence

- RED 3: Added a guide-source regression for `checkedAt: null` plus a focus-entry/trap regression and a stale guide-response regression. `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx apps/web/src/data/placeRepository.test.ts apps/web/src/app-shell/AppShell.test.tsx` failed because guide sources still fabricated `Checked 2026-09-01` from `reviewDueAt`, and focus remained outside the dialog instead of moving inside and trapping `Tab` / `Shift+Tab`.
- GREEN 2: Replaced fabricated guide-source normalization with a display-only source shape that keeps `checkedAt` nullable, renders an explicit unknown-check-date label, removes the summary line that implied known check dates, and added initial focus plus a local `Tab` / `Shift+Tab` trap on the dialog while preserving close and focus restoration. The stale audience-change guide test also passed with the existing request-id guard.

### Changed Files

- Updated: `apps/web/src/components/PlaceDetailPanel.tsx`
- Updated: `apps/web/src/components/PlaceDetailPanel.test.tsx`
- Updated: `apps/web/src/components/PlaceSources.tsx`
- No `TASKS.md` or `ARCHITECTURE.md` change was needed for this review fix.

### Verification

- `npx vitest run apps/web/src/components/PlaceDetailPanel.test.tsx apps/web/src/data/placeRepository.test.ts apps/web/src/app-shell/AppShell.test.tsx` ✅ 3 files, 23 tests passed
- `npm run typecheck` ✅
- `npm run lint` ✅
- `git diff --check` ✅

### Self-review

- Confirmed guide sources no longer invent `checkedAt` values from `reviewDueAt` or the current clock.
- Confirmed the unknown source-date state stays explicit while preserving the clickable HTTPS link.
- Confirmed the dialog now takes focus on open and cycles focus within the panel without breaking close or shell-level focus restoration.
