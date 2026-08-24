# Weekly scorecards — OPERATION PORCH LIGHT (Aug 3 – Sep 13, 2026)

One entry per Monday, per `strategy/measurement-plan.md` §6. Supabase figures pulled live from production (`keckqpadzxwwmagnmpuk`) each capture morning; store figures from the ASC API where available, founder dashboard screenshots otherwise.

---

## Week 1 scorecard — Aug 3–9 (recorded Mon Aug 10; corrected same day after founder audit)

**Attribution honesty:** with no install attribution and no UTM-to-signup capture,
installs and signups cannot be split by channel. Channel reads below are
triangulated (ASC source buckets + Vercel UTMs + calendar timing) and directional.

**Window discipline:** every cohort-denominated row uses the CLOSED Aug 3–9 cohort
(n=30, every account past its full 72h window at capture). Aug 10 signups/events are
out of window. Buddy edges are counted as unique unordered pairs per the §4
calibration; row-count equivalents footnoted where they differ.

**Release context for the week:** flight launched Mon Aug 3 on the 2.1 listing;
**v2.2 (build 314) went READY_FOR_SALE ~11:40Z Tue Aug 4** and auto-released
mid-flight — unified Buddy List + buddy photos + global Suggested Buddies +
privacy row. Promo text v1 live since Aug 1. `suggest_buddies` RPC live since Aug 1.

Targets are the authoritative week-1 row from `strategy/measurement-plan.md` §2 (base case, growth-plan §1.4).

| Objective | Target (week 1) | Actual | Trend vs baseline | Note |
|---|---|---|---|---|
| O2 signups | 5–10 | **30** | baseline steady state 1–3/wk | **3–6× target**; strongest non-spike week ever |
| O3 WAU (trailing 7d) | grow from 4 | **37** | **9×** baseline (4) | New cohort is coming back, not drive-by |
| O4 activation ≤72h (room post) | ≥35% | **0.0%** (0/30) | baseline 11% | **MISS** — see O5: the room surface is not being entered at all |
| O5 room msgs/wk | ≥250 (daily floor starts wk 2) | **0** — and **0/30 cohort members joined any room**; last room message platform-wide was **2026-07-21**, 13 days before flight start | baseline also cold (A2) | **MISS.** This is a zero-entry problem, not a cold-conversation problem — seeding content does not address a surface nobody opens |
| **Conversation (DMs)** | — (row added wk 1) | **3 DMs sent** Aug 3–9 (prior week: 2 · all-time: 128) · **2/30 cohort members have ever sent a DM** | week-of-Jul-20 was 11 | The counterweight to the buddy-edge number: connections are being requested, conversations are not starting |
| O6 new unique buddy relationships (accepted, non-founder) | 4–6 | **5** | 26 total at baseline | **ON target** |
| **Suggested Buddies (shipped Aug 4, v2.2)** | n/a | **72 new unique buddy edges** Aug 3–9 (5 accepted + **67 pending**) vs **2** (both accepted) the prior week, from **14 distinct requesters**. Like-for-like: accepted-to-accepted **5 vs 2 (2.5×)**; total-to-total **72 vs 2**. **Pending share: 67/72 = 93% of new edges unaccepted.**¹ | — | The rail moves the *request* action massively; acceptance is the bottleneck to watch in week 2 |
| O7 iOS push opt-in (new cohort) | ≥40% | **0%** (0/30) | 5 holders across all 116 accounts | Reads as a **product gap**, not user choice: no first-run prompt (Phase-4 audit deferred); opt-in lives buried on /account |
| O8 UTM pageviews | ~500 | *founder screenshot pending* | baseline 5 visitors/7 views | Vercel API plan-gated (retested Aug 5, 404) |
| O9 store funnel vs snapshot | dashboard read | *founder screenshot pending* | Jul 24–28 steady state: ~10–50 imp/day, ~4 PPV/day, ~0–1 dl/day | ASC Analytics API not available to this key |

¹ Row-count equivalents (accepted pairs store as two reciprocal rows): week 1 = 77 rows (10 accepted + 67 pending) vs prior week 4 rows — same 2.5× accepted ratio, 19× on raw rows. The pair convention above is the §4-calibrated standard.

**Store state (API, HTTP 200, Aug 10):** 2.2 READY_FOR_SALE (build 314) · promo text v1 confirmed live · **0 customer reviews** (review watch running daily 14:00Z).

**Safety block (O11/O12, never public):** reports **0** · blocks **0** · DM flags **0** · room flags **0** ·
deletions **inside Aug 3–9: 2** (Aug 7, Aug 8) = **2/30 = 6.7% — under the 10% guardrail** · 100% of reports reviewed: yes (zero to review).

### Shipped feature adoption (Aug 3–9 cohort, n=30; all-accounts denominator 116)

All values re-verified against production 2026-08-10. `status_msg` (29/30) and `discoverable` (29/30) are **signup defaults, not adoption signals** — excluded from the reads below.

| Feature (shipped) | Cohort (n=30) | All accounts (n=116) | Note |
|---|---|---|---|
| Away message set | **4 (13%)** | 17 (15%) | **The week-1 headline finding** — see reading |
| Buddy icon set | 6 (20%) | 20 (17%) | |
| Buddy Circles (Jul 22) | — | **0 circles · 0 members · 0 owners** in 19 days live | |
| Knock (Jul 22) | — | **2 uses in week 1 · 6 all-time** | |
| Buzz | — | **0 all-time** | Confirmed genuine zero usage, not non-persistence: `preview_type='buzz'` is a persisted message type rendered in ChatWindow; no such row exists |
| Reactions | — | 2 all-time | |
| Saved messages | — | 3 all-time | |
| iOS push token | **0 (0%)** | 5 (4%) | No first-run prompt exists |

**Adoption reading:** a friendship app positioned on away messages converted **13% of its largest-ever cohort** into setting one. Every feature shipped Jul 22 (Circles, Knock) sits at or near zero after 19 days; the one feature shipped Aug 1–4 with a visible surface in the default view (Suggested Buddies) moved its metric 2.5–19× in six days. This is **one discovery-and-prompting problem across the product surface**, not four independent feature misses. Remediation belongs in the week-2 plan (separate entry) — recorded here as reads only.

### Activation definition — decision record

- **activation-v2 as proposed Aug 10 (room post OR buddy request sent OR DM sent ≤72h): REJECTED.** Under it, buddy-request-sent-≤72h alone scores **13/30 = 43%** and converts the week from miss to pass — a pass carried entirely by a one-tap action that is 93% unreciprocated this week, and the exact action the mid-flight Suggested Buddies ship inflates. Grading the flight on the metric the flight moved.
- **Counter-proposal recorded for founder sign-off — activation = DM sent OR room post OR buddy request ACCEPTED, within 72h.** Every qualifying action requires a second person. Target unchanged at ≥35%. **Week 1 under this definition: 5/30 = 16.7% — still a miss**, stated explicitly.

### Week-1 reading (three sentences)

Acquisition and return are working — 30 signups (3–6× the week-1 target, no Snap-spike required) and WAU 37 vs 4 — and the Suggested Buddies rail proved the cohort will act when a surface puts action one tap away (72 new edges vs 2 the prior week). But nothing downstream of the tap is firing yet: 93% of those requests sit unaccepted, 3 DMs were sent all week, no cohort member has entered a room (last room message platform-wide predates the flight), and the away-message identity feature converted 13%. Week 1's verdict: **top of funnel and first-tap mechanics are solved; reciprocity, conversation, and surface discovery are the flight's real work from here** — the room zero-entry problem and the unaccepted-request backlog are week 2's two levers, and both are named in the week-2 plan rather than patched here.

### Founder inputs still needed for this entry

1. ASC Analytics screenshots (impressions/PPV/downloads by source, Aug 3–9) — compare against the Jul 24–28 steady state.
2. Vercel Web Analytics screenshot (pageviews by utm_source, referrers).
3. Sign-off or veto on the **counter-proposal activation definition** above (accepted-request variant; v2-as-proposed is rejected and recorded).

---

## Week 2 scorecard — Aug 10–16 (recorded Mon Aug 17) · PRE-PUSH BASELINE for the 2.2 launch run (Day 0 Tue Aug 18)

**Window discipline:** closed Aug 10–16 cohort (n=19), unique-pair edge convention,
deletions counted inside the window. The in-app engine went live on the LAST day of
this window (Aug 16): its 8 DMs are split out below; its first room prompt executed
00:18Z Aug 17 (trigger queue latency) and therefore belongs to week 3.

| Objective | Target (week 2) | Actual | vs week 1 | Note |
|---|---|---|---|---|
| O2 signups | 8–12 | **19** | 30 | Above target again, still zero push — the listing acquires on its own |
| O3 WAU (trailing 7d) | hold/grow | **17** | 37 | **Halved. The week-1 cohort is evaporating — retention is now the flagship problem** |
| O4 activation ≤72h (room post) | ≥35% | **0.0%** (0/19) | 0/30 | Zero under the counter-proposal definition too (0/19) |
| O5 room msgs/wk | ≥350 + daily floor | **0 organic** | 0 | Engine's first prompt landed just past the window; week 3 is its first real test |
| Conversation (DMs) | — | **4 organic** (12 total − 8 engine sends) | 3 | Cohort ever-DM: 0/19 |
| O6 new accepted buddy pairs | 5–8 | **0** | 5 | **MISS.** 10 new pairs, all pending, 6 requesters (rail novelty fading: 72 → 10) |
| Pending backlog | — | **86 unique pairs unaccepted** | 67 | Nudge engine started draining it Aug 16 (4/day) |
| O7 iOS push opt-in (cohort) | ≥40% | **0%** (0/19) | 0/30 | Product gap unchanged; 5/128 all accounts |
| O8 / O9 | ~700 pageviews / funnel | *founder screenshots pending* | — | APIs plan-gated |

**Store (verified live):** 2.2 READY_FOR_SALE · 0 reviews · **promo text v2 rotated on its Aug 17 gate date** (executed manually when the scheduled rotation lagged; the late trigger re-applies idempotently).

**Safety block (O11/O12, never public):** reports 0 · blocks 0 · flags 0/0 ·
deletions in-window: **2** = 2/19 = **10.5% — ABOVE the 10% guardrail: the first weekly
breach of the flight** (week 1 was 6.7%, under). Flight-cumulative — the guardrail's
actual definition — is 4/49 = **8.2%, still under**. Escalation rule: a second weekly
breach, or cumulative crossing 10%, names this a risk with root-cause work (deleted-at
clustering vs signup source); until then it is a breached weekly read on a small
denominator (2 people).

**Adoption deltas (all accounts at Monday capture, 116 → 128):** away message 17→18 ·
icons 20→21 · Circles still **0** · Knock 6→**8** · Buzz 0 · reactions 2 · saved 3 · push 5.
*Denominator reconciliation (captures are ~13:00Z Mondays, signup weeks are
midnight-aligned): 116 + 19 wk2 signups − 6 already inside the Aug 10 capture − 1
deletion between captures = 128 exactly. At this capture: auth.users 130, public.users
128, orphan auth rows 2.*

**Measurement caveat (new):** pairs created in week 1 that read "accepted" dropped from
5 (measured Aug 10) to 1 (measured Aug 17) — the accept flow appears to rewrite row
timestamps/status in place, so week-attributed acceptance counts are unstable
retroactively. From week 3 the scorecard tracks acceptance as snapshot deltas
(total accepted pairs now vs last Monday), not creation-week attribution.

### Week-2 reading

Acquisition remains solved without a single post (19 signups vs an 8–12 target); everything
downstream of arrival remains unsolved, and now visibly decays: WAU halved as the week-1
cohort churned through a silent app, zero pairs accepted, backlog grew to 86. The in-app
engine (welcomes, nudges, daily room prompts) went live with 8 hours left in the window —
week 3 is its first measured test, and it coincides with the 2.2 launch run (Day 0 Aug 18),
so week 3 reads as: push × engine together vs the same zero-organic baseline. O12 breached
its weekly read for the first time (10.5% on a 2-person numerator; flight-cumulative 8.2%
still under) — a second weekly breach or a cumulative cross names it a risk.

---

## Week 3 scorecard — Aug 17–23 (recorded Mon Aug 24) · FIRST MEASURED TEST of the engine × the 2.2 launch run

**Window discipline:** closed Aug 17–23 cohort (n=8), unique unordered pairs, in-window
deletions. This is the week both interventions were fully live: the in-app engine
(welcome DMs, nudges, daily room prompts) ran all seven days, and the 2.2 launch run
covered Day 0 (Aug 18) through Day 5 (Aug 23). Whatever the flight's two levers can do
on their own, this week is what it looks like.

Targets are the week-3 row from `strategy/measurement-plan.md` §2.

| Objective | Target (week 3) | Actual | wk1 → wk2 → wk3 | Note |
|---|---|---|---|---|
| O2 signups | 10–18 | **8** | 29 → 19 → 8 | **MISS, and the first decline of the flight.** Acquisition had beaten target twice with zero marketing; it is now falling while marketing is running |
| O3 WAU (trailing 7d) | hold/grow | **10** | 37 → 17 → 10 | Third consecutive halving. The base is eroding faster than it is replaced |
| O4 activation ≤72h (room post) | ≥35% | **0.0%** (0/8) | 0/30 → 0/19 → 0/8 | Zero for the third straight week |
| Activation, counter-proposal defn | ≥35% | **12.5%** (1/8) | 16.7% → 0% → 12.5% | The single qualifying member accepted **the founder's own** buddy request. Under any definition that excludes founder-initiated edges, this week is 0/8 |
| O5 room msgs/wk | ≥450 + daily floor | **0 organic** · 8 engine prompts posted | 0 → 0 → 0 | Last organic (non-founder) room message platform-wide remains **2026-07-20** — 34 days ago. Week 1's entry cited Jul 21; that was a founder message. Corrected here |
| Conversation (DMs) | — | **0 organic** · 36 founder sends (8 welcome + 28 nudge) | 3 → 4 → 0 | **Zero replies to 36 messages.** Organic DMs have gone to zero for the first time |
| O6 new accepted pairs (non-founder) | 7–10 | **0** | 5 → 0 → 0 | **MISS** |
| Buddy requests created | — | **50 rows**, of which **48 were the founder's own GH-01 backfill**; members created **2** (1 unique non-founder pair) | 14 → 6 → **2 member requesters** | The Suggested Buddies rail that produced 72 edges in week 1 has effectively stopped |
| Pending backlog | — | **134 unique pairs unaccepted** | 67 → 86 → 134 | Growth is now mostly the founder's own backfill |
| O7 iOS push opt-in (cohort) | ≥40% | **0%** (0/8) | 0% → 0% → 0% | 5 of 136 accounts, unchanged since Aug 2. The contextual prompt shipped in code but is not in a released build |
| O8 / O9 | ~1,200 pageviews / funnel | *founder screenshots pending* | — | APIs plan-gated; still the only unfilled rows |

**Cohort behaviour (n=8):** 0 joined any room · 0 ever sent a DM · 0 set an away message ·
0 set a buddy icon · 0 registered a push token. Eight people arrived and none of them
performed a single social action.

**Store (ASC API, HTTP 200, Aug 24):** 2.2 READY_FOR_SALE · **0 customer reviews** (22 days
live) · promo text v2 confirmed live, v3 rotates Aug 31 as scheduled ·
**2.3 exists in READY_FOR_REVIEW** (build 377, uploaded Aug 24 03:37Z) with
`promotionalText` **null** — patched to the live v2 text this morning and verified by
readback, because a null would have blanked the listing's promo slot on release. Build
377's embedded bundle was checked and is clean (one entry script, 30 chunks, production
Supabase ref, no placeholder): it is not affected by the #119 double-entry incident.

### GH-01 founder buddy request — first result

48 requests sent Aug 20–22. **1 accepted** (Aug 23 05:43Z), 47 still pending: **2.1%**.
That single acceptance is also the only thing standing between this week and a clean
zero on every engagement metric. Read it as a signal that the mechanism works at all,
not that it works — one accept out of 48 is indistinguishable from noise at this n.

**Safety block (O11/O12, never public):** reports **0** · blocks **0** · DM flags **0** ·
room flags **0** · 100% of reports reviewed (zero to review).
Deletions in-window: **2/8 = 25%** — the second consecutive weekly breach of the 10%
guardrail (wk1 6.7%, wk2 10.5%). Flight-cumulative is now **6/56 = 10.7%, which crosses
10% for the first time.** Both escalation conditions named in the week-2 entry have now
fired. **This is recorded as a risk, not a watch item.** Root-cause work owed: deleted-at
clustering against signup date and against whether the account received an engine DM —
the latter matters because the engine began cold-DMing every new member on Aug 16 and
the deletion rate has risen in each week since.

**Adoption (all accounts, denominator 136; auth.users 138, orphan auth rows 2):**
away message 18→**17** · icons 21→**21** · Circles **0 circles, 0 members** (33 days live) ·
Knock 8→**8** · Buzz **0** · reactions **2** · saved **3** · push **5**.
Away-message count *fell* by one — a deletion, not an un-setting.

### Week-3 reading

Both levers fired and neither moved: the engine sent 36 DMs and 8 room prompts into the
week and produced 0 replies, 0 room entries and 1 accepted buddy request out of 48; the
launch run posted through Day 5 and signups fell for the first time in the flight
(29 → 19 → 8). Every cohort-level engagement metric is 0/8, and the acquisition advantage
that carried weeks 1–2 is now gone too, which removes the argument that there was time to
solve retention later. The deletion guardrail has crossed on both of its escalation
conditions (25% weekly, 10.7% cumulative) and is now a named risk with root-cause work
owed. **The honest conclusion is that this is not a copy or cadence problem.** Three weeks
of prompts, nudges and welcomes have produced one action from one person; the room prompts
were rewritten to one-word asks starting Aug 24 and week 4 is that test, but if entry is
still zero next Monday the constraint is the product surface — whether members can find or
enter a room at all — and the flight's remaining budget is better spent diagnosing that
than writing more prompts.

### Founder inputs still needed

1. Sign-off or veto on the counter-proposal activation definition (unanswered since Aug 10).
   Week 3 makes it near-moot — 1/8 either way — but the definition should be settled before
   week 4.
2. ASC Analytics + Vercel Web Analytics screenshots (O8/O9), still the only unfilled rows
   across three weeks.
3. A decision on the O12 root-cause cut: is the engine's cold DM plausibly driving deletions?
   That question needs answering before the engine's volume is increased.
