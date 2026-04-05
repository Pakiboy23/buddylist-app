-- Server-authoritative room unread fanout.
-- Run this after room_participants.sql.

begin;

create or replace function public.normalize_room_key(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(input, '')), '^#+', ''));
$$;

create or replace function public.handle_room_message_insert_unread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_key text;
  v_room_name text;
begin
  if new.room_id is null or new.sender_id is null then
    return new;
  end if;

  select public.normalize_room_key(chat_rooms.name), chat_rooms.name
  into v_room_key, v_room_name
  from public.chat_rooms
  where chat_rooms.id = new.room_id;

  if coalesce(v_room_key, '') = '' then
    return new;
  end if;

  insert into public.user_active_rooms (
    user_id,
    room_key,
    room_name,
    unread_count,
    joined_at,
    updated_at
  )
  select
    participants.user_id,
    v_room_key,
    coalesce(v_room_name, v_room_key),
    1,
    timezone('utc', now()),
    timezone('utc', now())
  from public.room_participants as participants
  where participants.room_key = v_room_key
    and participants.user_id <> new.sender_id
  on conflict (user_id, room_key) do update
  set room_name = excluded.room_name,
      unread_count = public.user_active_rooms.unread_count + 1,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists room_messages_sync_unread on public.room_messages;
create trigger room_messages_sync_unread
after insert on public.room_messages
for each row
execute function public.handle_room_message_insert_unread();

commit;
