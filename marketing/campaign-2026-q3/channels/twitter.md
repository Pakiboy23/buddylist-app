# H.I.M. Q3 2026 — X/Twitter Channel Plan

**Campaign:** OPERATION PORCH LIGHT (internal name — never in public copy) · Flight Mon Aug 3 – Sun Sep 13, 2026
**Prepared:** 2026-07-15 · **Role:** Twitter Engager (platform-specialist bench)
**Governing docs (this plan executes, never overrides):** `strategy/campaign-strategy.md` §5.4 (X channel architecture), `strategy/brand-brief.md` (voice, naming, nostalgia policy), `strategy/claims-register.md` (only allowed claims), `strategy/baseline-audit.md` §3.2 (measurement sources), `strategy/growth-plan.md` GH-02 / GH-03 / GH-04 / GH-11.
**Channel role (strategy §5.4, binding):** X is the **build-in-public founder channel** — founder narrative + community replies. It is NOT a link channel: non-Premium link posts get near-zero reach (trend-research §d), so links live in bio and self-replies only. KPI currency is replies and profile click-throughs, never impressions or followers (strategy non-goal 2).

**Copy status:** every post below is built from claims-register APPROVED claims and brand-brief Tier 1–3 vocabulary or founder-voice product truth. The tagline "The light's on." is not used anywhere in this plan as drafted; it received founder sign-off on 2026-07-15 (brand brief §6 Tier 1) and may now close ship-logs (see §8's note). Posts speak in Haaris's first person; he should feel free to retype any of them in his own words as long as the claim content survives the pre-publish checklist (§9).

---

## 1. Account setup

### 1.1 One account, and it's the founder's

Per strategy §5.4 ("Haaris posts as himself"), the campaign runs on **Haaris's personal X account**, not a brand account. Solo-founder texture is the product's credibility; a faceless brand handle would cost reach and trust and double the workload.

- **If he already has a personal account with any history:** use it. Account age and existing followers beat a cold start. Update display name + bio per below.
- **If starting fresh:** candidate handles to availability-check, in preference order: `@pakiboy24` (matches the in-app screenname he's already public about — GTM §5), `@haarisbuilds`, `@haarisshariff`. Whichever is free and feels right to him.
- **Brand handle:** reserve `@hiitsmeapp` (or nearest available) to prevent squatting. Park it: bio + link + pinned pointer to the founder account. Zero posting duty this flight.
- **X Premium:** subscribe on the founder account (~$8/mo × 2 months, authorized in strategy §8 — "likely the single highest-ROI paid item in the budget").

### 1.2 Profile copy

**Display name:** `Haaris — building H.I.M.`

**Bio (variant A, 157 chars — default):**

> Solo founder of H.I.M. — a friendship-first social app for gay men. Screennames, away messages, buddy lists, rooms. Not a dating app. 18+ · Pakiboy24 in-app

**Bio (variant B, 137 chars — alternate):**

> I build H.I.M. — screennames, away messages, buddy lists, and chat rooms for gay men who want friends, not dates. On the App Store. 18+

**Location field:** "Florida" (founder is already on the record — GTM §4–5) or blank; his call. Never more precise than state.

**Website field:** `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=bio`

**Avatar:** founder photo (his choice — he's public) or the H.I.M. app icon. **Header:** midnight-indigo field with the monospace H.I.M. wordmark + amber pip, or a real-UI screenshot per brand brief §3. No mocked-up activity, no member counts, ever (brand brief §2 rule 2).

**Pinned post:** the launch thread (post T1) from Aug 3 through end of flight.

---

## 2. Cadence — ~5 posts/week, sustainable solo

Growth-plan GH-11 sets the **floor** at 3 founder posts/week. This plan runs at ~5/week by adding two near-zero-cost mirrors of content already produced for other channels. Weekly rhythm:

| Slot | Day / window (ET) | What | Source of effort |
|---|---|---|---|
| Ship-log #1 | Mon or Tue, when he can stay 30–60 min | Build-in-public: what shipped, what broke, real-UI clip (Format F2) | GH-11, original |
| Away Message of the Week | Wed ~12pm | GH-02 prompt, verbatim mirror of the TikTok/IG prompt | Near zero — copy exists |
| Ship-log #2 / product moment | Thu or Fri | Second build-in-public post OR one of the drafted product-moment posts (§4) | GH-11 / this doc |
| Community question | Fri or Sat | Question post from §4 or the format bank | This doc |
| Sunday Reset mirror | Sun ~6pm | Opens the same week-planning question as the in-room ritual (Format F3, GH-03) | Near zero — mirrors in-app ritual |

**Rules that keep it sustainable:**

- **Post-then-hang rule (binding, trend-research §d):** never schedule-and-walk-away. The first 30–60 minutes of reply velocity is the distribution signal — only post when Haaris can actually stay and reply. If he can't stay, the post waits.
- **Week-5 exception:** Late Night posts ship in the 11pm–1am ET window (strategy §6, week 5) — the one time posting time beats reply-availability, because the reply window IS the late-night audience.
- **Degrade order under load:** if a week goes sideways, drop slots in this order: community question → ship-log #2 → Away Message prompt. Never drop the Sunday Reset mirror (it's an appointment ritual, GH-03) or ship-log #1 (the GH-11 floor).
- **Batching:** draft ship-logs during the actual dev work they describe; the two mirrors are copy-paste. Realistic X time budget: ~2 hr/week posting + ~30 min/day replies (fits the §9 founder-load ledger in campaign-strategy §9).
- **Phase gates (Aug 17, Aug 31):** review X formats on 2-week windows like every other channel. Kill or double per the strategy's volatility clause — judge formats, never single posts.

**Build-in-public numbers rule (resolves strategy §5.4 "honest numbers" against DNC #10, which wins):** ship-logs may cite engineering and product numbers — 7 rooms, a 700-term wordlist, 28 migrations, days-to-fix-a-bug, App Store review turnaround. **Never** user counts, signup counts, message volumes, room-activity stats, or anything that measures community size. "No user counts or activity stats ever" (strategy §2) applies to the founder's personal account for the duration — it is campaign surface.

---

## 3. Per-post CTA + UTM conventions

### 3.1 Link discipline

1. **No links in post bodies. Ever.** (Trend-research §d: link posts get near-zero reach.) Links go in exactly two places: the bio, and a **first self-reply** posted immediately after the main post ("Link, since a few of you asked:" / "Link below.").
2. **Canonical destination is hiitsme.app**, never a direct App Store URL — hiitsme.app is the only measurable surface (Vercel UTM breakdowns, baseline-audit §3.2-C); App Store links strip attribution at the hop (baseline-audit gap 1). The landing page routes people onward.
3. **UTM template (locked in strategy §6 pre-flight + GH-09):**

   ```
   https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=<slug>
   ```

   - `utm_source=x` — fixed for this channel
   - `utm_medium=social` — fixed (GH-09 requires source/medium/campaign on every link)
   - `utm_campaign=porchlight-q3` — fixed for the flight
   - `utm_content=<slug>` — per-post slug from the tables in §4 (e.g. `wk1-launch-thread`); `bio` for the bio link
4. **Slug format:** `wk<N>-<kebab-slug>`, assigned in §4. Recurring formats use dated slugs: `wk3-away-prompt`, `wk5-shiplog-2`, etc.

### 3.2 The three CTA types (every post ends in exactly one)

| CTA type | Copy pattern | How it's measured |
|---|---|---|
| **Screenname drop** (GH-04 — default CTA) | "I'm Pakiboy24 in the app — add me." / "Add me: Pakiboy24. Search it in the app." | Supabase: buddy requests to the founder's account in 72h post-post windows (baseline-audit §3.2-D, `public.buddies`) |
| **Room-specific link** (strategy §7.1: every asset points into a specific room) | Self-reply: "Link below — head for the [room name] room when you land." + UTM link | Vercel UTM by `utm_content` (§3.2-C) |
| **Store search** | "Search 'H.I.M.' on the App Store." (no link needed) | ASC App Store Search source bucket, directional (§3.2-A) |

Only the founder ever drops a screenname publicly, and only his own — claims #24: members are never asked to post theirs (framed opt-in always).

---

## 4. The 15 ready-to-post pieces

All copy ≤280 chars per tweet (Premium allows longer; we don't use it — short travels). Em-dashes and line breaks are part of the copy. Media notes are production instructions, not captions. **Every screen capture obeys the member-consent guardrail (strategy §5.1, binding): other members' screennames/messages appear only with logged consent from S0 seed members; otherwise crop or blur. Never publish DM content — Buzz/DM demos use a second test account owned by the founder.**

### Week 1 · Aug 3–9 · Sign-On Week

---

**T1 — LAUNCH THREAD (founder story) · Mon Aug 3, morning, when he can hang for an hour · slug `wk1-launch-thread` · PINNED all flight**

> **1/** I spent the past year building a social app for gay men that is not a dating app. It's called H.I.M. — "Hi, It's Me." It's live on the App Store. Here's why. 🧵

> **2/** Every app for gay men opens on a grid of faces sorted by distance. That's fine for what it's for. But there was nowhere to just talk. Make a friend. Be a regular somewhere.

> **3/** I grew up on the early-2000s internet, where you signed on, your screenname was the whole first impression, and your away message did the talking. Online social felt personal. I missed that.

> **4/** So H.I.M. works like that: pick a screenname — no real name, not photo-first. Set an away message. Build a buddy list of people you've actually talked to. Hang out in rooms.

> **5/** Seven rooms at launch: New York City, Los Angeles, Chicago, Atlanta, Everywhere Else, Late Night, Sunday Reset. Regional rooms are chosen, not GPS — there's no location radar anywhere in the app.

> **6/** Deliberately missing: swiping, a match queue, "people nearby," photo-first browsing. No algorithm pushing you toward romance. Friendship first.

> **7/** It's small right now. I'm one person, and the rooms are honest-sized. If you've ever wanted to be early to something instead of late, this is what that looks like.

> **8/** On the App Store (iPhone) and at hiitsme.app. 18+. I'm Pakiboy24 in the app — add me, tell me what's broken, set an away message. Link in the next reply.

> **9/ (self-reply)** Link, as promised: `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=wk1-launch-thread`

*Media: tweet 4 carries a screen recording of the real sign-on flow → away-message set (founder's own account only). CTA: screenname drop + link in reply. Claims: #1, #2, #3, #4, #21, #22, #23, #24.*

---

**T2 — Absence enumeration (product moment) · Wed Aug 5 · slug `wk1-no-grid`**

> No swiping. No match queue. No "people nearby." No photo-first browsing.
>
> What's left is the part I actually missed about the internet: rooms where the conversation is already going, and a buddy list you built on purpose.
>
> That's the whole app. That's H.I.M.

*Media: none, or a single real-UI screenshot of the rooms list. CTA (self-reply): "Search 'H.I.M.' on the App Store." Claims: #1, #4, #22.*

---

**T3 — Community question: screennames · Fri Aug 7 · slug `wk1-screenname-q`**

> Building a screenname-first app has taught me that a screenname is a tiny autobiography.
>
> So: what was your first-ever screenname, and what were you *trying* to say with it?
>
> (Mine survived to the app. I'm Pakiboy24 in there.)

*Media: none. CTA: screenname drop. Reply plan: founder replies to every answer; this is a reply-farm post in the good sense. Never repost anyone's answer as content without the DNC #11 amendment conditions (§5.4). Claims: #2, #24.*

---

### Week 2 · Aug 10–16 · Away Message Week

---

**T4 — GH-02 prompt, the campaign's exact register · Wed Aug 12 · slug `wk2-away-prompt`**

> your away message for a Sunday you refuse to leave the house. go.

*Media: none — the whole post is the prompt. CTA: none in the body (a prompt with a sales pitch attached dies); founder's own answer goes in the first reply, e.g. "mine says 'finally cleaning my apartment' and it is a lie." Claims: #3.*

---

**T5 — Away messages product moment · Mon Aug 10 · slug `wk2-away-moment`**

> Away messages are the signature H.I.M. mechanic, because "online/offline" was never enough information.
>
> Set yours to "doomscrolling" or "finally cleaning my apartment." Status as self-expression, the way it used to be.

*Media: screen recording of setting an away message (real UI, founder account). CTA (self-reply): room-specific link → `utm_content=wk2-away-moment`. Claims: #3.*

---

**T6 — Buzz (product moment) · Fri Aug 14 · slug `wk2-buzz`**

> There is a button in H.I.M. that shakes your buddy's chat window. It's called Buzz.
>
> It says: I have nothing to report, I just want you to know I exist.
>
> DM-only. Buzz responsibly.

*Media: screen recording of a Buzz between the founder's two test accounts — never a real member's DM (strategy §5.1: never publish DM content). Tone check per growth-plan: playful, never framed as pressure to respond or chasing someone who went quiet. CTA: "Search 'H.I.M.' on the App Store." Claims: #7.*

---

### Week 3 · Aug 17–23 · Room Tour Week

---

**T7 — ROOM TOUR THREAD (7 rooms in 7 tweets) · Mon Aug 17 · slug `wk3-room-tour`**

> **1/** H.I.M. shipped with seven rooms. Not "communities," not "servers" — rooms. You walk in and say hi. Quick tour: 🧵

> **2/** New York City — "The city that never sleeps." Say hi and drop which borough you're repping. (Or don't. Lurk first. It's allowed.)

> **3/** Los Angeles — "West Coast vibes, sun and screens." The room where somebody is always stuck on the 405 with opinions.

> **4/** Chicago — "Chi-town. The Second City. Our kind of town." Second city, first-rate room.

> **5/** Atlanta — "ATL forever." The shortest room description in the app. Correct energy.

> **6/** Everywhere Else — "Not NYC, LA, Chicago, or ATL? This is your room." The room for everyone the map forgot. Some of the best conversation in the app.

> **7/** Late Night — "For the night owls. No judgment." Both halves of that sentence are load-bearing.

> **8/** Sunday Reset — "Prep, reflect, recharge. See you Monday." The week gets planned from the sofa in here every Sunday evening.

> **9/** Regional rooms are chosen, never GPS — no location radar anywhere in the app. Pick your room and say hi. I'm Pakiboy24 in there. Link below.

> **10/ (self-reply)** `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=wk3-room-tour`

*Media: one consent-cleared room screenshot per room where available (S0 seed members, consent logged — strategy §6 week-3 binding rule); otherwise the empty-but-honest room header UI. Quoted room lines are the verbatim seeded descriptions (claims #1 phrasing guidance). Claims: #1, #22, #24.*

---

**T8 — Community question: room #8 · Fri Aug 21 · slug `wk3-room-pick-q`**

> Four cities got their own rooms at launch: New York City, Los Angeles, Chicago, Atlanta. Everyone else — Everywhere Else is literally your room.
>
> Which city makes the case for room #8? One sentence.
>
> (No promises — I'm one guy — but I'm listening.)

*Media: none. The "no promises" line is required: questions must not read as roadmap commitments (strategy non-goal 12). CTA: none in body; link in bio does the work. Claims: #1.*

---

### Week 4 · Aug 24–30 · New City, No Crew

---

**T9 — Relocation season (S1) · Mon Aug 24 · slug `wk4-new-city`**

> Moving to a new city gets you an apartment, a start date, and a phone full of contacts who aren't friends yet.
>
> New in town? The city room is where you say hi before you owe anyone a face.
>
> NYC, LA, Chicago, ATL — and Everywhere Else for the rest of us.

*Media: real-UI shot of the regional rooms list. Register is the approved S1 line from strategy §4 — situational and specific, never diagnosing ("lonely" is banned in user-facing copy, strategy §1.1 two-track rule). CTA (self-reply): room-specific link → `utm_content=wk4-new-city`. Claims: #1, #2.*

---

**T10 — Everywhere Else (product moment) · Thu Aug 27 · slug `wk4-everywhere-else`**

> The room description for Everywhere Else is: "Not NYC, LA, Chicago, or ATL? This is your room."
>
> It's the room for everyone the map forgot — small towns, mid-size cities, the suburbs of somewhere. Nobody in there is networking. That's the charm.

*Media: consent-cleared Everywhere Else screenshot or room-header UI. CTA: screenname drop. Claims: #1.*

---

### Week 5 · Aug 31–Sep 6 · Night Owls & Sunday Reset

---

**T11 — Late Night, posted late · Tue Sep 1, 11pm–1am ET window · slug `wk5-late-night`**

> It's past midnight and the group chat has been asleep since 9.
>
> The Late Night room description is "For the night owls. No judgment." Both halves on purpose.
>
> I'm signed on. Away message says what I'm doing. Come say hi — Pakiboy24.

*Media: none, or dark-mode room UI (midnight indigo looks right at 1am). Posting time IS the targeting. CTA: screenname drop. Claims: #1, #3, #24.*

---

**T12 — Sunday Reset mirror, long-weekend edition · Sun Sep 6, ~6pm ET (Labor Day weekend) · slug `wk5-sunday-reset`**

> Sunday Reset is the room where the week gets planned from the sofa: prep, reflect, recharge, see you Monday. Long-weekend edition tonight.
>
> Same question in here as in there: one thing you're actually looking forward to this week?
>
> I'll go first in the replies.

*Media: none. Founder answers first, replies to everyone (GH-03 mirror). CTA: none in body; bio link. Claims: #1.*

---

**T13 — Offline outbox (product moment, ship-log voice) · Thu Sep 3 · slug `wk5-outbox`**

> H.I.M. queues your messages when you lose signal and sends them when you're back online.
>
> I'm told I can't say it "works offline," because the rest of the app still wants internet. Fine. It's "polite about tunnels."

*Media: optional clip of a queued message sending on reconnect (founder's own accounts). The joke does the honest-phrasing work: claim #10's guidance verbatim, "works offline" explicitly disclaimed (DNC #12). CTA: "Search 'H.I.M.' on the App Store." Claims: #10.*

---

### Week 6 · Sep 7–13 · Buddy List Week

---

**T14 — The buddy loop (product moment) · Mon Sep 7 · slug `wk6-buddy-loop`**

> How making a friend works on H.I.M.:
>
> 1. Wander into a room
> 2. Have opinions about someone's dinner
> 3. Keep showing up
> 4. Send a buddy request
>
> The buddy list is people you actually talked to. Non-buddy DMs are rate-limited; a buddy accept unlocks unlimited DMs.

*Media: real-UI buddy-list screenshot (founder's list with consenting seed members, or cropped). Precision per claims #4 (2026-07-15 edit): never "only buddies can message you." Claims: #1, #4.*

---

**T15 — Privacy receipts (product moment, the "your list, your rules" close) · Thu Sep 10 · slug `wk6-privacy`**

> Privacy stuff in H.I.M., built on purpose:
>
> — Read receipts in DMs have an off switch
> — Notification previews default to sender-only; message text never hits your lock screen unless you choose
> — Face ID app lock on iPhone
>
> Your list, your rules.

*Media: settings-screen capture (founder account). Scoping rules: read receipts DM-only (#9), app lock iPhone-copy-only (#13, DNC #15). CTA (self-reply): link → `utm_content=wk6-privacy`. Claims: #9, #12, #13.*

---

### Post-type coverage check (brief requirements)

| Required | Delivered |
|---|---|
| Launch thread, founder story | T1 |
| Product moments: away messages | T4, T5 |
| Product moments: buddy list | T14 |
| Product moments: rooms | T7, T9, T10, T11, T12 |
| Other product moments | T2 (absence claims), T6 (Buzz), T13 (outbox), T15 (privacy) |
| Community questions | T3, T8, T12 |

---

## 5. Reply & engagement strategy for gay Twitter

The account grows in the replies, not the feed. A small account with high engagement still travels (trend-research §d); a small account that only broadcasts does not.

### 5.1 Daily practice (~30 min/day, two blocks)

1. **Post-adjacent block (30–60 min after each post):** reply to every single reply. Reply velocity in the first hour is the strongest distribution signal on 2026 X. This is non-negotiable and is why posts only ship when Haaris can stay.
2. **Roaming block (~15 min, any time):** show up as a person in conversations where H.I.M.'s themes genuinely live — adult-friendship threads ("how do you make friends after 30"), moving-to-a-new-city threads, old-internet nostalgia threads, Sunday-night/homebody culture, indie build-in-public dev circles. Add value first. Mention the product only when it directly answers what was asked, and disclose it's his app every time ("I build one, so, biased, but —"). This is the Reddit 90/10 rule (strategy §5.3) applied to X.

### 5.2 Voice in the replies

- Warm, funny, specific — the brand-brief §2 register, but looser because it's a person, not a brand.
- **Never snark at people** (brand rule 5): no dunk quote-tweets, no ratio-chasing, no jokes at the expense of people who use other apps.
- **Nothing horny-coded** (brand rule 5): the founder account does not reply-guy thirst threads, ever. On gay Twitter that lane is always open and it is always wrong for this brand.
- **Never name competitors** in public replies (brand brief §5 — replies are public campaign copy). If someone else names them, respond mechanism-level: "different thing than what I'm building — no grid, no radar, rooms and buddy lists" and move on.
- **Never diagnose.** People in the replies can say they're lonely; the account never says it to them or about them (strategy two-track rule). The reply register is "come hang out," never "I can fix that."

### 5.3 Outing safety in engagement (binding, brand rule 6)

- Never publicly @-welcome, thank, or otherwise identify someone as a H.I.M. member unless they went public first, in their own words.
- Never confirm or deny that any named person is in the app.
- Never screenshot a member's in-app presence, buddy list entry, or room message into a reply — consent rules (strategy §5.1) apply to replies exactly as to posts. **DM content never ships in any form.**
- Never run "post your face" / "drop your location" reply mechanics. City talk stays at the "which room would you pick" altitude — chosen, not detected.

### 5.4 Reposting user replies (DNC #11 amendment, applied)

Default: member replies stay in-thread — engage there, don't harvest. A member's reply to a prompt (e.g. T4) may be reposted ONLY when all four conditions hold: explicit permission for the specific repost, permission logged (DM screenshot or message reference in the tracker), words verbatim and unedited, and framing is "a reply to this week's prompt" — never a testimonial, review, or "users love it" frame. When in doubt: reply in-thread, repost nothing.

### 5.5 Canned honest answers (the four questions that will come)

| Question | Reply (approved register) |
|---|---|
| "Is this a dating app?" | "Nope — friendship-first on purpose. No swiping, no radar, no grid. Rooms, buddy lists, away messages. 'Not a hookup app' is literally in the site header." |
| "Is it on Android?" | "iPhone and the web today." — Full stop. Nothing promissory about Android in public until the founder confirms a Play submission (DNC #6); then and only then: "coming to Android." |
| "Is it encrypted / how private is it?" | Only in direct reply to a direct question, never a standalone post (DNC #1): "Messages are sent over encrypted connections (HTTPS/TLS) and stored on secured infrastructure." Then pivot to the real, shipped privacy receipts: preview defaults, read-receipt off switch, app lock. Deeper questions → support@hiitsme.app. |
| "How many users?" | "Small and early, on purpose — I don't share counts. The rooms are honest-sized and that's kind of the point right now. Come be early." (Honest smallness is the brand; numbers never — DNC #10.) |

### 5.6 Trolls, bad faith, and hate

Mute early, block freely, report platform-violating content, feed nothing. Never screenshot-dunk harassment — it amplifies it and drags the account into a register the brand can't win in. Homophobic pile-ons are a when, not an if: the standing play is silence + block + keep posting warm. The founder decides his own personal limits here; the plan's only rule is that the account never fights.

### 5.7 Micro-creator groundwork (feeds strategy §5.8)

During roaming blocks, genuinely engage (no pitch) with small queer creators (10K–100K) whose content already matches the segments — adult-friendship talkers, queer city-guide creators, cozy/homebody posters, nostalgic-internet posters. Weeks of real engagement earn the eventual DM offering early access (strategy §5.8: no scripts, no contracts, FTC disclosure if anything of value changes hands; zero creator posts is an acceptable outcome, forced content is not).

---

## 6. Three recurring formats

**F1 — "Away Message of the Week" (GH-02 mirror) · Wednesdays ~12pm ET · slugs `wkN-away-prompt`**
The prompt formula: `your away message for [hyper-specific, warm, non-horny situation]. go.` Founder answers first in the replies. Prompt bank for the flight (fresh each week, never reruns):

| Week | Prompt |
|---|---|
| 2 | "a Sunday you refuse to leave the house" (the strategy's own canonical prompt) |
| 3 | "day three of a heat advisory" |
| 4 | "you just moved and the boxes are winning" |
| 5 | "it's 1am and you're wide awake for no reason" |
| 6 | "the Sunday scaries hit at 4pm sharp" |
| Labor Day bonus | "a long weekend with zero plans, on purpose" |

Measurement: GH-02's own metric — signups in 72h post-prompt windows vs quiet windows (Supabase `users.created_at`, baseline-audit §3.2-D).

**F2 — Ship-log (GH-11) · 2–3×/week · slugs `wkN-shiplog-1/2`**
Template: *what I shipped/fixed/learned this week on H.I.M. + one real-UI clip or screenshot.* Allowed numbers: engineering and product facts only (§2 rule). Allowed vulnerability: bugs, App Review adventures, solo-founder texture. Banned: user counts, activity stats, roadmap promises, anything not shipped (claims register, whole document). Ship-logs are also where honest campaign meta lives ("I can't say 'works offline,' so:" — see T13's register).

**F3 — Sunday Reset mirror (GH-03) · Sundays ~6pm ET · slugs `wkN-sunday-reset`**
The same week-planning question opening in the Sunday Reset room, posted to X the same evening. Founder always answers first, replies to everyone. Fixed weekly appointment — the one slot never dropped under load. Labor Day weekend gets the "long-weekend edition" (T12). Measurement: GH-03's metric — distinct posters in Sunday Reset during the hour, week over week (§3.2-D `room_messages`).

---

## 7. Channel KPIs

Sources are the ones named in `strategy/baseline-audit.md` §3.2 (A = App Store Connect, C = Vercel Web Analytics, D = Supabase SQL), plus X native analytics for the strategy §5.4 platform KPI (replies + profile click-throughs — platform-native, directional). No follower targets exist anywhere in this plan (strategy non-goal 2).

| # | KPI | Target (honest, seed-stage) | Measurement source |
|---|---|---|---|
| X1 | Output shipped | ≥30 posts over the flight (~5/wk), including both threads (T1, T7) and all 15 drafted pieces on their theme weeks | Manual content log (same pattern as O10's tracking sheet) |
| X2 | Reply responsiveness | 100% of replies to founder posts answered within 24h; every post gets its 30–60 min hang window | X notifications + content log (self-tracked, controllable) |
| X3 | Engagement trend | Replies-per-post and profile visits trending up across the three 2-week windows; floor: ≥5 posts drawing ≥10 replies from accounts outside the seed community by Sep 13 | X native analytics (strategy §5.4 KPI: replies + profile click-throughs, not impressions) |
| X4 | Web traffic contribution | 300–600 pageviews with `utm_source=x` across the flight (a deliberately modest 5–10% slice of O8's 6,000 — X is not a link channel by design) | Vercel Web Analytics UTM breakdown (baseline-audit §3.2-C) |
| X5 | Store-referrer presence | x.com / t.co visible among ASC top referring domains (Web Referrer source type) by flight end — directional only | ASC downloads by source type + referring domains (baseline-audit §3.2-A) |
| X6 | Screenname-drop conversion (GH-04) | Buddy requests to the founder's account measurably higher in 72h windows after screenname-drop posts (T1, T3, T7, T10, T11) vs quiet windows | Supabase `public.buddies` filtered to founder's `user_id` (baseline-audit §3.2-D; founder edges identified per growth-plan §1.2) |
| X7 | Signup timing correlation | Visible signup bumps in the 72h windows after T1 (launch thread) and T7 (room tour) vs adjacent quiet windows | Supabase `public.users.created_at` (baseline-audit §3.2-D), read via the weekly scorecard |

**Attribution honesty (restated from strategy §3, applies to every row above):** with no install attribution and no UTM-to-signup capture, X's contribution to installs/signups cannot be isolated — X4–X7 are triangulation signals (ASC source buckets + Vercel UTM aggregates + timing correlation), and the weekly scorecard states that limitation rather than inventing precision.

Weekly readout lands in `marketing/campaign-2026-q3/reporting/weekly-scorecard.md` (Mondays, per strategy §9) — the X block covers X1–X7 in ~4 lines.

---

## 8. What this account never posts (standing list)

- User counts, activity stats, "N online," growth charts of community metrics (DNC #10; strategy §2)
- Testimonials or endorsement-framed user quotes; unpermissioned reposts of member replies (DNC #11 + amendment)
- AOL / AIM / ICQ marks or trade dress, or any implied affiliation (DNC #9; brand brief §7)
- Dating vocabulary: match, swipe, singles, nearby, flirt, "meet guys" ("hookup" only inside "not a hookup app") (brand rule 3)
- Anything about Android before a confirmed Play submission (DNC #6)
- "Encrypted," "anonymous," "works offline," "invite link," moderation-team or SLA language (DNC #1, #8, #12, #7, #3, #4)
- Unshipped features, roadmap commitments, or "H.I.M. Pro" (brand brief §9; non-goal 12)
- Competitor names, in any register (brand brief §5)
- The word "lonely" addressed at users (strategy §1.1 two-track rule)
- ~~"The light's on."~~ — removed from this list: founder sign-off landed 2026-07-15; the line is approved and may close ship-logs
- Fake UI, mocked-up activity, member content without logged consent, DM content in any form (brand brief §3; strategy §5.1)

## 9. Pre-publish checklist (every post, ~60 seconds)

1. Every product statement maps to an APPROVED claim # (or is founder-voice opinion/story containing no product claim)
2. Scoping intact: DM-only features said as DM-only; iPhone-only said as iPhone-only
3. No §8 banned items; naming rules followed ("H.I.M." with periods; hiitsme.app lowercase)
4. Screenshots/clips: founder-owned accounts or logged S0 consent; non-consenting screennames cropped/blurred; no DMs
5. No link in the post body; UTM slug assigned if a link ships in the self-reply
6. Haaris can stay online for the next 30–60 minutes
7. ≤280 chars per tweet

---

## Claims used (appendix)

Every product claim relied on in this plan, by claims-register number:

| # | Claim as used here | Where used |
|---|---|---|
| 1 | 7 chat rooms at launch — New York City, Los Angeles, Chicago, Atlanta, Everywhere Else, Late Night, Sunday Reset; seeded room descriptions quoted verbatim ("The city that never sleeps." / "West Coast vibes, sun and screens." / "Chi-town. The Second City. Our kind of town." / "ATL forever." / "Not NYC, LA, Chicago, or ATL? This is your room." / "For the night owls. No judgment." / "Prep, reflect, recharge. See you Monday.") | T1, T2, T7, T8, T9, T10, T11, T12, T14, F3 |
| 2 | Screenname-first identity — sign up with a screenname, no real name, not photo-first | T1, T3, T9, bio copy |
| 3 | Away messages + status — custom away messages ("doomscrolling," "finally cleaning my apartment"); status as self-expression | T1, T4, T5, T11, F1 |
| 4 | Buddy list of people you've actually met; DMs with non-buddies are rate-limited, a buddy accept unlocks unlimited DMs (never "buddy-only DMs") | T1, T2, T14 |
| 7 | Buzz — shakes your buddy's chat window; DM-only | T6 |
| 9 | Read receipts in DMs with an off switch | T15 |
| 10 | Offline outbox — messages queue offline and send when you're back online (never "works offline") | T13 |
| 12 | Notification previews default to sender-only; message text never hits the lock screen unless you choose | T15 |
| 13 | Face ID app lock — iPhone copy only | T15 |
| 21 | Available on the App Store (iPhone) and at hiitsme.app | T1, T2, T6, T13, bio copy, CTAs |
| 22 | Absence claims — no swiping, no match queue, no "people nearby," no photo-first browsing, no location radar, no algorithm pushing you toward romance; regional rooms chosen, never GPS | T1, T2, T7, canned reply §5.5 |
| 23 | 18+ | T1, bio copy |
| 24 | Findable by screenname with an opt-out — "Add me: Pakiboy24, search it in the app" (founder's own screenname only; members never asked to drop theirs) | T1, T3, T7, T10, T11, CTA conventions §3.2 |

**DNC guidance applied (not claims, but load-bearing):** DNC #1 (encryption canned reply, verbatim approved sentence, reply-only), DNC #6 (Android silence), DNC #10 (no counts — including in ship-logs), DNC #11 amendment (repost conditions), DNC #12 ("works offline" disclaimed in T13's copy itself).

---

*Twitter/X channel plan · OPERATION PORCH LIGHT · H.I.M. Q3 2026 · Saman Technologies LLC (internal)*
