-- GH-17 daily snapshot — paste-ready.
--
-- Paste the whole file into the Supabase SQL editor on production
-- (keckqpadzxwwmagnmpuk) and run it. Safe to re-run the same day:
-- snapshot_date is unique and the statement upserts.
--
-- No DDL here. The table was created by
-- supabase/migrations/20260822000001_marketing_snapshots.sql. If this errors
-- with 'relation "public.marketing_snapshots" does not exist', that migration
-- has not been applied to the project you are pointed at.
--
-- Definitions worth knowing before quoting anything this returns:
--   * new_signups_24h counts auth.users. public.users has no created_at.
--   * buddy pairs are DISTINCT UNORDERED pairs, not row counts halved.
--     'pending' is one directional row; 'accepted' writes both directions but
--     some rows lost their mirror, so count(*) / 2 is wrong for both.
--   * every _24h column is a rolling 24h window from the moment you run it,
--     not a calendar day. Run it at a consistent hour or the series wobbles.
--   * accepted_buddy_pairs is a RUNNING TOTAL. O6 wants the delta between two
--     snapshot rows, never a single row's value.

insert into public.marketing_snapshots (
  snapshot_date,
  total_users,
  active_last_7d,
  active_last_24h,
  new_signups_24h,
  room_joins_24h,
  invite_joins_24h,
  dms_sent_24h,
  room_msgs_24h,
  pending_buddy_pairs,
  accepted_buddy_pairs
)
select
  (timezone('utc', now()))::date,
  (select count(*) from public.users),
  (select count(*) from public.users
     where last_active_at >= timezone('utc', now()) - interval '7 days'),
  (select count(*) from public.users
     where last_active_at >= timezone('utc', now()) - interval '24 hours'),
  (select count(*) from auth.users
     where created_at >= timezone('utc', now()) - interval '24 hours'),
  (select count(*) from public.room_memberships
     where joined_at >= timezone('utc', now()) - interval '24 hours'),
  (select count(*) from public.room_memberships
     where invited_by is not null
       and joined_at >= timezone('utc', now()) - interval '24 hours'),
  (select count(*) from public.messages
     where created_at >= timezone('utc', now()) - interval '24 hours'),
  (select count(*) from public.room_messages
     where created_at >= timezone('utc', now()) - interval '24 hours'),
  (select count(*) from (
     select distinct least(user_id, buddy_id) as a, greatest(user_id, buddy_id) as b
     from public.buddies where status = 'pending') pending_pairs),
  (select count(*) from (
     select distinct least(user_id, buddy_id) as a, greatest(user_id, buddy_id) as b
     from public.buddies where status = 'accepted') accepted_pairs)
on conflict (snapshot_date) do update set
  total_users = excluded.total_users,
  active_last_7d = excluded.active_last_7d,
  active_last_24h = excluded.active_last_24h,
  new_signups_24h = excluded.new_signups_24h,
  room_joins_24h = excluded.room_joins_24h,
  invite_joins_24h = excluded.invite_joins_24h,
  dms_sent_24h = excluded.dms_sent_24h,
  room_msgs_24h = excluded.room_msgs_24h,
  pending_buddy_pairs = excluded.pending_buddy_pairs,
  accepted_buddy_pairs = excluded.accepted_buddy_pairs,
  created_at = timezone('utc', now());

-- Last two weeks, newest first.
select * from public.marketing_snapshots
order by snapshot_date desc
limit 14;

-- Day-over-day deltas. This is what O6 reads: the change in accepted pairs
-- between snapshots, never a single row's running total.
select
  snapshot_date,
  total_users,
  active_last_7d,
  accepted_buddy_pairs,
  accepted_buddy_pairs
    - lag(accepted_buddy_pairs) over (order by snapshot_date)
    as accepted_pairs_delta,
  pending_buddy_pairs,
  pending_buddy_pairs
    - lag(pending_buddy_pairs) over (order by snapshot_date)
    as pending_pairs_delta
from public.marketing_snapshots
order by snapshot_date desc
limit 14;
