# Project Memory
Last updated: 2026-05-15 | Session 2 | Branch: claude/app-store-submission-prep-xIHe3
Memory health: 9/10

## Project Overview
H.I.M. (`hiitsme`) — retro AIM-style mobile-first messaging app. Vite + React 19 + React Router v7 web app, deployed on Vercel (web) and wrapped via Capacitor 8 for iOS + Android. Supabase for auth/Postgres/realtime/edge-functions. README + CLAUDE.md were stale (Next.js claim, "17 migrations"); refreshed in 2026-05-15 cleanup pass.

## Where We Left Off
- **Current task:** Carryover cleanup after Phase 3 ship — repo migration sync, doc refresh, delete-account rooms-v2 awareness.
- **Status:**
  - Phase 1 (in-app account deletion / Guideline 5.1.1(v)) — **merged in PR #36**
  - Phase 2(a) (block + report visible on every UGC surface) — **merged in PR #36**
  - Phase 3 (content filter / Guideline 1.2) — **merged in PR #37 + hotfix #38; migration applied to prod**
  - Carryover cleanup (sync repo migrations to live DB, fix README/CLAUDE.md, delete-account rooms-v2) — **in progress on this branch**
  - Phase 4 (Legal section + push permission audit) — **not started**
- **Next immediate step:** Open PR for the carryover cleanup, then Phase 4.
- **Open notes:** Local migrations `20260410000018` through `20260411000022` (`user_connections`, `room_type_and_discovery`, `presence_visibility`, `connection_notifications`, `add_screenname_changed_at`) exist in the repo but are NOT in `supabase_migrations.schema_migrations` on prod — they were applied via SQL editor outside migration tracking. The tables they create (e.g. `user_connections`) DO exist in production. Leaving them as-is for now; a future cleanup pass should register them in the migrations table or fold them into a single bootstrap migration.

## Completed (last 10 commits)
- 2026-05-14 `66ac562` feat(safety): expose block + report on every UGC surface (merged in PR #36)
- 2026-05-14 `823e588` feat(account): in-app account deletion for App Store 5.1.1(v) (merged in PR #36)
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
- [ ] **Phase 3 (in flight):** wire `flagged_at` into the `ChatMessage`/`RoomMessage` types + SELECT queries (`chatMessages` fetch in `hi-its-me/page.tsx`, room message fetch in `GroupChatWindow.tsx`, idempotency `MESSAGE_SELECT_COLUMNS` in `messageIdempotency.ts`); render placeholder for recipients via `displayBodyForMessage`; ship `supabase/queries/moderation_review_queue.sql` for the owner to run.
- [ ] **Phase 4:** Legal section on `/account` (Privacy, Terms, Contact rows) + push permission audit (don't fire `requestPermission` on cold launch; only after settings toggle OR after first sent message via "Get notified when buddies reply?" CTA).
- [ ] Check Xcode Cloud auto-archive of main; promote to TestFlight from App Store Connect
- [ ] Generate brand artwork (amber lamp glyph + splash) so `npm run ios:assets` can regenerate iOS icons; Android mipmaps need direct replacement
- [ ] Fix `capacitor.config.ts` `webDir: 'dist'` vs `scripts/ios-release-preflight.mjs` expecting `'native-web'` mismatch — one-line config bug
- [ ] Follow-up PR (after ~2 weeks clean prod): delete `--rose`, `--rose-dark`, `--gold`, `--lavender` deprecation aliases from `globals.css`
- [ ] Update README + CLAUDE.md "Stack" sections — still reference Next.js 16 and 17 migrations

## Blockers
- None known

## Key Decisions
| Date | Decision | Reasoning | Affects |
|------|----------|-----------|---------|
| 2026-05-15 | Account deletion deletes `abuse_reports` rows on BOTH reporter and target sides | Owner choice for full erasure on user request; loses some moderation trail but satisfies right-to-be-forgotten. | `supabase/functions/delete-account/` |
| 2026-05-15 | Content moderation = DB trigger w/ baked-in regex sourced from `bad-words` npm package | Phase 3 of App Store prep. Webhook-based moderation infra was disabled in migration 15 (push moved client-side), so a `BEFORE INSERT` trigger is the cleanest server-side gate. List is regenerated via `scripts/generate-profanity-terms.mjs`, not hand-rolled. | `supabase/migrations/20260516000026_content_moderation.sql`, `src/lib/contentModeration.ts` |
| 2026-05-15 | Message-report `source_message_id` only populated for DM reports, not room-message reports | `abuse_reports.source_message_id` is `bigint → messages(id)`, but `room_messages` uses `uuid`. Adding a sibling column deferred until owner confirms. | `abuse_reports` schema, `MessageReportSheet.tsx` wiring |
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
| `src/components/GroupChatWindow.tsx` | Room UI + presence; long-press menu wires Report + Block sender |
| `src/components/ChatWindow.tsx` | DM UI; long-press menu adds Report for incoming messages |
| `src/components/MessageReportSheet.tsx` | Shared report sheet for message- or user-level reports |
| `src/components/BuddyProfileSheet.tsx` | Profile sheet w/ Block/Unblock/Report (visible, ≤2 taps from any UGC surface) |
| `src/components/RetroWindow.tsx` | Top-level mobile window shell |
| `src/app/account/delete/page.tsx` | Self-service account deletion (Apple 5.1.1(v)) |
| `src/app/hi-its-me/page.tsx` | H.I.M. main view — buddies, DMs, rooms, settings |
| `src/lib/accountDeletion.ts` | Screenname confirmation matcher + edge-function invoke |
| `src/lib/contentModeration.ts` | `isObjectionable()` + `displayBodyForMessage()` (mirrors DB trigger) |
| `src/lib/profanityTerms.generated.ts` | **Auto-generated** wordlist from `bad-words`. Refresh via `scripts/generate-profanity-terms.mjs`. |
| `src/lib/passwordRecovery.ts` | Recovery code + admin reset ticket crypto |
| `src/lib/clientStorage.ts` | Versioned local persistence envelopes |
| `src/lib/outbox.ts` | Offline send queue (`hiitsme:outbox:v1:<userId>`) |
| `supabase/functions/delete-account/` | Edge function: wipes 14 user tables + auth.users (final, irreversible) |
| `supabase/migrations/` | CLI-managed schema history (26 migrations as of 2026-05-15) |
| `scripts/generate-profanity-terms.mjs` | Regenerates the moderation blocklist from `bad-words` npm package |
| `capacitor.config.ts` | iOS/Android wrapper config |
| `api/` | Vercel Functions (admin, auth, push, rooms) |

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
| 1 | 2026-05-14 | Recovery mode init. Midnight migration shipped via PR #32 (22 files), iOS+Android bundle resync via PR #33 (86 files), MEMORY.md tracked via PR #34. PR #31 closed (stale base). nvm default set to v22 (Capacitor CLI requirement). Obsolete local commit `e534dc7` skipped during rebase — its room-invite auth fix was superseded by the Edge Function migration on origin/main. Preflight `webDir` mismatch flagged for follow-up. |
| 2 | 2026-05-15 | App Store submission prep. **Phase 1 + Phase 2 merged via PR #36; Phase 3 merged via PR #37 + hotfix PR #38**. Phase 1: `/account/delete` page (typed screenname → final modal) + `delete-account` Edge Function wiping 14 tables before `auth.admin.deleteUser`. Phase 2(a): `MessageReportSheet` + long-press Report in DM threads + long-press Report/Block-sender in room threads + render-time block filter in `GroupChatWindow`. Phase 3: migration 0026 (later renamed to applied version `20260515021650`) + `contentModeration.ts` + 11 unit tests; render integration + admin queue query shipped. Hotfix #38 corrected the room-trigger column reference (`new.body` not `new.content`). Migration applied to prod via Supabase MCP. **Carryover cleanup pass (this session, post-#38):** imported 8 remote-only migrations into the repo (`drop_last_seen_column`, `migrate_messages_id_bigint_to_uuid_v2`, two `add_invite_to_room_rpc` revisions, `rooms_v2_launch_schema`, `add_discoverable_flag`, `fix_room_memberships_rls_recursion`, `add_join_leave_room_rpcs`); renamed local content_moderation file to its applied version; updated `delete-account` to sweep `room_memberships` (rooms v2) alongside the legacy v1 tables; refreshed README + CLAUDE.md to reflect the Vite stack + rooms v2 + content moderation; learned that `abuse_reports.source_message_id` was already migrated to uuid in prod (the originally-flagged bigint mismatch is moot). |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- UI work: verify in a browser before declaring done
- Default to no comments unless WHY is non-obvious

## External Context
- Supabase: 26 migrations applied through `20260516000026_content_moderation.sql` (latest committed; not yet pushed). At least one admin row required in `public.admin_users`.
- Vercel: deploys web; env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_API_ORIGIN`, `SUPABASE_SERVICE_ROLE_KEY`. Vite reads via `import.meta.env.VITE_*` for client-side; `.env.local` should mirror.
- Native push: APNs auth key `AuthKey_XV95PUP6YN.p8` is in repo root (verify ignored in production)
- Release docs: `IOS_APP_STORE_RELEASE.md`, `ANDROID_PLAY_RELEASE.md`
- App Store prep PR #36 merged 2026-05-15 (Phase 1 + Phase 2). Phase 3/4 will ship in a follow-up PR off the same branch.
