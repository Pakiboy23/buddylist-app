# H.I.M. App

A retro AIM-style messaging app built with Vite + React Router + Supabase, mobile-first, with persistent room sessions, unread tracking, global realtime notifications, and a Capacitor iOS wrapper. Android support was removed in #147.

## Current Status

- Auth migrated from magic links to password-based sign-on.
- Non-email password recovery is live:
  - recovery code flow
  - admin-issued one-time reset ticket fallback
- Chat rooms support persistent membership (`activeRooms`) and unread room counters across refresh/re-login.
- Direct-message unread state is persisted in DB (`user_dm_state`) for multi-device consistency.
- Global listener shows incoming notification banners outside active views.
- DM behavior:
  - incoming DMs no longer force-open the chat window
  - unread DM badge appears next to sender in H.I.M. until opened
- Chat UX is optimized for mobile:
  - dense AIM-style timestamped message rows (no heavy message cards)
  - collapsible rich text toolbar in compose area
  - compact `<` / `X` room controls
  - smooth auto-scroll to newest message
  - inline message search in DM and room windows
- Sender names are color-differentiated in DM and group chat:
  - `You` is always blue
  - other users get stable deterministic colors (per sender id)
- Capacitor mobile wrapper is configured with status bar + safe-area aware layout behavior.
- Chat room state now exposes sync status (`hydrating`, `syncing`, `live`, `error`) with manual resync in H.I.M..
- UI preferences/drafts now use a versioned local cache (`hiitsme:ui:v1:<userId>`) with legacy-key migration.
- DM and room chat support soft edit/delete and emoji reactions.
- DM and room chat support file attachments via Supabase Storage (`chat-media`) + metadata tables.
- Offline-safe local outbox (`hiitsme:outbox:v1:<userId>`) retries queued DM/room sends with backoff.

## Messaging Feature Policy

H.I.M. intentionally does not treat direct messages and rooms as the same product surface. The current v1 policy is:

| Capability | DMs | Rooms | Decision |
|---|---|---|---|
| Soft edit / delete | Yes | Yes | Keep parity. Core message hygiene belongs in both surfaces. |
| Emoji reactions | Yes | Yes | Keep parity. Reactions are now wired end to end in both DM and room chat. |
| Attachments / media | Yes | Yes | Keep parity at the file/media layer. |
| Inline search | Yes | Yes | Keep parity. Search is table stakes in both surfaces. |
| Presence / membership context | Buddy presence | Room participant presence | Different on purpose. DMs are relationship-first; rooms are audience-first. |
| Read receipts | Yes | No | Rooms do not expose per-user read state in v1. Too noisy and socially heavy for shared threads. |
| Delivery tracking | Yes | No | Rooms do not model message delivery state per participant in v1. |
| Forwarding | Yes | No | Forwarding remains DM-only in v1 until room moderation/distribution rules are defined. |
| Disappearing messages (`expires_at`) | Yes | No | Ephemeral expiry is a private-conversation feature in v1, not a shared-room behavior. |
| Voice note preview type | Yes | No | DMs keep the richer voice-note metadata path; rooms stay on the simpler shared attachment model in v1. |

This is a product decision, not an unfinished parity backlog. If a room feature is not listed as supported above, assume it is intentionally out of scope until the room model is explicitly expanded.

## Stack

- Vite 6 + React Router v7
- React 19
- TypeScript
- Tailwind CSS v4
- Capacitor 8 (`@capacitor/core`, `@capacitor/ios`) — iOS only; `android/` was removed in #147
- Supabase:
  - Auth
  - Postgres 17
  - Realtime
  - Storage
  - Edge Functions (Deno)
- Vercel: web hosting + serverless `api/` functions

(The repo was migrated off Next.js in commit `5ec1d04`. Folder names under `src/app/` still mirror the old App Router convention, but they're plain React components wired into `src/App.tsx` via `react-router-dom`.)

## Core App Routes

- `/` — logged-out web porch; native `/` is still Sign in. `?signin=1` and `/signin` keep LoginPage.
- `/signin` — password sign-on + account creation
- `/reset-password` — recovery-code / admin-ticket redemption
- `/hi-its-me` — main app: buddies, DM windows, room windows, settings
- `/hi-its-me/rooms`, `/hi-its-me/rooms/new`, `/hi-its-me/rooms/:roomId/preview` — room list / create / invite preview
- `/join/:inviteCode` — room invite accept
- `/account` — email, password, push permission, notification preview, data export, legal links
- `/account/delete` — two-step account erasure
- Static legal: `hiitsme.app/privacy`, `/terms`, `/support` (`public/{privacy,terms,support}.html`)
- API routes:
  - `/api/auth/recovery/setup`
  - `/api/auth/recovery/reset`
  - `/api/auth/recovery/redeem-ticket`
  - `/api/admin/me`
  - `/api/admin/password-reset-ticket`
  - `/api/admin/password-reset-audit`

## Environment Variables

Copy `.env.example` to `.env.local`, then fill in values:

```bash
cp .env.example .env.local
```

`.env.local` should contain:

```bash
# Client-side (read via import.meta.env after the Vite migration)
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...

# Server-side only (Vercel Functions, Edge Functions, admin tooling)
SUPABASE_SERVICE_ROLE_KEY=...

# Native bundles hitting the hosted API origin (var name kept for backward compat)
NEXT_PUBLIC_APP_API_ORIGIN=...
```

Optional E2E (Playwright) env vars for seeded test users:

```bash
PLAYWRIGHT_USER_A_SCREENNAME=...
PLAYWRIGHT_USER_A_PASSWORD=...
PLAYWRIGHT_USER_B_SCREENNAME=...
PLAYWRIGHT_USER_B_PASSWORD=...
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is required for server-side recovery/admin routes.
- Never commit real keys.

## Mobile Platforms

- iOS release notes: [IOS_APP_STORE_RELEASE.md](./IOS_APP_STORE_RELEASE.md)
- Push operations: [docs/push-dispatch.md](./docs/push-dispatch.md)
- Android was dropped in #147. [ANDROID_PLAY_RELEASE.md](./ANDROID_PLAY_RELEASE.md) is historical.

## Local Setup

1. Install dependencies (this project uses pnpm — `npm install` would write a
   second lockfile that resolves differently, so CI rejects it):

```bash
pnpm install
```

2. Apply Supabase migrations from `supabase/migrations/` (canonical CLI-managed history; the readable snapshots in `supabase/*.sql` are not the live schema). Rooms v2, push fan-out, exclusive device tokens, and `push_dispatch_log` all live later in that directory than the early 2026 numbered files.

If the remote project already has these schema changes and you are adopting Supabase CLI after the fact, mark already-applied versions with `supabase migration repair --status applied <version>` rather than replaying them. Then:

```bash
supabase login
supabase migration list
```

3. (Optional but recommended) seed at least one admin:

```sql
insert into public.admin_users (user_id, screenname)
select id, screenname
from public.users
where lower(screenname) = 'pakiboy24'
on conflict (user_id) do nothing;
```

4. Run the app:

```bash
npm run dev
```

## Mobile Wrapper (Capacitor)

Capacitor has already been initialized. The committed native project is iOS only:

- `ios/`
- `capacitor.config.ts`

The `android/` tree was deleted in #147. `android:*` scripts remain in `package.json` but have nothing to operate on.

Current config defaults to bundled native web assets:
- `webDir = native-web`
- hosted mode is opt-in only via `CAPACITOR_HOSTED=1`
- optional hosted URL override: `CAPACITOR_SERVER_URL=https://your-domain`

On iOS the React app owns every pixel. A web UI change reaches the phone only after `npm run build && npm run ios:sync` and a commit of `dist/` + `ios/App/App/public`. Never `npx cap copy ios` — it drops `HiItsMeShellPlugin`. Details: [IOS_APP_STORE_RELEASE.md](./IOS_APP_STORE_RELEASE.md).

Useful commands:

```bash
# sync bundled native assets + iOS project
npm run ios:sync

# optional hosted-mode sync for debugging only
npm run ios:sync:hosted

# open Xcode
npm run ios:open
```

Current native-host behavior:
- thin Capacitor WKWebView; no SwiftUI overlay
- WKWebView site data cleared once per `CFBundleVersion` so a reinstall cannot keep a stale service worker
- no pull-to-refresh bounce (`overscroll-behavior-y: none`)
- no viewport zoom (`maximum-scale=1`, `user-scalable=0`)
- no long-press text callout (`-webkit-touch-callout: none`)
- status bar configured in `capacitor.config.ts`
- push is Supabase-first (token table + `push-dispatch` Edge Function). See [docs/push-dispatch.md](./docs/push-dispatch.md).

## Auth Model

Supabase auth uses synthetic email behind screenname:
- new signup uses `${screenname}@hiitsme.app`; sign-in also falls back to legacy BuddyList auth emails such as `${screenname}@buddylist.com`
- user profile screenname lives in `public.users`

Recovery model:
- user can set/update a recovery code (hashed in DB)
- forgot password supports:
  - recovery code reset
  - admin one-time ticket redemption

## Realtime + Notification Model

### Room Presence

- Room participant presence is tracked via shared channel:
  - `active_chat_room:${roomId}`
- Participants list in room header updates via Supabase Presence sync.

### Global Notifications

- Mounted globally in layout via `GlobalNotificationListener`.
- Uses dedicated channels:
  - `global_notifications_messages` (DMs)
  - `global_notifications_room_messages` (room messages)
- Banner queue prevents dropped notifications under bursts.
- Banner click behavior:
  - DM banner routes to `?dm=<senderId>`
  - Room banner routes to `?room=<roomName>`
- Push is Supabase-first: the client calls `push-dispatch` after a send; server-side inserts (engine DMs, room prompts, buddy requests) are announced by a Postgres trigger. Outcomes land in `push_dispatch_log`. See [docs/push-dispatch.md](./docs/push-dispatch.md).

### Room Persistence

- Canonical state is rooms v2: `public.rooms` + `public.room_memberships` (unread via `last_seen_at`). The rooms-v1 table `user_active_rooms` is archived (`_archive_user_active_rooms`).
- Client hydrates from localStorage cache first, then syncs `room_memberships`.
- Main app join/leave (`ChatContext`) upserts/deletes `room_memberships` directly.
- Invite/preview flows use SECURITY DEFINER RPCs `join_room_by_id` / `leave_room_by_id`.

## Files to Know

- `src/context/ChatContext.tsx` - persistent room state + unread logic
- `src/components/GlobalNotificationListener.tsx` - app-wide notifications
- `src/components/GroupChatWindow.tsx` - room UI + presence
- `src/components/ChatWindow.tsx` - DM UI (mobile-first dense log + collapsible formatting)
- `src/components/IncomingMessageBanner.tsx` - mobile-style notification banner
- `src/components/RetroWindow.tsx` - top-level mobile window shell + centered glossy titlebar
- `src/app/hi-its-me/page.tsx` - H.I.M. contacts, DM windows, room controls, admin reset UI
- `src/lib/passwordRecovery.ts` - recovery/ticket crypto + workflows
- `src/lib/clientStorage.ts` - safe typed local persistence with versioned envelopes
- `src/lib/chatMedia.ts` - attachment validation + Supabase Storage upload helpers
- `src/lib/outbox.ts` - offline outbox queue schema + retry metadata
- `src/lib/roomName.ts` - shared room normalization helpers
- `capacitor.config.ts` - iOS wrapper configuration
- `src/lib/pushDispatch.ts` - client fan-out into the `push-dispatch` Edge Function
- `src/lib/pushPromptMoments.ts` - contextual iOS permission prompt after friendship actions
- `supabase/functions/push-dispatch/index.ts` - APNs delivery + `push_dispatch_log`
- `src/app/api/admin/password-reset-audit/route.ts` - admin-only recovery audit feed

## Build & Quality Checks

```bash
npm run lint
npm run build
npm run test:unit
npm run test:e2e
npm run ios:preflight
```

## Troubleshooting

### `Can't resolve 'tailwindcss' in '/Users/...`

Usually means `npm run dev` was started from the wrong directory. Run from repo root:

```bash
cd /path/to/buddylist-app
pnpm install
pnpm run dev
```

### iOS still shows an old layout after a web change

The phone does not load `hiitsme.app` in bundled mode. Rebuild and sync:

```bash
npm run build
npm run ios:sync
```

Then commit `dist/` and `ios/App/App/public`. If a reinstall still looks stale, confirm `CFBundleVersion` changed — `AppDelegate` only clears WKWebView site data when the build number changes.

### Push returned 200 but nobody got a notification

Two different failures look the same from the sender's side:

- **No tokens.** `push_dispatch_log` shows `recipients > 0 AND tokens = 0`. Nobody on that account ever registered.
- **Dead-install tokens.** The log shows tokens found and APNs accepted them, but the current install never requested permission. H.I.M. is missing from Settings → Notifications. Token rows from earlier installs are not evidence this one was asked.

Full runbook: [docs/push-dispatch.md](./docs/push-dispatch.md).

### `npx cap copy ios` dropped HiItsMeShellPlugin

Use `npm run ios:sync` (or `pnpm run ios:sync`). Never hand-edit `CapApp-SPM/Package.swift`.

## Deployment Notes (Vercel)

- Set the three required env vars in Vercel project settings.
- Set `NEXT_PUBLIC_APP_API_ORIGIN` too if native builds should target a different backend origin than the default production web domain.
- Ensure Supabase URL/keys match the intended environment (staging vs prod).
- If auth callback/session behavior seems stale after env changes, redeploy.
- If using Capacitor hosted mode for debugging, keep `CAPACITOR_SERVER_URL` aligned with your intended domain.
