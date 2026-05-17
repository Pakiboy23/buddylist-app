# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

H.I.M. — a retro AIM-style messaging app. Cross-platform (web, iOS, Android) with DMs, chat rooms (regional + vibe), offline message queueing, push notifications, and biometric auth.

## Tech Stack

- Vite 6 + React Router v7, React 19, TypeScript
- Tailwind CSS v4 + PostCSS 4
- Supabase (Postgres 17, Auth, Realtime, Storage, Edge Functions)
- Capacitor 8 (iOS/Android native wrappers)
- Vitest (unit), Playwright (E2E)
- Vercel for web hosting; Vercel Functions in `api/` for serverless endpoints

Note: The repo was migrated off Next.js in commit `5ec1d04` (early 2026). Anything in source still labeled "Next.js" or "App Router" is historical naming — see `src/lib/appNavigation.ts` for the React Router adapter that preserves the old call sites.

## Commands

```bash
# Development
npm run dev                    # Vite dev server (default port 5173)

# Build & Lint
npm run build                  # tsc --noEmit + vite build (outputs to dist/)
npm run lint                   # ESLint
npm run preview                # Preview the production build

# Testing
npm run test:unit              # Vitest (run once)
npm run test:unit:watch        # Vitest (watch mode)
npx vitest run src/lib/foo.test.ts  # Single unit test
npm run test:e2e               # Playwright (needs seeded test users)
npx playwright test tests/e2e/dm-unread.spec.ts  # Single E2E test

# Mobile
npm run ios:sync               # Build native web + sync iOS (bundled, release-safe)
npm run ios:sync:hosted        # Sync iOS in hosted/debug mode
npm run ios:open               # Open Xcode
npm run ios:preflight          # Full validation: lint, test, build, sync, assets
npm run android:sync           # Build native web + sync Android
npm run android:bundle:release # Gradle bundleRelease (.aab for Play Store)
```

## Architecture

### Build Modes
- **Web:** Vite production build (`dist/`) deployed to Vercel. `dist/` IS tracked in git — see `vercel.json` and prior `chore: resync dist/` commits.
- **Native Bundled (default):** Vite build piped through `scripts/build-native-web.mjs` into `native-web/`, embedded in Capacitor apps.
- **Native Hosted (debug only):** Live server mode via `CAPACITOR_HOSTED=1`

### Auth Model
- Password-based (not magic links). Supabase synthetic email: `${screenname}@hiitsme.app`
- Fallback to legacy `${screenname}@buddylist.com`
- Password recovery: recovery codes (user-generated) + admin one-time tickets

### Rooms v2
The rooms model was rewritten in migration `20260509184623_rooms_v2_launch_schema.sql`. Old tables (`chat_rooms`, `room_messages` v1, `room_participants`, `user_active_rooms`, etc.) were renamed to `_archive_*` and replaced by:
- `public.rooms` — 7 seeded launch rooms (regional + vibe `room_kind` enum)
- `public.room_memberships` — presence + join tracking
- `public.room_messages` — fresh shape (`body` text, not `content`)

Membership flows go through `join_room_by_id` / `leave_room_by_id` SECURITY DEFINER RPCs (migration 20260510050322) to bypass an RLS recursion bug on direct INSERT.

### Realtime Channels
- Room presence: `active_chat_room:${roomId}`
- Global notifications: `global_notifications_messages`, `global_notifications_room_messages`
- State persisted in `room_memberships` (rooms v2) and `user_dm_state` (DMs)

### Content moderation
- DB trigger `BEFORE INSERT` on `messages` and `room_messages` (migration `20260515021650_content_moderation.sql`) stamps `flagged_at` when content matches an alternation of ~700 normalized profanity terms.
- Wordlist sourced from the `bad-words` npm package via `scripts/generate-profanity-terms.mjs`. To refresh, re-run the script and ship a new migration with `create or replace function`.
- Client-side: `src/lib/contentModeration.ts` mirrors the trigger logic; `displayBodyForMessage()` swaps the body for `[Message hidden — flagged for review]` when rendering a flagged message to a non-author.
- Admin queue: `supabase/queries/moderation_review_queue.sql`. No admin UI yet.

### Key Source Layout
- `src/app/` — Page modules. Path style follows the old Next.js App Router convention but they're plain React components wired into `src/App.tsx` via `react-router-dom`.
- `src/components/` — React components (ChatWindow, GroupChatWindow, RetroWindow, MessageReportSheet, etc.)
- `src/context/ChatContext.tsx` — Persistent room state, unread tracking, sync
- `src/hooks/` — Custom hooks (keyboard viewport, pull-to-refresh, swipe-back, theme)
- `src/lib/` — Business logic (auth, crypto, outbox, media, presence, push, content moderation, account deletion, trust & safety, etc.)
- `src/lib/profanityTerms.generated.ts` — **Auto-generated** wordlist. Don't hand-edit; re-run the generator.
- `supabase/migrations/` — Ordered Postgres migrations (28 as of May 2026).
- `supabase/functions/` — Deno Edge Functions: `admin-me`, `delete-account`, `push-dispatch`, `rooms-invite`.
- `supabase/queries/` — Admin/operational queries (not migrations).
- `api/` — Vercel Functions for serverless endpoints.

### Vercel API Routes
- `/api/auth/recovery/{setup,reset,redeem-ticket}` — Password recovery flows
- `/api/admin/{me,password-reset-ticket,password-reset-audit}` — Admin tools

### Supabase Edge Functions
- `delete-account` — Self-service account erasure (Apple Guideline 5.1.1(v)). Wipes ~14 user tables in dependency order, then `auth.admin.deleteUser` last.
- `push-dispatch` — APNs/FCM push fan-out, called from client after each send.
- `admin-me` — Check whether the caller is in `admin_users`.
- `rooms-invite` — Room invite link generator + accept.

## Environment

Copy `.env.example` to `.env.local`. Required vars (note the `VITE_*` rename for client-side after the Vite migration):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — client-side Supabase
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only (Vercel Functions, Edge Functions, admin queries)
- `NEXT_PUBLIC_APP_API_ORIGIN` — native builds hitting hosted backend (var name kept for backward compat with Capacitor scripts)

E2E tests need: `PLAYWRIGHT_USER_A_SCREENNAME`, `PLAYWRIGHT_USER_A_PASSWORD`, `PLAYWRIGHT_USER_B_SCREENNAME`, `PLAYWRIGHT_USER_B_PASSWORD`. The `account-delete` and `block-report` specs additionally need `SUPABASE_SERVICE_ROLE_KEY` exposed to the test process. Specs auto-skip if env is missing.

## Path Alias

`@/*` resolves to `./src/*` (tsconfig + vitest)

## Native Deployment Notes

- iOS: Archive via Xcode after `npm run ios:preflight`. Xcode Cloud CI in `ci_scripts/`.
- Android: Keystore config in `android/keystore.properties` (not committed). Env var alternative: `ANDROID_KEYSTORE_PATH`, etc.
- Both platforms default to bundled mode. Keep `ios/App/App/public` and `native-web/` in sync with web builds.

## App Store / Play Store readiness

Trust + safety surface, current state (May 2026):
- **Account deletion:** `/account/delete` page, two-step confirmation, hits `delete-account` Edge Function.
- **Block + Report:** visible on every UGC surface; DM message Report via long-press, room message Report + Block-sender via long-press, profile sheet always exposes Block + Report.
- **Content filter:** server-side trigger + render-time placeholder for recipients.
- **Pending Phase 4:** Legal section (Privacy / Terms / Contact rows on `/account`) and push permission audit (no `requestPermission` on cold launch).
