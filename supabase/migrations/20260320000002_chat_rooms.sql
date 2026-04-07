-- Chat Rooms schema for H.I.M.
-- Run in Supabase SQL Editor

begin;

create extension if not exists pgcrypto;

create table if not exists public.chat_rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) > 0),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists room_messages_room_created_idx
  on public.room_messages (room_id, created_at asc);
create index if not exists room_messages_sender_idx
  on public.room_messages (sender_id);

alter table public.chat_rooms enable row level security;
alter table public.room_messages enable row level security;

drop policy if exists chat_rooms_select_authenticated on public.chat_rooms;
create policy chat_rooms_select_authenticated
on public.chat_rooms
for select
to authenticated
using (true);

drop policy if exists chat_rooms_insert_authenticated on public.chat_rooms;
create policy chat_rooms_insert_authenticated
on public.chat_rooms
for insert
to authenticated
with check (true);

drop policy if exists room_messages_select_authenticated on public.room_messages;
create policy room_messages_select_authenticated
on public.room_messages
for select
to authenticated
using (true);

drop policy if exists room_messages_insert_authenticated on public.room_messages;
create policy room_messages_insert_authenticated
on public.room_messages
for insert
to authenticated
with check (true);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_rooms'
  ) then
    alter publication supabase_realtime add table public.chat_rooms;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_messages'
  ) then
    alter publication supabase_realtime add table public.room_messages;
  end if;
end;
$$;

commit;
