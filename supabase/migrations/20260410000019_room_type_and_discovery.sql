-- Extend chat_rooms with type, discovery metadata, and invite mechanics.
-- Adds get_room_preview() and get_public_rooms() for the room discovery UI.
-- Depends on: user_connections (20260410000018)

begin;

-- 1. Extend chat_rooms
alter table public.chat_rooms
  add column if not exists room_type text not null default 'public'
    constraint chat_rooms_room_type_check check (room_type in ('public', 'invite', 'private')),
  add column if not exists description text,
  add column if not exists tags text[],
  add column if not exists invite_code uuid default gen_random_uuid(),
  add column if not exists member_cap integer,
  add column if not exists created_by uuid references auth.users(id) on delete set null;

-- Add unique constraint on invite_code separately so it validates after backfill
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chat_rooms_invite_code_key'
      and conrelid = 'public.chat_rooms'::regclass
  ) then
    alter table public.chat_rooms add constraint chat_rooms_invite_code_key unique (invite_code);
  end if;
end;
$$;

create index if not exists chat_rooms_room_type_idx on public.chat_rooms (room_type);
create index if not exists chat_rooms_created_by_idx on public.chat_rooms (created_by);

-- 2. Replace the permissive SELECT policy with type-aware policies.
--    Public rooms: any authenticated user can see them.
--    Invite/Private rooms: only members (in room_participants) can see them.
drop policy if exists chat_rooms_select_authenticated on public.chat_rooms;

drop policy if exists chat_rooms_select_public on public.chat_rooms;
create policy chat_rooms_select_public
on public.chat_rooms for select to authenticated
using (room_type = 'public');

drop policy if exists chat_rooms_select_member on public.chat_rooms;
create policy chat_rooms_select_member
on public.chat_rooms for select to authenticated
using (
  room_type in ('invite', 'private')
  and exists (
    select 1 from public.room_participants rp
    where rp.room_key = public.chat_rooms.room_key
      and rp.user_id = auth.uid()
  )
);

-- 3. get_room_preview — returns a single room's preview for a given user.
--    Used by the pre-join room profile page.
create or replace function public.get_room_preview(p_room_id uuid, p_user_id uuid)
returns table (
  id             uuid,
  name           text,
  description    text,
  tags           text[],
  room_type      text,
  member_cap     integer,
  member_count   bigint,
  buddy_overlap_count bigint,
  is_member      boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cr.id,
    cr.name,
    cr.description,
    cr.tags,
    cr.room_type,
    cr.member_cap,
    (
      select count(*) from public.room_participants rp
      where rp.room_key = cr.room_key
    ) as member_count,
    -- Count of mutual connections who are also in this room.
    -- Uses user_connections (migration 20260410000018).
    (
      select count(*) from public.room_participants rp
      join public.user_connections uc on (
        (uc.user_a = p_user_id and uc.user_b = rp.user_id)
        or (uc.user_b = p_user_id and uc.user_a = rp.user_id)
      )
      where rp.room_key = cr.room_key
        and uc.status = 'mutual'
    ) as buddy_overlap_count,
    exists (
      select 1 from public.room_participants rp
      where rp.room_key = cr.room_key and rp.user_id = p_user_id
    ) as is_member
  from public.chat_rooms cr
  where cr.id = p_room_id
    -- Access control: public rooms always visible; invite/private only to members
    and (
      cr.room_type = 'public'
      or exists (
        select 1 from public.room_participants rp
        where rp.room_key = cr.room_key and rp.user_id = p_user_id
      )
    );
$$;

-- 4. get_public_rooms — returns all public rooms ordered by member count.
--    Used by the room discovery browse page (server component).
create or replace function public.get_public_rooms()
returns table (
  id           uuid,
  name         text,
  description  text,
  tags         text[],
  room_key     text,
  member_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    cr.id,
    cr.name,
    cr.description,
    cr.tags,
    cr.room_key,
    (
      select count(*) from public.room_participants rp
      where rp.room_key = cr.room_key
    ) as member_count
  from public.chat_rooms cr
  where cr.room_type = 'public'
  order by member_count desc, cr.created_at asc;
$$;

grant execute on function public.get_room_preview(uuid, uuid) to authenticated;
grant execute on function public.get_public_rooms()           to authenticated;

commit;
