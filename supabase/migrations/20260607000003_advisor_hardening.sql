-- Advisor hardening (Supabase database linter: security + performance).
-- All changes are semantics-preserving:
--   1. Pin search_path on the 4 functions flagged function_search_path_mutable.
--   2. Add covering indexes for the 2 unindexed foreign keys.
--   3. Rewrite the 10 RLS policies flagged auth_rls_initplan so auth.uid() is
--      evaluated once per query (select auth.uid()) instead of once per row.
-- The RLS rewrites change ONLY the auth.uid() wrapping; every USING/WITH CHECK
-- predicate is otherwise identical to the live policy.
--
-- NOT addressed here (deliberately):
--   * *_security_definer_function_executable: revoking EXECUTE would break the
--     SECURITY DEFINER RPCs the client relies on (join_room_by_id, etc.).
--   * debug_auth: still called by the app (rooms/[roomId]/preview/actions.ts);
--     remove that call before dropping the function.
--   * account_deletion_log rls_enabled_no_policy: intentional deny-all to
--     clients (service-role only) — adding a policy would expose the audit log.
--   * auth_leaked_password_protection / extension_in_public / pg_net /
--     public_bucket_allows_listing: dashboard/config, not SQL.

-- 1. Function search_path hardening (all refs are schema-qualified or pg_catalog) --
alter function public.message_content_appears_objectionable(text) set search_path = '';
alter function public.flag_objectionable_message() set search_path = '';
alter function public.flag_objectionable_room_message() set search_path = '';
alter function public.set_updated_at() set search_path = '';

-- 2. Covering indexes for unindexed foreign keys --
create index if not exists room_memberships_user_id_idx on public.room_memberships (user_id);
create index if not exists room_messages_user_id_idx on public.room_messages (user_id);

-- 3. RLS auth_rls_initplan rewrites (wrap auth.uid() in a scalar subquery) --

drop policy if exists abuse_reports_select_own on public.abuse_reports;
create policy abuse_reports_select_own on public.abuse_reports
  as permissive for select to authenticated
  using (
    ((select auth.uid()) = reporter_id)
    or ((select auth.uid()) in (select admin_users.user_id from admin_users))
  );

drop policy if exists buddies_select_own_or_related on public.buddies;
create policy buddies_select_own_or_related on public.buddies
  as permissive for select to authenticated
  using (
    (((select auth.uid()) = user_id) or ((select auth.uid()) = buddy_id))
    and (not (exists (
      select 1 from blocked_users bu
      where (((bu.blocker_id = buddies.user_id) and (bu.blocked_id = buddies.buddy_id))
          or ((bu.blocker_id = buddies.buddy_id) and (bu.blocked_id = buddies.user_id)))
    )))
  );

drop policy if exists messages_select_participants on public.messages;
create policy messages_select_participants on public.messages
  as permissive for select to authenticated
  using (
    (((select auth.uid()) = sender_id) or ((select auth.uid()) = receiver_id))
    and (not (exists (
      select 1 from blocked_users bu
      where (((bu.blocker_id = messages.sender_id) and (bu.blocked_id = messages.receiver_id))
          or ((bu.blocker_id = messages.receiver_id) and (bu.blocked_id = messages.sender_id)))
    )))
  );

drop policy if exists memberships_delete_own on public.room_memberships;
create policy memberships_delete_own on public.room_memberships
  as permissive for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists memberships_insert_own on public.room_memberships;
create policy memberships_insert_own on public.room_memberships
  as permissive for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists memberships_select_room_members on public.room_memberships;
create policy memberships_select_room_members on public.room_memberships
  as permissive for select to authenticated
  using (is_room_member(room_id, (select auth.uid())));

drop policy if exists memberships_update_own on public.room_memberships;
create policy memberships_update_own on public.room_memberships
  as permissive for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists messages_insert_member on public.room_messages;
create policy messages_insert_member on public.room_messages
  as permissive for insert to authenticated
  with check (
    (user_id = (select auth.uid()))
    and is_room_member(room_id, (select auth.uid()))
    and (exists (
      select 1 from rooms r
      where ((r.id = room_messages.room_id) and (r.is_active = true))
    ))
  );

drop policy if exists messages_select_member on public.room_messages;
create policy messages_select_member on public.room_messages
  as permissive for select to authenticated
  using (
    is_room_member(room_id, (select auth.uid()))
    and ((user_id = (select auth.uid())) or (not (exists (
      select 1 from blocked_users bu
      where (((bu.blocker_id = (select auth.uid())) and (bu.blocked_id = room_messages.user_id))
          or ((bu.blocker_id = room_messages.user_id) and (bu.blocked_id = (select auth.uid()))))
    ))))
  );

drop policy if exists "authenticated insert own security_events" on public.security_events;
create policy "authenticated insert own security_events" on public.security_events
  as permissive for insert to authenticated
  with check (user_id = (select auth.uid()));
