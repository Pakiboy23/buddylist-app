-- Messaging enhancement schema:
-- - soft edit/delete metadata for DM + room messages
-- - emoji reactions for DM + room messages
-- Run after gtm_plan.sql and chat_rooms.sql.

begin;

alter table public.messages
  add column if not exists edited_at timestamptz null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references public.users(id) on delete set null;

alter table public.room_messages
  add column if not exists edited_at timestamptz null,
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references public.users(id) on delete set null;

drop policy if exists messages_update_sender on public.messages;
create policy messages_update_sender
on public.messages
for update
to authenticated
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

drop policy if exists room_messages_update_sender on public.room_messages;
create policy room_messages_update_sender
on public.room_messages
for update
to authenticated
using (auth.uid() = sender_id)
with check (auth.uid() = sender_id);

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null check (char_length(trim(emoji)) between 1 and 16),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.room_message_reactions (
  message_id uuid not null references public.room_messages(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  emoji text not null check (char_length(trim(emoji)) between 1 and 16),
  created_at timestamptz not null default timezone('utc', now()),
  primary key (message_id, user_id, emoji)
);

create index if not exists message_reactions_message_idx
  on public.message_reactions (message_id);

create index if not exists message_reactions_user_idx
  on public.message_reactions (user_id);

create index if not exists room_message_reactions_message_idx
  on public.room_message_reactions (message_id);

create index if not exists room_message_reactions_user_idx
  on public.room_message_reactions (user_id);

alter table public.message_reactions enable row level security;
alter table public.room_message_reactions enable row level security;

drop policy if exists message_reactions_select_participants on public.message_reactions;
create policy message_reactions_select_participants
on public.message_reactions
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
  )
);

drop policy if exists message_reactions_insert_participants on public.message_reactions;
create policy message_reactions_insert_participants
on public.message_reactions
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.messages m
    where m.id = message_reactions.message_id
      and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
  )
);

drop policy if exists message_reactions_delete_own on public.message_reactions;
create policy message_reactions_delete_own
on public.message_reactions
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists room_message_reactions_select_authenticated on public.room_message_reactions;
create policy room_message_reactions_select_authenticated
on public.room_message_reactions
for select
to authenticated
using (true);

drop policy if exists room_message_reactions_insert_own on public.room_message_reactions;
create policy room_message_reactions_insert_own
on public.room_message_reactions
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists room_message_reactions_delete_own on public.room_message_reactions;
create policy room_message_reactions_delete_own
on public.room_message_reactions
for delete
to authenticated
using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_message_reactions'
  ) then
    alter publication supabase_realtime add table public.room_message_reactions;
  end if;
end;
$$;

commit;
