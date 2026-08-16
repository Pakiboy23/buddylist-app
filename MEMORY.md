# Project Memory
Last updated: 2026-06-12 | Session 9 | Branch: main
Memory health: 9/10

## Project Overview
H.I.M. (`hiitsme`) — retro AIM-style mobile-first messaging app. Vite + React 19 + React Router v7 web app, deployed on Vercel (web) and wrapped via Capacitor 8 for iOS + Android. Supabase for auth/Postgres/realtime/edge-functions. **In App Store review** (com.hiitsme.app, v2.0).

## Where We Left Off
- **Current task:** Resubmission after second rejection (5.1.1(v) account deletion + 1.5 Support URL). All four deletion bugs fixed and verified; Support URL live.
- **Status:** PR #64 open (legacy-trigger migration, applied to prod + verified against a data-bearing account). PRs #59–#63 merged. Builds 199/200 exist in ASC; Account-menu fix (#63) needs a NEW build.
- **Next immediate step:** Merge PR #64 → bump `CURRENT_PROJECT_VERSION` ≥ 201 → Xcode Cloud build → TestFlight on physical iPhone → record the deletion flow → Resolution Center reply (text drafted in session) → attach new build to v2.0 → resubmit.
- **Open question:** Delete the stale 6.5" screenshot set in ASC? whatsNew text?

## Completed (Session 9 — 2026-06-07 → 06-12)
- ASC API automation: `scripts/asc/asc.mjs` (zero-dep ES256 JWT client) + `scripts/asc/upload-screenshots.mjs`. Full metadata remediation via API: age rating 9+→18+, Support URL → hiitsme.app/support, reviewer notes lead with deletion steps, description fixes, 8× 6.9" screenshots uploaded (`scripts/store-screenshots.mjs`).
- Rejection #1 fixed — 2.1(a) iPad unresponsive (build 167): `width:100vw` overflow + opaque boot-splash with no escape. `width:100%` + boot watchdog + pointer-events fix (PR #59). Verified on iPad Air 11 M3 sim. Shipped build 200.
- Copy de-gendering: "gay men" dropped from app-facing copy; consent bullet now "may reveal my sexual orientation" (PR #60); internal strategy docs left as-is per user.
- Rejection #2, 1.5: `/support` page live (`public/support.html` + vercel.json rewrite, PR #61).
- Rejection #2, 5.1.1(v) — FOUR stacked deletion bugs found + fixed:
  1. CORS: `supabase.functions.invoke` sends `x-client-info`; Allow-Headers lacked it → preflight blocked (edge fn v2).
  2. `isMissingTable()` only matched `42P01`/"does not exist" — PostgREST returns `PGRST205`/"schema cache" → abort (edge fn v3, PR #62).
  3. iOS native ⋯ menu had NO path to /account — added "Account" UIAction → `openAccount` shell action (PR #63; needs build ≥201).
  4. Legacy rooms-v1 triggers on `_archive_user_active_rooms` deleted from the DROPPED `room_participants` table → 42P01 aborted every cascade delete for users with rooms-v1 history. Dropped triggers + function (migration `20260612000001`, applied to prod as `20260612065205`, PR #64). Verified: rollback-guarded delete of a data-bearing admin account succeeds end-to-end.
- Demo account `appreviewer2026` polished (buddies/messages); deletion reference video at `/tmp/him_rec/account-deletion.mp4`; `scripts/record-deletion.mjs` gained SIGNIN_*/SKIP_DELETE modes + delete-response logging.

## Active Work
- [ ] Merge PR #64; build ≥201; device recording; Resolution Center reply; resubmit v2.0
- [ ] SECURITY: revoke ASC key `XV95PUP6YN` (leaked in git history, commit `00b2839`); revoke+regenerate `LMT6SQA4GV` after submission work completes
- [ ] Optional: delete stale 6.5" ASC screenshot set; write whatsNew

## Blockers
- None — all deletion bugs fixed; waiting on build + device recording.

## Key Decisions
| Date | Decision | Reasoning | Affects |
|------|----------|-----------|---------|
| 2026-06-12 | Drop rooms-v1 sync triggers instead of recreating `room_participants` | Table is dead by design (rooms v2); triggers were pure debris | `_archive_user_active_rooms`, account deletion |
| 2026-06-11 | Account deletion testing MUST use data-bearing accounts | Fresh empty accounts skip archive cascades — false "verified" | delete-account testing |
| 2026-06-10 | Native ⋯ menu gets explicit "Account" item | 5.1.1(v): deletion must be reachable in-app on iOS; web popover ≠ native menu | `AppDelegate.swift`, `nativeShell.ts`, hi-its-me page |
| 2026-06-09 | Edge fn CORS Allow-Headers: `authorization, x-client-info, apikey, content-type` | `functions.invoke` adds x-client-info; missing → preflight 4xx | all edge functions |
| 2026-06-08 | ASC metadata managed via API (`scripts/asc/asc.mjs`) | Repeatable, scriptable; Resolution Center is NOT in the API (paste manually) | App Store ops |
| 2026-06-08 | `width:100%` not `100vw` on root | 100vw + iPad scrollbar/safe-area = horizontal overflow → "unresponsive" verdict | `globals.css`, `index.html` |
| 2026-05-29 | App icon = "hi." wordmark, not Samaan chiraag | Wrong semantic for chat + fragile at 60×60 | `AppIcon.appiconset/`, Android mipmaps |
| 2026-05-25 | Notification preview default = sender-only for new accounts | Outing risk from lock-screen message text; existing users backfilled `full` | `20260525000003`, `pushPreview.ts` |
| 2026-05-25 | `ITSAppUsesNonExemptEncryption=false` in Info.plist | Skips export prompt per upload | `Info.plist` |
| 2026-05-17 | Push permission never requested on cold launch | Guideline 2.5.13; deliberate action only | `nativePush.ts` |
| 2026-05-15 | Content moderation = DB trigger + `bad-words` wordlist | BEFORE INSERT trigger is cleanest server-side gate | `20260515021650` |
| 2026-05-14 | Midnight design system: amber `#E8A23A`, indigo `#1A1F3A`, stone `#F5F1E8` | Samaan brand book | whole UI |
| ~2026-04 | Next.js → Vite + React Router v7 | Cleaner Capacitor bundling | frontend + `api/` |
| v1 | DMs and rooms NOT a unified surface | Intentional product scope | parity backlog |

## Key Files
| File | Purpose |
|------|---------|
| `scripts/asc/asc.mjs` | ASC API client — `auth() { ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=fastlane/.keys/AuthKey_*.p8 node scripts/asc/asc.mjs "$@"; }` |
| `scripts/asc/upload-screenshots.mjs` | Reserve→PUT chunks→commit screenshot uploads |
| `scripts/store-screenshots.mjs` | Playwright store screenshots (430×932 @3x = 1290×2796) |
| `scripts/record-deletion.mjs` | Deletion-flow recorder; env SIGNIN_SCREENNAME/PASSWORD, SKIP_DELETE |
| `supabase/functions/delete-account/index.ts` | Edge fn v3: wipes ~14 tables then auth.users; CORS + isMissingTable fixed |
| `src/app/account/delete/page.tsx` | Two-step delete UI (testids: account-delete-cta, delete-confirm-input/-submit, delete-final-confirm) |
| `ios/App/App/AppDelegate.swift` | Native shell: ⋯ menu (now with Account), Liquid Glass dock, accent resolver |
| `src/lib/nativeShell.ts` | NativeShellAction union (incl. `openAccount`) + bridge |
| `src/app/hi-its-me/page.tsx` | Main view; shell-action switch routes `openAccount` → /account |
| `public/support.html` | Support page (Guideline 1.5) — live at hiitsme.app/support |
| `src/context/ChatContext.tsx` | Persistent room state + unread logic |
| `src/lib/contentModeration.ts` | Mirrors DB trigger; `displayBodyForMessage()` placeholder |
| `scripts/prepare-ios-swift-packages.mjs` | Vendors plugins + privacy manifests + registers HiItsMeShellPlugin |
| `supabase/migrations/` | Through `20260612000001_drop_legacy_room_participants_sync_triggers.sql` |

## Architecture Notes
- Realtime: `active_chat_room:${roomId}`, `global_notifications_messages`, `global_notifications_room_messages`
- Rooms v2: `public.rooms` + `room_memberships`; join/leave via SECURITY DEFINER RPCs (RLS recursion on direct INSERT)
- Native push: registration listener → `user_push_tokens`; `requestAndRegisterPush()` is the ONLY permission trigger
- Liquid Glass: SwiftUI top-dock re-enabled builds 170+; install deferred to first JS chrome publish; WebView edge-to-edge; `HiItsMeShellPlugin` registered by `prepare-ios-swift-packages.mjs`
- Xcode Cloud assigns build numbers — 199/200 exist despite `CURRENT_PROJECT_VERSION=179`; next build must set ≥201
- PostgREST missing-table error = `PGRST205` "schema cache", NOT Postgres `42P01` — guard for both

## Known Issues
- **Memory drift recovered:** session 6–8 commits (incl. `736a4b3` MEMORY.md update) lived on un-pushed local main, clobbered when PRs merged via GitHub; preserved on `backup/local-main-session8`. This file = recovered s8 base + s9. Push memory commits promptly.
- **dist/ drift:** always `npm run build` (emptyOutDir) before committing a resync; CI guard enforces dist/native-web/ios-public sync.
- `npx cap copy ios` regenerates `capacitor.config.json` and DROPS `HiItsMeShellPlugin` — use full `npm run ios:sync`.

## Session Log
| Session | Date | Summary |
|---------|------|---------|
| 1 | 2026-05-14 | Recovery init. Midnight migration (PR #32), resync (PR #33), MEMORY.md (PR #34). |
| 2 | 2026-05-15 | Account deletion + block/report (PR #36), content filter (PRs #37–38). |
| 3 | 2026-05-17 | PRs #40–44, legal pages live, amber alignment (PR #46). |
| 4 | 2026-05-17 | Brand artwork + icon fix. Live screenshots. |
| 5 | 2026-05-25 | TestFlight live. Android mipmaps. UIGlassEffect deferred. |
| 6 | 2026-05-25 | Compliance: privacy manifests, audit log (`security_events`), GDPR docs, EU banner, preview toggle. |
| 7 | 2026-05-29 | "hi." icon shipped. Liquid Glass dock attempted/reverted. Build 167. |
| 8 | 2026-06-07 | dist/ drift fixed, build 177. Liquid Glass status corrected (re-enabled 170–177). |
| 9 | 2026-06-12 | App Store review saga: ASC API tooling, 2.1(a) iPad fix (build 200), 5.1.1(v) deletion fixed (4 bugs: CORS, PGRST205, native menu, legacy triggers), /support live, screenshots uploaded. PR #64 open. |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- UI work: verify in a browser before declaring done
- Default to no comments unless WHY is non-obvious
- Prod writes (deploys/migrations): ask per action, then move fast once approved

## External Context
- ASC: app `6761863631`, v2.0 `03671932-b7be-418a-8dd6-49b16de88cc0`, en-US loc `c50ae36c…66a5`, reviewDetail `8627b22d…c4b7d`, 6.9" set `3b03f508…9e32`. Demo account `appreviewer2026` (password in ASC reviewer details — never store here).
- Supabase project `keckqpadzxwwmagnmpuk`; remote migrations through `20260612065205`.
- SECURITY: `AuthKey_XV95PUP6YN.p8` leaked in git history (`00b2839`) — REVOKE in ASC. `LMT6SQA4GV` passed through chat — revoke+regenerate when submission done. `.gitignore` covers `*.p8`.
- Legal pages live: hiitsme.app/privacy + /terms; support: hiitsme.app/support.
