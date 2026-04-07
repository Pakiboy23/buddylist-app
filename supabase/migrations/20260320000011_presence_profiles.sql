-- Presence/profile extensions for H.I.M.
-- Run after gtm_plan.sql and chat_media.sql.

begin;

alter table public.users
  add column if not exists profile_bio text null,
  add column if not exists buddy_icon_path text null,
  add column if not exists idle_since timestamptz null,
  add column if not exists last_active_at timestamptz null;

create index if not exists users_last_active_at_idx
  on public.users (last_active_at desc);

create index if not exists users_idle_since_idx
  on public.users (idle_since desc)
  where idle_since is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'buddy-icons',
  'buddy-icons',
  true,
  2097152,
  array['image/*']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists buddy_icons_read_authenticated on storage.objects;
create policy buddy_icons_read_authenticated
on storage.objects
for select
to authenticated
using (bucket_id = 'buddy-icons');

drop policy if exists buddy_icons_insert_authenticated on storage.objects;
create policy buddy_icons_insert_authenticated
on storage.objects
for insert
to authenticated
with check (bucket_id = 'buddy-icons' and auth.uid() is not null);

drop policy if exists buddy_icons_update_owner on storage.objects;
create policy buddy_icons_update_owner
on storage.objects
for update
to authenticated
using (bucket_id = 'buddy-icons' and owner = auth.uid())
with check (bucket_id = 'buddy-icons' and owner = auth.uid());

drop policy if exists buddy_icons_delete_owner on storage.objects;
create policy buddy_icons_delete_owner
on storage.objects
for delete
to authenticated
using (bucket_id = 'buddy-icons' and owner = auth.uid());

commit;
