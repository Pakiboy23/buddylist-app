begin;

create schema if not exists private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.get_mutual_context(p_target_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_viewer_id uuid := (select auth.uid());
  v_context jsonb;
begin
  if v_viewer_id is null then
    raise exception 'AUTH_REQUIRED: Sign in to view shared context.'
      using errcode = 'PT401', hint = 'AUTH_REQUIRED';
  end if;

  if p_target_id is null or p_target_id = v_viewer_id then
    raise exception 'INVALID_CONTEXT_TARGET: Choose another member.'
      using errcode = '22023', hint = 'INVALID_CONTEXT_TARGET';
  end if;

  if exists (
    select 1
    from public.blocked_users bu
    where (bu.blocker_id = v_viewer_id and bu.blocked_id = p_target_id)
       or (bu.blocker_id = p_target_id and bu.blocked_id = v_viewer_id)
  ) then
    raise exception 'CONTEXT_UNAVAILABLE: Shared context is not available.'
      using errcode = 'PT403', hint = 'CONTEXT_UNAVAILABLE';
  end if;

  if not (
    exists (
      select 1
      from public.buddies b
      where b.status = 'accepted'
        and (
          (b.user_id = v_viewer_id and b.buddy_id = p_target_id)
          or (b.user_id = p_target_id and b.buddy_id = v_viewer_id)
        )
    )
    or exists (
      select 1
      from public.room_memberships viewer_membership
      join public.room_memberships target_membership
        on target_membership.room_id = viewer_membership.room_id
       and target_membership.user_id = p_target_id
      join public.rooms r
        on r.id = viewer_membership.room_id
       and r.is_active = true
      where viewer_membership.user_id = v_viewer_id
    )
  ) then
    raise exception 'CONTEXT_UNAVAILABLE: Shared context requires a buddy connection or shared room.'
      using errcode = 'PT403', hint = 'CONTEXT_UNAVAILABLE';
  end if;

  with viewer_buddies as (
    select distinct
      case when b.user_id = v_viewer_id then b.buddy_id else b.user_id end as buddy_id
    from public.buddies b
    where b.status = 'accepted'
      and (b.user_id = v_viewer_id or b.buddy_id = v_viewer_id)
  ),
  target_buddies as (
    select distinct
      case when b.user_id = p_target_id then b.buddy_id else b.user_id end as buddy_id
    from public.buddies b
    where b.status = 'accepted'
      and (b.user_id = p_target_id or b.buddy_id = p_target_id)
  ),
  mutual_buddies as (
    select u.id, u.screenname
    from viewer_buddies viewer_buddy
    join target_buddies target_buddy using (buddy_id)
    join public.users u on u.id = viewer_buddy.buddy_id
    where u.id <> v_viewer_id
      and u.id <> p_target_id
      and not exists (
        select 1
        from public.blocked_users bu
        where (bu.blocker_id = v_viewer_id and bu.blocked_id = u.id)
           or (bu.blocker_id = u.id and bu.blocked_id = v_viewer_id)
           or (bu.blocker_id = p_target_id and bu.blocked_id = u.id)
           or (bu.blocker_id = u.id and bu.blocked_id = p_target_id)
      )
  ),
  listed_mutual_buddies as (
    select id, screenname
    from mutual_buddies
    order by lower(screenname), id
    limit 8
  ),
  shared_rooms as (
    select distinct r.id, r.slug, r.name
    from public.room_memberships viewer_membership
    join public.room_memberships target_membership
      on target_membership.room_id = viewer_membership.room_id
     and target_membership.user_id = p_target_id
    join public.rooms r
      on r.id = viewer_membership.room_id
     and r.is_active = true
    where viewer_membership.user_id = v_viewer_id
  )
  select jsonb_build_object(
    'sharedRooms', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', id, 'slug', slug, 'name', name)
          order by lower(name), id
        )
        from shared_rooms
      ),
      '[]'::jsonb
    ),
    'mutualBuddies', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object('id', id, 'screenname', screenname)
          order by lower(screenname), id
        )
        from listed_mutual_buddies
      ),
      '[]'::jsonb
    ),
    'mutualBuddyCount', (select count(*) from mutual_buddies)
  )
  into v_context;

  return v_context;
end;
$$;

comment on function private.get_mutual_context(uuid) is
  'Returns only the active rooms and accepted buddies shared by the authenticated viewer and a permitted target.';

revoke all on function private.get_mutual_context(uuid) from public, anon;
grant execute on function private.get_mutual_context(uuid) to authenticated;

create or replace function public.get_mutual_context(p_target_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select private.get_mutual_context(p_target_id);
$$;

comment on function public.get_mutual_context(uuid) is
  'Authenticated RPC wrapper for privacy-scoped shared rooms and mutual buddies.';

revoke all on function public.get_mutual_context(uuid) from public, anon;
grant execute on function public.get_mutual_context(uuid) to authenticated;

commit;
