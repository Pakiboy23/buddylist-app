-- Rooms v1 -> v2 cleanup. _archive_user_active_rooms still carried triggers that
-- sync to public.room_participants, a table dropped in the rooms v2 launch. On any
-- cascade delete of archived rows (notably account deletion for users with rooms-v1
-- history), the trigger threw 42P01 (relation "public.room_participants" does not
-- exist) and aborted the whole delete. This was the real cause of the repeated
-- 5.1.1(v) account-deletion failures.
--
-- Applied to prod 2026-06-12 as remote version 20260612065205.
drop trigger if exists user_active_rooms_sync_participants_write on public._archive_user_active_rooms;
drop trigger if exists user_active_rooms_sync_participants_update on public._archive_user_active_rooms;
drop function if exists public.sync_room_participants_from_active_rooms();
