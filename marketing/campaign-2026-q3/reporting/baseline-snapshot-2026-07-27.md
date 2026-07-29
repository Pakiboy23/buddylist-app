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

- **A1 — the mid-July signup spike (31 + 20 in two weeks) with near-zero activation.** 51 accounts arrived in a fortnight while WAU stayed at 4 and rooms stayed silent. No attribution exists (baseline audit gap), so the source is unknown: v2.1 TestFlight/internal testers? A store-listing visibility change? Directory scrape/spam? **Identify the cause** — it decides whether O2's targets get re-anchored upward or these signups get discounted as non-organic. Until identified, the growth-plan §1.4 base case stays as written (re-anchor rule deliberately NOT applied to unexplained data).
- **A2 — every room is cold right now (0 messages in 7 days).** The O5 floor (every room ≥1 human message/day from week 2) starts from zero, not from warm. The §7 seed-community briefing and Sunday-Reset ritual aren't nice-to-haves this week — they're the difference between the campaign landing in a live product or a dead one.
- **A3 — deletion pressure ~20% of recent signups.** The deletion log holds only a trailing ~30-day window (pruned by the retention job — lifetime churn is not reconstructible retroactively), and that window shows 11 deletions against 55 July signups: **double the O12 guardrail** (<10% of flight signups). Plausibly linked to A1 (drive-by signups deleting), but worth one founder look at `deleted_at` clustering vs the spike weeks. Consequence for measurement: O12 must be captured in every Monday scorecard and summed — a wrap-time query cannot see the whole flight (measurement plan §4 updated accordingly).

## 3. Web analytics (Vercel) — NOT ENABLED, action required

`get_web_analytics` returns "Web Analytics not found" for hiitsme-app as of 2026-07-29: **collection has never been on, and O8 (6,000 UTM pageviews) is blind until it is.** Two-part fix, both trivial:

1. ✅ **Done in this commit:** the insights script tag is added to `index.html` (deploys with the next push to main — Vercel builds from source per `vercel.json`).
2. ⬜ **Founder, ~1 minute:** Vercel dashboard → `hiitsme-app` → Analytics tab → **Enable**. Then verify after next deploy: `https://hiitsme.app/_vercel/insights/script.js` returns 200.

Baseline value: none (no history exists). O8 measurement starts the day analytics goes live — enable it BEFORE Aug 3 or the flight's web leg reads as zero forever.

## 4. App Store Connect metrics (founder — record this week)

Screenshot each into `marketing/campaign-2026-q3/reporting/` (filenames like `asc-baseline-<metric>-2026-07-xx.png`) or fill the table; consoles don't keep history forever:

| ASC screen | Record |
|---|---|
| Analytics → Impressions by source type (Search/Browse/Web Referrer/App Referrer), trailing 30d | |
| Analytics → Product page views + conversion rate by source type, trailing 30d | |
| Analytics → Total downloads (first-time vs redownloads), trailing 30d | |
| Analytics → Referring domains list | |
| App version live right now + build (2.0.2? 2.1?) and the state of the July metadata submission (with keywords Option A or Variant C — record which was pasted) | |

## 5. Flight-readiness deltas since the campaign package shipped

- **v2.1 shipped new product surface** (Buddy Circles, Knock, away replies, mutual context, room "Seen by N") and a dormant H.I.M. Pro entitlement. Per the governance note in `marketing/release-2-1/`: these need claims-register entries **#25–28 + founder sign-off** before any campaign asset or store metadata mentions them. Until then, flight copy stays on the register's verified 24 claims — the drafted channel content remains fully valid.
- `marketing/release-2-1/` carries the v2.1 ASC submission + launch-window TikTok/X content; the Q3 flight calendar and that release package should be sequenced together during this week's batch session so the two content streams don't collide on the same days.

## 6. This week's remaining punch list (from README §Start-here, updated)

1. ⬜ Resolve A1 (spike source) → then re-anchor or confirm §1.4 base case (record the decision here + growth-plan §1.4 same day)
2. ⬜ Enable Vercel Web Analytics (§3 above) — before Aug 3
3. ⬜ ASC baseline screens (§4 above) + confirm July metadata submission state
4. ⬜ Seed-community briefing: rituals, first-replier duty, ambassador ask — urgent given A2
5. ⬜ Batch weeks 1–2 content (fold in `release-2-1/` social assets to avoid collisions)
6. ⬜ Live subreddit-rules audit; waitlist email footer (unsubscribe + postal address)
7. ⬜ Claims-register entries #25–28 for the v2.1 features + sign-off, if 2.1 features should appear in flight copy at all
