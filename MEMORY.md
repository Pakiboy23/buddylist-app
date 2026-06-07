# Project Memory
Last updated: 2026-06-07 | Session 8 | Branch: main
Memory health: 9/10

## Project Overview
H.I.M. (`hiitsme`) — retro AIM-style mobile-first messaging app. Vite + React 19 + React Router v7 web app, deployed on Vercel (web) and wrapped via Capacitor 8 for iOS + Android. Supabase for auth/Postgres/realtime/edge-functions.

## Where We Left Off
- **Current task:** Session-start cleanup done — worktree is CLEAN, ready for today's work.
- **Status:** Committed (`ba80371`, `6930bdd`, `d708575`). Found + fixed a latent bug: committed `dist/` had drifted from source (stale asset hashes, an untracked orphan build left behind). Rebuilt fresh, resynced iOS via `cap copy`, bumped to build 177. tsc clean, 106/106 unit tests pass, same Supabase backend, plugin registration preserved.
- **Next immediate step:** Awaiting today's task — build pipeline + tree are healthy.

## Completed (Session 8 — 2026-06-07)
- Session-start cleanup: rebuilt stale `dist/` (committed asset hashes had drifted from source; a reverted build had left 56 untracked orphan assets), resynced iOS `public/` via `cap copy`, bumped CFBundleVersion → 177 (`ba80371`). Verified same Supabase backend baked in; restored `HiItsMeShellPlugin` registration in `capacitor.config.json` (cap copy drops it). Removed stray empty `1.0` file. Tracked `supabase/.temp/linked-project.json` (`d708575`, follows 8 sibling files) + added `swiftui-liquid-glass` skill (`6930bdd`).

## Completed (Session 7 — 2026-05-29)
- 2026-05-29 New "hi." app icon shipped (PRs in `fc9b9b3` + `53387cc`): Nunito Black wordmark, Chiraag amber on Midnight, period as oversized circle for 60×60 Spotlight legibility. 13 iOS sizes + Android 5 densities (flat + adaptive foreground). Replaces Samaan chiraag mark (wrong semantic for chat, fragile small).
- 2026-05-29 CFBundleVersion bumped 162 → 166 → 167 for App Store builds.
- 2026-05-29 SwiftUI Liquid Glass top dock bridge implemented then reverted after physical TestFlight blank-screen report. Stable UIKit blur top dock restored.
- 2026-05-25 EU storage disclosure banner (`8ebac35`): `src/lib/euTimezone.ts` allowlist (EU/EEA/UK/CH), `src/components/StorageNotice.tsx` fixed bottom banner for EU users, `docs/compliance/storage-inventory.md` audits all 12 localStorage keys (all strictly necessary).
- 2026-05-25 Notification preview toggle (`321563c`): new accounts default to sender-only (lock-screen safety); existing users backfilled to `full`. Three radio modes (Full / Sender only / Hidden) on `/account`. `src/lib/pushPreview.ts` extracted; APNs payload gets `mutable-content:1` (forward-compat for future NSE).
- 2026-05-25 Audit log + GDPR docs (`1d44a7f`): `public.security_events` table (migration `20260525000005`, RLS — authed users insert own rows, anon for pre-auth failures), `src/lib/securityEvent.ts` fire-and-forget helper, all 10 audit gaps closed (signin success/failure, signup, password reset, email/password change, forced signout, admin access, account deletion manifest, GDPR export delivery). `run_retention_cleanup()` prunes security_events at 90 days. Full GDPR doc set + pg_cron migration `20260525000004`.
- 2026-05-25 iOS privacy manifests (`e16219d`): `ios/App/App/PrivacyInfo.xcprivacy` main app + 6 CapacitorVendor plugins. `CapawesomeCapacitorBadge` declares CA92.1 for UserDefaults. `scripts/prepare-ios-swift-packages.mjs` injects manifests + patches Package.swift on every re-sync.
- 2026-05-25 Export compliance + privacy effective date (`c314b7b`): `ITSAppUsesNonExemptEncryption=false` baked into Info.plist; privacy policy effective date set to 2026-05-25.
- 2026-05-25 Android mipmaps replaced with Midnight amber design: `scripts/generate-android-assets.mjs` (Playwright), 15 PNGs across 5 densities, `ic_launcher_background` → `#13100E`. `android:assets` npm script added.
- 2026-05-25 UIGlassEffect top pill: custom Liquid Glass is SwiftUI-only (`glassEffect(_:in:)`); UIKit path requires `UIHostingController` bridging. Deferred — needs iOS 26 GM device test.

## Completed (recent sessions)
- 2026-05-17 PR #46 — `fix(ios,brand)`: align `himRose` → `himChiraag` amber `#E8A23A`; alias kept for one release
- 2026-05-17 him-landing PRs #1 + #2 — `hiitsme.app/privacy` + `hiitsme.app/terms` pages live
- 2026-05-17 PR #44 — Phase 4: legal section + push permission audit (`nativePush.ts`, Notifications + Legal on /account)
- 2026-05-17 PR #42 — Liquid Glass iOS tab bar (`configureWithDefaultBackground()`, bottom chrome rip-out, 5-tone accent resolver)
- 2026-05-17 PRs #39–41 — migration history repair, native chrome theming, CapacitorApp vendor
- 2026-05-15 PRs #37 + #38 — Phase 3: server-side content filter, `flagged_at` render placeholder
- 2026-05-15 PR #36 — Phase 1 + 2: account deletion, block/report on all UGC surfaces

## Active Work
- [x] Delete `--rose`/`--rose-dark`/`--gold`/`--lavender` CSS aliases + `himRose` Swift alias. Migrated ~60 CSS call sites + ~25 Swift call sites + 8 component files. (Swift `himLavender` left in place — it's a real distinct color `#A78BFA`, not an alias; only used in `headerGradientLayer` at AppDelegate.swift:580.)

## Blockers
- None

## Key Decisions
| Date | Decision | Reasoning | Affects |
|------|----------|-----------|---------|
| 2026-05-17 | `generate-ios-assets.mjs` writes to `icon-1024.png` | Must match `Contents.json` slot name; `AppIcon-512@2x.png` was unassigned → Xcode error | `scripts/generate-ios-assets.mjs`, `AppIcon.appiconset/` |
| 2026-05-17 | Push permission never requested on cold launch | Apple Guideline 2.5.13; request only on deliberate user action in Account → Notifications | `GlobalNotificationListener.tsx`, `src/lib/nativePush.ts` |
| 2026-05-17 | Legal links point to `hiitsme.app/privacy` + `/terms` | Standard App Store requirement; pages must exist before review | `src/app/account/page.tsx` |
| 2026-05-17 | Liquid Glass: tab bar uses `configureWithDefaultBackground()` | Per Apple docs — custom backgrounds interfere with Liquid Glass on iOS 26 | `ios/App/App/AppDelegate.swift` |
| 2026-05-17 | Dock overlay alpha 0.55/0.45 (not 0.92 opaque) | Opaque overlay defeats the blur material | `ios/App/App/AppDelegate.swift` |
| 2026-05-29 | App icon = H.I.M.-specific "hi." wordmark, not Samaan chiraag | chiraag mark is wrong semantic for a chat app + fragile at 60×60. Period rendered as oversized circle so the H.I.M. punctuation reference reads at every size | `AppIcon.appiconset/`, Android mipmaps |
| 2026-05-25 | Notification preview default = sender-only for new accounts | Reduces outing risk from message text on lock screen; existing users backfilled to `full` to preserve prior behavior | `supabase/migrations/20260525000003`, `src/lib/pushPreview.ts`, `/account` |
| 2026-05-25 | `ITSAppUsesNonExemptEncryption=false` baked into Info.plist | Skips export-compliance prompt on every App Store upload | `ios/App/App/Info.plist` |
| 2026-05-25 | `security_events` table is fire-and-forget, not blocking | Audit log must never fail a user action; helper swallows errors | `src/lib/securityEvent.ts`, `20260525000005` migration |
| 2026-05-15 | Content moderation = DB trigger + `bad-words` wordlist | `BEFORE INSERT` trigger is cleanest server-side gate | `supabase/migrations/20260515021650_content_moderation.sql` |
| 2026-05-14 | Locked Midnight design system: Chiraag amber `#E8A23A`, midnight indigo `#1A1F3A`, pale stone `#F5F1E8` | Replaces rose/lavender/gold/blue; source: Samaan brand book | Whole UI, native chrome |
| ~2026-04 | Next.js → Vite + React Router v7 | Cleaner Capacitor bundling, simpler API split | Whole frontend + `api/` |
| v1 | DMs and rooms NOT a unified surface | Rooms lack read receipts, delivery tracking, forwarding — intentional product scope | Parity backlog |

## Key Files
| File | Purpose |
|------|---------|
| `src/context/ChatContext.tsx` | Persistent room state + unread logic |
| `src/components/GlobalNotificationListener.tsx` | App-wide DM/room banners; push token registration (auto-registers if already granted, never prompts) |
| `src/components/GroupChatWindow.tsx` | Room UI + presence; long-press Report + Block-sender |
| `src/components/ChatWindow.tsx` | DM UI; long-press Report for incoming messages |
| `src/components/BuddyProfileSheet.tsx` | Profile sheet; Block/Unblock/Report always visible |
| `src/app/account/page.tsx` | Account settings: email, password, Notifications (native push toggle), Legal (Privacy/Terms/Contact), Delete account |
| `src/app/account/delete/page.tsx` | Self-service account deletion (Apple 5.1.1(v)) |
| `src/app/hi-its-me/page.tsx` | H.I.M. main view — buddies, DMs, rooms, settings |
| `src/lib/nativePush.ts` | `checkPushPermission()` + `requestAndRegisterPush()` — deliberate-action push permission helpers |
| `src/lib/accountDeletion.ts` | Screenname confirmation matcher + edge-function invoke |
| `src/lib/contentModeration.ts` | `isObjectionable()` + `displayBodyForMessage()` (mirrors DB trigger) |
| `src/lib/securityEvent.ts` | Fire-and-forget audit log helper (writes to `public.security_events`) |
| `src/lib/euTimezone.ts` | EU/EEA/UK/CH timezone allowlist via `Intl.DateTimeFormat` |
| `src/components/StorageNotice.tsx` | Fixed bottom storage-disclosure banner for EU users |
| `src/lib/pushPreview.ts` | `applyNotificationPreview()` — full/sender-only/hidden modes |
| `ios/App/App/PrivacyInfo.xcprivacy` | App Privacy manifest (NSPrivacyTracking=false, 8 data types AppFunctionality/linked) |
| `scripts/prepare-ios-swift-packages.mjs` | Vendors Capacitor plugins + injects `PrivacyInfo.xcprivacy` + patches Package.swift on every re-sync |
| `ios/App/App/AppDelegate.swift` | Native iOS shell — top chrome pill, Liquid Glass tab bar, 5-tone accent resolver, light/dark chrome |
| `ios/App/App/Assets.xcassets/AppIcon.appiconset/icon-1024.png` | App icon (Midnight amber design, 1024×1024); regenerate via `npm run ios:assets` |
| `scripts/generate-ios-assets.mjs` | Generates `icon-1024.png` + splash PNGs using Playwright headless render |
| `scripts/take-app-store-screenshots.mjs` | Captures 18 App Store screenshots (3 sizes × 6 screens); credentials via env vars |
| `supabase/functions/delete-account/` | Edge function: wipes 14 user tables + auth.users |
| `supabase/migrations/` | 28 ordered migrations (through `20260515021650_content_moderation.sql`) |
| `capacitor.config.ts` | iOS/Android wrapper config (`webDir` mismatch bug flagged) |

## Architecture Notes
- Realtime channels: `active_chat_room:${roomId}` (room presence), `global_notifications_messages` (DMs), `global_notifications_room_messages` (rooms)
- Rooms v2: `public.rooms` + `public.room_memberships`. Join/leave via `join_room_by_id` / `leave_room_by_id` SECURITY DEFINER RPCs (bypasses RLS recursion bug on direct INSERT).
- Local cache namespace: `hiitsme:ui:v1:<userId>` with legacy-key migration
- Native push flow: `GlobalNotificationListener` adds `registration` listener → token upserted to `user_push_tokens`. `requestAndRegisterPush()` in `nativePush.ts` is the ONLY permitted trigger for new permission requests.
- Liquid Glass: `UITabBar.configureWithDefaultBackground()` lets the system paint Liquid Glass on iOS 26 and standard tab bar chrome on older iOS. SwiftUI top-dock glass was RE-ENABLED after Session 7 (builds 170–177, despite the earlier blank-screen revert): install deferred until first JS chrome publish to dodge the boot blank-screen; WebView runs edge-to-edge so Glass samples the real web gradient; native UIColor backgrounds aligned to CSS gradient midpoints (dark `#1A1F3A`, light `#F5F1E8`); `HiItsMeShellPlugin` registered via `prepare-ios-swift-packages.mjs` (Capacitor 8 autoRegister skips in-app plugins). Last touched `7c834a3` (2026-06-06).
- App Store screenshots: `scripts/take-app-store-screenshots.mjs` — set `PLAYWRIGHT_USER_A_SCREENNAME` + `PLAYWRIGHT_USER_A_PASSWORD` env vars for live authenticated screens.

## Known Issues
- **dist/ drift:** committed `dist/` can fall out of sync with source if a build's `index.html`/deletions get reverted via git while the new hashed assets stay untracked (orphans). Always rebuild (`npm run build` — `emptyOutDir` wipes orphans) before committing a resync. Found + fixed Session 8.
- `npx cap copy ios` regenerates `capacitor.config.json` and DROPS `HiItsMeShellPlugin` from `packageClassList`. Restore from HEAD, or run full `npm run ios:sync` (note `prepare-ios-swift-packages.mjs` only works after a full `cap sync`, not `cap copy` — it throws on the already-prepared `Package.swift`).
- None outstanding for brand migration. `himLavender` `#A78BFA` in `headerGradientLayer` is a real color, not an alias.

## Session Log
| Session | Date | Summary |
|---------|------|---------|
| 1 | 2026-05-14 | Recovery mode init. Midnight migration (PR #32), iOS+Android resync (PR #33), MEMORY.md tracking (PR #34). |
| 2 | 2026-05-15 | App Store prep Phases 1–3. Account deletion + block/report (PR #36), content filter + hotfix (PRs #37+#38). |
| 3 | 2026-05-17 | PRs #40–#42, Phase 4 (PR #44), him-landing /privacy + /terms, PR #46 amber alignment. All App Store blockers cleared. |
| 4 | 2026-05-17 | Midnight amber brand artwork + icon fix (unassigned child). Live screenshots captured. iOS synced + Xcode open. |
| 5 | 2026-05-25 | TestFlight confirmed live. Android mipmaps regenerated (Midnight amber). UIGlassEffect researched + deferred (SwiftUI-only, needs `UIHostingController` bridge + iOS 26 GM device test). |
| 6 | 2026-05-25 | Compliance push: iOS privacy manifests (app + 6 plugins), export-compliance flag, audit log (`security_events` + 10 gaps), GDPR doc set + retention cron, EU storage banner, notification preview toggle (sender-only default). |
| 7 | 2026-05-29 | SwiftUI Liquid Glass top dock attempted + reverted (TestFlight blank screen). New "hi." app icon shipped (iOS + Android). CFBundleVersion → 167. Memory refreshed. |
| 8 | 2026-06-07 | Session-start cleanup. Fixed latent dist/ drift (committed bundle stale vs source) — rebuilt + resynced iOS, build 177. Corrected memory: Liquid Glass was RE-enabled builds 170–177 (Session 7 "reverted" note was wrong). Tree clean; tsc + 106 tests pass. |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- UI work: verify in a browser before declaring done
- Default to no comments unless WHY is non-obvious

## External Context
- Supabase: migrations applied through `20260525000005` (security_events). Notable recent: `20260525000003` notification preview default, `20260525000004` retention cron, `20260525000005` security_events table.
- Vercel: deploys web; client env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; server-side `SUPABASE_SERVICE_ROLE_KEY`.
- Native push: APNs auth key `AuthKey_XV95PUP6YN.p8` in repo root (verify gitignored in production).
- Legal pages live: `hiitsme.app/privacy` + `hiitsme.app/terms` (him-landing repo).
