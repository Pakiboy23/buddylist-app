-- Room participants canonical state for room unread fanout.
-- Run this after persistent_chat_state.sql.

begin;

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

create table if not exists public.room_participants (
  room_key text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  joined_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (room_key, user_id),
  constraint room_participants_room_key_nonempty check (char_length(trim(room_key)) > 0)
);

create index if not exists room_participants_user_idx
  on public.room_participants (user_id);

create index if not exists room_participants_room_updated_idx
  on public.room_participants (room_key, updated_at desc);

drop trigger if exists room_participants_set_updated_at on public.room_participants;
create trigger room_participants_set_updated_at
before update on public.room_participants
for each row
execute function public.set_updated_at();

alter table public.room_participants enable row level security;

drop policy if exists room_participants_select_shared on public.room_participants;
create policy room_participants_select_shared
on public.room_participants
for select
to authenticated
using (true);

drop policy if exists room_participants_insert_own on public.room_participants;
create policy room_participants_insert_own
on public.room_participants
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists room_participants_update_own on public.room_participants;
create policy room_participants_update_own
on public.room_participants
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists room_participants_delete_own on public.room_participants;
create policy room_participants_delete_own
on public.room_participants
for delete
to authenticated
using (auth.uid() = user_id);

insert into public.room_participants (
  room_key,
  user_id,
  joined_at,
  updated_at
)
select
  public.normalize_room_key(room_key),
  user_id,
  coalesce(joined_at, timezone('utc', now())),
  timezone('utc', now())
from public.user_active_rooms
where public.normalize_room_key(room_key) <> ''
on conflict (room_key, user_id) do update
set joined_at = least(public.room_participants.joined_at, excluded.joined_at),
    updated_at = greatest(public.room_participants.updated_at, excluded.updated_at);

create or replace function public.sync_room_participants_from_active_rooms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_room_key text;
  v_new_room_key text;
begin
  if tg_op = 'DELETE' then
    v_old_room_key := public.normalize_room_key(old.room_key);

    if v_old_room_key <> '' then
      delete from public.room_participants
      where room_key = v_old_room_key
        and user_id = old.user_id;
    end if;

    return old;
  end if;

  v_new_room_key := public.normalize_room_key(new.room_key);

  if tg_op = 'UPDATE' then
    v_old_room_key := public.normalize_room_key(old.room_key);

    if (v_old_room_key <> v_new_room_key or old.user_id <> new.user_id) and v_old_room_key <> '' then
      delete from public.room_participants
      where room_key = v_old_room_key
        and user_id = old.user_id;
    end if;
  end if;

  if v_new_room_key = '' then
    return new;
  end if;

  insert into public.room_participants (
    room_key,
    user_id,
    joined_at,
    updated_at
  )
  values (
    v_new_room_key,
    new.user_id,
    coalesce(new.joined_at, timezone('utc', now())),
    timezone('utc', now())
  )
  on conflict (room_key, user_id) do update
  set updated_at = excluded.updated_at;

  return new;
end;
$$;

drop trigger if exists user_active_rooms_sync_participants_write on public.user_active_rooms;
drop trigger if exists user_active_rooms_sync_participants on public.user_active_rooms;
create trigger user_active_rooms_sync_participants_write
after insert or delete on public.user_active_rooms
for each row
execute function public.sync_room_participants_from_active_rooms();

drop trigger if exists user_active_rooms_sync_participants_update on public.user_active_rooms;
create trigger user_active_rooms_sync_participants_update
after update of room_key, user_id, joined_at on public.user_active_rooms
for each row
execute function public.sync_room_participants_from_active_rooms();

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_participants'
  ) then
    alter publication supabase_realtime add table public.room_participants;
  end if;
end;
$$;

commit;
