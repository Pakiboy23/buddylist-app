# Memory Archive — H.I.M.
Archived from `MEMORY.md` on 2026-08-22. Sessions 1–9 (2026-05-14 → 2026-06-12): pre-launch build + App Store approval.

## Summary
Sessions 1–9 took H.I.M. from a post-Next.js-migration codebase to an approved App Store app. The arc: locking the Midnight design system, building the full trust-and-safety surface Apple requires (account deletion, block/report, content moderation, legal pages), shipping native chrome for iOS, then surviving two App Store rejections. Work was PR-driven into `main` (PRs #32–#64).

## Key milestones
- **S1 (05-14)** Memory init after a recovery. Midnight design migration (PR #32), dist/ resync (#33), first `MEMORY.md` (#34).
- **S2 (05-15)** Trust & safety phases 1–3: account deletion + block/report (#36), server-side content filter with `flagged_at` render placeholder (#37–38).
- **S3 (05-17)** Migration-history repair, native chrome theming, Liquid Glass iOS tab bar (#39–44). Legal pages live at hiitsme.app/privacy + /terms. Amber alignment (#46).
- **S4 (05-17)** Brand artwork, icon fix, live App Store screenshots.
- **S5 (05-25)** First TestFlight build live. Android mipmaps regenerated in Midnight amber. UIGlassEffect top pill researched and deferred (SwiftUI-only; needs `UIHostingController` bridging).
- **S6 (05-25)** Compliance sprint: privacy manifests, `security_events` audit log, GDPR self-service export (Art. 15/20), retention cron, EU banner, notification-preview toggle defaulting to sender-only.
- **S7 (05-29)** "hi." wordmark app icon shipped. Liquid Glass dock attempted then reverted. Build 167.
- **S8 (06-07)** dist/ drift fixed, build 177. Liquid Glass status corrected (was in fact re-enabled builds 170–177).
- **S9 (06-07 → 06-12)** The App Store review saga. Built ASC API tooling (`scripts/asc/asc.mjs`, zero-dep ES256 JWT client) and drove all metadata remediation through it. Fixed rejection #1 (2.1(a) iPad unresponsive: `width:100vw` overflow + opaque boot splash → `width:100%` + boot watchdog, PR #59, build 200). Fixed rejection #2 across two guidelines: 1.5 Support URL (`public/support.html`, PR #61) and 5.1.1(v) account deletion, which turned out to be **four stacked bugs** — (1) CORS Allow-Headers missing `x-client-info` that `functions.invoke` always sends, (2) `isMissingTable()` matching only Postgres `42P01` while PostgREST returns `PGRST205`/"schema cache", (3) no path to `/account` in the iOS native ⋯ menu, (4) legacy rooms-v1 triggers on `_archive_user_active_rooms` firing against the dropped `room_participants` table, aborting every cascade delete for accounts with rooms-v1 history (PR #64). Also de-gendered app-facing copy (PR #60).

## Durable lessons from this era
- Account deletion testing must use **data-bearing** accounts; fresh empty accounts skip archive cascades and produce false "verified" results.
- PostgREST's missing-table error is `PGRST205` "schema cache", **not** Postgres `42P01`. Guard for both.
- Xcode Cloud assigns build numbers independently of `CURRENT_PROJECT_VERSION`, so the pbxproj number routinely lags what is live.
- Memory drift is real here: sessions 6–8 commits lived on an un-pushed local `main` and were clobbered when PRs merged via GitHub (preserved on `backup/local-main-session8`). Push memory commits promptly.
