# Project Memory
Last updated: 2026-05-14 | Session 1 | Branch: codex/him-midnight-migration
Memory health: 8/10

## Project Overview
H.I.M. (`hiitsme`) — retro AIM-style mobile-first messaging app. Vite + React 19 + React Router v7 web app, deployed on Vercel (web) and wrapped via Capacitor 8 for iOS + Android. Supabase for auth/Postgres/realtime. README "Stack" section is **stale** — still says Next.js 16, but the app migrated to Vite/React Router in commit `5ec1d04`.

## Where We Left Off
- **Current task:** Midnight design system migration (PR #31)
- **Status:** PR open, build passing, awaiting visual QA in browser + iOS sim
- **Next immediate step:** Verify rendered output against checklist (light/dark stone vs. midnight, amber CTAs, wordmark, online pip, privacy shield, status bar). Then iterate on visual fixes or generate native icon/splash artwork.
- **Open question:** When will brand artwork (amber lamp glyph + splash) be ready so `npm run ios:assets` can run? Currently deferred.

## Completed (last 10 commits)
- 2026-05-xx `e534dc7` Send auth token with room invite request
- 2026-05-xx `38a21ec` Room invite CORS 404, iOS fetch origin, plugin gates, render churn
- 2026-05-xx `beff381` Stabilize `useAppRouter` return value — stops bootstrap re-run loop
- 2026-05-xx `e9e9d1c` Stop channel re-subscribe cascade + stabilize profile edit flow
- 2026-05-xx `bd60abd` Stop buddy list flicker — skeleton only on empty load, stable `usersChannel`
- 2026-05-xx `309cdca` Chat UI regressions on iOS
- 2026-05-xx `2730e54` Profile bug fix, room invite, full light/dark theming
- 2026-05-xx `4f7d671` Stabilize buddy list re-renders + dark mode text contrast
- Pre-migration era: `5ec1d04` Next.js → Vite + React Router v7 + Vercel Functions
- Earlier: AIM-style shell polish, HIM design system, social graph + room discovery, push notifications

## Active Work
- [ ] **PR #31 visual QA** — verify Midnight migration renders correctly in light/dark, iOS sim, Android device
- [ ] Generate brand artwork (amber lamp glyph) so `npm run ios:assets` can regenerate iOS icons; Android mipmaps need direct replacement
- [ ] Follow-up PR after PR #31 merges: delete `--rose`, `--rose-dark`, `--gold`, `--lavender` deprecation aliases from `globals.css` (kept for 1 release as safety net)
- [ ] Resolve pre-existing uncommitted iOS asset regenerations (`dist/`, `ios/App/App/public/assets/*` deltas — routine `ios:sync` output, not in PR #31)
- [ ] Update README "Stack" section — still references Next.js 16

## Blockers
- None known

## Key Decisions
| Date | Decision | Reasoning | Affects |
|------|----------|-----------|---------|
| 2026-05-14 | Locked Midnight design system: Chiraag amber `#E8A23A` brand, midnight indigo `#1A1F3A` dark, pale stone `#F5F1E8` light, Anaar pomegranate `#9C2E2E` accent-only | Replaces rose/lavender/gold/blue. Source: Samaan brand book locked 2026.05.14. Rose retired entirely. | Whole UI, native status bar, app icon (pending) |
| 2026-05-14 | Keep `--rose`/`--gold`/`--lavender` as deprecation aliases → `--chiraag` for one release | Safety net for ~50 inline `var(--rose)` refs scattered in globals.css; deleted in follow-up PR after 2 weeks clean prod | `src/app/globals.css` |
| ~2026-04 | Next.js → Vite + React Router v7 + Vercel Functions | Vite migration; cleaner Capacitor bundling, simpler API split | Whole frontend + `api/` |
| v1 | DMs and rooms are NOT a unified surface | Rooms intentionally lack read receipts, delivery tracking, forwarding, expiry, voice-note preview type — see README "Messaging Feature Policy" | Product scope, parity backlog |
| — | Push roadmap is Supabase-first (DB/edge/webhook) | Avoids Xcode-native push wiring | iOS push, edge functions |
| — | Synthetic email behind screenname for Supabase auth | `${screenname}@hiitsme.app` (new), `${screenname}@buddylist.com` (legacy fallback) | Auth, signup, sign-in |
| — | Capacitor defaults to bundled native web (`webDir = native-web`) | Hosted mode opt-in via `CAPACITOR_HOSTED=1` | iOS/Android shipping |

## Key Files
| File | Purpose |
|------|---------|
| `src/context/ChatContext.tsx` | Persistent room state + unread logic |
| `src/components/GlobalNotificationListener.tsx` | App-wide DM/room notification banners |
| `src/components/GroupChatWindow.tsx` | Room UI + presence |
| `src/components/ChatWindow.tsx` | DM UI (dense log, collapsible formatting) |
| `src/components/RetroWindow.tsx` | Top-level mobile window shell |
| `src/app/hi-its-me/page.tsx` | H.I.M. main view — buddies, DMs, rooms, settings |
| `src/lib/passwordRecovery.ts` | Recovery code + admin reset ticket crypto |
| `src/lib/clientStorage.ts` | Versioned local persistence envelopes |
| `src/lib/outbox.ts` | Offline send queue (`hiitsme:outbox:v1:<userId>`) |
| `capacitor.config.ts` | iOS/Android wrapper config |
| `api/` | Vercel Functions (admin, auth, push, rooms) |
| `supabase/migrations/` | Canonical CLI-managed schema history (17 migrations as of 2026-04-05) |

## Architecture Notes
- Realtime channels: `active_chat_room:${roomId}` (room presence), `global_notifications_messages` (DMs), `global_notifications_room_messages` (rooms)
- Room state canonical source: `user_active_rooms` table; client hydrates from localStorage first, then DB
- Room RPCs: `join_active_room`, `leave_active_room`, `clear_room_unread`, `bump_room_unread`
- Local cache namespace: `hiitsme:ui:v1:<userId>` with legacy-key migration
- DM unread state persisted to `user_dm_state` for multi-device consistency

## Known Issues
- Working tree has 26+ deleted iOS public/asset files and matching new hashes — looks like a routine `ios:sync` regenerate but not committed yet
- README "Stack" section is stale (claims Next.js 16; actually Vite + React Router v7)

## Session Log
| Session | Date | Summary |
|---------|------|---------|
| 1 | 2026-05-14 | Memory bank initialized via recovery mode; executed full Midnight design system migration → PR #31 (19 files, +394/-349). Build passes. Native asset regen deferred. |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- UI work: verify in a browser before declaring done
- Default to no comments unless WHY is non-obvious

## External Context
- Supabase: 17 migrations applied (`20260320000001` → `20260405220000`), at least one admin row required in `public.admin_users`
- Vercel: deploys web; env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_API_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY`
- Native push: APNs auth key `AuthKey_XV95PUP6YN.p8` is in repo root (verify ignored in production)
- Release docs: `IOS_APP_STORE_RELEASE.md`, `ANDROID_PLAY_RELEASE.md`
