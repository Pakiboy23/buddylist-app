-- Canonical room-key integrity for room state tables.
-- `chat_rooms.name` preserves display casing, so FK relationships need a
-- normalized key column instead of binding against the raw room name.

begin;

create or replace function public.normalize_room_key(input text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(input, '')), '^#+', ''));
$$;

alter table public.chat_rooms
  add column if not exists room_key text;

update public.chat_rooms
set room_key = public.normalize_room_key(name)
where room_key is null
   or room_key <> public.normalize_room_key(name);

create or replace function public.sync_chat_room_key()
returns trigger
language plpgsql
as $$
begin
  new.room_key = public.normalize_room_key(new.name);
  return new;
end;
$$;

drop trigger if exists chat_rooms_sync_room_key on public.chat_rooms;
create trigger chat_rooms_sync_room_key
before insert or update of name on public.chat_rooms
for each row
execute function public.sync_chat_room_key();

insert into public.chat_rooms (name, room_key, created_at)
select
  source.room_name,
  source.room_key,
  timezone('utc', now())
from (
  select distinct on (normalized.room_key)
    normalized.room_key,
    normalized.room_name
  from (
    select
      public.normalize_room_key(uar.room_key) as room_key,
      coalesce(nullif(trim(uar.room_name), ''), public.normalize_room_key(uar.room_key)) as room_name
    from public.user_active_rooms uar
    union all
    select
      public.normalize_room_key(rp.room_key) as room_key,
      public.normalize_room_key(rp.room_key) as room_name
    from public.room_participants rp
  ) as normalized
  where normalized.room_key <> ''
  order by normalized.room_key, normalized.room_name
) as source
left join public.chat_rooms existing
  on existing.room_key = source.room_key
where existing.id is null;

with ranked_rooms as (
  select
    id,
    room_key,
    name,
    created_at,
    row_number() over (
      partition by room_key
      order by created_at asc, id asc
    ) as row_num,
    first_value(id) over (
      partition by room_key
      order by created_at asc, id asc
    ) as canonical_id
  from public.chat_rooms
),
duplicate_rooms as (
  select
    id as duplicate_id,
    canonical_id
  from ranked_rooms
  where row_num > 1
)
update public.room_messages messages
set room_id = duplicates.canonical_id
from duplicate_rooms duplicates
where messages.room_id = duplicates.duplicate_id;

with ranked_rooms as (
  select
    id,
    room_key,
    row_number() over (
      partition by room_key
      order by created_at asc, id asc
    ) as row_num
  from public.chat_rooms
)
delete from public.chat_rooms rooms
using ranked_rooms ranked
where rooms.id = ranked.id
  and ranked.row_num > 1;

update public.user_active_rooms
set room_key = public.normalize_room_key(room_key),
    updated_at = timezone('utc', now())
where room_key <> public.normalize_room_key(room_key);

update public.room_participants
set room_key = public.normalize_room_key(room_key),
    updated_at = timezone('utc', now())
where room_key <> public.normalize_room_key(room_key);

alter table public.chat_rooms
  alter column room_key set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_rooms_room_key_nonempty'
      and conrelid = 'public.chat_rooms'::regclass
  ) then
    alter table public.chat_rooms
      add constraint chat_rooms_room_key_nonempty
      check (char_length(trim(room_key)) > 0)
      not valid;
  end if;
end;
$$;

alter table public.chat_rooms
  validate constraint chat_rooms_room_key_nonempty;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'chat_rooms_room_key_key'
      and conrelid = 'public.chat_rooms'::regclass
  ) then
    alter table public.chat_rooms
      add constraint chat_rooms_room_key_key unique (room_key);
  end if;
end;
$$;

alter table public.user_active_rooms
  validate constraint user_active_rooms_room_key_fkey;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_active_rooms_room_key_fkey'
      and conrelid = 'public.user_active_rooms'::regclass
  ) then
    alter table public.user_active_rooms
      add constraint user_active_rooms_room_key_fkey
      foreign key (room_key)
      references public.chat_rooms(room_key)
      on delete cascade
      not valid;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'room_participants_room_key_fkey'
      and conrelid = 'public.room_participants'::regclass
  ) then
    alter table public.room_participants
      add constraint room_participants_room_key_fkey
      foreign key (room_key)
      references public.chat_rooms(room_key)
      on delete cascade
      not valid;
  end if;
end;
$$;

alter table public.room_participants
  validate constraint room_participants_room_key_fkey;

commit;
