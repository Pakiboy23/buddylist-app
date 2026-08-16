# H.I.M. Q3 2026 Campaign — Store & Measurement Baseline Audit

**Role:** App Store Optimizer + Analytics Reporter
**Verified:** 2026-07-15 against repo `buddylist-app` @ `35f76e2` (main). Evidence paths are repo-relative.
**Campaign flight:** Mon Aug 3 – Sun Sep 13, 2026. This document records what the stores say and what we can measure **on the day before the campaign exists**, so flight-period deltas mean something.
**Companions:** `marketing/campaign-2026-q3/strategy/brand-brief.md` (voice/positioning) and `marketing/campaign-2026-q3/strategy/claims-register.md` (claims ground truth — it supersedes stale lines in `him-launch-deliverables.md`).

---

## 1. Store metadata baseline — both stores, side by side

Sources: `him-launch-deliverables.md` §A (June 2026 final iOS listing — the copy the live listing was entered from; ASC values themselves are not in the repo and should be eyeball-confirmed once), `him-gtm-kit.md` §2 (superseded April draft), `IOS_APP_STORE_RELEASE.md`, `ANDROID_PLAY_RELEASE.md`, `index.html` (web surface).

| Field | iOS App Store (LIVE — v2.0, build 177) | Google Play (NOT LIVE) |
|---|---|---|
| **Status** | Live in the App Store (`ANDROID_PLAY_RELEASE.md` header: "iOS is live") | Not submitted. Release automation merged July 2026 (PRs #67, #68, #71) but every item in the `ANDROID_PLAY_RELEASE.md` §7 store-listing checklist is unchecked; no repo artifact confirms a Play rollout. Claims register DNC #6: say nothing about Android publicly. |
| **App name** | `H.I.M. — Friends, Not Dates` (27 chars; on-device display name is `H.I.M.`) | Planned: `H.I.M.` (§7 checklist). No Play listing name finalized. |
| **Subtitle / short description** | Subtitle: `Gay friendship, retro style` (27 chars) | Short description (80 chars): **does not exist anywhere in the repo** — must be drafted. |
| **Promotional text** (iOS-only, editable anytime, 170 chars) | "A friendship-first space for gay men — screennames, away messages, buddy lists, and chat rooms. No swiping. No hookups. Just real conversations with people who get it." (166 chars) | n/a (no Play equivalent) |
| **Full description** | LD §A full description ("H.I.M. ('Hi, It's Me') is a friendship app for gay men — not a dating app, and not a hookup app." + absent-mechanics enumeration + safety block). **Two lines now stale per claims register:** "Download a full copy of your data whenever you want" (DNC #2 — overstates export caps) and "Gay men 17+" (Approved #23 — rating is now 18+). Correct both at the next metadata update. | Does not exist — must be drafted (4,000-char limit). Play has no keyword field, so this description doubles as the keyword surface. |
| **Keyword field** | `gay,friends,friendship,community,chat,rooms,buddy,lgbtq,queer,messaging,im,away,screenname,platonic` (99/100 chars). Deliberately omits date/dating/hookup/match/meet/single/nearby/flirt (4.3 category risk) and competitor names (2.3.10). Only changeable with a new binary submission. | n/a — keywords are extracted from listing text. |
| **Age rating** | **18+** (ASC rating changed 9+→18+ per claims register #23 / PR #57; LD §B's "17+" tables are the pre-change rationale) | Content-rating questionnaire pending; §7 anticipates Mature 17+ answers, target audience 18+/adults. Must be completed at submission. |
| **Category** | Not recorded in repo — confirm in App Store Connect (Social Networking expected). Log it in this file once read. | Undecided: "Communication / Social" (§7). |
| **Screenshots / creative** | Live set entered manually; approved overlay captions in `him-gtm-kit.md` §3; tooling exists: `scripts/take-app-store-screenshots.mjs`, `scripts/generate-app-store-previews.mjs`. iPhone-only, portrait — no iPad mockups (claims register #21). | Required at submission: icon 512×512, feature graphic 1024×500, ≥2 phone screenshots (§7). None produced yet. |
| **What's New template** | "Design updates, performance fixes, and stability improvements. Thanks for being in early access." (`him-gtm-kit.md` §2) | n/a until live |
| **Privacy labels / data safety** | Nutrition labels mapped in LD §C; **Tracking = No on every row** — a constraint on any analytics we ever add | `docs/compliance/google-play-data-safety.md` drafted; legal open items unresolved (§7 checklist) |
| **Publisher / support** | Saman Technologies LLC · support@hiitsme.app · hiitsme.app/privacy · /terms | Same |

**Web surface baseline** (`index.html`, deployed via `dist/` to Vercel): title `H.I.M. — Friendship-first social app`; meta description `Your screenname, your status, your people. Not a hookup app.`; OG image `https://hiitsme.app/og-image.png` (1200×630); OG description drops the "Not a hookup app" clause. This is the landing surface every campaign link hits.

**Editability during the flight (plan around this):**
- Editable anytime, no review of the binary: iOS promotional text; Play listing text (once live); web meta tags.
- Requires a new iOS build submission: keyword field, app name, subtitle, screenshots-with-new-build. If a keyword revision is wanted for the Aug 3 start, it must ride a build submitted in July.

---

## 2. Keyword expansion candidates (grounded in the existing field)

### 2.1 Duplication audit — ~23 characters are being wasted

Apple indexes the app name and subtitle; repeating their words in the keyword field buys nothing. Current name/subtitle already index: `friends`, `dates`, `gay`, `friendship`, `retro`, `style`.

| Term in keyword field | Also in | Chars reclaimable (term + comma) |
|---|---|---|
| `gay` | Subtitle | 4 |
| `friends` | App name | 8 |
| `friendship` | Subtitle | 11 |

Reclaimable: **23 of 100 chars**.

### 2.2 Expansion candidates

All candidates pass the campaign hard rules: no dating vocabulary (match/swipe/single/nearby/flirt/hookup), no competitor names (Grindr/Scruff/Tinder — 2.3.10 risk), no AOL/AIM/ICQ trademarks (brand policy + 2.3.7 trademark risk applies to hidden metadata too). Apple auto-combines terms across the field and name/subtitle, so single words unlock phrase queries.

| Candidate | Chars | Rationale (grounded in existing field/brand) | Phrase combos unlocked with terms already indexed |
|---|---|---|---|
| `social` | 6 | Was in the April field (`gay social`, `queer social` — `him-gtm-kit.md` §2); dropped in June for no stated reason | gay social, queer social, social chat |
| `men` | 3 | April field had `gay men`; audience-defining, cheap | gay men, men chat |
| `messenger` | 9 | Category noun for the retro-IM mechanic; era-generic, no trademark | gay messenger, retro messenger, buddy messenger |
| `talk` | 4 | Intent-matched to "a place to just talk" (approved listing language) | gay talk, talk rooms |
| `group` | 5 | Rooms are the core loop; combines with existing `chat` | group chat, gay group chat |
| `penpal` | 6 | Friendship-intent search with low competition; matches async "people check in throughout the day" positioning | gay penpal |
| `status` | 6 | Away-message mechanic; low volume, on-brand | status app (weak — lower priority) |
| `instant` | 7 | Combines with `messenger` for the generic category phrase | instant messenger (generic term, not a mark) |
| `nyc` / `chicago` / `atlanta` | 3/7/7 | Grounded in the real seeded regional rooms (claims register #1); combos like "gay chat nyc" are exactly what the rooms serve | gay chat nyc, gay chicago, gay atlanta |
| `hangout` | 7 | Friendship-intent, no dating adjacency | gay hangout |

**Trim candidates within the existing field:** `im` (2 chars, likely normalized away by search), `away` (nobody searches it; brand-defining but not a query), `messaging` (redundant if `messenger` is added — keep one). `platonic` and `screenname` are low-volume but zero-competition and intent-perfect; keep.

### 2.3 Example revised string (97/100 chars — for the next build submission, founder sign-off required)

```
community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,group,penpal,platonic,screenname
```

Drops the three name/subtitle duplicates plus `im`/`away`/`messaging`; adds `messenger,social,men,talk,group,penpal`. City terms are the next candidates if further chars are freed. There is no repo-visible keyword-rank data (see gap inventory), so this is a hygiene-and-coverage revision, not a data-driven one — treat the Aug–Sep flight as the first period where ASC search-source data gets checked against it.

### 2.4 Play Store keyword note

Play has no keyword field; ranking derives from listing text. **The Play short + full descriptions do not exist yet** — drafting them (seeded from the corrected iOS description: 18+ not 17+, "download a copy of your data" not "full copy") is a prerequisite for any Android motion and belongs on the campaign deliverables list, gated on the founder actually submitting to Play.

---

## 3. Measurement-readiness inventory

### 3.1 Analytics/telemetry actually in the codebase (grep audit, 2026-07-15)

| Tool | Present? | Evidence |
|---|---|---|
| Vercel Web Analytics | **Yes — web only** | `package.json`: `@vercel/analytics ^2.0.1`; `src/App.tsx:4` imports it; `src/App.tsx:109` renders `{!Capacitor.isNativePlatform() && <Analytics />}` — deliberately gated off native (LD §C flag 2, Art. 9 posture) |
| Custom events via `track()` | **No** | Zero `@vercel/analytics` `track()` calls; the only `.track(` hits in `src/` are Supabase Realtime presence channels |
| PostHog / Plausible / GA4 / gtag / Mixpanel / Amplitude / Umami / Segment / Heap / Matomo / Fathom | **No** | Case-insensitive grep across `package.json` + `src/`: no matches (hits elsewhere are lockfiles, compliance docs, unrelated words) |
| Sentry / crash reporting SDK | **No** | No matches; only crash data is ASC's opt-in crash reports |
| UTM handling in app code | **No** | Case-insensitive grep for `utm` in `src/`: zero matches. Nothing reads, stores, or forwards UTM params |
| Install referrer (Android) / AdAttributionKit / SKAdNetwork | **No** | No plugin, no config — nothing in `package.json` or native projects |

**UTM status, precisely:** links to hiitsme.app **can** carry UTMs today and Vercel Web Analytics records UTM parameters on pageviews as filterable dashboard properties (subject to plan event limits) — so channel-level *web traffic* breakdowns work with zero code. But the app itself never touches UTMs: nothing persists them through signup (no acquisition columns on `public.users`), and the moment a visitor hops to the App Store the parameters are gone. One SPA caveat: `/join/:inviteCode` immediately client-redirects (`src/app/join/[inviteCode]/page.tsx` is a bare `<Navigate to="/hi-its-me/rooms" replace />`), so deep-linked entries register as a pageview then vanish — the invite code itself is discarded, never captured (claims register DNC #7).

### 3.2 What CAN be measured today, with no new tooling

**A. App Store Connect (iOS — primary platform)**
- Complete counts: impressions, product page views, conversion rate, total downloads (first-time vs redownload), by territory and by source type (App Store Search / App Store Browse / App Referrer / Web Referrer, with top referring domains — the only attribution signal we have for the store hop).
- Opt-in-only usage metrics (~a third of devices): sessions, active devices, retention curves, crashes. Directionally useful, not absolute.
- Peer-group benchmarks (conversion, retention vs category).
- Promotional text is editable anytime — the one live ASO lever during the flight without a build.
- Automatable: ASC Analytics Reports API with an API key, if weekly pulls are wanted; not required.

**B. Google Play Console** — nothing until the app is live. Once live: store performance by traffic source, search terms, installs/uninstalls, vitals. No baseline exists; if Android launches mid-flight it starts from zero, which is itself a clean baseline.

**C. Vercel Web Analytics (web app + landing surface)** — pageviews, referrers, UTM breakdowns, countries, devices, top routes. Anonymous and aggregate only; cannot be joined to Supabase accounts; blind to everything inside the native app.

**D. Supabase SQL (service role — the richest source we own).** Everything below is a real column verified in `supabase/migrations/`; pattern already exists in `supabase/queries/` (e.g. `moderation_review_queue.sql`).

| Campaign metric | Source of truth |
|---|---|
| New signups per day/week | `public.users.created_at` (also `age_confirmed_at`, `art9_consent_at`) |
| DAU/WAU proxy | `public.users.last_active_at` (indexed: `users_last_active_at_idx`, migration `20260320000011`) |
| **Activation** — LD §E.8 defines it as "posted in a room" | first `public.room_messages` row per `user_id`; time-to-first-post = that minus `users.created_at`. Fully measurable today |
| Room engagement, per room | `room_messages.created_at` by `room_id`; `room_memberships.joined_at` / `last_seen_at` (indexed room+last_seen) |
| DM volume + depth | `public.messages` (`sender_id`, `receiver_id`, `created_at`, `read_at`, `delivered_at`) |
| Social-graph formation | `public.buddies` (`status` pending/accepted, `created_at`) → buddy-request→accept rate, accepted pairs per new cohort |
| Retention cohorts (crude) | `users.created_at` × `users.last_active_at`; corroborate with `security_events` (migration `20260525000005`) sign-in events over time |
| Push reach | `public.user_push_tokens` by `platform` |
| Churn | `public.account_deletion_log` (migration `20260525000004`) |
| Safety load (report weekly during flight) | `abuse_reports`, `blocked_users`, `flagged_at` counts on `messages`/`room_messages` |

**E. Vercel request logs** — exist, but retention is hours-to-a-day depending on plan and there is no log drain configured. Not a reporting source; ignore for the campaign.

### 3.3 What is MISSING (no new-tooling workaround)

| Capability | Status | Consequence |
|---|---|---|
| Install attribution (iOS) | Missing — no MMP, no Apple Search Ads, no SKAdNetwork/AdAttributionKit config | Can't tie an install to a channel; ASC source-type buckets + referrer domain are the ceiling |
| UTM → signup capture | Missing — UTMs die at the App Store hop and are never persisted at web signup | Can't attribute even web signups to a channel; can't compare cohort quality by source |
| In-product event funnel | Missing — zero event instrumentation; native is intentionally analytics-free (privacy-label commitment: Tracking = No) | SQL sees states (signed up, posted), not steps (store page → open → signup start → age gate → first room join); mid-flight onboarding drop-off is invisible |
| Referral/invite tracking | Missing — and the share-link mechanic itself doesn't work: `/join/:inviteCode` discards the code; `getShareableInviteUrl` (`src/lib/appApi.ts:27`) has no redemption behind it; universal-link plumbing (`public/.well-known/assetlinks.json`, `apple-app-site-association`) is wired but captures nothing | No word-of-mouth mechanic to promote and no K-factor measurement; claims register DNC #7 bans "invite link" copy |
| Web ↔ app identity join | Missing — Vercel data is anonymous; Supabase is authenticated; no bridge | Landing-page performance can never be connected to accounts created |
| Durable reporting layer / baseline snapshots | Missing — metrics scattered across ASC, Vercel dashboard, and ad-hoc SQL; nothing is snapshotted | Without a pre-Aug-3 snapshot, week-over-week campaign deltas can't be reconstructed later |
| Crash/error telemetry beyond ASC opt-in | Missing (no Sentry) | Campaign-driven traffic spikes could surface bugs we only hear about via support email |
| ASO keyword-rank data | Missing — no tool, no repo record of ranks | Keyword revision (§2.3) can't be validated except via ASC search-source trends |

**Privacy constraint on all fixes:** the iOS nutrition labels declare Tracking = No and native ships analytics-free by design (LD §C). Any measurement added to the native binary must stay first-party and non-tracking or it triggers label changes and Art. 9 exposure. The cheap, posture-consistent path is: Supabase-side columns/queries + web-only Vercel — which is exactly what gaps 1–3 below need anyway (e.g., a nullable `acquisition_source` on `public.users` written once at signup from a client-captured UTM is first-party data, not tracking).

---

## 4. Top 5 measurement gaps, ranked by how badly they block campaign reporting

1. **No install attribution on iOS — the primary platform is a black box between tap and install.** Every campaign link's channel identity dies at the App Store hop; App Store Connect only yields source-type buckets and referrer domains. Per-channel installs, cost-per-install, and content-level performance are unreportable for the flight.

2. **No UTM → signup capture — even web signups can't be attributed to a channel.** UTMs are visible only as anonymous aggregate pageviews in Vercel Web Analytics; nothing persists acquisition source at account creation (`public.users` has no acquisition columns, `src/` has zero UTM handling), so signup counts can never be split by campaign, post, or channel.

3. **No in-product funnel events — campaign traffic that dies mid-onboarding dies invisibly.** There is no event instrumentation anywhere (no `track()` calls; native intentionally analytics-free), so while SQL can report end states (signup, first room post), the step-level drop-off between landing, signup start, age gate, first room join, and first post cannot be seen or fixed mid-flight.

4. **The referral/invite loop is neither built nor measurable — word-of-mouth, the cheapest channel for a seeded community, has zero tracking.** `/join/:inviteCode` throws the code away and `getShareableInviteUrl` has no redemption behind it, so no share mechanic can be promoted (claims register DNC #7) and no K-factor or invite-conversion number can ever be produced.

5. **No durable reporting layer or pre-flight baseline snapshot — week-over-week campaign deltas can't be trusted after the fact.** Metrics live in three consoles plus ad-hoc SQL, Vercel request logs expire in hours-to-a-day, and nothing snapshots the pre-Aug-3 state; unless baseline numbers (ASC metrics + the §3.2-D SQL counts) are captured before the flight starts, the campaign report can't honestly say what changed.

**Cheapest pre-flight mitigations (no new vendors, respects the privacy posture):** (a) snapshot ASC metrics + all §3.2-D SQL counts into a dated file the week of Jul 27; (b) standardize UTM tagging on every campaign link anyway — Vercel aggregates are better than nothing; (c) if any code change is budgeted before Aug 3, the highest-leverage single fix is persisting first-touch UTM into a nullable column on `public.users` at signup (closes gap 2 for web and gives gap 1 a partial proxy via "web signup vs store-source install" triangulation).

---

*Baseline audit · H.I.M. Q3 2026 campaign · internal — not campaign copy*
