-- Global buddy suggestions ("people you might know") for the native v2.2
-- unified buddy-list surface (issue #94).
--
-- Ranking: mutual accepted buddies, then shared room memberships, then
-- recency. Hard filters: candidates must be discoverable (register #24 —
-- discovery opt-out is absolute), never self, never anyone with an existing
-- buddy edge in ANY state (pending or accepted, either direction), never
-- anyone blocked in either direction.
--
-- SECURITY DEFINER because ranking needs visibility into other users'
-- buddy edges and room memberships, which RLS correctly hides from the
-- caller (same pattern as join_room_by_id, 20260510050322). The function
-- itself only ever RETURNS aggregate counts, never edge details.

create or replace function public.suggest_buddies(limit_count integer default 8)
returns table (
  user_id uuid,
  screenname text,
  buddy_icon_path text,
  mutual_count integer,
  shared_room_count integer,
  last_active_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with me as (
    select auth.uid() as id
  ),
  -- Accepted edges normalized to (a knows b) in both directions, since
  -- storage is mixed single/reciprocal rows (calibrated 2026-07-29).
  edges as (
    select b.user_id as a, b.buddy_id as b from public.buddies b where b.status = 'accepted'
    union
    select b.buddy_id as a, b.user_id as b from public.buddies b where b.status = 'accepted'
  ),
  my_buddies as (
    select e.b as id from edges e, me where e.a = me.id
  ),
  excluded as (
    select b.buddy_id as id from public.buddies b, me where b.user_id = me.id
    union
    select b.user_id from public.buddies b, me where b.buddy_id = me.id
    union
    select bu.blocked_id from public.blocked_users bu, me where bu.blocker_id = me.id
    union
    select bu.blocker_id from public.blocked_users bu, me where bu.blocked_id = me.id
    union
    select me.id from me
  ),
  my_rooms as (
    select rm.room_id from public.room_memberships rm, me where rm.user_id = me.id
  ),
  candidates as (
    select u.id, u.screenname, u.buddy_icon_path, u.last_active_at
    from public.users u
    where u.discoverable is true
      and u.id not in (select id from excluded)
  ),
  mutuals as (
    select e.a as cand, count(distinct e.b)::int as n
    from edges e
    where e.b in (select id from my_buddies)
    group by e.a
  ),
  shared as (
    select rm.user_id as cand, count(distinct rm.room_id)::int as n
    from public.room_memberships rm
    where rm.room_id in (select room_id from my_rooms)
    group by rm.user_id
  )
  select
    c.id,
    c.screenname,
    c.buddy_icon_path,
    coalesce(m.n, 0),
    coalesce(s.n, 0),
    c.last_active_at
  from candidates c
  left join mutuals m on m.cand = c.id
  left join shared s on s.cand = c.id
  where auth.uid() is not null
  order by coalesce(m.n, 0) desc, coalesce(s.n, 0) desc, c.last_active_at desc nulls last
  limit greatest(1, least(coalesce(limit_count, 8), 25));
$$;

revoke all on function public.suggest_buddies(integer) from public;
grant execute on function public.suggest_buddies(integer) to authenticated;

comment on function public.suggest_buddies(integer) is
  'Ranked global buddy suggestions for the signed-in user. Discoverable-only, excludes existing edges and blocks both directions.';
