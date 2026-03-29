-- Private-chat foundation schema:
-- - DM delivery/read metadata
-- - reply + forward metadata
-- - saved messages
-- - per-conversation preferences
-- - privacy settings for read receipts + notification previews
-- Run after gtm_plan.sql, dm_state.sql, chat_media.sql, and message_idempotency.sql.

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

alter table public.messages
  add column if not exists delivered_at timestamptz null,
  add column if not exists read_at timestamptz null,
  add column if not exists reply_to_message_id bigint null references public.messages(id) on delete set null,
  add column if not exists forward_source_message_id bigint null references public.messages(id) on delete set null,
  add column if not exists forward_source_sender_id uuid null references public.users(id) on delete set null,
  add column if not exists expires_at timestamptz null,
  add column if not exists preview_type text not null default 'text';

alter table public.messages
  alter column delivered_at set default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'messages_preview_type_check'
      and conrelid = 'public.messages'::regclass
  ) then
    alter table public.messages
      add constraint messages_preview_type_check
      check (preview_type in ('text', 'attachment', 'forwarded', 'voice_note'))
      not valid;
  end if;
end;
$$;

alter table public.messages
  validate constraint messages_preview_type_check;

update public.messages
set delivered_at = coalesce(delivered_at, created_at)
where delivered_at is null;

create index if not exists messages_sender_receiver_read_idx
  on public.messages (sender_id, receiver_id, read_at, created_at desc);

create table if not exists public.user_dm_preferences (
  user_id uuid not null references public.users(id) on delete cascade,
  buddy_id uuid not null references public.users(id) on delete cascade,
  is_pinned boolean not null default false,
  is_muted boolean not null default false,
  is_archived boolean not null default false,
  theme_key text null,
  wallpaper_key text null,
  disappearing_timer_seconds int null check (disappearing_timer_seconds is null or disappearing_timer_seconds > 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, buddy_id),
  constraint user_dm_preferences_not_self check (user_id <> buddy_id)
);

create index if not exists user_dm_preferences_user_pinned_idx
  on public.user_dm_preferences (user_id, is_pinned, updated_at desc);

create index if not exists user_dm_preferences_user_archived_idx
  on public.user_dm_preferences (user_id, is_archived, updated_at desc);

drop trigger if exists user_dm_preferences_set_updated_at on public.user_dm_preferences;
create trigger user_dm_preferences_set_updated_at
before update on public.user_dm_preferences
for each row
execute function public.set_updated_at();

alter table public.user_dm_preferences enable row level security;

drop policy if exists user_dm_preferences_select_own on public.user_dm_preferences;
create policy user_dm_preferences_select_own
on public.user_dm_preferences
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_dm_preferences_insert_own on public.user_dm_preferences;
create policy user_dm_preferences_insert_own
on public.user_dm_preferences
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_dm_preferences_update_own on public.user_dm_preferences;
create policy user_dm_preferences_update_own
on public.user_dm_preferences
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_dm_preferences_delete_own on public.user_dm_preferences;
create policy user_dm_preferences_delete_own
on public.user_dm_preferences
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.user_privacy_settings (
  user_id uuid primary key references public.users(id) on delete cascade,
  share_read_receipts boolean not null default true,
  notification_preview_mode text not null default 'full',
  screen_shield_enabled boolean not null default false,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_privacy_settings_notification_preview_check
    check (notification_preview_mode in ('full', 'name_only', 'hidden'))
);

drop trigger if exists user_privacy_settings_set_updated_at on public.user_privacy_settings;
create trigger user_privacy_settings_set_updated_at
before update on public.user_privacy_settings
for each row
execute function public.set_updated_at();

alter table public.user_privacy_settings enable row level security;

drop policy if exists user_privacy_settings_select_own on public.user_privacy_settings;
create policy user_privacy_settings_select_own
on public.user_privacy_settings
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_privacy_settings_insert_own on public.user_privacy_settings;
create policy user_privacy_settings_insert_own
on public.user_privacy_settings
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists user_privacy_settings_update_own on public.user_privacy_settings;
create policy user_privacy_settings_update_own
on public.user_privacy_settings
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists user_privacy_settings_delete_own on public.user_privacy_settings;
create policy user_privacy_settings_delete_own
on public.user_privacy_settings
for delete
to authenticated
using (auth.uid() = user_id);

create table if not exists public.saved_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 4000),
  source_message_id bigint null references public.messages(id) on delete set null,
  source_sender_id uuid null references public.users(id) on delete set null,
  source_screenname text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists saved_messages_user_created_idx
  on public.saved_messages (user_id, created_at desc);

drop trigger if exists saved_messages_set_updated_at on public.saved_messages;
create trigger saved_messages_set_updated_at
before update on public.saved_messages
for each row
execute function public.set_updated_at();

alter table public.saved_messages enable row level security;

drop policy if exists saved_messages_select_own on public.saved_messages;
create policy saved_messages_select_own
on public.saved_messages
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists saved_messages_insert_own on public.saved_messages;
create policy saved_messages_insert_own
on public.saved_messages
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists saved_messages_update_own on public.saved_messages;
create policy saved_messages_update_own
on public.saved_messages
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists saved_messages_delete_own on public.saved_messages;
create policy saved_messages_delete_own
on public.saved_messages
for delete
to authenticated
using (auth.uid() = user_id);

create or replace function public.clear_dm_unread(p_buddy_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_share_read_receipts boolean := true;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_buddy_id is null or p_buddy_id = v_user_id then
    return;
  end if;

  select coalesce(share_read_receipts, true)
  into v_share_read_receipts
  from public.user_privacy_settings
  where user_id = v_user_id;

  update public.user_dm_state
  set unread_count = 0,
      last_read_at = timezone('utc', now()),
      updated_at = timezone('utc', now())
  where user_id = v_user_id
    and buddy_id = p_buddy_id;

  update public.messages
  set delivered_at = coalesce(delivered_at, timezone('utc', now())),
      read_at = case
        when v_share_read_receipts then coalesce(read_at, timezone('utc', now()))
        else read_at
      end
  where sender_id = p_buddy_id
    and receiver_id = v_user_id
    and deleted_at is null
    and (
      delivered_at is null
      or (v_share_read_receipts and read_at is null)
    );
end;
$$;

revoke all on function public.clear_dm_unread(uuid) from public;
grant execute on function public.clear_dm_unread(uuid) to authenticated;

commit;
