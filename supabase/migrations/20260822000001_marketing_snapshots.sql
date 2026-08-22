-- GH-17 founder/ops daily snapshot table + first capture.
-- Source draft: marketing/campaign-2026-q3/reporting/gh17-snapshot.sql
--
-- Three deviations from that draft, forced by the live schema
-- (verified 2026-08-22 against production keckqpadzxwwmagnmpuk):
--
--   1. public.users has no created_at column, so new_signups_24h reads
--      auth.users.created_at instead.
--
--   2. public.buddies is not stored symmetrically, so count(*) / 2 is wrong.
--      'pending' is a single directional row (requester -> target) and
--      'accepted' writes both directions (src/lib/buddyRequest.ts), but some
--      accepted rows are missing their mirror. Halving undercounts pending and
--      mis-counts accepted, so both columns count distinct unordered pairs.
--
--   3. RLS is enabled with no policies. The table is ops-only ("no client
--      reads"); without RLS, PostgREST would expose it to anon.

create table if not exists public.marketing_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null unique,
  total_users integer,
  active_last_7d integer,
  active_last_24h integer,
  new_signups_24h integer,
  room_joins_24h integer,
  invite_joins_24h integer,
  dms_sent_24h integer,
  room_msgs_24h integer,
  pending_buddy_pairs integer,
  accepted_buddy_pairs integer,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.marketing_snapshots is
  'Founder/ops daily capture. Not a product surface. No client reads.';

comment on column public.marketing_snapshots.pending_buddy_pairs is
  'Distinct unordered {user_id, buddy_id} pairs with status = pending.';
comment on column public.marketing_snapshots.accepted_buddy_pairs is
  'Distinct unordered {user_id, buddy_id} pairs with status = accepted.';
comment on column public.marketing_snapshots.new_signups_24h is
  'auth.users.created_at within 24h; public.users has no created_at.';

alter table public.marketing_snapshots enable row level security;
revoke all on table public.marketing_snapshots from anon, authenticated;

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
