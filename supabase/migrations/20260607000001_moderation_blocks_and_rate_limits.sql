-- Moderation primitives: enforce blocks on READ + rate-limit buddy requests and cold DMs.
--
-- Blocking is canonical in public.blocked_users (user_connections.status='blocked' is dead
-- and never written by the app). Insert-side block enforcement already exists
-- (messages_insert_participants, buddies_insert_own_or_related) and room_messages SELECT is
-- already block-filtered (20260509224222_block_report_completion). This migration closes the
-- two remaining READ gaps (DM thread + buddy list/incoming requests) and adds anti-flood
-- rate limits.
--
-- Applied to production as schema_migrations version 20260607045536.
-- Must apply after 20260328000014_trust_safety_slice (creates blocked_users).

begin;

-- ===========================================================================
-- PART 2 — Enforce blocks on READ (bidirectional, server-side).
-- Mirrors the existing room_messages "messages_select_member" block filter.
-- ===========================================================================

-- DM thread / conversation: hide the entire 1:1 thread when a block exists either way.
drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants
on public.messages
for select
to authenticated
using (
  (auth.uid() = sender_id or auth.uid() = receiver_id)
  and not exists (
    select 1 from public.blocked_users bu
    where (bu.blocker_id = messages.sender_id   and bu.blocked_id = messages.receiver_id)
       or (bu.blocker_id = messages.receiver_id and bu.blocked_id = messages.sender_id)
  )
);

-- Buddy list + incoming buddy requests: hide rows where a block exists either way.
drop policy if exists buddies_select_own_or_related on public.buddies;
create policy buddies_select_own_or_related
on public.buddies
for select
to authenticated
using (
  (auth.uid() = user_id or auth.uid() = buddy_id)
  and not exists (
    select 1 from public.blocked_users bu
    where (bu.blocker_id = buddies.user_id  and bu.blocked_id = buddies.buddy_id)
       or (bu.blocker_id = buddies.buddy_id and bu.blocked_id = buddies.user_id)
  )
);

-- ===========================================================================
-- PART 3 — Anti-flood rate limits.
-- Thresholds live in ONE place: public.moderation_rate_limits(). Tune them there.
-- ===========================================================================

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
  select 20, 5, interval '1 hour';
$$;

comment on function public.moderation_rate_limits() is
  'Single source of truth for moderation rate-limit thresholds. Edit the SELECT to tune.';

-- Buddy requests: max N pending requests created per requester (user_id) per rolling window.
create or replace function public.enforce_buddy_request_rate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cfg record;
  v_count integer;
begin
  -- Only throttle new pending requests initiated by the requester.
  if new.status is distinct from 'pending' then
    return new;
  end if;

  select * into v_cfg from public.moderation_rate_limits();

  select count(*) into v_count
  from public.buddies b
  where b.user_id = new.user_id
    and b.status = 'pending'
    and b.created_at > now() - v_cfg.window_interval;

  if v_count >= v_cfg.buddy_requests_per_hour then
    raise exception
      'RATE_LIMIT_BUDDY_REQUESTS: Too many buddy requests in the last hour. Please slow down and try again later.'
      using errcode = 'PT429', hint = 'RATE_LIMIT_BUDDY_REQUESTS';
  end if;

  return new;
end;
$$;

drop trigger if exists buddies_enforce_request_rate on public.buddies;
create trigger buddies_enforce_request_rate
before insert on public.buddies
for each row execute function public.enforce_buddy_request_rate();

-- Cold DMs: max N DISTINCT non-buddy recipients per sender per rolling window.
-- non-buddy = no 'accepted' buddies row in either direction.
create or replace function public.enforce_dm_nonbuddy_rate()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_cfg record;
  v_is_buddy boolean;
  v_distinct integer;
begin
  select * into v_cfg from public.moderation_rate_limits();

  select exists (
    select 1 from public.buddies b
    where b.status = 'accepted'
      and ((b.user_id = new.sender_id   and b.buddy_id = new.receiver_id)
        or (b.user_id = new.receiver_id and b.buddy_id = new.sender_id))
  ) into v_is_buddy;

  -- Buddies are never throttled.
  if v_is_buddy then
    return new;
  end if;

  -- Count DISTINCT *other* non-buddy recipients this sender messaged in the window.
  select count(distinct m.receiver_id) into v_distinct
  from public.messages m
  where m.sender_id = new.sender_id
    and m.created_at > now() - v_cfg.window_interval
    and m.receiver_id <> new.receiver_id
    and not exists (
      select 1 from public.buddies b
      where b.status = 'accepted'
        and ((b.user_id = new.sender_id   and b.buddy_id = m.receiver_id)
          or (b.user_id = m.receiver_id   and b.buddy_id = new.sender_id))
    );

  -- Messaging this NEW non-buddy recipient would push the distinct count past the cap.
  if v_distinct >= v_cfg.dm_nonbuddy_recipients_per_hour then
    raise exception
      'RATE_LIMIT_DM_NONBUDDY: You can only message % new people per hour. Add them as a buddy or try again later.', v_cfg.dm_nonbuddy_recipients_per_hour
      using errcode = 'PT429', hint = 'RATE_LIMIT_DM_NONBUDDY';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_enforce_nonbuddy_rate on public.messages;
create trigger messages_enforce_nonbuddy_rate
before insert on public.messages
for each row execute function public.enforce_dm_nonbuddy_rate();

commit;
