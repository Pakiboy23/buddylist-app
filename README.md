# H.I.M. App

A retro AIM-style messaging app built with Next.js + Supabase, now mobile-first with persistent room sessions, unread tracking, global realtime notifications, and Capacitor iOS/Android wrappers.

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

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS v4
- Capacitor 8 (`@capacitor/core`, `@capacitor/ios`, `@capacitor/android`)
- Supabase:
  - Auth
  - Postgres
  - Realtime

## Core App Routes

- `/` - Sign-on + account creation + password recovery/ticket redemption
- `/hi-its-me` - Main app view, buddies, DM windows, room windows, settings, admin reset tooling
- Note: room chat is rendered via components from H.I.M. (not a standalone `/chat-rooms` route in this codebase).
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
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_APP_API_ORIGIN=...
SUPABASE_SERVICE_ROLE_KEY=...
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

- Android release notes: [ANDROID_PLAY_RELEASE.md](./ANDROID_PLAY_RELEASE.md)
- iOS release notes: [IOS_APP_STORE_RELEASE.md](./IOS_APP_STORE_RELEASE.md)

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Apply Supabase SQL migrations in this order:

```text
supabase/migrations/20260320000001_gtm_plan.sql
supabase/migrations/20260320000002_chat_rooms.sql
supabase/migrations/20260320000003_password_recovery_admin.sql
supabase/migrations/20260320000004_persistent_chat_state.sql
supabase/migrations/20260320000005_room_participants.sql
supabase/migrations/20260320000006_room_unread_fanout.sql
supabase/migrations/20260320000007_message_idempotency.sql
supabase/migrations/20260320000008_dm_state.sql
supabase/migrations/20260320000009_message_enhancements.sql
supabase/migrations/20260320000010_chat_media.sql
supabase/migrations/20260320000011_presence_profiles.sql
supabase/migrations/20260328000012_user_push_tokens.sql
supabase/migrations/20260328000013_private_chat_foundation.sql
supabase/migrations/20260328000014_trust_safety_slice.sql
supabase/migrations/20260328000015_send_push_trigger.sql
supabase/migrations/20260405034615_room_key_foreign_keys.sql
supabase/migrations/20260405220000_push_token_environments.sql
```

The legacy readable SQL snapshots still live in `supabase/*.sql`, but `supabase/migrations/` is the canonical CLI-managed history.

If the remote project already has these schema changes and you are adopting Supabase CLI after the fact:

```bash
supabase login

supabase migration repair --status applied 20260320000001
supabase migration repair --status applied 20260320000002
supabase migration repair --status applied 20260320000003
supabase migration repair --status applied 20260320000004
supabase migration repair --status applied 20260320000005
supabase migration repair --status applied 20260320000006
supabase migration repair --status applied 20260320000007
supabase migration repair --status applied 20260320000008
supabase migration repair --status applied 20260320000009
supabase migration repair --status applied 20260320000010
supabase migration repair --status applied 20260320000011
supabase migration repair --status applied 20260328000012
supabase migration repair --status applied 20260328000013
supabase migration repair --status applied 20260328000014
supabase migration repair --status applied 20260328000015
```

Then create/apply any new migrations normally and confirm the history:

```bash
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

Capacitor has already been initialized and platform projects are committed:

- `ios/`
- `android/`
- `capacitor.config.ts`

Current config defaults to bundled native web assets:
- `webDir = native-web`
- hosted mode is opt-in only via `CAPACITOR_HOSTED=1`
- optional hosted URL override: `CAPACITOR_SERVER_URL=https://your-domain`

Useful commands:

```bash
# sync bundled native assets + native projects
npm run ios:sync
npm run android:sync

# optional hosted-mode sync for debugging only
npm run ios:sync:hosted
npm run android:sync:hosted

# open native projects
npx cap open ios
npx cap open android
```

Android Play release docs:

- See [ANDROID_PLAY_RELEASE.md](./ANDROID_PLAY_RELEASE.md)

Current native-shell behavior:
- no pull-to-refresh bounce (`overscroll-behavior-y: none`)
- no viewport zoom (`maximum-scale=1`, `user-scalable=0`)
- no long-press text callout (`-webkit-touch-callout: none`)
- safe-area aware glossy header
- status bar configured in `capacitor.config.ts`
- push roadmap stays Supabase-first (DB/edge/webhook), avoiding Xcode-native push setup.

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
- Push direction for this app is Supabase-first (DB/webhook/edge integration), not Xcode-native push wiring.

### Room Persistence

- `user_active_rooms` is canonical state for:
  - active rooms
  - unread room counters
- Client hydrates from localStorage cache first, then syncs from DB.
- Context actions call RPCs:
  - `join_active_room`
  - `leave_active_room`
  - `clear_room_unread`
  - `bump_room_unread`

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
- `capacitor.config.ts` - iOS/Android wrapper configuration
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

### `Unable to acquire lock at .next/dev/lock`

A previous `next dev` instance is still running.

```bash
pkill -f "next dev"
rm -f .next/dev/lock
npm run dev
```

### `Can't resolve 'tailwindcss' in '/Users/...`

Usually means `npm run dev` was started from the wrong directory. Run from repo root:

```bash
cd /path/to/hiitsme-app
npm install
npm run dev
```

## Deployment Notes (Vercel)

- Set the three required env vars in Vercel project settings.
- Set `NEXT_PUBLIC_APP_API_ORIGIN` too if native builds should target a different backend origin than the default production web domain.
- Ensure Supabase URL/keys match the intended environment (staging vs prod).
- If auth callback/session behavior seems stale after env changes, redeploy.
- If using Capacitor hosted mode for debugging, keep `CAPACITOR_SERVER_URL` aligned with your intended domain.
