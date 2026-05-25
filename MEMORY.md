# Project Memory
Last updated: 2026-05-25 | Session 5 | Branch: main
Memory health: 9/10

## Project Overview
H.I.M. (`hiitsme`) — retro AIM-style mobile-first messaging app. Vite + React 19 + React Router v7 web app, deployed on Vercel (web) and wrapped via Capacitor 8 for iOS + Android. Supabase for auth/Postgres/realtime/edge-functions.

## Where We Left Off
- **Current task:** Active items list worked through. Android assets done. Alias cleanup + UIGlassEffect deferred.
- **Status:** TestFlight build confirmed live. Android mipmaps regenerated with Midnight amber design. `capacitor.config.ts` webDir bug was a stale note — already correct.
- **Next immediate step:** After 2026-05-28, delete `--rose`/`--gold`/`--lavender` CSS aliases + `himRose`/`himLavender` from AppDelegate.swift.
- **Open question:** None.

## Completed (this session)
- 2026-05-25 Android mipmaps replaced with Midnight amber design: `scripts/generate-android-assets.mjs` (Playwright, same design as iOS icon), 15 PNGs across 5 densities (flat + adaptive foreground), `ic_launcher_background` color `#FFFFFF` → `#13100E`. `android:assets` npm script added.
- 2026-05-25 Confirmed `capacitor.config.ts` webDir bug was stale — `build-native-web.mjs` already outputs to `dist/`, all three files agree.
- 2026-05-25 UIGlassEffect top pill: researched Apple PDFs — custom Liquid Glass is SwiftUI-only (`glassEffect(_:in:)`); no UIKit equivalent for arbitrary views. UIKit path requires `UIHostingController` bridging. Deferred: needs real device test on iOS 26 GM. Current blur+overlay approximation is Apple's recommended fallback for UIKit custom chrome.

## Completed (recent sessions)
- 2026-05-17 PR #46 — `fix(ios,brand)`: align `himRose` → `himChiraag` amber `#E8A23A`; alias kept for one release
- 2026-05-17 him-landing PRs #1 + #2 — `hiitsme.app/privacy` + `hiitsme.app/terms` pages live
- 2026-05-17 PR #44 — Phase 4: legal section + push permission audit (`nativePush.ts`, Notifications + Legal on /account)
- 2026-05-17 PR #42 — Liquid Glass iOS tab bar (`configureWithDefaultBackground()`, bottom chrome rip-out, 5-tone accent resolver)
- 2026-05-17 PRs #39–41 — migration history repair, native chrome theming, CapacitorApp vendor
- 2026-05-15 PRs #37 + #38 — Phase 3: server-side content filter, `flagged_at` render placeholder
- 2026-05-15 PR #36 — Phase 1 + 2: account deletion, block/report on all UGC surfaces

## Active Work
- [ ] Delete `--rose`/`--gold`/`--lavender` deprecation aliases from `globals.css` + `himRose`/`himLavender` from AppDelegate.swift — hold until **2026-05-28**
- [ ] UIGlassEffect top chrome pill — deferred. Approach: `UIHostingController` hosting SwiftUI `Color.clear.glassEffect(in: .capsule)` pinned behind the dock pill content; remove `UIBlurEffect`. Requires iOS 26 GM device test before shipping.

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
- Liquid Glass: `UITabBar.configureWithDefaultBackground()` — system paints Liquid Glass on iOS 26, standard bar on older. Top chrome pill is blur+overlay (0.55/0.45α). True `UIGlassEffect` top pill is a known follow-up.
- App Store screenshots: `scripts/take-app-store-screenshots.mjs` — set `PLAYWRIGHT_USER_A_SCREENNAME` + `PLAYWRIGHT_USER_A_PASSWORD` env vars for live authenticated screens.

## Known Issues
- `himRose` + `himLavender` aliases in AppDelegate.swift kept for one release; delete alongside web `--rose`/`--gold`/`--lavender` aliases after 2026-05-28

## Session Log
| Session | Date | Summary |
|---------|------|---------|
| 1 | 2026-05-14 | Recovery mode init. Midnight migration (PR #32), iOS+Android resync (PR #33), MEMORY.md tracking (PR #34). |
| 2 | 2026-05-15 | App Store prep Phases 1–3. Account deletion + block/report (PR #36), content filter + hotfix (PRs #37+#38). |
| 3 | 2026-05-17 | PRs #40–#42, Phase 4 (PR #44), him-landing /privacy + /terms, PR #46 amber alignment. All App Store blockers cleared. |
| 4 | 2026-05-17 | Midnight amber brand artwork + icon fix (unassigned child). Live screenshots captured. iOS synced + Xcode open. |
| 5 | 2026-05-25 | TestFlight confirmed live. Android mipmaps regenerated (Midnight amber). UIGlassEffect researched + deferred (SwiftUI-only, needs `UIHostingController` bridge + iOS 26 GM device test). |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- UI work: verify in a browser before declaring done
- Default to no comments unless WHY is non-obvious

## External Context
- Supabase: 28 migrations applied through `20260515021650_content_moderation.sql`.
- Vercel: deploys web; client env vars `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`; server-side `SUPABASE_SERVICE_ROLE_KEY`.
- Native push: APNs auth key `AuthKey_XV95PUP6YN.p8` in repo root (verify gitignored in production).
- Legal pages live: `hiitsme.app/privacy` + `hiitsme.app/terms` (him-landing repo).
