-- Raise the cold-DM (non-buddy) rate limit from 5 to 15 new recipients/hour.
--
-- App Review commonly DMs several seeded demo accounts in one session; at 5/hr
-- the 6th hard-fails with PT429, which reads as a broken core flow (Guideline
-- 2.1). 15/hr keeps meaningful anti-flood protection while comfortably clearing
-- normal use and a reviewer's testing. buddy_requests_per_hour and the rolling
-- window are unchanged. Thresholds live in this one function (see
-- 20260607000001_moderation_blocks_and_rate_limits.sql).
create or replace function public.moderation_rate_limits()
returns table (
  buddy_requests_per_hour integer,
  dm_nonbuddy_recipients_per_hour integer,
  window_interval interval
)
language sql
immutable
set search_path = ''
as $$
  -- >>> TUNE MODERATION THRESHOLDS HERE <<<
  select 20, 15, interval '1 hour';
$$;
