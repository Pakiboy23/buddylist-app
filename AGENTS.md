# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What This Is

H.I.M. — a retro AIM-style messaging app. Web + iOS, with DMs, chat rooms (regional + vibe), offline message queueing, push notifications, and biometric auth. Android support was dropped in #147 — the `android/` directory is gone.

## Tech Stack

- Vite 6 + React Router v7, React 19, TypeScript
- Tailwind CSS v4 + PostCSS 4
- Supabase (Postgres 17, Auth, Realtime, Storage, Edge Functions)
- Capacitor 8 (iOS native wrapper)
- Vitest (unit), Playwright (E2E)
- Vercel for web hosting; Vercel Functions in `api/` for serverless endpoints

Note: The repo was migrated off Next.js in commit `5ec1d04` (early 2026). Anything in source still labeled "Next.js" or "App Router" is historical naming — see `src/lib/appNavigation.ts` for the React Router adapter that preserves the old call sites.

## Commands

Package manager is **pnpm**, pinned by the `packageManager` field in
`package.json`. Install with `pnpm install`. Never `npm install` or `yarn`: a
second lockfile resolves the same semver ranges to different versions, and CI
fails the "One lockfile only" guard. Running scripts via `npm run` is fine —
only installing differs.

```bash
# Setup
pnpm install                   # pnpm only; npm/yarn write a conflicting lockfile

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
```

The `android:*` scripts are still in `package.json` but the `android/` directory
they operate on was removed in #147 — they will fail. Don't reach for them.

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

The main buddy-list path (`ChatContext`) upserts/deletes `room_memberships` directly. Invite/preview flows go through `join_room_by_id` / `leave_room_by_id` SECURITY DEFINER RPCs (migration 20260510050322) to bypass an RLS recursion bug on direct INSERT.

### iOS renders the React app — there is no native UI layer
On iOS the React app owns every pixel. `ios/App/App/AppDelegate.swift` is a thin
Capacitor host: `HiItsMeShellViewController` embeds the bridge edge-to-edge and
does nothing else, and the `HiItsMeShell` plugin exists only to report the
signed push environment. Its `isAvailable` returns `false` on purpose, which is
what tells the web to render its own chrome (`nativeShellActive === false`).

**A change to the web UI reaches iOS by rebuilding the bundle — nothing else.**
`npm run build && npm run ios:sync`, then commit `dist/` and
`ios/App/App/public`. What the phone shows is what `hiitsme.app` shows, because
the two ship the identical entry chunk.

History, so nobody rebuilds it by accident: through Aug 2026 a ~3,300-line
SwiftUI overlay (`NativeMilestoneOneView.swift`) reimplemented the buddy list,
rooms and conversations natively above the WKWebView, fed by a
`publishNativeMilestoneOneState` bridge. Keeping a hand-written native copy in
step with the React screens proved impossible — the native list was always a
redesign behind — so `f6fbad5` switched iOS to the React UI and the overlay,
its UIKit chrome (nav bar, tab bar, dock), and the whole milestone-one bridge
were deleted. Native duplicates of privacy settings, admin reset and account
deletion went with them; the web equivalents at `/account`, `/account/delete`
and in `hi-its-me/page.tsx` are the only implementations now.

On each new `CFBundleVersion`, `AppDelegate` clears WKWebView site data
(HTTP cache + service-worker Cache Storage) so a reinstall cannot keep serving
the previous bundle. See [IOS_APP_STORE_RELEASE.md](./IOS_APP_STORE_RELEASE.md).

Vestigial but harmless: `nativeShellActive` / `nativeShellMode` conditionals and
the chrome-state publish path still exist in `page.tsx` and
`src/lib/nativeShell.ts`. With `isAvailable` false they always take the web
branch. Removing them is a separate cleanup — it touches layout across several
components and wants device verification.

### Realtime Channels
- Room presence: `active_chat_room:${roomId}`
- Global notifications: `global_notifications_messages`, `global_notifications_room_messages`
- State persisted in `room_memberships` (rooms v2) and `user_dm_state` (DMs)

### Push
Client sends after a user action (`src/lib/pushDispatch.ts` → Edge Function
`push-dispatch`). Server-side inserts (founder engine DMs, room prompts,
buddy requests with `auth.uid() IS NULL`) are announced by the
`dispatch_push_for_inserted_row` trigger via `pg_net` + a Vault fanout secret.

Device tokens are exclusive to one account (`claim_push_token_for_user` + unique
index on `user_push_tokens.token`). Delivery outcomes land in
`push_dispatch_log` (service-role only; no device tokens). Permission is never
requested on cold launch — only `/account` and the contextual prompt
(`buddy_accepted`, `first_dm_sent`). iOS permission state is the source of
truth for whether this install has been asked; `him.pushPrompt.askedAt` is a
7-day cooldown, not a permanent veto. Do not skip the ask because token rows
exist — they outlive the install.

Operational runbook: [docs/push-dispatch.md](./docs/push-dispatch.md).

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
- `supabase/migrations/` — Ordered Postgres migrations (28 as of May 2026; later push/ops migrations continue the series).
- `supabase/functions/` — Deno Edge Functions: `admin-me`, `delete-account`, `export-account`, `push-dispatch`, `rooms-invite`.
- `supabase/queries/` — Admin/operational queries (not migrations).
- `api/` — Vercel Functions for serverless endpoints.

### Vercel API Routes
- `/api/auth/recovery/{setup,reset,redeem-ticket}` — Password recovery flows
- `/api/admin/{me,password-reset-ticket,password-reset-audit}` — Admin tools

### Supabase Edge Functions
- `delete-account` — Self-service account erasure (Apple Guideline 5.1.1(v)). Wipes ~14 user tables in dependency order, then `auth.admin.deleteUser` last.
- `export-account` — JSON download of the caller's data (`/account` Export).
- `push-dispatch` — APNs (and leftover FCM) fan-out. Client JWT after a send, or Vault secret for server-side inserts.
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
- iOS defaults to bundled mode. Keep `ios/App/App/public` and `native-web/` in sync with web builds — on iOS this bundle *is* the UI.
- iOS SPM: never run `npx cap copy ios`; always `pnpm run ios:sync`; never hand-edit `CapApp-SPM/Package.swift` — its `capacitor-swift-pm` pin must match the installed `@capacitor/ios` in `pnpm-lock.yaml`.
- Package manager: pnpm, pinned by the `packageManager` field. Install with `pnpm install`; never `npm install` or `yarn`.
- Xcode Cloud: `Release (HIM) — main` archives `main` and auto-distributes to internal TestFlight; `PR compile check v2 (HIM)` builds `claude/*` branches without archiving. `ci_pre_xcodebuild.sh` refuses archives that are not `main` or a tag. See `ci_scripts/README.md`.

## App Store readiness

Trust + safety surface, current state:
- **Account deletion:** `/account/delete` page, two-step confirmation, hits `delete-account` Edge Function.
- **Block + Report:** visible on every UGC surface; DM message Report via long-press, room message Report + Block-sender via long-press, profile sheet always exposes Block + Report.
- **Content filter:** server-side trigger + render-time placeholder for recipients.
- **Legal:** Privacy / Terms / Contact rows on `/account` (`hiitsme.app/privacy`, `/terms`, `mailto:support@hiitsme.app`). Static copies also live in `public/{privacy,terms,support}.html`.
- **Push permission:** never requested on cold launch. Contextual prompt after `buddy_accepted` or `first_dm_sent`, only while iOS reports `prompt`; stored flag is a 7-day cooldown. Manual enable remains on `/account`.
