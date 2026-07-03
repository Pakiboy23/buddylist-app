-- Advisor hardening 2: revoke client EXECUTE on internal SECURITY DEFINER functions.
--
-- Postgres grants EXECUTE to PUBLIC by default on new functions, which exposes
-- every public-schema function at /rest/v1/rpc/<name> to the anon and
-- authenticated roles. The linter (0028/0029) flags all SECURITY DEFINER
-- functions; the app RPCs (join_room_by_id, bump_dm_unread, get_public_rooms,
-- etc.) are intentionally client-callable and auth.uid()-guarded, so they stay.
-- This migration locks down only the internal ones a client should never call:
--
--   * run_retention_cleanup()            - pg_cron job (03:00 UTC, runs as
--                                          postgres). Deletes aged abuse
--                                          reports / push tokens / deletion
--                                          tombstones - must not be triggerable
--                                          by anonymous REST callers.
--   * rls_auto_enable()                  - event-trigger helper (DDL time).
--   * log_user_deletion()                - trigger function.
--   * handle_message_insert_dm_state()   - trigger function.
--   * handle_new_message_push()          - trigger function.
--   * handle_room_message_insert_unread()- trigger function.
--
-- Trigger execution is unaffected: Postgres checks EXECUTE on the trigger
-- function when the trigger is CREATED (by the migration role), not when it
-- fires. pg_cron runs jobs as their owner (postgres), which retains EXECUTE.
--
-- debug_auth() is still called by the signed-in client
-- (src/app/hi-its-me/rooms/[roomId]/preview/actions.ts), so it keeps the
-- authenticated grant and loses only anonymous access.

-- Internal functions: no client role may execute.
revoke execute on function public.run_retention_cleanup() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
revoke execute on function public.log_user_deletion() from public, anon, authenticated;
revoke execute on function public.handle_message_insert_dm_state() from public, anon, authenticated;
revoke execute on function public.handle_new_message_push() from public, anon, authenticated;
revoke execute on function public.handle_room_message_insert_unread() from public, anon, authenticated;

-- Keep an operator path for manual retention runs via the service key.
grant execute on function public.run_retention_cleanup() to service_role;

-- debug_auth: authenticated-only (remove the PUBLIC default, then re-grant).
revoke execute on function public.debug_auth() from public, anon;
grant execute on function public.debug_auth() to authenticated;
