---
name: him-app-expert
description: Product, architecture, brand, App Store, and growth expert for H.I.M. ("Hi, It's Me") in Pakiboy23/buddylist-app. Use on any H.I.M. code, copy, schema, Capacitor, push, rooms, buddies, landing, or store task. Encodes the live product that CLAUDE.md and him-CLAUDE.md currently contradict.
---

# H.I.M. app expert

Read this before `CLAUDE.md` or `him-CLAUDE.md` when they disagree. This skill is the live product.

## What this is

H.I.M. ("Hi, It's Me") is a friendship-first social app for gay men. Screennames, away messages, buddy lists, seven chat rooms. Not a dating app, not a hookup app.

- Publisher: Saman Technologies LLC
- Domain: `hiitsme.app`
- Bundle: `com.hiitsme.app`
- GitHub: `Pakiboy23/buddylist-app`
- Supabase: BuddyList `keckqpadzxwwmagnmpuk`
- iOS: live App Store, v2.2 as of Aug 2026
- Android: not live. Do not claim it is.

Canonical public line: **H.I.M. — Friends, Not Dates.** Never tell people to search bare "H.I.M."

## Live truth (overrides stale docs)

| Topic | Live code | Stale doc to ignore |
|---|---|---|
| Design tokens | Midnight + chiraag. `src/app/globals.css`: ink `#0F1424`, stone `#F5F1E8`, chiraag `#E8A23A`, indigo `#1A1F3A`, anaar `#9C2E2E` | `him-CLAUDE.md` rose `#E8608A` / gold / `#13100E`. That palette is **not in `src/`**. Do not restyle toward it. |
| Auth email | Primary `${screenname}@hiitsme.app`, legacy fallback `@buddylist.com` (`src/lib/authIdentity.ts`) | `him-CLAUDE.md` saying primary is `@buddylist.com` |
| Rooms | v2: `public.rooms`, `room_memberships`, `room_messages.body`. Join/leave via `join_room_by_id` / `leave_room_by_id` | `him-CLAUDE.md` `user_active_rooms` + dual-write to `room_participants` |
| Social graph | `buddies` (**asymmetric**, pending → accepted). `pending` is ONE directional row (requester → target); `accepted` writes both directions but some mirrors are missing. Count DISTINCT UNORDERED pairs — `count(*) / 2` is wrong for both statuses. | Do not build on `user_connections`. Do not assume symmetry. |
| Public copy | No dating vocab. No AOL/AIM in **public** copy (issue #108) | Internal AIM-era mechanics (sounds, buddy list) may stay. `src/app/page.tsx` still plays `/sounds/aol-welcome.mp3` on native sign-on — do not advertise that. |
| Wordmark | lowercase `him` in product chrome. Periods only in body copy and press ("H.I.M.") | Uppercase wordmark |

`CLAUDE.md` is closer to engineering truth. `him-CLAUDE.md` is closer to positioning and voice, except its design-system and rooms-v1 sections are wrong.

## Stack

Vite 6 + React 19 + React Router v7 SPA. Tailwind v4. Supabase (Postgres, Auth, Realtime, Storage, Edge Functions). Capacitor 8 iOS/Android wrappers. Vitest + Playwright. Vercel for web; `api/` for recovery/admin. Native default is **bundled** (`native-web/` via `scripts/build-native-web.mjs`). Hosted mode is debug-only.

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
- **Password recovery** is custom (synthetic emails cannot receive mail): `account_recovery_codes`, `password_reset_tickets`, `password_reset_audit`, `password_reset_attempts`. Do not "simplify" onto Supabase's email reset.
- **Account deletion** is `supabase/functions/delete-account`. It must succeed on data-bearing accounts, not empty ones. Guards: CORS allows `x-client-info`; `isMissingTable()` matches both `42P01` and `PGRST205`; native ⋯ menu has Account; rooms-v1 archive triggers were dropped. Do not reintroduce those four bugs.
- **Push:** `requestAndRegisterPush()` lives in `src/lib/nativePush.ts`. Callers: `/account` (manual) and `src/lib/pushPromptMoments.ts` (contextual, only while system state is `prompt`). Friendship-action callers are `buddyRequest.ts` (`buddy_accepted`) and `messageIdempotency.ts` (`first_dm_sent`). First room message is **not** wired. iOS permission state is the source of truth; `him.pushPrompt.askedAt` is a 7-day cooldown, not a once-per-install veto — localStorage survives reinstalls, authorization does not (#154). Do not skip the ask because `user_push_tokens` has rows. `pushColdLaunchGuard.test.ts` is the contract. Never prompt on cold launch (Guideline 2.5.13). Notification preview default is sender-only.
- **Invites:** `rooms-invite` requires an accepted buddy. There are no shareable invite links. `/join/:inviteCode` discards the code. Do not invent viral links.
- **`dist/` is tracked.** Always `npm run build` (emptyOutDir) before a dist resync. `npx cap copy ios` drops `HiItsMeShellPlugin` — use `npm run ios:sync`.
- **Content moderation:** DB trigger + client `displayBodyForMessage()`. Wordlist is generated; do not hand-edit `profanityTerms.generated.ts`.

## App Store

History that will repeat if forgotten:

1. Rejection: iPad "unresponsive" — `100vw` overflow + opaque boot splash. Fix: `width: 100%`, boot watchdog.
2. Rejection: 5.1.1(v) account deletion + 1.5 Support URL. Four stacked deletion bugs (CORS, PGRST205, native menu, legacy triggers) plus `/support`.

Still required: deletion reachable in-app on iOS; Support/Privacy/Terms URLs live; no push prompt on launch; age rating 18+. Demo account `appreviewer2026` exists for review — never store its password in the repo.

Owner security: revoke ASC key `XV95PUP6YN` (leaked in git history `00b2839`). Rotate `LMT6SQA4GV` after the current window.

## Growth (Aug 2026, week 3 of the Q3 flight)

Open tickets:

- **#108** web porch on logged-out `hiitsme.app` `/`. Native `/` stays Sign in. `/signin` and `?signin=1` keep LoginPage.
- ~~**#109** first-run iOS push after a friendship action.~~ Code on main via #104; not on live 2.2. 2.3 upload blocked by ITMS-90382 (22 Aug).
- ~~**#106** `users.acquisition_source` write-once at web signup.~~ Shipped 22 Aug (#113).
- ~~**#107** `marketing_snapshots` + founder SQL insert.~~ Shipped 22 Aug (#114); run `marketing/campaign-2026-q3/reporting/gh17-daily.sql`.

Do **not** this weekend: Circles (0 owners), Buzz demos, Reddit launch blast, a 2.2.1 unless a live bridge error, user counts in posts, "Apple approved 2.2 today," reusing WAU 37.

Interim porch: `https://him.samaan.tech/why.html?utm_source=instagram&utm_campaign=him_v2_2`.

Activation funnel (honest): install (ASC, not in Supabase) → screenname (`users`) → first room joined → first buddy accepted → first DM → D7 return via `last_active_at` (coarse until GH-17 snapshots exist). Cold DMs are allowed and rate-limited; step 4 is not a subset of step 3.

## What not to do

- Dating positioning, face-first discovery, or outing-adjacent mechanics (lock-screen message bodies, forcing real name/photo).
- Fabricated member counts or "live now" numbers.
- Restyling to the unshipped rose/gold system.
- Building on `user_connections` or rooms-v1 archive tables.
- Shareable invite links.
- SSR.
- Touching password-reset tables without an explicit ask.
- Shipping Circles as a launch feature while they have 0 owners.

## Done when

- Typecheck, unit tests, and the relevant Playwright spec pass.
- Native path still bundles (`ios:sync`, not hosted).
- Copy could be read aloud in a quiet room without sounding like a dating ad.
- If you changed push callers, `pushColdLaunchGuard.test.ts` matches the new policy.
- If you changed auth, synthetic email domains still try `hiitsme.app` then `buddylist.com`.
