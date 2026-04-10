-- Social graph for H.I.M. — buddy requests, follows, and blocks.
-- Supports a hybrid B+C model:
--   following : one-way soft follow (see away message / status, no full buddy access)
--   pending   : user_a sent a buddy request to user_b, awaiting acceptance
--   mutual    : full buddies (accepted)
--   blocked   : user_a has blocked user_b
--
-- Canonical ordering: user_a is always the lexicographically lesser UUID.
-- This prevents duplicate rows for the same pair.

begin;

create table if not exists public.user_connections (
  id           uuid        primary key default gen_random_uuid(),
  user_a       uuid        not null references auth.users(id) on delete cascade,
  user_b       uuid        not null references auth.users(id) on delete cascade,
  status       text        not null,
  initiated_by uuid        not null references auth.users(id),
  created_at   timestamptz not null default timezone('utc', now()),
  updated_at   timestamptz not null default timezone('utc', now()),

  constraint user_connections_status_check
    check (status in ('following', 'pending', 'mutual', 'blocked')),
  constraint user_connections_unique_pair
    unique (user_a, user_b),
  constraint user_connections_canonical_order
    check (user_a < user_b),
  constraint user_connections_no_self_connect
    check (user_a <> user_b)
);

create index if not exists user_connections_user_a_idx on public.user_connections (user_a);
create index if not exists user_connections_user_b_idx on public.user_connections (user_b);
create index if not exists user_connections_status_idx  on public.user_connections (status);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists user_connections_set_updated_at on public.user_connections;
create trigger user_connections_set_updated_at
before update on public.user_connections
for each row
execute function public.set_updated_at();

-- Returns the connection status for two users, handling canonical ordering.
-- Returns null if no connection row exists.
create or replace function public.get_connection_status(p_user_id uuid, p_other_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select status
  from public.user_connections
  where (user_a = least(p_user_id, p_other_id)
     and user_b = greatest(p_user_id, p_other_id));
$$;

-- Returns true only if both users share at least one room in room_participants.
-- Enforces the room-gated add rule: you can only send a buddy request to someone
-- you have met in a room.
create or replace function public.can_add_from_room(p_user_id uuid, p_target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.room_participants rp1
    join public.room_participants rp2
      on rp1.room_key = rp2.room_key
    where rp1.user_id = p_user_id
      and rp2.user_id = p_target_id
  );
$$;

-- RLS
alter table public.user_connections enable row level security;

-- SELECT: parties can see their own connection rows.
-- Blocked rows are only visible to the blocker (the one who initiated the block).
drop policy if exists user_connections_select_own on public.user_connections;
create policy user_connections_select_own
on public.user_connections
for select to authenticated
using (
  (auth.uid() = user_a or auth.uid() = user_b)
  and (status <> 'blocked' or initiated_by = auth.uid())
);

-- INSERT: authenticated users, must be a party to the row.
-- For pending/mutual inserts, both users must share a room.
drop policy if exists user_connections_insert_own on public.user_connections;
create policy user_connections_insert_own
on public.user_connections
for insert to authenticated
with check (
  (auth.uid() = user_a or auth.uid() = user_b)
  and (
    status in ('following', 'blocked')
    or public.can_add_from_room(
      auth.uid(),
      case when auth.uid() = user_a then user_b else user_a end
    )
  )
);

-- UPDATE: either party may change to blocked;
-- only the non-initiating user may change pending → mutual.
drop policy if exists user_connections_update_own on public.user_connections;
create policy user_connections_update_own
on public.user_connections
for update to authenticated
using (auth.uid() = user_a or auth.uid() = user_b)
with check (
  -- either party can block
  status = 'blocked'
  -- only the non-initiator can accept a pending request
  or (status = 'mutual' and auth.uid() <> initiated_by)
);

-- No DELETE policy: use blocked status instead.

grant execute on function public.get_connection_status(uuid, uuid) to authenticated;
grant execute on function public.can_add_from_room(uuid, uuid)     to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_connections'
  ) then
    alter publication supabase_realtime add table public.user_connections;
  end if;
end;
$$;

commit;
