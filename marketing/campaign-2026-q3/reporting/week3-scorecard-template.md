# Week 3 scorecard — Aug 17–23 (fill Mon Aug 24)

Window: closed Aug 17–23. Engine's first full week + launch run Day 0–5.
Pre-push baseline is week 2 (WAU 17, signups 19, 0 accepted pairs, 0 organic room msgs, 86 pending).

Do not reuse week-1 WAU 37 in Day 6/7 copy.

| Objective | Week-2 actual | Week-3 actual | Note |
|---|---|---|---|
| O2 signups | 19 |  | Cohort n = |
| O3 WAU trailing 7d | 17 |  | |
| O4 activation ≤72h (DM or room post or request ACCEPTED) | 0/19 |  | |
| O5 room msgs (organic vs engine) | 0 organic | organic __ / engine __ | |
| DMs (organic vs engine) | 4 organic | | |
| O6 accepted-pair SNAPSHOT DELTA | 0 new | Monday accepted pairs minus Aug 17 accepted | Do not attribute by created_at |
| Pending unique pairs | 86 |  | |
| Invite-joins (invited_by not null) | n/a (GH-14 live Aug 16) |  | |
| O7 push opt-in new cohort | 0% |  | |
| O12 deletions in-window | 2/19 = 10.5% |  | Second weekly breach? Cumulative vs 49+this week |
| App Store reviews | 0 |  | |
| Promo text | v2 live | still v2 until Aug 31 | |

## Store / web (paste from screenshots)

- ASC impressions / PPV / first-time downloads / source split:
- Vercel pageviews + top referrers / UTMs:

## Three-sentence reading

1.
2.
3.

---

## Live capture — Sat Aug 22, 06:21 UTC (GH-17 instrument check, NOT the scorecard)

First row out of `public.marketing_snapshots`, created by migration
`20260822000001_marketing_snapshots.sql`. The week-3 window above still closes
**Aug 23** and still gets filled **Mon Aug 24**. Nothing here is a week-3 actual —
the `_24h` columns are a rolling Friday-night-into-Saturday slice, not a week.

| Column | Value |
|---|---|
| snapshot_date | 2026-08-22 |
| total_users | 135 |
| active_last_7d | 13 |
| active_last_24h | 4 |
| new_signups_24h | 3 |
| room_joins_24h | 0 |
| invite_joins_24h | 0 |
| dms_sent_24h | 7 |
| room_msgs_24h | 1 |
| pending_buddy_pairs | 134 |
| accepted_buddy_pairs | 29 |

### Read the columns before you quote them

- **`new_signups_24h` comes from `auth.users`.** `public.users` has no
  `created_at` column, so the draft SQL could not have run as written. Note
  `auth.users` (137) and `public.users` (135) disagree by 2 — two auth
  identities with no profile row. `total_users` counts profile rows.
- **Buddy pairs are distinct unordered pairs, not `count(*) / 2`.** The draft
  halved both. Live data says `pending` is a single directional row (134 rows,
  zero mirrored) so halving would have printed 67 instead of 134; `accepted`
  writes both directions but 7 of 51 rows are missing their mirror, so halving
  would have printed 25 instead of 29.
- **`pending_buddy_pairs` 134 is not comparable to the week-2 "86 pending".**
  Different definition. Re-baseline off this row, or recount week 2 the same way
  before drawing a trend.
- **`accepted_buddy_pairs` 29 is a running total, not an in-window delta.** O6
  wants Monday's number minus the Aug 17 number, and there is no Aug 17 row —
  this table starts today. The first honest O6 delta is week 4.
- `room_joins_24h` 0 and `invite_joins_24h` 0 are the overnight slice only.

### Still open for the Mon Aug 24 fill

O2, O3, O4, O5, O7, O12, App Store reviews, and the ASC/Vercel block are all
unfilled. This capture does not touch them.
