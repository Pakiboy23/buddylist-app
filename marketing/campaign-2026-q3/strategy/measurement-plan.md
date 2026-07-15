# H.I.M. Q3 2026 — Measurement Plan

**Campaign:** OPERATION PORCH LIGHT (internal) · Flight Mon Aug 3 – Sun Sep 13, 2026
**Prepared:** 2026-07-15 · **Role:** Analytics Reporter
**Executes:** `campaign-strategy.md` §3 (objectives O1–O12) and §9 (reporting cadence). Experiment tracking lives in `growth-plan.md` §6 (the tracker template there is the source of truth — this plan does not duplicate it).

**Measurement doctrine (binding, from `baseline-audit.md` §4 and strategy §3):** there is no install attribution and no UTM-to-signup capture. Channel effect is read by triangulation — ASC source-type buckets + referrer domains, Vercel UTM aggregates, and timing correlation against the content calendar. Every weekly scorecard states this limitation verbatim rather than inventing precision. No new analytics vendors this flight (strategy non-goal #11); the only sanctioned addition is the first-party `acquisition_source` column (GH-13) if the founder budgets dev time.

---

## 1. KPI tree

**North star (flight): O5 room aliveness** — ≥600 room messages/week by weeks 5–6 AND every one of the 7 rooms has ≥1 human message per day from week 2 onward. Rationale: the campaign fails if a new user opens a dead room (strategy §7); acquisition is only as good as what it lands in.

```
O5 Room aliveness (north star)
├── Acquisition      O1 installs · O2 signups · O8 web traffic · O9 store funnel · O10 earned media
├── Activation       O4 first room post ≤72h · O7 push opt-in
├── Connection       O6 buddy pairs
├── Retention        O3 WAU (final week)
└── Guardrails       O11 safety load · O12 deletions <10% of signups
```

Channel-level KPIs live in each channel file (`channels/*.md` §KPIs) and roll up to these objectives; none of them are follower counts (strategy non-goal #2).

## 2. Week-by-week target table

Base case from `growth-plan.md` §1.4 (authoritative per the strategy §3 reconciliation note). **Re-anchor against the Jul 27 baseline snapshot before week 1** — if the snapshot shows any floor already exceeded, revise here, in the snapshot file, and in growth-plan §1.4 the same day.

| Week | Dates | O2 signups | O5 room msgs/wk | O6 new buddy pairs | O8 UTM pageviews | Notes |
|---|---|---|---|---|---|---|
| Pre | Jul 27–Aug 2 | — | — | — | — | Baseline snapshot (blocking); UTMs locked; batch weeks 1–2 content |
| 1 | Aug 3–9 | 5–10 | ≥250 | 4–6 | ~500 | Promo text v1; launch thread; email drop #1 |
| 2 | Aug 10–16 | 8–12 | ≥350 + all-rooms daily floor holds | 5–8 | ~700 | Away-message engine starts; forward ask #1 |
| 3 | Aug 17–23 | 10–18 | ≥450 | 7–10 | ~1,200 | Reddit founder post + press tranche 1 + promo v2 · **gate Aug 17** |
| 4 | Aug 24–30 | 12–20 | ≥500 | 8–12 | ~1,200 | Relocation peak; TikTok 2-week window review |
| 5 | Aug 31–Sep 6 | 12–20 | ≥600 | 8–12 | ~1,100 | Reddit post 2 + AMA + promo v3 · **gate Aug 31** |
| 6 | Sep 7–13 | 13–20 | ≥600 | 8–12 | ~1,300 | Buddy List week; wrap prep |
| **Flight** | | **60–100** | | **40–60** | **~6,000** | Stretch ceilings (aspiration only): O2 150, O6 80 |

Cumulative objectives not in the weekly grid: O1 (100–165 installs, read from ASC weekly), O3 (45–65 WAU in week of Sep 7–13), O4 (≥35% activation, read per weekly cohort), O7 (≥60% iOS push opt-in), O9 (directional vs snapshot), O10 (≥1 published piece), O11/O12 (guardrails, weekly).

## 3. UTM convention (locked pre-flight)

Format: `https://hiitsme.app/?utm_source=<source>&utm_medium=<medium>&utm_campaign=porchlight-q3&utm_content=<slug>`

| Channel | utm_source | utm_medium | utm_content slug convention |
|---|---|---|---|
| X / Twitter | `x` | `social` | per-post slug from `channels/twitter.md` (e.g. `wk1-launch-thread`) |
| TikTok | `tiktok` | `social` | `wkN-<concept>` (e.g. `wk1-c1-signon`) |
| Instagram | `instagram` | `social` | `wkN-<post-id>` (e.g. `wk3-cb-roomtour`) |
| Reddit | `reddit` | `social` | `wk3-founder-post`, `wk5-builder-post` |
| Press / earned | `press` | `referral` | outlet slug |
| Waitlist email | `waitlist` | `email` | `drop-N` |

Rules: every campaign link carries all four params (GH-09); `utm_campaign` is always `porchlight-q3`; sources are lowercase and never invented ad hoc; links in X live in bio/self-replies only (channel rule). Read weekly in Vercel Web Analytics → pageviews by UTM.

## 4. Supabase SQL suite (the Monday pull)

Run as one saved script during pre-flight week (strategy §9). Flight window used below: `2026-08-03T00:00:00Z` to `2026-09-13T23:59:59Z`. Schema verified against migrations at HEAD `35f76e2` (`users.last_active_at` from `20260320000011`, `room_messages(room_id, user_id, body, created_at)` from `20260509184623`, `buddies` from `20260320000001`).

```sql
-- O2: signups per week
select date_trunc('week', created_at)::date as week, count(*) as signups
from public.users
where created_at >= '2026-07-27'
group by 1 order by 1;

-- O3: WAU (trailing 7 days, run on Mondays)
select count(*) as wau
from public.users
where last_active_at >= now() - interval '7 days';

-- O4: activation — % of flight cohort posting in a room within 72h of signup
with cohort as (
  select id, created_at from public.users
  where created_at between '2026-08-03' and '2026-09-13 23:59:59+00'
), first_post as (
  select user_id, min(created_at) as first_room_msg
  from public.room_messages group by 1
)
select round(100.0 * count(*) filter (where fp.first_room_msg <= c.created_at + interval '72 hours')
       / nullif(count(*), 0), 1) as activation_pct
from cohort c left join first_post fp on fp.user_id = c.id;

-- O5a: room messages per week
select date_trunc('week', created_at)::date as week, count(*) as room_msgs
from public.room_messages
where created_at >= '2026-08-03'
group by 1 order by 1;

-- O5b: aliveness floor — messages per room per day, trailing 7 days
select r.name, rm.created_at::date as day, count(*) as msgs
from public.room_messages rm join public.rooms r on r.id = rm.room_id
where rm.created_at >= now() - interval '7 days'
group by 1, 2 order by 1, 2;

-- O6: newly accepted buddy pairs in flight (excluding founder edges)
select count(*) as accepted_edges
from public.buddies b
where b.status = 'accepted'
  and b.created_at between '2026-08-03' and '2026-09-13 23:59:59+00'
  and not exists (
    select 1 from public.users u
    where lower(u.screenname) = 'pakiboy24' and u.id in (b.user_id, b.buddy_id)
  );
-- Calibrate once before the first report: check whether an accepted
-- relationship stores one row or two (reciprocal). If two, halve the count
-- for "pairs" and note the convention in the scorecard.

-- O7: push opt-in among new iOS-capable accounts
with cohort as (
  select id from public.users
  where created_at between '2026-08-03' and '2026-09-13 23:59:59+00'
)
select round(100.0 * count(distinct t.user_id) / nullif((select count(*) from cohort), 0), 1)
       as ios_push_optin_pct
from public.user_push_tokens t
join cohort c on c.id = t.user_id
where t.platform = 'ios';

-- O11: safety load, trailing 7 days
select
  (select count(*) from public.abuse_reports  where created_at >= now() - interval '7 days') as reports,
  (select count(*) from public.blocked_users  where created_at >= now() - interval '7 days') as blocks,
  (select count(*) from public.messages       where flagged_at  >= now() - interval '7 days') as dm_flags,
  (select count(*) from public.room_messages  where flagged_at  >= now() - interval '7 days') as room_flags;

-- O12: deletions during flight (guardrail: < 10% of O2 actual)
select count(*) as deletions
from public.account_deletion_log
where deleted_at >= '2026-08-03';
-- If the timestamp column differs, adjust once during pre-flight calibration
-- (table created alongside 20260525000005_security_events.sql).
```

**Pre-flight calibration (once, week of Jul 27):** run the full suite, verify each query returns sanely against known state (buddies row convention, deletion-log column name), then freeze it as the Monday script. This is what turns the ~60–90 min scorecard block into ~15–20 min.

## 5. Store-console checklist (weekly, screenshot-logged)

Per `baseline-audit.md` gap-5 mitigation: consoles retain limited history, so each metric is screenshot-captured into `reporting/` weekly.

- **App Store Connect → Analytics:** impressions by source type (Search / Browse / Web Referrer / App Referrer), product page views, conversion rate by source type, total downloads (first-time vs redownload), referring domains.
- **ASC → App Information:** confirm live promotional text version matches the calendar (v1 Aug 3 / v2 Aug 17 / v3 Aug 31, `channels/app-store-optimization.md` §5).
- **Vercel Web Analytics:** pageviews by utm_source / utm_content; referrers.
- **If the ASA probe runs (weeks 3–6, optional):** ASA console — impressions, taps, installs per exact-match term. ASA is the one channel with native attribution; report it separately from the triangulated organic read.

## 6. Weekly scorecard template

Append one entry per Monday to `reporting/weekly-scorecard.md` (~60–90 min until the SQL suite is frozen, then ~15–20 min + console reads):

```markdown
## Week N scorecard — <dates> (recorded <date>)

**Attribution honesty:** with no install attribution and no UTM-to-signup capture,
installs and signups cannot be split by channel. Channel reads below are
triangulated (ASC source buckets + Vercel UTMs + calendar timing) and directional.

| Objective | Target (this week) | Actual | Trend | Note |
|---|---|---|---|---|
| O2 signups | | | | |
| O3 WAU (trailing 7d) | | | | |
| O4 activation ≤72h (cohort) | | | | |
| O5 room msgs/wk · daily floor | | | 7/7 rooms? | |
| O6 buddy pairs | | | | |
| O7 iOS push opt-in | | | | |
| O8 UTM pageviews (by source) | | | | |
| O9 store funnel vs snapshot | | | | |

**Safety block (O11/O12, never public):** reports __ · blocks __ · flags __ ·
deletions __ · 100% of reports reviewed: yes/no
**Experiments touched this week:** (ids + one-line status → update growth-plan §6 tracker)
**Kill / double decisions:** (2-week windows only — never single posts)
**Next week:** (top 3 actions)
```

**Phase gates (Aug 17, Aug 31):** the scorecard for those Mondays additionally records: content formats killed/doubled, promotional text rotated (GH-08 read), ASA go/no-go, and any target re-anchoring.

**Wrap (week of Sep 14):** final scorecard vs §2 table + `reporting/flight-wrap-2026-09.md` (strategy §6 week 6): channel triangulation writeup, keyword-hypothesis reads (H1–H3, `channels/app-store-optimization.md` §3), Q4 keep/kill/scale memo, Android go-decision input.
