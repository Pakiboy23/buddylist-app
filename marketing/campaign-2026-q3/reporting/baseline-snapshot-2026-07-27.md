# Baseline Snapshot — week of Jul 27, 2026 (captured Jul 29)

**Purpose:** the pre-flight anchor mandated by `campaign-strategy.md` §3 — every flight target is graded against these numbers. Supabase figures below were pulled live from production (`BuddyList`, project `keckqpadzxwwmagnmpuk`) on 2026-07-29 via read-only SQL. ASC figures must be added by the founder (no console access from this environment) — the section below lists the exact screens.

---

## 1. Product metrics (Supabase, live 2026-07-29)

| Metric | Value | Notes |
|---|---|---|
| Total accounts (auth.users) | **78** | 77 have profiles — 1 orphan auth row (abandoned mid-signup; harmless) |
| Signups since Jul 1 | **55** | Weekly: Jun 22: 1 · Jun 29: 2 · Jul 6: 3 · **Jul 13: 31 · Jul 20: 20** — see anomaly A1 |
| WAU (trailing 7 days, `last_active_at`) | **4** | The active core; matches iOS push-token holders |
| July cohort activated ≤72h (first room post) | **6 / 55 ≈ 11%** | O4 target is ≥35% — the activation gap is the campaign's real fight |
| Accepted buddy edges | **45** raw · **38** reciprocal · = **26 unique relationships** (19 mutual pairs + 7 one-way accepted rows) | Calibration verdict below |
| Room messages, last 7 days | **0 across all 7 rooms** | Lifetime: NYC 11 · Everywhere Else 6 · Late Night 7 · Sunday Reset 6 · LA 2 · ATL 2 · Chicago 1 (35 total) |
| DM messages, week of Jul 20 | 11 | June–July total is ~20 |
| iOS push-token holders | **4** | O7 reads against new-cohort opt-in from Aug 3 |
| Safety: reports / blocks / flagged msgs | **0 / 0 / 0** | Clean slate for the O11 guardrail |
| Account deletions, trailing ~30 days | **11** | NOT lifetime — the log is pruned at 30 days by `run_retention_cleanup()` (migration `20260525000004`). 11 in ~30d vs 55 July signups ≈ 20% deletion pressure — see A3 |

### Calibration verdicts (what the Monday scorecard must use)

1. **Signup timestamps live in `auth.users.created_at`** — `public.users` has NO `created_at` column. Every cohort/signup query joins or reads `auth.users`. (Measurement plan §4 corrected in this same commit.)
2. **Buddy-pair convention is MIXED:** accepted relationships are stored as 2 reciprocal rows for most pairs, but 7 accepted edges are one-way. Unique relationships = `reciprocal_edges / 2 + one_way_edges`. The scorecard reports unique relationships (26 today).
3. **Deletion log confirmed but WINDOWED:** `public.account_deletion_log.deleted_at` exists, and the table is pruned at 30 days by `run_retention_cleanup()`. O12 is a weekly-capture metric (trailing 7 days each Monday, summed for the wrap) — never a single flight-window query.

## 2. Anomalies to resolve before Aug 3 (founder input needed)

- **A1 — RESOLVED (founder, 2026-07-29): the mid-July signup spike was a founder Snapchat post.** That's the single strongest acquisition datum the product has: one personal Snap drove ~50 organic signups in two weeks — more than the entire flight's weekly base case — through a channel the campaign plan doesn't even include. Two consequences: (1) **targets:** the spike is one-off post-driven, not steady state, so growth-plan §1.4's base case stands unchanged — but the O2 stretch ceiling is clearly reachable; (2) **channel mix:** Snapchat added as an official founder-personal support channel — signed off 2026-07-29, now strategy §5.9 (mirror the week's status card, spoken search CTA, ≥1 story/week). The activation half of the story is unchanged and now sharper: ~50 Snap-driven arrivals hit quiet rooms and left (11% activation) — the §7 aliveness work is what converts the next spike.
- **A2 — every room is cold right now (0 messages in 7 days).** The O5 floor (every room ≥1 human message/day from week 2) starts from zero, not from warm. The §7 seed-community briefing and Sunday-Reset ritual aren't nice-to-haves this week — they're the difference between the campaign landing in a live product or a dead one.
- **A3 — deletion pressure ~20% of recent signups.** The deletion log holds only a trailing ~30-day window (pruned by the retention job — lifetime churn is not reconstructible retroactively), and that window shows 11 deletions against 55 July signups: **double the O12 guardrail** (<10% of flight signups). Plausibly linked to A1 (drive-by signups deleting), but worth one founder look at `deleted_at` clustering vs the spike weeks. Consequence for measurement: O12 must be captured in every Monday scorecard and summed — a wrap-time query cannot see the whole flight (measurement plan §4 updated accordingly).

## 3. Web analytics (Vercel) — ENABLED and collecting (corrected 2026-07-29)

**Correction:** Web Analytics IS enabled and has history (founder dashboard screenshot, 2026-07-29). The earlier "not found" came from the **API**, which is gated — most likely by plan tier and/or the team's **Overdue billing status** (visible on the dashboard; founder should clear it — overdue Vercel billing can eventually pause deployments). Until API access works, the weekly O8 read is a manual dashboard read recorded in the scorecard.

**Web baseline (dashboard, trailing 7 days as of Jul 29):** **5 visitors · 7 page views · 60% bounce.** Consistent with the ASC steady state — post-Snap attention went to App Store search, not the website. This near-zero floor is the O8 comparator.

Notes: the manual insights script tag added to `index.html` (PR #90) coexists with Vercel's own injection — believed guard-safe, but **watch week-1 scorecard for doubled page-view counts vs visitors**; if counts look inflated, drop the manual tag. Native bundles load the tag as a harmless 404 (documented in the tag's comment).

## 4. App Store Connect metrics — RECORDED (founder screenshots, 2026-07-29; range Jun 29–Jul 28)

| Metric (trailing 30d) | Value |
|---|---|
| Impressions | **115,163** — near-zero until Jul 15, spike ~30K/day Jul 16–19, decaying to 10–46/day by Jul 24–28 |
| Product page views | **1,698** — same spike shape (peak ~500/day Jul 17–18); steady state ~4/day post-spike |
| Total downloads | **121** — peak ~27/day Jul 17–19, small echo Jul 22, ~0–1/day by Jul 25–28 |
| Page views by source (unique devices, daily avg) | **App Store Search 43 · App Referrer 1 · App Store Browse 1 · Web Referrer 0** |

**Derived baseline funnel (whole 30d window):** impressions → page view ≈ **1.5%** · page view → download ≈ **7.1%** · downloads → signups ≈ **45–50%** (121 downloads vs 55 July signups — revises the strategy's ~60% install→signup derivation assumption downward).

**Reading (2026-07-29):** the entire spike is the founder Snapchat event (A1), and the source mix is the surprise — viewers didn't tap a link, they **searched the App Store** (Search dominates page views; Web Referrer is zero). Two implications: (1) the compound search phrase + keyword field are the campaign's real conversion surface — the Variant C `hiitsme` keyword decision just got more important; (2) 115K impressions against 1.5% tap-through quantifies the name-collision cost: H.I.M. surfaced constantly in search results during the buzz and was rarely the result people tapped. **Steady-state baseline for flight deltas (Jul 24–28, the honest comparator): ~10–50 impressions/day, ~4 page views/day, ~0–1 downloads/day.**

**Still to record:** official conversion-rate figure + first-time-vs-redownload split (Analytics → Metrics), referring domains list, and the §6 item-3 facts: live version/build + July metadata submission state + which keyword string was pasted (Option A vs Variant C).

## 5. Flight-readiness deltas since the campaign package shipped

- **v2.1 shipped new product surface** (Buddy Circles, Knock, away replies, mutual context, room "Seen by N") and a dormant H.I.M. Pro entitlement. Per the governance note in `marketing/release-2-1/`: these need claims-register entries **#25–28 + founder sign-off** before any campaign asset or store metadata mentions them. Until then, flight copy stays on the register's verified 24 claims — the drafted channel content remains fully valid.
- `marketing/release-2-1/` carries the v2.1 ASC submission + launch-window TikTok/X content; the Q3 flight calendar and that release package should be sequenced together during this week's batch session so the two content streams don't collide on the same days.

## 6. This week's remaining punch list (from README §Start-here, updated)

1. ✅ A1 resolved (founder Snapchat post) → §1.4 base case confirmed unchanged; Snapchat signed off as strategy §5.9 (2026-07-29)
2. ✅ Vercel Web Analytics — already enabled and collecting (§3, corrected 2026-07-29); web baseline recorded; NEW small item: clear the team's Overdue billing status
3. 🟡 ASC baseline recorded (§4, founder screenshots 2026-07-29) — still open: conversion-rate + redownload split, referring domains, and live version / July-submission / keyword-string confirmation
4. ⬜ Seed-community briefing: rituals, first-replier duty, ambassador ask — urgent given A2
5. ⬜ Batch weeks 1–2 content (fold in `release-2-1/` social assets to avoid collisions)
6. ⬜ Live subreddit-rules audit; waitlist email footer (unsubscribe + postal address)
7. ✅ Claims-register entries #25–28 added + DNC #16 (H.I.M. Pro stays unmarketed) — founder signed off 2026-07-29; v2.1 features are now usable in flight copy per their phrasing guidance
