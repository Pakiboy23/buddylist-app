# Weekly scorecards — OPERATION PORCH LIGHT (Aug 3 – Sep 13, 2026)

One entry per Monday, per `strategy/measurement-plan.md` §6. Supabase figures pulled live from production (`keckqpadzxwwmagnmpuk`) each capture morning; store figures from the ASC API where available, founder dashboard screenshots otherwise.

---

## Week 1 scorecard — Aug 3–9 (recorded Mon Aug 10, ~13:00Z)

**Attribution honesty:** with no install attribution and no UTM-to-signup capture,
installs and signups cannot be split by channel. Channel reads below are
triangulated (ASC source buckets + Vercel UTMs + calendar timing) and directional.

**Release context for the week:** flight launched Mon Aug 3 on the 2.1 listing;
**v2.2 (build 314) went READY_FOR_SALE ~11:40Z Tue Aug 4** and auto-released
mid-flight — unified Buddy List + buddy photos + global Suggested Buddies +
privacy row. Promo text v1 live since Aug 1. `suggest_buddies` RPC live since Aug 1.

| Objective | Target (this week) | Actual | Trend vs baseline | Note |
|---|---|---|---|---|
| O2 signups | base case ~10–15/wk | **30** (wk of Aug 3) + 6 so far wk of Aug 10 | baseline steady state was 1–3/wk | Strongest non-spike week ever; cohort 36 through Mon AM |
| O3 WAU (trailing 7d) | grow from 4 | **37** | **9×** baseline (4) | New cohort is coming back, not drive-by |
| O4 activation ≤72h (room post, cohort) | ≥35% | **0.0%** (0/36) | baseline 11% | **MISS — see reading.** Cohort energy went to buddy graph, not rooms |
| O5 room msgs/wk · daily floor | every room ≥1/day from wk 2 | **0 messages, all 7 rooms, all 7 days** | baseline also cold (A2) | **MISS.** Seed-community rituals (§7) still not running |
| O6 new unique buddy relationships (non-founder) | directional | **6 accepted** | 26 total at baseline | Plus large pending backlog — see Suggested Buddies line |
| **Suggested Buddies adoption (new, v2.2)** | n/a (feature shipped Aug 4) | **76 new buddy edges since Aug 4 vs 2 the prior week (38×), from 17 distinct requesters** | — | The standout product signal of the week |
| O7 iOS push opt-in (new cohort) | ≥40% | **0%** (0/36) | 4 holders at baseline | Reads as a **product gap**, not user choice: no cold-launch prompt (Phase-4 audit deferred); opt-in lives buried on /account |
| O8 UTM pageviews | dashboard read | *founder screenshot pending* | baseline 5 visitors/7 views | Vercel API plan-gated (retested Aug 5, 404) |
| O9 store funnel vs snapshot | dashboard read | *founder screenshot pending* | Jul 24–28 steady state: ~10–50 imp/day, ~4 PPV/day, ~0–1 dl/day | ASC Analytics API not available to this key |

**Store state (API, HTTP 200, Aug 10):** 2.2 READY_FOR_SALE (build 314) · promo text v1 confirmed live · **0 customer reviews** (review watch running daily 14:00Z).

**Safety block (O11/O12, never public):** reports **0** · blocks **0** · DM flags **0** · room flags **0** ·
deletions trailing 7d: **3** (vs 30 wk-1 signups = **10.0% — exactly at the O12 guardrail**, capture weekly and watch) · 100% of reports reviewed: yes (zero to review).

**Other reads:** DMs last 7d: **8** (baseline week-of-Jul-20 was 11).

### Week-1 reading (three sentences)

Acquisition and return are working — 30 signups in week 1 (10× the pre-spike steady state, no Snap-spike required) and WAU at 37 vs 4 — but **the cohort's energy went into the buddy graph, not the rooms**: Suggested Buddies drove 76 buddy edges in six days (vs 2 the week before) while all seven rooms sat at zero messages and activation-by-room-post reads 0%. Two consequences: (1) the O4/O5 definitions undercount real activation this flight — a member who sends buddy requests and DMs but never posts in a room is *activated* in every sense that matters to a friendship app; log a measurement-plan amendment proposal (activation-v2: room post OR buddy request sent OR DM sent within 72h) for founder sign-off rather than silently moving the goalposts. (2) The §7 aliveness work (seed briefing, first-replier duty, Sunday Reset ritual) is now the single highest-leverage founder action of week 2 — the rooms are the only dead surface in an otherwise warming product. Watch items: deletions sitting exactly at the 10% guardrail, and new-cohort push opt-in at 0% (product gap — no prompt in the first-run path; candidate for the next release).

### Founder inputs still needed for this entry

1. ASC Analytics screenshots (impressions/PPV/downloads by source, Aug 3–9) — compare against the Jul 24–28 steady state.
2. Vercel Web Analytics screenshot (pageviews by utm_source, referrers).
3. Sign-off or veto on the **activation-v2 definition amendment** above (measurement honesty: the target stays ≥35%, only the numerator definition widens).
