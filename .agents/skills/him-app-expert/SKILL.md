---
name: him-app-expert
description: Product, architecture, brand, App Store, and growth expert for H.I.M. in Pakiboy23/buddylist-app. Use on any H.I.M. code, copy, schema, Capacitor, push, rooms, buddies, landing, or store task. Encodes the live product that CLAUDE.md and him-CLAUDE.md currently contradict.
---

# H.I.M. app expert

Read this before `CLAUDE.md` or `him-CLAUDE.md` when they disagree. This skill is the live product.

## What this is

H.I.M. is a friendship-first social app for gay men. Screennames, away messages, buddy lists, seven chat rooms. Never describe it as a dating or hookup app, and never spell out what the initials stand for.

- Publisher: Saman Technologies LLC (the App Store seller line shows the individual developer account)
- Domain: `hiitsme.app`
- Bundle: `com.hiitsme.app`
- GitHub: `Pakiboy23/buddylist-app`
- Supabase: BuddyList `keckqpadzxwwmagnmpuk`
- iOS: live App Store **2.6 (build 466)**, released 26 Sep 2026
- Repo: `MARKETING_VERSION = 2.7`, `CURRENT_PROJECT_VERSION = 465`. Xcode Cloud assigns the real build number (its run number), so 465 is not what ships. 2.7 build 472 is already in internal TestFlight from `main` (28 Sep). Any 2.7 binary must be above 466; Xcode Cloud's next number (473+) already is.
- Android: removed in #147. Do not claim it exists.

Canonical public line: **H.I.M. — Friends, Not Dates.** Never tell people to search bare "H.I.M."

## Live truth (overrides stale docs)

| Topic | Live code | Stale doc to ignore |
|---|---|---|
| Design tokens | Midnight + chiraag. `src/app/globals.css`: ink `#0F1424`, stone `#F5F1E8`, chiraag `#E8A23A`, indigo `#1A1F3A`, anaar `#9C2E2E` | `him-CLAUDE.md` rose `#E8608A` / gold / `#13100E`. That palette is **not in `src/`**. Do not restyle toward it. |
| Auth email | Sign-up collects a real email. Sign-in resolves the member's real email from `public.users`, then falls back to `${screenname}@hiitsme.app` and legacy `@buddylist.com` (`src/lib/authIdentity.ts`) | `him-CLAUDE.md` saying primary is `@buddylist.com` |
| Rooms | v2: `public.rooms`, `room_memberships`, `room_messages.body`. Join/leave via `join_room_by_id` / `leave_room_by_id` | `him-CLAUDE.md` `user_active_rooms` + dual-write to `room_participants` |
| Social graph | `buddies` (**asymmetric**, pending → accepted). `pending` is ONE directional row (requester → target); `accepted` writes both directions but some mirrors are missing. Count DISTINCT UNORDERED pairs — `count(*) / 2` is wrong for both statuses. | Do not build on `user_connections`. Do not assume symmetry. |
| Public copy | No dating vocab. No AOL/AIM in **public** copy (issue #108) | Internal AIM-era mechanics (sounds, buddy list) may stay. `src/app/page.tsx` still plays `/sounds/aol-welcome.mp3` on native sign-on — do not advertise that. |
| Wordmark | lowercase `him` in product chrome. Periods only in body copy and press ("H.I.M.") | Uppercase wordmark |

`CLAUDE.md` is closer to engineering truth. `him-CLAUDE.md` is closer to positioning and voice, except its design-system and rooms-v1 sections are wrong.

## Stack

Vite 6 + React 19 + React Router v7 SPA. Tailwind v4. Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). Capacitor 8 iOS wrapper (Android removed, #147). Vitest + Playwright. pnpm. Vercel for web; `api/admin` for admin. Native default is **bundled** (`native-web/` via `scripts/build-native-web.mjs`). Hosted mode is debug-only.

Do not introduce SSR, server components, or Next.js App Router primitives. The Next.js labels in paths are historical (`src/app/` pages are plain React, wired in `src/App.tsx`).

## Design system (shipped)

- Light: stone surfaces, ink text, chiraag amber accent.
- Dark: indigo night `#1A1F3A` / `#0F1424`, chiraag accent.
- Do not use Tailwind `bg-black` / `bg-slate-*` / `bg-zinc-*` as a substitute for tokens — they fight the theme.
- No fake live counts. `himArtDirection.ts` hard-codes honesty here on purpose.
- No dating-app vocabulary in UI copy: match, swipe, singles, nearby, flirt, hot, hookup-as-offer.

## Architecture landmines

- **Realtime in Capacitor:** `detectSessionInUrl: false`; call `supabase.realtime.setAuth(session.access_token)` after SUBSCRIBED; filter `room_id` client-side. Do not remove these.
- **Rooms v2 RLS:** direct INSERT on `room_memberships` recurses. Always go through the SECURITY DEFINER RPCs.
- **Password recovery** is Supabase's email-link reset: `resetPasswordForEmail` with `redirectTo` `HIM://reset-password` on native and `https://hiitsme-app.vercel.app/reset-password` on web, landing on `/reset-password` (`type=recovery` tokens in the hash). Sign-up collects a real email. The old recovery-code system was removed in April 2026 (`7c4ed0e`, migration `20260426083107_drop_password_recovery.sql` drops `account_recovery_codes` and the `password_reset_*` tables). Legacy synthetic-email accounts (`@hiitsme.app`, `@buddylist.com`) cannot receive the mail. Do not redesign recovery without an explicit ask. On iOS the link needs `HIM` registered in `Info.plist` and host-as-route deep-link parsing; both are in open PR #186, not on `main` yet.
- **Account deletion** is `supabase/functions/delete-account`. It must succeed on data-bearing accounts, not empty ones. Guards: CORS allows `x-client-info`; `isMissingTable()` matches both `42P01` and `PGRST205`; native ⋯ menu has Account; rooms-v1 archive triggers were dropped. Do not reintroduce those four bugs.
- **Push:** `requestAndRegisterPush()` lives in `src/lib/nativePush.ts`. Callers: `/account` (manual) and `src/lib/pushPromptMoments.ts` (contextual, only while system state is `prompt`). Friendship-action callers are `buddyRequest.ts` (`buddy_accepted`) and `messageIdempotency.ts` (`first_dm_sent` on a successful DM insert; `first_room_message` on a successful room insert, not on a 23505 reconcile). iOS permission state is the source of truth; `him.pushPrompt.askedAt` is a 7-day cooldown, not a once-per-install veto — localStorage survives reinstalls, authorization does not (#154). Do not skip the ask because `user_push_tokens` has rows. `pushColdLaunchGuard.test.ts` is the contract. Never prompt on cold launch (Guideline 2.5.13). Notification preview default is sender-only.
- **Invites:** `rooms-invite` requires an accepted buddy. There are no shareable invite links. `/join/:inviteCode` discards the code. Do not invent viral links.
- **Buddies graph:** profile Add Buddy writes `buddies` (#178), the same graph as search and suggestions. Do not write `user_connections`.
- **Removed, stay removed:** Buddy Circles UI (#174), the room unread counter that never incremented (#181), Android (#147), the native SwiftUI shell (iOS renders the React bundle).
- **`dist/` and `ios/App/App/public` are tracked, and Xcode Cloud archives `ios/App/App/public` verbatim.** A web change reaches iOS only after `npm run build && npm run ios:sync` with the real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, committed. CI's Bundle resync guard fails a PR that changes client source without it. Never use `npx cap copy ios` (it drops `HiItsMeShellPlugin`).
- **Xcode Cloud (verified via the App Store Connect API, 8 Oct 2026):** enabled workflows are `Release (HIM) — main` (Archive, internal TestFlight, branch `main` only), `PR compile check v2 (HIM)` (Build only, no archive, branches starting `claude/`), and `Untitled Workflow` (Archive, no start conditions, manual runs only). `ci_pre_xcodebuild.sh` also refuses an archive that is not `main` or a tag. Pushing any non-main branch does not archive or upload; merging to `main` does.
- **Content moderation:** DB trigger + client `displayBodyForMessage()`. Wordlist is generated; do not hand-edit `profanityTerms.generated.ts`.

## App Store

History that will repeat if forgotten:

1. Rejection: iPad "unresponsive" — `100vw` overflow + opaque boot splash. Fix: `width: 100%`, boot watchdog.
2. Rejection: 5.1.1(v) account deletion + 1.5 Support URL. Four stacked deletion bugs (CORS, PGRST205, native menu, legacy triggers) plus `/support`.

Still required: deletion reachable in-app on iOS; Support/Privacy/Terms URLs live; no push prompt on launch; age rating 18+. Demo account `appreviewer2026` exists for review. Never store its password in the repo.

Owner security: ASC key `XV95PUP6YN` leaked in git history (`00b2839`). Its revocation is **unverified** (no API can list keys; issue #132). Do not claim it is revoked. `LMT6SQA4GV` was confirmed revoked (401) on 22 Aug 2026.

## Growth

This skill carries no current metrics. Read them live (`marketing/campaign-2026-q3/reporting/`, Supabase) and never invent or publish user counts.

Activation funnel (honest): install (ASC, not in Supabase) → screenname (`users`) → first room joined → first buddy accepted → first DM → D7 return via `last_active_at`. Cold DMs are allowed and rate-limited; step 4 is not a subset of step 3.

Canonical public line is **H.I.M. — Friends, Not Dates**. Interim porch: `https://him.samaan.tech/why.html`. Logged-out web `/` is the porch (#108); native `/` stays Sign in.

## What not to do

- Dating positioning, face-first discovery, or outing-adjacent mechanics (lock-screen message bodies, forcing real name/photo).
- Fabricated member counts or "live now" numbers.
- Restyling to the unshipped rose/gold system.
- Building on `user_connections` or rooms-v1 archive tables.
- Shareable invite links.
- SSR.
- Redesigning password recovery without an explicit ask.
- Restoring Circles UI (deleted in #174) or room unread counters (removed in #181).
- Describing H.I.M. as dating or hookup, or spelling out the initials.

## Done when

- Typecheck, unit tests, and the relevant Playwright spec pass.
- Native path still bundles (`ios:sync`, not hosted).
- Copy could be read aloud in a quiet room without sounding like a dating ad.
- If you changed push callers, `pushColdLaunchGuard.test.ts` matches the new policy.
- If you changed auth, synthetic email domains still try `hiitsme.app` then `buddylist.com`.
