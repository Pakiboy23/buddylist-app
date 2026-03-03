-- Chat media attachments for DM + room messages.
-- Run after gtm_plan.sql, chat_rooms.sql, and message_enhancements.sql.

begin;

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  true,
  10485760,
  array[
    'image/*',
    'video/*',
    'audio/*',
    'text/*',
    'application/pdf',
    'application/json',
    'application/zip',
    'application/x-zip-compressed'
  ]::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id bigint not null references public.messages(id) on delete cascade,
  uploader_id uuid not null references public.users(id) on delete cascade,
  bucket text not null default 'chat-media',
  storage_path text not null,
  file_name text not null,
  mime_type text null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, storage_path)
);

create table if not exists public.room_message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.room_messages(id) on delete cascade,
  uploader_id uuid not null references public.users(id) on delete cascade,
  bucket text not null default 'chat-media',
  storage_path text not null,
  file_name text not null,
  mime_type text null,
  size_bytes int not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default timezone('utc', now()),
  unique (message_id, storage_path)
);

create index if not exists message_attachments_message_idx
  on public.message_attachments (message_id, created_at asc);

create index if not exists room_message_attachments_message_idx
  on public.room_message_attachments (message_id, created_at asc);

create index if not exists message_attachments_uploader_idx
  on public.message_attachments (uploader_id);

create index if not exists room_message_attachments_uploader_idx
  on public.room_message_attachments (uploader_id);

alter table public.message_attachments enable row level security;
alter table public.room_message_attachments enable row level security;

drop policy if exists message_attachments_select_participants on public.message_attachments;
create policy message_attachments_select_participants
on public.message_attachments
for select
to authenticated
using (
  exists (
    select 1
    from public.messages m
    where m.id = message_attachments.message_id
      and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
  )
);

drop policy if exists message_attachments_insert_participants on public.message_attachments;
create policy message_attachments_insert_participants
on public.message_attachments
for insert
to authenticated
with check (
  auth.uid() = uploader_id
  and exists (
    select 1
    from public.messages m
    where m.id = message_attachments.message_id
      and (auth.uid() = m.sender_id or auth.uid() = m.receiver_id)
  )
);

drop policy if exists message_attachments_delete_own on public.message_attachments;
create policy message_attachments_delete_own
on public.message_attachments
for delete
to authenticated
using (auth.uid() = uploader_id);

drop policy if exists room_message_attachments_select_authenticated on public.room_message_attachments;
create policy room_message_attachments_select_authenticated
on public.room_message_attachments
for select
to authenticated
using (true);

drop policy if exists room_message_attachments_insert_own on public.room_message_attachments;
create policy room_message_attachments_insert_own
on public.room_message_attachments
for insert
to authenticated
with check (auth.uid() = uploader_id);

drop policy if exists room_message_attachments_delete_own on public.room_message_attachments;
create policy room_message_attachments_delete_own
on public.room_message_attachments
for delete
to authenticated
using (auth.uid() = uploader_id);

drop policy if exists chat_media_read_authenticated on storage.objects;
create policy chat_media_read_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'chat-media');

drop policy if exists chat_media_insert_authenticated on storage.objects;
create policy chat_media_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'chat-media' and auth.uid() is not null);

drop policy if exists chat_media_update_owner on storage.objects;
create policy chat_media_update_owner
on storage.objects
for update
to authenticated
using (bucket_id = 'chat-media' and owner = auth.uid())
with check (bucket_id = 'chat-media' and owner = auth.uid());

drop policy if exists chat_media_delete_owner on storage.objects;
create policy chat_media_delete_owner
on storage.objects
for delete
to authenticated
using (bucket_id = 'chat-media' and owner = auth.uid());

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'message_attachments'
  ) then
    alter publication supabase_realtime add table public.message_attachments;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_message_attachments'
  ) then
    alter publication supabase_realtime add table public.room_message_attachments;
  end if;
end;
$$;

commit;

