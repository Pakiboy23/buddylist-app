# Project Memory
Last updated: 2026-10-08 | Session 14 | Branch: grok/docs-main-today
Memory health: 8/10. Sessions 1 to 9 are in `MEMORY-ARCHIVE.md`. Metrics below are dated historical reads, not current numbers; read live data before quoting any.

## Project Overview
H.I.M. (`hiitsme`): friendship-first messaging app with a retro buddy-list feel. Vite + React 19 + React Router v7, Vercel (web), Capacitor 8 (iOS only; Android removed in #147), Supabase backend. **Shipped.** iOS App Store live is **2.6 (build 466)**, released 2026-09-26. `main` is marketing **2.7**.

## Where We Left Off
- **App Store:** 2.6 (466) Ready for Sale, released 2026-09-26. Earlier: 2.5 (460), 2.4 (453), 2.3 (377), 2.2 (314).
- **main:** `MARKETING_VERSION = 2.7` (#185), `CURRENT_PROJECT_VERSION = 465`. Xcode Cloud assigns the build number (its run number), so 465 is not what ships. 2.7 build 472 is in internal TestFlight from `main` (2026-09-28). The next 2.7 archive must be above 466, and Xcode Cloud's next number (473+) already is.
- **Xcode Cloud, verified via ASC API 2026-10-08:** `Release (HIM) — main` archives on `main` only (internal TestFlight). `PR compile check v2 (HIM)` builds `claude/*` with no archive. `Untitled Workflow` archives on manual start only (no branch or PR conditions). The other three workflows are disabled. **Pushing a non-main branch does not archive or upload.** Merging to `main` does. Issue #131 stays open for the owner to close.
- **Open PRs from this session:** #186 (outbox requeue + iOS `HIM://reset-password` link; needs a bundle resync before it reaches iOS).
- **Open question:** ASC key `XV95PUP6YN` revocation is still unverified (issue #132). Do not claim it is revoked.

## Health check — verified 2026-08-22 end of session
Web `hiitsme.app` /, /privacy, /terms, /support all **200**; porch `him.samaan.tech/why.html` **200**; served bundle has **1** entry script (hash differs from the tracked one, confirming Vercel rebuilds from source). Supabase: 135 users, 7 rooms, last DM Aug 21 16:41Z, last room msg 16:15Z, last signup 12:00Z, 6 push tokens, **0 flagged messages pending review**. All **6 edge functions ACTIVE** (`push-dispatch` v9). App Store: **2.2 READY_FOR_SALE**. ASC key `9R3T4646YP` verified HTTP 200.

## The core product finding (Aug 2026 read; historical)
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
- [ ] #186: outbox rows stuck in `sending` after an app kill; iOS password-reset link (`HIM` URL scheme + host-as-route). Needs `npm run build && npm run ios:sync` with the real Supabase env before merge.
- [ ] Owner: confirm `HIM://reset-password` is in the Supabase Auth redirect allow list
- [ ] SECURITY (owner, console only): confirm ASC key `XV95PUP6YN` is revoked (#132). Leaked at `00b2839`
- [ ] Owner: close #131 once satisfied. The ASC API shows Archive is off PR and branch triggers
- [x] 2.3 through 2.6 shipped; 2.6 (466) live since 2026-09-26
- [x] `first_room_message` push moment (#157)
- [x] Android removed (#147); Circles UI deleted (#174); room unread counter removed (#181)
- [x] Profile Add Buddy writes the `buddies` graph (#178)

## Blockers
- **iOS renders the React app; there is no native UI.** A web change reaches iOS only by rebuilding: `npm run build && npm run ios:sync` with the real `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`, then commit `dist/` + `native-web/` + `ios/App/App/public`. Xcode Cloud archives `ios/App/App/public` verbatim. Do not reimplement screens natively.
- O8/O9 unreadable: Vercel Web Analytics API is plan-gated (404) and ASC Analytics is not exposed to the API key. Both need founder dashboard screenshots.

## Key Decisions
| Date | Decision | Reasoning | Affects |
|------|----------|-----------|---------|
| 2026-04-26 | Password recovery moved to Supabase email-link reset; recovery-code tables dropped | Recorded from `7c4ed0e` and `20260426083107_drop_password_recovery.sql` | `src/app/page.tsx`, `/reset-password` |
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
| `src/lib/outbox.ts` | Offline outbox (`hiitsme:outbox:v1:<userId>`), backoff, `client_msg_id` ids |
| `src/components/DeepLinkHandler.tsx` | Routes OS-opened URLs into the SPA |
| `ios/App/App/AppDelegate.swift` | Thin Capacitor host — embeds the web view, reports push environment. No native UI (30 Aug) |
| `src/context/ChatContext.tsx` | Persistent room state + unread logic |
| `AGENTS.md` | Codex-facing twin of `CLAUDE.md` |
| `supabase/migrations/` | Through `20260907000001_show_online_status.sql` |

## Architecture Notes
- **Rooms v2:** `public.rooms` + `room_memberships`; join/leave via SECURITY DEFINER RPCs (RLS recursion on direct INSERT). `invited_by` stamped on invite-joins since GH-14.
- **Realtime:** `active_chat_room:${roomId}`, `global_notifications_messages`, `global_notifications_room_messages`.
- **`public.buddies` is asymmetric** — verified against prod 2026-08-22: pending 134 raw rows / **0 mirrored**; accepted 51 raw rows / 44 mirrored / **7 orphaned** → 29 true pairs. `count(*)/2` understates pending by half. Always count distinct unordered pairs. (The `him-app-expert` skill claimed symmetry; corrected in PR #117.) `public.users` has **no** `created_at`; use `auth.users.created_at`.
- **In-app engine** (welcome DMs, buddy nudges ~4/day, daily room prompts) went live Aug 16; first room prompt fired 00:18Z Aug 17 on trigger-queue latency. Frozen texts live on the PR #104 branch, not yet merged. 4 nudges/day will not drain an 86-pair backlog — hence the manual drain.
- **Push:** registration listener → `user_push_tokens`; `requestAndRegisterPush()` is the only permission trigger. Contextual moments in `pushPromptMoments.ts`: `buddy_accepted`, `first_dm_sent`, `first_room_message` (#157). Never on cold launch.
- **Password recovery:** Supabase `resetPasswordForEmail`, native redirect `HIM://reset-password`, web `/reset-password`. The custom recovery-code system was dropped in April 2026.
- `CURRENT_PROJECT_VERSION` is **465** in the repo, but Xcode Cloud assigns the build number (its run number): live 2.6 is 466, and 2.7 TestFlight is 472. Any new binary must be above 466.
- PostgREST missing-table error is `PGRST205` "schema cache", not Postgres `42P01`. Guard both.

## Known Issues
- **Memory lives on `main` and drifts fast.** The session-9 file survived only because PR #64 carried it; a parallel copy on `codex/him-hi-app-icon` diverged. Write memory on `main` and push it.
- **Tracked build output is the #1 recurring hazard — it has bricked iOS twice.** Always `npm run build` (emptyOutDir) before committing a resync.
  - #93: builds 293–304 shipped bricked from a bundle built without real Supabase env.
  - #104 → #119 (Aug 22): a merge hit **144 conflicts, all in `dist/` and `ios/App/App/public/`, zero in source**. Resolving them kept both sides, so `index.html` carried **two module entry scripts and 57 chunks instead of 29** — the app booted twice. Web was safe (Vercel rebuilds from source) but Xcode Cloud archives `ios/App/App/public` **verbatim**, so any build cut from main would have shipped it.
  - **Never hand-resolve conflicts in build output** — content-hashed chunk names have no meaningful merge. Delete both trees and regenerate.
  - CI now guards all three failure modes: source-changed-without-resync, placeholder backend, and (added after #119) exactly one module entry point per bundle.
- **The pending-requests surface already exists — do not rebuild it.** Web (the only implementation since 30 Aug): a "N requests" button in the Find People card (visible by default when count > 0) and a Requests filter tab. The 134-pair backlog is therefore **not** a discovery problem. With WAU 13 of 135 accounts, recipients simply are not returning to see it, which is a notification problem — i.e. 2.3.
- **FIXED (verified via ASC API 2026-10-08): `Untitled Workflow` now has no branch or PR start condition, and only `main` archives automatically.** Historical note, 23 Aug: the "Untitled Workflow" archived AND uploaded on every branch and every PR. Verified 23 Aug against the console: builds exist for `main`, `claude/*`, `docs/*`, `fix/*`, and TestFlight lists at least ten 2.3 builds already Ready to Submit (360, 361, 362, 364, 365, 366, 367, 371, 374, 375, more behind *See More*). The 22 Aug ITMS-90382 exhaustion was read as "markdown PRs archived"; the real shape is broader and much older. **A docs commit is an App Store upload.**
- **The #122 docs-only archive guard failed OPEN and never worked in Xcode Cloud.** `docs_only_change` treated *"no diff"* and *"could not compute a diff"* as the same empty string, and both fell through to "not docs-only" — a fallthrough that exists so archiving `main` (legitimately empty diff) still works. Xcode Cloud checks out shallow and its script environment cannot reliably fetch `origin/main`, so the diff came back empty for the opposite reason. Proof: build **374** was two docs files and it archived *and* uploaded. Fixed by making `unknown` a distinct verdict and failing **closed** on unclassifiable PR builds, keyed off `CI_PULL_REQUEST_NUMBER` (needs no git history). **The docs-only refusal path is still unproven in Xcode Cloud** — read the `Archive gate:` log line to confirm.
- **ITMS-90382 is a rolling count, not a time window.** Build 371 uploaded cleanly at 05:43 UTC Sun, two minutes before 372 and 373 were rejected; 374/375 succeeded at 08:32/08:49. 371 took the last slot. Do not reason about it as "the cap clears at HH:MM".
- `npx cap copy ios` regenerates `capacitor.config.json` and DROPS `HiItsMeShellPlugin`. Use `npm run ios:sync`.
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
| 11 | 2026-08-23 | Closed #25 as not planned. Closed #107/#109 as shipped. Web porch on logged-out `/` (#108). Xcode Cloud refuses docs-only archives so they cannot burn ITMS-90382 quota. Do not upload 2.3 until the 24h window from Sat 22 Aug 07:37 GMT is done. |
| 12 | 2026-08-24 | Competitor scare (Goose) assessed and dismissed — it is a dating app whose founder quit after a WIRED investigation into AI-generated promo accounts; H.I.M.'s real problem remains its own funnel. Verified `main` archive-ready and wrote `marketing/release-2-3/asc-submission.md`, the first 2.3 submission package (#124). Then discovered, by triggering it, that **the #122 archive guard fails open in Xcode Cloud** and that **every branch archives and uploads** — builds 374/375 went to App Store Connect from a docs PR. Rewrote the guard to fail closed on unclassifiable PR builds. Net: 2.3 (375) is uploaded and Ready to Submit; only Distribution remains. |
| 14 | 2026-10-08 | Docs truth-up against `main`, git history, and the ASC API (read-only): 2.6 (466) live since 26 Sep, `main` on 2.7 with TestFlight 472, Xcode Cloud only archives `main`, password recovery is Supabase email reset (recovery codes dropped in April). Opened #186 (outbox requeue after app kill; `HIM://reset-password` deep link), superseding drafts #175 and #179. Closed obsolete issues #133, #134, #158. |
| 13 | 2026-08-29/30 | The AIM-structure buddy list day. Web restructure shipped (#128) + away-on-send; lockfile consolidation to pnpm (#136); archive gate narrowed to main/tags (#137); 2.3-train-closed diagnosis and 2.4 bump (#138) — build **2.4 (401)** uploaded, VALID, in the internal TestFlight group. Then the day's real lesson: the user still saw the old layout because **iOS renders the buddy list in SwiftUI** (`NativeMilestoneOneView.swift`), not the web bundle — nothing documented this; CLAUDE.md now has a 'Native iOS shell (Milestone One)' section. Ported the AIM grouping to SwiftUI (`nativeBuddyGroups` mirroring `buddyListGroups`): circles-then-Buddies groups with (online/total) headers, single Offline group, Find a Buddy filter, collapse, italic-grey signed-off rows. ASC API used with an uploaded key: disabled the broken `Buddy` workflow, created `PR compile check (HIM)` (Build-only, fires on `claude/*`), proved `Test - iOS` unfixable via API (409 deploymentConfig) and that its required-failure **skips TestFlight auto-distribute**. |

## User Preferences
- Concise, direct responses; no trailing summaries
- Readability + maintainability over cleverness
- No em dashes in app-facing copy; no pitch-deck words
- UI work: verify in a browser before declaring done
- Default to no comments unless the WHY is non-obvious
- Prod writes (deploys/migrations): ask per action, then move fast once approved
- Never publish user counts or fake in-app activity — quiet-room reframes are allowed, fake occupancy is not

## External Context
- ASC: app `6761863631`. Live: 2.6 build 466, Ready for Sale (released 2026-09-26). Repo on 2.7.
- Supabase project `keckqpadzxwwmagnmpuk`.
- Porch: logged-out web `/` is the in-app porch (issue #108). Native `/` is still Sign in. Fallback marketing page remains `https://him.samaan.tech/why.html`. Never tell people to search bare "H.I.M." — always "H.I.M. — Friends, Not Dates".
- Live pages: hiitsme.app/privacy, /terms, /support.
- ASC API key: **`9R3T4646YP`** (installed `fastlane/.keys/`, mode 600, git-ignored; verified HTTP 200 on 2026-08-22). Issuer `f42ab007-1295-4ecb-b309-023ddfdac034` — same UUID as the Xcode Cloud team id. `LMT6SQA4GV` **confirmed revoked** (401 on 2026-08-22); local copy deleted. `XV95PUP6YN` was leaked in git history (`00b2839`) — **revocation still unverified**, and ASC exposes no API to list keys, so it needs a Users-and-Access console check. `.gitignore` covers `/fastlane/.keys/`. Never store keys or passwords here.
