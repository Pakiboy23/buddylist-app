-- SUPERSEDED 2026-08-22 — do not paste this file into the SQL editor.
-- The live schema does not match this draft: public.users has no created_at,
-- and public.buddies is not stored symmetrically so count(*) / 2 is wrong for
-- both pending and accepted. Corrected and applied version:
--   supabase/migrations/20260822000001_marketing_snapshots.sql
-- Kept here only as the original GH-17 draft.

-- GH-17 founder-run snapshot
-- Paste into Supabase SQL editor on production (keckqpadzxwwmagnmpuk).
-- Safe to re-run the same day: snapshot_date is unique and we upsert.

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
  (select count(*) from public.users
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
  (select count(*) / 2 from public.buddies where status = 'pending'),
  (select count(*) / 2 from public.buddies where status = 'accepted')
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

select * from public.marketing_snapshots
order by snapshot_date desc
limit 14;
