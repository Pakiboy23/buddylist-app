# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

H.I.M. — a retro AIM-style messaging app. Cross-platform (web, iOS, Android) with DMs, chat rooms, offline message queueing, push notifications, and biometric auth.

## Tech Stack

- Next.js 16 (App Router, React Compiler enabled), React 19, TypeScript
- Tailwind CSS v4, PostCSS 4
- Supabase (Postgres, Auth, Realtime, Storage)
- Capacitor 8 (iOS/Android native wrappers)
- Vitest (unit), Playwright (E2E)

## Commands

```bash
# Development
npm run dev                    # Next.js dev server

# Build & Lint
npm run build                  # Production build
npm run lint                   # ESLint

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
- **Web:** Standard Next.js deployed to Vercel
- **Native Bundled (default):** Static export to `native-web/`, embedded in Capacitor apps. Triggered by `NATIVE_STATIC_EXPORT=1`.
- **Native Hosted (debug only):** Live server mode via `CAPACITOR_HOSTED=1`

### Auth Model
- Password-based (not magic links). Supabase synthetic email: `${screenname}@hiitsme.app`
- Fallback to legacy `${screenname}@buddylist.com`
- Password recovery: recovery codes (user-generated) + admin one-time tickets

### Realtime Channels
- Room presence: `active_chat_room:${roomId}`
- Global notifications: `global_notifications_messages`, `global_notifications_room_messages`
- State persisted in `user_active_rooms` (rooms) and `user_dm_state` (DMs)

### Key Source Layout
- `src/app/` — Next.js App Router pages and API routes
- `src/components/` — React components (ChatWindow, GroupChatWindow, RetroWindow, etc.)
- `src/context/ChatContext.tsx` — Persistent room state, unread tracking, sync
- `src/hooks/` — Custom hooks (keyboard viewport, pull-to-refresh, swipe-back, theme)
- `src/lib/` — Business logic utilities (auth, crypto, outbox, media, presence, push, etc.)
- `supabase/migrations/` — 17 ordered Postgres migrations

### API Routes
- `/api/auth/recovery/{setup,reset,redeem-ticket}` — Password recovery flows
- `/api/admin/{me,password-reset-ticket,password-reset-audit}` — Admin tools
- `/api/push/dispatch` — Push notification dispatch

## Environment

Copy `.env.example` to `.env.local`. Required vars:
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_API_ORIGIN` (for native builds hitting hosted backend)

E2E tests need: `PLAYWRIGHT_USER_A_SCREENNAME`, `PLAYWRIGHT_USER_A_PASSWORD`, `PLAYWRIGHT_USER_B_SCREENNAME`, `PLAYWRIGHT_USER_B_PASSWORD`

## Path Alias

`@/*` resolves to `./src/*` (tsconfig + vitest)

## Native Deployment Notes

- iOS: Archive via Xcode after `npm run ios:preflight`. Xcode Cloud CI in `ci_scripts/`.
- Android: Keystore config in `android/keystore.properties` (not committed). Env var alternative: `ANDROID_KEYSTORE_PATH`, etc.
- Both platforms default to bundled mode. Keep `ios/App/App/public` and `native-web/` in sync with web builds.
