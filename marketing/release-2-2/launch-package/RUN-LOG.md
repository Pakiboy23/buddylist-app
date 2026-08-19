# 2.2 launch run — execution log (Aug 18–25)

What actually posted, when. Kept because Day 6 (build-in-public) and Day 7 (recap)
require real verified numbers with sources, and the week-3 scorecard needs to know
which channels were live on which days before attributing any movement to them.

Founder reports are recorded as reported; product-side numbers are live reads.

## Day 0 — Tue Aug 18

| Channel | Status | Note |
|---|---|---|
| Substack long-form | ⬜ not yet | Carries the full narrative + CTA button |
| Instagram carousel | ✅ posted | 6 slides |
| Threads | ✅ posted | |
| Facebook | ✅ posted | Not in the original package channel list — founder added it |
| LinkedIn founder post | ✅ posted | |
| X thread (7 posts) | ⬜ not yet | **The only Day-0 piece carrying the direct App Store link in-post** |
| Instagram Stories (3 frames) | ⬜ not yet | Link sticker → App Store |
| 30s Reel / TikTok | ⬜ not yet | Real screen recording only |

**Product read at Aug 19 02:20 UTC (~12h into Day 0):**
signups since Day 0 start: **2** (Aug 17, the day before: 0) · organic room replies to
engine prompts: **0** · inbound DMs to founder: **0**. Too early to attribute; recorded
as the Day-0 marker for the Day 6/7 delta.

**In-app engine (running alongside, since Aug 16):** welcome DMs 5 sent · nudges 12 sent
(pending-request backlog draining 4/day) · room prompts posted: Sunday Reset (Aug 17
00:18Z — first room message platform-wide since Jul 21), New York City (Aug 17),
Los Angeles (Aug 18).

## Sources for the numbers above

Every figure in this log is a live read against production Supabase
(`keckqpadzxwwmagnmpuk`), not recollection. Day 6/7 copy may quote these only with
the window stated, per the honest-numbers rule in `03_Teaser_and_Rollout_Plan.md`
and `EXECUTION-2026-08-18.md`.

Product marker (run 2026-08-19 02:20 UTC):

```sql
select
 (select count(*) from auth.users where created_at >= '2026-08-18') as signups_since_day0,
 (select count(*) from auth.users where created_at >= '2026-08-17' and created_at < '2026-08-18') as signups_aug17,
 (select count(*) from public.room_messages where created_at >= '2026-08-17'
    and user_id <> '9f8f18e1-44d3-4708-aa24-cfbf12542a25') as organic_room_replies_since_prompts,
 (select count(*) from public.messages where created_at >= '2026-08-16'
    and sender_id <> '9f8f18e1-44d3-4708-aa24-cfbf12542a25') as inbound_dms_since_engine;
-- → 2 · 0 · 0 · 0
```

Caveats that must travel with these numbers:
- "Signups since Day 0" is a **partial-day, UTC-bounded** count taken ~12h in; Day 0
  in ET was still running. Not a daily total, not a channel-attributed figure — the
  product has no install/UTM attribution (baseline audit gap #1).
- Organic room replies exclude the founder account (engine prompts post as the founder).
- Inbound DMs count messages from anyone other than the founder since the engine's
  first send (Aug 16), i.e. replies to welcome DMs and nudges.

Engine counts (welcome DMs, nudges, room prompts) are the verified insert IDs returned
by each sweep in the operating session, cross-checkable with:

```sql
select count(*) filter (where content like 'hey! it''s Haaris%') as welcomes,
       count(*) filter (where content like 'you''ve got buddy requests waiting%') as nudges
from public.messages where sender_id = '9f8f18e1-44d3-4708-aa24-cfbf12542a25';
```

Channel posted/queued status is **founder-reported**, not machine-verified — no
posting API is connected for Instagram, Threads, Facebook, LinkedIn, or X.
