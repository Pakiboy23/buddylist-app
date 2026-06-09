-- Admin-only moderation review queue.
-- Run as a privileged role in the Supabase SQL editor (service_role / postgres).
-- No admin UI yet — this is the canonical query for sweeping flagged content.

-- 1. Recently flagged DM bodies (last 7 days). Limit applied for safety.
select
  m.id,
  m.created_at,
  m.flagged_at,
  m.sender_id,
  sender.screenname as sender_screenname,
  m.receiver_id,
  receiver.screenname as receiver_screenname,
  m.content,
  m.deleted_at,
  m.deleted_by
from public.messages m
left join public.users sender on sender.id = m.sender_id
left join public.users receiver on receiver.id = m.receiver_id
where m.flagged_at is not null
  and m.flagged_at > timezone('utc', now()) - interval '7 days'
order by m.flagged_at desc
limit 200;

-- 2. Recently flagged room messages (last 7 days). Limit applied for safety.
select
  rm.id,
  rm.created_at,
  rm.flagged_at,
  rm.room_id,
  cr.name as room_name,
  rm.user_id as sender_id,
  sender.screenname as sender_screenname,
  rm.body
from public.room_messages rm
left join public.rooms cr on cr.id = rm.room_id
left join public.users sender on sender.id = rm.user_id
where rm.flagged_at is not null
  and rm.flagged_at > timezone('utc', now()) - interval '7 days'
order by rm.flagged_at desc
limit 200;

-- 3. Counts of flagged content per sender (last 30 days). Identifies
-- repeat offenders.
with dm_flags as (
  select sender_id as user_id, count(*) as flagged_dm_count
  from public.messages
  where flagged_at is not null
    and flagged_at > timezone('utc', now()) - interval '30 days'
  group by sender_id
), room_flags as (
  select user_id, count(*) as flagged_room_count
  from public.room_messages
  where flagged_at is not null
    and flagged_at > timezone('utc', now()) - interval '30 days'
  group by user_id
)
select
  u.id,
  u.screenname,
  coalesce(d.flagged_dm_count, 0) as flagged_dms_30d,
  coalesce(r.flagged_room_count, 0) as flagged_room_msgs_30d,
  coalesce(d.flagged_dm_count, 0) + coalesce(r.flagged_room_count, 0) as flagged_total_30d
from public.users u
left join dm_flags d on d.user_id = u.id
left join room_flags r on r.user_id = u.id
where coalesce(d.flagged_dm_count, 0) + coalesce(r.flagged_room_count, 0) > 0
order by flagged_total_30d desc
limit 100;

-- 4. Spot-check: confirm the trigger fires correctly. Run after the migration
-- ships. The first insert below will be auto-flagged; the second won't.
-- Wrap in a savepoint so it can be rolled back without committing test data.
--
--   begin;
--   savepoint check_filter;
--   insert into public.messages (sender_id, receiver_id, content)
--     values ('<some-user-id>'::uuid, '<some-other-id>'::uuid, 'go fuck yourself')
--     returning id, flagged_at;
--   insert into public.messages (sender_id, receiver_id, content)
--     values ('<some-user-id>'::uuid, '<some-other-id>'::uuid, 'have a nice day')
--     returning id, flagged_at;
--   rollback to savepoint check_filter;
--   commit;
