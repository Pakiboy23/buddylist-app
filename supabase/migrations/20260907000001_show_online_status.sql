-- FB/IG-style "show when you're active" preference.
-- discoverable = appear in Browse & Search.
-- show_online_status = whether other people can see online / idle / away / last-active.
--
-- Postgres RLS is row-level, so raw users.status / last_active_at / idle_since
-- remain readable on the table. Directory reads should use user_presence_directory
-- (columns already nulled) or the app-layer mask in src/lib/presence.ts.
-- can_see_presence now also respects this toggle.

begin;

alter table public.users
  add column if not exists show_online_status boolean not null default true;

comment on column public.users.show_online_status is
  'When false, other viewers must not see this account''s online / idle / away chips or last-active times. Own profile always sees the truth. Independent of discoverable.';

create or replace function public.can_see_presence(viewer_id uuid, subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer_id = subject_id
    or (
      coalesce(
        (select u.show_online_status from public.users u where u.id = subject_id),
        true
      )
      and (
        exists (
          select 1 from public.user_connections
          where user_a = least(viewer_id, subject_id)
            and user_b = greatest(viewer_id, subject_id)
            and status = 'mutual'
        )
        or exists (
          select 1 from public.user_connections
          where user_a = least(viewer_id, subject_id)
            and user_b = greatest(viewer_id, subject_id)
            and status = 'following'
            and initiated_by = viewer_id
        )
      )
    );
$$;

comment on function public.can_see_presence(uuid, uuid) is
  'True when the viewer may see the subject''s live presence. Own data always; otherwise the subject must have show_online_status and the legacy connection-graph grant.';

drop view if exists public.user_presence_directory;
create view public.user_presence_directory
with (security_invoker = true)
as
select
  u.id,
  u.screenname,
  u.away_message,
  u.profile_bio,
  u.buddy_icon_path,
  u.discoverable,
  u.show_online_status,
  case
    when auth.uid() = u.id or u.show_online_status then u.status
    else null
  end as status,
  case
    when auth.uid() = u.id or u.show_online_status then u.last_active_at
    else null
  end as last_active_at,
  case
    when auth.uid() = u.id or u.show_online_status then u.idle_since
    else null
  end as idle_since
from public.users u;

grant select on public.user_presence_directory to authenticated;

comment on view public.user_presence_directory is
  'Directory-safe user rows: last_active_at, idle_since, and status are nulled for other viewers when show_online_status is false. Away message stays visible.';

-- Rank suggestions with the real stamp, but do not return last_active_at when hidden.
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
    select u.id, u.screenname, u.buddy_icon_path, u.last_active_at, u.show_online_status
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
    case when c.show_online_status then c.last_active_at else null end
  from candidates c
  left join mutuals m on m.cand = c.id
  left join shared s on s.cand = c.id
  where auth.uid() is not null
  order by coalesce(m.n, 0) desc, coalesce(s.n, 0) desc, c.last_active_at desc nulls last
  limit greatest(1, least(coalesce(limit_count, 8), 25));
$$;

revoke all on function public.suggest_buddies(integer) from public;
revoke execute on function public.suggest_buddies(integer) from anon;
grant execute on function public.suggest_buddies(integer) to authenticated;

comment on function public.suggest_buddies(integer) is
  'Ranked global buddy suggestions for the signed-in user. Discoverable-only, excludes existing edges and blocks both directions. last_active_at is nulled when the candidate hid activity.';

commit;
