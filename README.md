# BuddyList App

A retro AIM-style messaging app built with Next.js + Supabase, now mobile-first with persistent room sessions, unread tracking, global realtime notifications, and Capacitor iOS/Android wrappers.

## Current Status

- Auth migrated from magic links to password-based sign-on.
- Non-email password recovery is live:
  - recovery code flow
  - admin-issued one-time reset ticket fallback
- Chat rooms support persistent membership (`activeRooms`) and unread room counters across refresh/re-login.
- Global listener shows incoming notification banners outside active views.
- DM behavior:
  - incoming DMs no longer force-open the chat window
  - unread DM badge appears next to sender in Buddy List until opened
- Chat UX is optimized for mobile:
  - dense AIM-style timestamped message rows (no heavy message cards)
  - collapsible rich text toolbar in compose area
  - compact `<` / `X` room controls
  - smooth auto-scroll to newest message
- Sender names are color-differentiated in DM and group chat:
  - `You` is always blue
  - other users get stable deterministic colors (per sender id)
- Capacitor mobile wrapper is configured with status bar + safe-area aware layout behavior.

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
- `/buddy-list` - Main app view, buddies, DM windows, room windows, settings, admin reset tooling
- Note: room chat is rendered via components from Buddy List (not a standalone `/chat-rooms` route in this codebase).
- API routes:
  - `/api/auth/recovery/setup`
  - `/api/auth/recovery/reset`
  - `/api/auth/recovery/redeem-ticket`
  - `/api/admin/me`
  - `/api/admin/password-reset-ticket`

## Environment Variables

Create `.env.local` with:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Notes:
- `SUPABASE_SERVICE_ROLE_KEY` is required for server-side recovery/admin routes.
- Never commit real keys.

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Apply Supabase SQL migrations in this order:

```text
supabase/gtm_plan.sql
supabase/chat_rooms.sql
supabase/password_recovery_admin.sql
supabase/persistent_chat_state.sql
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

Current config uses hosted web content mode:
- `server.url = https://buddylist-app.vercel.app`

Useful commands:

```bash
# sync web/native config + plugin updates
npx cap sync

# open native projects
npx cap open ios
npx cap open android
```

Android Play release docs:

- See [ANDROID_PLAY_RELEASE.md](/Users/syedshariff/buddylist/ANDROID_PLAY_RELEASE.md)

Current native-shell behavior:
- no pull-to-refresh bounce (`overscroll-behavior-y: none`)
- no viewport zoom (`maximum-scale=1`, `user-scalable=0`)
- no long-press text callout (`-webkit-touch-callout: none`)
- safe-area aware glossy header
- status bar configured in `capacitor.config.ts`

## Auth Model

Supabase auth uses synthetic email behind screenname:
- login/signup use `${screenname}@buddylist.com`
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
- `src/app/buddy-list/page.tsx` - buddy list, DM windows, room controls, admin reset UI
- `src/lib/passwordRecovery.ts` - recovery/ticket crypto + workflows
- `src/lib/roomName.ts` - shared room normalization helpers
- `capacitor.config.ts` - iOS/Android wrapper configuration

## Build & Quality Checks

```bash
npm run lint
npm run build
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
cd /path/to/buddylist-app
npm install
npm run dev
```

## Deployment Notes (Vercel)

- Set all three env vars in Vercel project settings.
- Ensure Supabase URL/keys match the intended environment (staging vs prod).
- If auth callback/session behavior seems stale after env changes, redeploy.
- If using Capacitor hosted mode, keep `capacitor.config.ts -> server.url` aligned with your production domain.
