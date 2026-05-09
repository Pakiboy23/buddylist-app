-- Block/report feature completion:
-- - Add status + notes columns to abuse_reports
-- - Allow admins to query all reports
-- - Tighten room_messages SELECT to filter blocked-user messages

begin;

-- 1. Add status column to abuse_reports
alter table public.abuse_reports
  add column if not exists status text not null default 'open';

alter table public.abuse_reports
  drop constraint if exists abuse_reports_status_check;
alter table public.abuse_reports
  add constraint abuse_reports_status_check
  check (status in ('open', 'reviewed', 'dismissed', 'actioned'));

-- 2. Add admin-facing notes column to abuse_reports
alter table public.abuse_reports
  add column if not exists notes text null;

-- 3. Update abuse_reports SELECT policy — reporters see own, admins see all
drop policy if exists abuse_reports_select_own on public.abuse_reports;
create policy abuse_reports_select_own
on public.abuse_reports
for select
to authenticated
using (
  auth.uid() = reporter_id
  or auth.uid() in (select user_id from public.admin_users)
);

-- 4. Tighten room_messages SELECT: existing membership check + block filter (bidirectional)
drop policy if exists messages_select_member on public.room_messages;
create policy messages_select_member
on public.room_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.room_memberships rm
    where rm.room_id = room_messages.room_id
      and rm.user_id = auth.uid()
  )
  and (
    room_messages.user_id = auth.uid()
    or not exists (
      select 1
      from public.blocked_users bu
      where (bu.blocker_id = auth.uid()               and bu.blocked_id  = room_messages.user_id)
         or (bu.blocker_id = room_messages.user_id    and bu.blocked_id  = auth.uid())
    )
  )
);

commit;
