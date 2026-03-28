-- Push notification device tokens for BuddyList.
-- Run after gtm_plan.sql so public.set_updated_at() is available.

begin;

create table if not exists public.user_push_tokens (
  user_id uuid not null references public.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  last_registered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, token)
);

create index if not exists user_push_tokens_user_idx
  on public.user_push_tokens (user_id);

create index if not exists user_push_tokens_last_registered_idx
  on public.user_push_tokens (last_registered_at desc);

drop trigger if exists user_push_tokens_set_updated_at on public.user_push_tokens;
create trigger user_push_tokens_set_updated_at
before update on public.user_push_tokens
for each row
execute function public.set_updated_at();

alter table public.user_push_tokens enable row level security;

drop policy if exists user_push_tokens_select_own on public.user_push_tokens;
create policy user_push_tokens_select_own
on public.user_push_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_push_tokens_insert_own on public.user_push_tokens;
create policy user_push_tokens_insert_own
on public.user_push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_push_tokens_update_own on public.user_push_tokens;
create policy user_push_tokens_update_own
on public.user_push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_push_tokens_delete_own on public.user_push_tokens;
create policy user_push_tokens_delete_own
on public.user_push_tokens
for delete
to authenticated
using (auth.uid() = user_id);

commit;
