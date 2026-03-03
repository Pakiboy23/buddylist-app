# BuddyList App

A retro AIM-style messaging app built with Next.js + Supabase, now mobile-first with persistent room sessions, unread tracking, and global realtime notifications.

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

## Stack

- Next.js 16 (App Router, Turbopack)
- React 19
- TypeScript
- Tailwind CSS v4
- Supabase:
  - Auth
  - Postgres
  - Realtime

## Core App Routes

- `/` - Sign-on + account creation + password recovery/ticket redemption
- `/buddy-list` - Main app view, buddies, rooms, settings, admin reset tooling
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
- `src/components/IncomingMessageBanner.tsx` - mobile-style notification banner
- `src/app/buddy-list/page.tsx` - buddy list, DM windows, room controls, admin reset UI
- `src/lib/passwordRecovery.ts` - recovery/ticket crypto + workflows

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
