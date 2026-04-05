-- Trust and safety slice:
-- - block list
-- - abuse reports
-- - prevent buddy requests and DMs between blocked users
-- Run after gtm_plan.sql and private_chat_foundation.sql.

begin;

create extension if not exists pgcrypto;

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  reason text null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id),
  constraint blocked_users_reason_check
    check (reason is null or char_length(trim(reason)) between 1 and 240)
);

create index if not exists blocked_users_blocked_idx
  on public.blocked_users (blocked_id, created_at desc);

alter table public.blocked_users enable row level security;

drop policy if exists blocked_users_select_own on public.blocked_users;
create policy blocked_users_select_own
on public.blocked_users
for select
to authenticated
using (auth.uid() = blocker_id);

drop policy if exists blocked_users_insert_own on public.blocked_users;
create policy blocked_users_insert_own
on public.blocked_users
for insert
to authenticated
with check (auth.uid() = blocker_id);

drop policy if exists blocked_users_delete_own on public.blocked_users;
create policy blocked_users_delete_own
on public.blocked_users
for delete
to authenticated
using (auth.uid() = blocker_id);

create table if not exists public.abuse_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_user_id uuid not null references public.users(id) on delete cascade,
  source_message_id bigint null references public.messages(id) on delete set null,
  category text not null,
  details text null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint abuse_reports_not_self check (reporter_id <> target_user_id),
  constraint abuse_reports_category_check
    check (category in ('harassment', 'spam', 'impersonation', 'self_harm', 'other')),
  constraint abuse_reports_details_check
    check (details is null or char_length(trim(details)) between 1 and 1200)
);

create index if not exists abuse_reports_reporter_created_idx
  on public.abuse_reports (reporter_id, created_at desc);

create index if not exists abuse_reports_target_created_idx
  on public.abuse_reports (target_user_id, created_at desc);

alter table public.abuse_reports enable row level security;

drop policy if exists abuse_reports_select_own on public.abuse_reports;
create policy abuse_reports_select_own
on public.abuse_reports
for select
to authenticated
using (auth.uid() = reporter_id);

drop policy if exists abuse_reports_insert_own on public.abuse_reports;
create policy abuse_reports_insert_own
on public.abuse_reports
for insert
to authenticated
with check (auth.uid() = reporter_id);

drop policy if exists buddies_insert_own_or_related on public.buddies;
create policy buddies_insert_own_or_related
on public.buddies
for insert
to authenticated
with check (
  (auth.uid() = user_id or auth.uid() = buddy_id)
  and user_id <> buddy_id
  and not exists (
    select 1
    from public.blocked_users bu
    where (bu.blocker_id = user_id and bu.blocked_id = buddy_id)
       or (bu.blocker_id = buddy_id and bu.blocked_id = user_id)
  )
);

drop policy if exists buddies_update_own_or_related on public.buddies;
create policy buddies_update_own_or_related
on public.buddies
for update
to authenticated
using (auth.uid() = user_id or auth.uid() = buddy_id)
with check (
  (auth.uid() = user_id or auth.uid() = buddy_id)
  and user_id <> buddy_id
  and not exists (
    select 1
    from public.blocked_users bu
    where (bu.blocker_id = user_id and bu.blocked_id = buddy_id)
       or (bu.blocker_id = buddy_id and bu.blocked_id = user_id)
  )
);

drop policy if exists messages_insert_participants on public.messages;
create policy messages_insert_participants
on public.messages
for insert
to authenticated
with check (
  auth.uid() = sender_id
  and sender_id <> receiver_id
  and not exists (
    select 1
    from public.blocked_users bu
    where (bu.blocker_id = sender_id and bu.blocked_id = receiver_id)
       or (bu.blocker_id = receiver_id and bu.blocked_id = sender_id)
  )
);

commit;
