-- Persistent DM unread state for cross-device consistency.
-- Run this after gtm_plan.sql.

begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.user_dm_state (
  user_id uuid not null references public.users(id) on delete cascade,
  buddy_id uuid not null references public.users(id) on delete cascade,
  unread_count int not null default 0 check (unread_count >= 0),
  last_read_at timestamptz null,
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, buddy_id),
  constraint user_dm_state_not_self check (user_id <> buddy_id)
);

create index if not exists user_dm_state_user_updated_idx
  on public.user_dm_state (user_id, updated_at desc);

create index if not exists user_dm_state_user_unread_idx
  on public.user_dm_state (user_id, unread_count)
  where unread_count > 0;

drop trigger if exists user_dm_state_set_updated_at on public.user_dm_state;
create trigger user_dm_state_set_updated_at
before update on public.user_dm_state
for each row
execute function public.set_updated_at();

alter table public.user_dm_state enable row level security;

drop policy if exists user_dm_state_select_own on public.user_dm_state;
create policy user_dm_state_select_own
on public.user_dm_state
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_dm_state_insert_own on public.user_dm_state;
create policy user_dm_state_insert_own
on public.user_dm_state
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_dm_state_update_own on public.user_dm_state;
create policy user_dm_state_update_own
on public.user_dm_state
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_dm_state_delete_own on public.user_dm_state;
create policy user_dm_state_delete_own
on public.user_dm_state
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.bump_dm_unread(p_buddy_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_buddy_id is null or p_buddy_id = v_user_id then
    return;
  end if;

  insert into public.user_dm_state (user_id, buddy_id, unread_count, updated_at)
  values (v_user_id, p_buddy_id, 1, timezone('utc', now()))
  on conflict (user_id, buddy_id) do update
  set unread_count = public.user_dm_state.unread_count + 1,
      updated_at = timezone('utc', now());
end;
$$;

create or replace function public.clear_dm_unread(p_buddy_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_buddy_id is null or p_buddy_id = v_user_id then
    return;
  end if;

  update public.user_dm_state
  set unread_count = 0,
      last_read_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = v_user_id
    and buddy_id = p_buddy_id;
end;
$$;

create or replace function public.handle_message_insert_dm_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.receiver_id is null or new.sender_id is null or new.receiver_id = new.sender_id then
    return new;
  end if;

  insert into public.user_dm_state (user_id, buddy_id, unread_count, updated_at)
  values (new.receiver_id, new.sender_id, 1, timezone('utc', now()))
  on conflict (user_id, buddy_id) do update
  set unread_count = public.user_dm_state.unread_count + 1,
      updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists messages_sync_dm_state on public.messages;
create trigger messages_sync_dm_state
after insert on public.messages
for each row
execute function public.handle_message_insert_dm_state();

revoke all on function public.bump_dm_unread(uuid) from public;
revoke all on function public.clear_dm_unread(uuid) from public;
grant execute on function public.bump_dm_unread(uuid) to authenticated;
grant execute on function public.clear_dm_unread(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_dm_state'
  ) then
    alter publication supabase_realtime add table public.user_dm_state;
  end if;
end;
$$;

commit;
