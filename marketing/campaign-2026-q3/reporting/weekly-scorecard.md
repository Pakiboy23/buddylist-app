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
