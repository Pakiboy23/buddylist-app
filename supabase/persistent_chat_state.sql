-- Persistent active room state + unread counters
-- Run this in Supabase SQL Editor as a privileged role.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.normalize_room_key(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(input, '')), '^#+', ''));
$$;

create table if not exists public.user_active_rooms (
  user_id uuid not null references public.users(id) on delete cascade,
  room_key text not null,
  room_name text not null,
  unread_count int not null default 0 check (unread_count >= 0),
  joined_at timestamptz not null default timezone('utc', now()),
  last_read_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, room_key)
);

create index if not exists user_active_rooms_user_updated_idx
  on public.user_active_rooms (user_id, updated_at desc);

create index if not exists user_active_rooms_user_unread_idx
  on public.user_active_rooms (user_id, unread_count)
  where unread_count > 0;

drop trigger if exists user_active_rooms_set_updated_at on public.user_active_rooms;
create trigger user_active_rooms_set_updated_at
before update on public.user_active_rooms
for each row
execute function public.set_updated_at();

alter table public.user_active_rooms enable row level security;

drop policy if exists user_active_rooms_select_own on public.user_active_rooms;
create policy user_active_rooms_select_own
on public.user_active_rooms
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_active_rooms_insert_own on public.user_active_rooms;
create policy user_active_rooms_insert_own
on public.user_active_rooms
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_active_rooms_update_own on public.user_active_rooms;
create policy user_active_rooms_update_own
on public.user_active_rooms
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_active_rooms_delete_own on public.user_active_rooms;
create policy user_active_rooms_delete_own
on public.user_active_rooms
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.join_active_room(p_room_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_name text := trim(coalesce(p_room_name, ''));
  v_room_key text := public.normalize_room_key(v_room_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_room_key = '' then
    raise exception 'Room name is required';
  end if;

  if v_room_name = '' then
    v_room_name := v_room_key;
  end if;

  insert into public.user_active_rooms (
    user_id,
    room_key,
    room_name,
    unread_count,
    joined_at,
    updated_at
  )
  values (
    v_user_id,
    v_room_key,
    v_room_name,
    0,
    timezone('utc', now()),
    timezone('utc', now())
  )
  on conflict (user_id, room_key) do update
  set room_name = excluded.room_name,
      updated_at = timezone('utc', now());
end;
$$;

create or replace function public.leave_active_room(p_room_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_key text := public.normalize_room_key(p_room_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_room_key = '' then
    return;
  end if;

  delete from public.user_active_rooms
  where user_id = v_user_id
    and room_key = v_room_key;
end;
$$;

create or replace function public.clear_room_unread(p_room_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_key text := public.normalize_room_key(p_room_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_room_key = '' then
    return;
  end if;

  update public.user_active_rooms
  set unread_count = 0,
      last_read_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = v_user_id
    and room_key = v_room_key;
end;
$$;

create or replace function public.bump_room_unread(p_room_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_key text := public.normalize_room_key(p_room_name);
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_room_key = '' then
    return;
  end if;

  update public.user_active_rooms
  set unread_count = unread_count + 1,
      updated_at = timezone('utc', now())
  where user_id = v_user_id
    and room_key = v_room_key;
end;
$$;

revoke all on function public.join_active_room(text) from public;
revoke all on function public.leave_active_room(text) from public;
revoke all on function public.clear_room_unread(text) from public;
revoke all on function public.bump_room_unread(text) from public;

grant execute on function public.join_active_room(text) to authenticated;
grant execute on function public.leave_active_room(text) to authenticated;
grant execute on function public.clear_room_unread(text) to authenticated;
grant execute on function public.bump_room_unread(text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_active_rooms'
  ) then
    alter publication supabase_realtime add table public.user_active_rooms;
  end if;
end;
$$;

-- Optional cleanup to normalize legacy values.
update public.user_active_rooms
set room_name = trim(room_name),
    room_key = public.normalize_room_key(room_name),
    updated_at = timezone('utc', now())
where room_name <> trim(room_name)
   or room_key <> public.normalize_room_key(room_name);

commit;
