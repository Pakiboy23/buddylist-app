# Project Memory
Last updated: 2026-08-22 (end of session) | Session 10 | Branch: main @ `303d125`
Memory health: 8/10 — rebuilt from git + marketing docs after a 71-day gap. Sessions 1–9 in `MEMORY-ARCHIVE.md`. Post-06-12 entries are reconstructed, not first-hand; verify before betting on a detail.

## Project Overview
H.I.M. (`hiitsme`) — retro AIM-style mobile-first messaging app. Vite + React 19 + React Router v7, Vercel (web), Capacitor 8 (iOS + Android), Supabase backend. **Shipped.** v2.2 (build 314) is live on the App Store; repo is on 2.3. ~128 accounts. Now in a growth flight, not a build sprint.

## Where We Left Off
- **Current task:** Week 3 of **OPERATION PORCH LIGHT** (Aug 3 – Sep 13), alongside the 2.2 launch run (Day 0 Tue Aug 18).
- **Status:** Session 10 ended with `main` clean at `303d125`, **app verified healthy end-to-end** (see Health check below). Board is clear except #25 and three growth issues.
- **Next immediate step (Sun Aug 23):** the runbook weekend, unchanged except one number — (1) post the **Sunday Reset teaser, NOT a Circles reveal**; (2) host Sunday Reset in-app 90 min; (3) hand-drain the pending backlog, which is now **134 pairs, not the 86 the runbook was written against**; (4) **Mon Aug 24:** run `reporting/gh17-daily.sql` in the Supabase SQL editor — verified paste-ready — then fill `week3-scorecard-template.md`. Monday's run produces the **first real snapshot delta** (only one row exists so far).
- **Open question:** #25 Speed Insights adds a dependency — merge, rebase, or close?

## Health check — verified 2026-08-22 end of session
Web `hiitsme.app` /, /privacy, /terms, /support all **200**; porch `him.samaan.tech/why.html` **200**; served bundle has **1** entry script (hash differs from the tracked one, confirming Vercel rebuilds from source). Supabase: 135 users, 7 rooms, last DM Aug 21 16:41Z, last room msg 16:15Z, last signup 12:00Z, 6 push tokens, **0 flagged messages pending review**. All **6 edge functions ACTIVE** (`push-dispatch` v9). App Store: **2.2 READY_FOR_SALE**. ASC key `9R3T4646YP` verified HTTP 200.

## The core product finding (most important thing in this file)
Across weeks 1 and 2 the pattern held and sharpened: **acquisition is solved without any marketing push; everything downstream of arrival is not, and is now decaying.**

| | Week 1 (Aug 3–9) | Week 2 (Aug 10–16) |
|---|---|---|
| Signups (target) | **30** (5–10) | **19** (8–12) |
| WAU trailing 7d | **37** (baseline 4) | **17 — halved** |
| Activation ≤72h | **0%** | **0%** |
| Room messages | **0** organic | **0** organic |
| DMs sent | 3 | 4 organic (+8 engine) |
| Accepted buddy pairs | 5 | **0** |
| Pending backlog | 67 | **86** |
| iOS push opt-in | 0% | 0% |

**Live production read, Sat 2026-08-22 (mid-week-3, via `gh17-daily.sql`):** total users **135** · WAU(7d) **13** · active 24h **4** · signups 24h **3** · DMs 24h **7** · room msgs 24h **1** · **pending backlog 134** · accepted pairs **29**.
Two things moved the wrong way since the week-2 capture: **WAU 37 → 17 → 13** is still decaying, and the **pending backlog 67 → 86 → 134** has nearly doubled rather than draining. The runbook's hand-drain target was written against 86.

Diagnosis on record: this is **one discovery-and-prompting problem across the whole surface**, not four independent feature misses. The one feature with a visible surface in the default view (Suggested Buddies, shipped Aug 4) moved its metric 2.5–19× in six days; everything shipped Jul 22 without a surface (Circles, Knock, Buzz) sits at or near zero. Room entry is a *zero-entry* problem — seeding content does not fix a surface nobody opens.

## Active Work
- [ ] Week-3 founder runbook — Sunday Reset, backlog drain (**134**), Monday scorecard
- [ ] **#25** Vercel Speed Insights — NOT stale (touched Aug 16); one import + one dep, needs rebase. Adds a dependency, so it needs an explicit call
- [ ] **#109** first-run iOS push prompt after a friendship action — the fix for the 0% opt-in. Note `pushColdLaunchGuard.test.ts` asserts the current policy; update it in the same PR
- [ ] **#108** web porch: logged-out `hiitsme.app` is Sign-in only
- [ ] **#107** GH-17 follow-through (table + daily SQL shipped; keep running it Mondays)
- [ ] SECURITY: confirm ASC key `XV95PUP6YN` is revoked in the ASC console — leaked at `00b2839`, **not checkable via API**, still unverified since June
- [ ] Housekeeping: `codex/him-hi-app-icon` now holds nothing unique — safe to delete
- [ ] Xcode Cloud runs a full iOS archive on markdown-only PRs; worth a path filter

## Blockers
- O8/O9 unreadable: Vercel Web Analytics API is plan-gated (404) and ASC Analytics is not exposed to the current key. Both need founder dashboard screenshots — **pending since week 1**.

## Key Decisions
| Date | Decision | Reasoning | Affects |
|------|----------|-----------|---------|
| 2026-08-22 | `marketing_snapshots` counts distinct unordered pairs, RLS on with no policies | `public.buddies` is not symmetric — pending is one directional row, accepted writes both but some mirrors are missing, so `count(*)/2` is wrong. RLS-off would expose an ops table to anon via PostgREST | `20260822000001` |
| 2026-08-22 | Do not reveal Circles as a launch feature | 0 owners / 0 members after a month live; demoing an empty surface is worse than silence | week-3 content plan |
| 2026-08-17 | Acceptance tracked as Monday-to-Monday snapshot deltas, not creation-week attribution | The accept flow rewrites row timestamps in place, so week-attributed counts mutate retroactively (wk-1 "accepted" read 5 on Aug 10, 1 on Aug 17) | `weekly-scorecard.md` |
| 2026-08-10 | activation-v2 (room post OR request sent OR DM ≤72h) **rejected**; counter-proposal = DM OR room post OR request **ACCEPTED** | The rejected version scores 43% on a one-tap action that is 93% unreciprocated — it grades the flight on the metric the flight moved. Every qualifying action must require a second person | measurement plan |
| 2026-08-10 | Never publish user counts; never claim "Apple approved X today" | Small denominators read as failure; approval claims age badly | all channels |
| 2026-07-22 | H.I.M. Pro entitlement ships **dormant** (`is_pro`) | Plan of record without committing the paywall | `20260722160000` |
| 2026-06-12 | Drop rooms-v1 sync triggers rather than recreate `room_participants` | Table is dead by design under rooms v2; triggers were pure debris | account deletion |
| 2026-06-11 | Deletion testing MUST use data-bearing accounts | Empty accounts skip archive cascades → false "verified" | delete-account testing |
| 2026-06-09 | Edge fn CORS Allow-Headers must include `x-client-info` | `functions.invoke` always sends it; missing → preflight 4xx | all edge functions |
| 2026-06-08 | ASC metadata managed via API (`scripts/asc/asc.mjs`) | Repeatable; Resolution Center is NOT in the API (paste manually) | App Store ops |
| 2026-06-08 | `width:100%` not `100vw` on root | 100vw + iPad scrollbar/safe-area = overflow → "unresponsive" rejection | `globals.css` |
| 2026-05-25 | Notification preview defaults to sender-only | Outing risk from lock-screen message text | `pushPreview.ts` |
| 2026-05-17 | Push permission never requested on cold launch | Guideline 2.5.13 | `nativePush.ts` |
| 2026-05-14 | Midnight system: amber `#E8A23A`, indigo `#1A1F3A`, stone `#F5F1E8` | Samaan brand book | whole UI |
| ~2026-04 | Next.js → Vite + React Router v7 | Cleaner Capacitor bundling | frontend + `api/` |
| v1 | DMs and rooms are NOT a unified surface | Intentional product scope | parity backlog |

## Key Files
| File | Purpose |
|------|---------|
| `marketing/campaign-2026-q3/reporting/WEEK3-FOUNDER-RUNBOOK.md` | **Start here.** Ordered weekend actions + explicit do-not list |
| `marketing/campaign-2026-q3/reporting/weekly-scorecard.md` | Week 1 + 2 scorecards, full method notes and decision records |
| `marketing/campaign-2026-q3/reporting/gh17-snapshot.sql` | Monday production capture query |
| `marketing/campaign-2026-q3/strategy/{growth-plan,measurement-plan}.md` | Objectives O2–O12, targets by week |
| `marketing/release-2-2/launch-package/` | 2.2 launch copy incl. `DAY4-DAY5-COPY.md`, `EXECUTION-2026-08-18.md` |
| `scripts/asc/asc.mjs` | ASC API client — `ASC_KEY_ID=… ASC_ISSUER_ID=… ASC_KEY_PATH=fastlane/.keys/AuthKey_*.p8 node scripts/asc/asc.mjs …` |
| `scripts/capture-app-store.mjs` | Playwright store screenshot capture |
| `supabase/functions/` | `admin-me`, `delete-account`, `export-account`, `push-dispatch`, `rooms-invite` |
| `src/lib/nativeShell.ts` | `NativeShellAction` union + JS↔Swift bridge |
| `ios/App/App/AppDelegate.swift` | Native shell: ⋯ menu, Liquid Glass dock, accent resolver |
| `ios/App/App/NativeMilestoneOneView.swift` | Native BuddyList presence surface (away replies, Knock, mutual context, Circles) |
| `src/context/ChatContext.tsx` | Persistent room state + unread logic |
| `AGENTS.md` | Codex-facing twin of `CLAUDE.md` |
| `supabase/migrations/` | Through `20260822000001_marketing_snapshots.sql` |

## Architecture Notes
- **Rooms v2:** `public.rooms` + `room_memberships`; join/leave via SECURITY DEFINER RPCs (RLS recursion on direct INSERT). `invited_by` stamped on invite-joins since GH-14.
- **Realtime:** `active_chat_room:${roomId}`, `global_notifications_messages`, `global_notifications_room_messages`.
- **`public.buddies` is asymmetric** — verified against prod 2026-08-22: pending 134 raw rows / **0 mirrored**; accepted 51 raw rows / 44 mirrored / **7 orphaned** → 29 true pairs. `count(*)/2` understates pending by half. Always count distinct unordered pairs. (The `him-app-expert` skill claimed symmetry; corrected in PR #117.) `public.users` has **no** `created_at`; use `auth.users.created_at`.
- **In-app engine** (welcome DMs, buddy nudges ~4/day, daily room prompts) went live Aug 16; first room prompt fired 00:18Z Aug 17 on trigger-queue latency. Frozen texts live on the PR #104 branch, not yet merged. 4 nudges/day will not drain an 86-pair backlog — hence the manual drain.
- **Push:** registration listener → `user_push_tokens`; `requestAndRegisterPush()` is the only permission trigger. There is still **no first-run prompt** (issue #109) — this is why opt-in reads 0%.
- Xcode Cloud assigns build numbers, so `CURRENT_PROJECT_VERSION` (288) lags what is live (314).
- PostgREST missing-table error is `PGRST205` "schema cache", not Postgres `42P01`. Guard both.

## Known Issues
- **Memory lives on `main` and drifts fast.** The session-9 file survived only because PR #64 carried it; a parallel copy on `codex/him-hi-app-icon` diverged. Write memory on `main` and push it.
- **Tracked build output is the #1 recurring hazard — it has bricked iOS twice.** Always `npm run build` (emptyOutDir) before committing a resync.
  - #93: builds 293–304 shipped bricked from a bundle built without real Supabase env.
  - #104 → #119 (Aug 22): a merge hit **144 conflicts, all in `dist/` and `ios/App/App/public/`, zero in source**. Resolving them kept both sides, so `index.html` carried **two module entry scripts and 57 chunks instead of 29** — the app booted twice. Web was safe (Vercel rebuilds from source) but Xcode Cloud archives `ios/App/App/public` **verbatim**, so any build cut from main would have shipped it.
  - **Never hand-resolve conflicts in build output** — content-hashed chunk names have no meaningful merge. Delete both trees and regenerate.
  - CI now guards all three failure modes: source-changed-without-resync, placeholder backend, and (added after #119) exactly one module entry point per bundle.
- `npx cap copy ios` regenerates `capacitor.config.json` and DROPS `HiItsMeShellPlugin` — use `npm run ios:sync`.
- O12 (deletion rate) breached its **weekly** read for the first time in week 2: 2/19 = 10.5% vs a 10% guardrail. Flight-cumulative 4/49 = 8.2%, still under. A second weekly breach or a cumulative cross escalates it to a named risk.

## Session Log
| Session | Date | Summary |
|---------|------|---------|
| 1–9 | 05-14 → 06-12 | Build + trust/safety + two App Store rejections survived. See `MEMORY-ARCHIVE.md`. |
| — | 06-14 → 07-06 | "hi." icon merged (#65). Android FCM push + Play release tooling (#67), Play upload CI (#68), assetlinks fix (#71). Security: revoked client EXECUTE on internal SECURITY DEFINER fns (#69), scoped chat-media storage to signed URLs (#70). |
| — | 07-11 → 07-23 | **Presence becomes the primary experience** (#84). Native BuddyList: away replies, Knock, mutual context, Buddy Circles (#86). "Seen by N" room receipts (#80). Orphan-profile self-heal (#81–83). Dormant Pro entitlement (#87). v2.1 release + GTM package (#88–89). OPERATION PORCH LIGHT campaign authored (#73). |
| — | 07-29 → 08-05 | Pre-flight baseline + Vercel Web Analytics (#90–92). **Builds 293–304 bricked** by a bundle missing Supabase env — urgent rebuild (#93). Buddy photos + global Suggested Buddies (#95), Profile unified into Buddy List (#96). v2.2 auto-released Aug 4. |
| — | 08-10 → 08-19 | Week-1 scorecard (#99) and week-2 scorecard (#103). `invited_by` on invite-joins (#100). 2.2 launch package, Day 0 Aug 18 (#102). Claude Code GH workflows (#105). |
| 10 | 2026-08-22 | Memory rebuild after a 71-day gap (archived s1–9, ff'd `main` 49 commits off the stale codex branch). Then: recovered the one salvageable orphan commit as #116 (−354KB splash); corrected the `him-app-expert` skill, which claimed `buddies` is symmetric when prod says otherwise (#117); recorded the live read showing **WAU 37→17→13** and **backlog 67→86→134** (#118); verified and merged #119, which fixed a **double-entry-point bundle** that #104 had merged onto main and that would have shipped via Xcode Cloud; added the CI guard that would have caught it (#120). Rotated the ASC key to `9R3T4646YP` (verified 200), confirmed `LMT6SQA4GV` revoked (401) and deleted it. Ended with a full health check, all green. |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- No em dashes in app-facing copy; no pitch-deck words
- UI work: verify in a browser before declaring done
- Default to no comments unless the WHY is non-obvious
- Prod writes (deploys/migrations): ask per action, then move fast once approved
- Never publish user counts or fake in-app activity — quiet-room reframes are allowed, fake occupancy is not

## External Context
- ASC: app `6761863631`. Live: 2.2 build 314, READY_FOR_SALE, **0 customer reviews**. Repo on 2.3.
- Supabase project `keckqpadzxwwmagnmpuk`; migrations through `20260822000001`.
- Porch link in use until issue #108 ships: `https://him.samaan.tech/why.html?utm_source=…&utm_campaign=him_v2_2`. Never tell people to search bare "H.I.M." — always "H.I.M. — Friends, Not Dates".
- Live pages: hiitsme.app/privacy, /terms, /support.
- ASC API key: **`9R3T4646YP`** (installed `fastlane/.keys/`, mode 600, git-ignored; verified HTTP 200 on 2026-08-22). Issuer `f42ab007-1295-4ecb-b309-023ddfdac034` — same UUID as the Xcode Cloud team id. `LMT6SQA4GV` **confirmed revoked** (401 on 2026-08-22); local copy deleted. `XV95PUP6YN` was leaked in git history (`00b2839`) — **revocation still unverified**, and ASC exposes no API to list keys, so it needs a Users-and-Access console check. `.gitignore` covers `/fastlane/.keys/`. Never store keys or passwords here.
