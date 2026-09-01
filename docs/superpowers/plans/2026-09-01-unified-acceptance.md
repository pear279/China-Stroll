# MVP Function Completion — Unified Acceptance Checklist

Date: 2026-09-01  
Branch: `codex/attractions-1-0`

## Scope

Packages 1 (Account/Profile/Trip Members), 2 (Complete Itinerary and Reservation Editing), 3 (Tools 1.0), and 4 (Private Places and Map boundary) are implemented. Package 5 (private photo/travel records and basic offline reading) is **postponed by product decision** and is not part of this milestone.

## Automated Gate (verified locally)

- [x] `npm run typecheck` — PASS (web + worker).
- [x] `npm run lint` — PASS, 0 warnings / 0 errors.
- [x] `npm test` — PASS, 29 files / 222 tests.
- [x] `npm run build` — PASS (typecheck + lint + places:verify + tests + web + Pages Functions + Worker dry-run).
- [x] `npm run db:verify` — PASS (two clean PostgreSQL 17 rebuilds + transactional permission/RLS/concurrency tests).
- [x] `git diff --check` — clean.

## Product Success Criteria vs Evidence

| Criterion | Status | Evidence |
| --- | --- | --- |
| 找到景点 → 详情 → 加入指定日期 → 地图定位 → 第三方导航 | Verified in code + tests | Attractions discovery/detail/add-to-day; Map action sheet with Apple/Google/Amap links. |
| AI 推荐理由可理解、修改需确认 | Verified | Suggestion panel shows reason + changes; confirm path uses versioned commands. |
| 20 个地点核心事实错误为零、动态信息可溯源 | Verified | Deterministic 20-place validator + source-link assertions in `db:verify`. |
| 未经确认的 AI 行程写入为零 | Verified | AI only produces `update_stop` drafts; reservation draft is read-only; no AI write path. |
| 无权限成员读写为零 | Verified | RLS + service-role-only commands with `FORBIDDEN`/`NOT_FOUND` denial tests. |
| 位置共享默认关闭、关闭后停止上传 | Verified | Default-off switch; revoke deletes the current point in the same command; concurrency test. |
| 390px 无横向溢出 + 加载/空/错误/成功 | Partial | Component tests cover states; final screenshot walkthrough is a release item below. |
| 门禁全绿 | Verified | See Automated Gate above. |

## Deferred to Release Acceptance (require a deployed environment / real device)

- [ ] Two-account browser flow: invitation create → accept → member removal → trip permission → location sharing.
- [ ] 390px and desktop screenshot walkthrough across all four modules.
- [ ] Apple Maps / Google Maps / Amap real-device navigation and ride-hailing deep link.
- [ ] Formal basemap tile provider, attribution, license, and Beijing-network availability (provider decision is still open in `PRODUCT.md`).
- [ ] Beijing-network performance and weak-network/offline behavior.
- [ ] Production deployment smoke test after the local gate.

## Secrets and Privacy

- [x] No service-role keys, AI secrets, or access tokens in committed files; Worker dry-run shows only env bindings.
- [x] Raw invitation tokens stop at the Worker hashing boundary; only SHA-256 hashes reach the database.
- [x] Location trails are not stored; only one expiring current point per member.

## Merge Gate

This branch is 53 commits ahead of `main`. Merging requires explicit authorization; release push/deploy requires the deferred release-acceptance items to be run against a deployed environment.
