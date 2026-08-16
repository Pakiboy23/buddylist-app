-- Storage privacy hardening for chat media (linter 0025 public_bucket_allows_listing).
--
-- Before this migration any signed-in user could SELECT (list, download via the
-- authenticated API, and sign URLs for) EVERY object in the chat-media and
-- buddy-icons buckets, and could INSERT into any path — including other users'
-- prefixes. This scopes both:
--
--   * chat-media SELECT  -> object owner, or a participant of the DM the object
--                           is attached to. (Rooms v2 archived
--                           room_message_attachments and no room-attachment UI
--                           exists; extend this policy when rooms media ships.)
--   * chat-media INSERT  -> only under the caller's own `<uid>/...` prefix
--                           (matches buildStoragePath in src/lib/chatMedia.ts).
--   * buddy-icons SELECT -> owner only. Avatar display uses public object URLs
--                           (getPublicUrl), which do not consult RLS while the
--                           bucket is public; owner SELECT is kept so
--                           uploadBuddyIconFile's remove() flow keeps working.
--   * buddy-icons INSERT -> only under the caller's own `<uid>/profile/...`
--                           prefix (matches buildStoragePath in src/lib/buddyIcon.ts).
--
-- Rollout note: both buckets REMAIN PUBLIC in this migration. The live iOS app
-- renders media through public object URLs; flipping `storage.buckets.public`
-- to false before that fleet updates to the signed-URL client would break it.
-- The flip is the final step in docs/storage-privacy-rollout.md.
--
-- auth.uid() is wrapped in a scalar subquery per the repo's auth_rls_initplan
-- convention (see 20260607000003_advisor_hardening.sql).

-- Supporting index for the storage_path lookup the new SELECT policy performs.
create index if not exists message_attachments_storage_path_idx
  on public.message_attachments (storage_path);

-- 1. chat-media: participant-scoped SELECT ------------------------------------
drop policy if exists chat_media_read_authenticated on storage.objects;
drop policy if exists chat_media_read_scoped on storage.objects;
create policy chat_media_read_scoped
on storage.objects
for select
to authenticated
using (
  bucket_id = 'chat-media'
  and (
    owner = (select auth.uid())
    or exists (
      select 1
      from public.message_attachments ma
      join public.messages m on m.id = ma.message_id
      where ma.storage_path = storage.objects.name
        and ((select auth.uid()) = m.sender_id or (select auth.uid()) = m.receiver_id)
    )
  )
);

-- 2. chat-media: own-prefix INSERT ---------------------------------------------
drop policy if exists chat_media_insert_authenticated on storage.objects;
drop policy if exists chat_media_insert_own_prefix on storage.objects;
create policy chat_media_insert_own_prefix
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'chat-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

-- 3. buddy-icons: owner-scoped SELECT ------------------------------------------
drop policy if exists buddy_icons_read_authenticated on storage.objects;
drop policy if exists buddy_icons_read_owner on storage.objects;
create policy buddy_icons_read_owner
on storage.objects
for select
to authenticated
using (bucket_id = 'buddy-icons' and owner = (select auth.uid()));

-- 4. buddy-icons: own-prefix INSERT ---------------------------------------------
drop policy if exists buddy_icons_insert_authenticated on storage.objects;
drop policy if exists buddy_icons_insert_own_prefix on storage.objects;
create policy buddy_icons_insert_own_prefix
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'buddy-icons'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
