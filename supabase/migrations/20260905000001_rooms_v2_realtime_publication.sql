-- Rooms v2 created public.room_memberships and a fresh public.room_messages
-- without adding them to supabase_realtime. The v1 tables that WERE published
-- (user_active_rooms, room_messages) were renamed to _archive_* and took the
-- publication membership with them.
--
-- ChatContext and GroupChatWindow listen for room_memberships INSERT/DELETE
-- so an accepted-buddy invite can land on the invitee's room list while the
-- app is already open. Without this publication those listeners never fire
-- and the invite looks like a no-op until the next visibility/online sync.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_memberships'
  ) then
    alter publication supabase_realtime add table public.room_memberships;
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
