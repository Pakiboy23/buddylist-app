-- Buddy Circles — private, owner-only groups for organizing one's buddy list.
--
-- A circle is a personal label (AIM's Family / Work / Besties). Circles and their
-- membership are visible ONLY to the owner; the buddy filed into a circle never
-- learns which circle (or that any circle exists). A buddy is filed in at most one
-- circle per owner; buddies with no membership row render under an implicit
-- "Ungrouped" section on the client.
--
-- Each circle also carries two OWNER-SIDE controls (they change only the owner's
-- own experience, never what buddies see of the owner):
--   * show_presence — when false, the owner's list stops surfacing live presence
--     for that circle (muted dot, excluded from the online split, no presence SFX).
--   * notify_mode   — 'muted' suppresses in-app DM alerts (sound/toast/unread
--     emphasis) from that circle. Background push is NOT suppressed here — that
--     would require a push-dispatch membership check (deliberately out of scope).
--
-- FKs target public.users(id) to match public.buddies exactly, so account deletion
-- of either party cascades circles/memberships away automatically.

begin;

create table if not exists public.buddy_circles (
  id          uuid        primary key default gen_random_uuid(),
  owner_id    uuid        not null references public.users(id) on delete cascade,
  name        text        not null check (char_length(trim(name)) between 1 and 40),
  position    integer     not null default 0,
  -- owner-side controls; defaults preserve today's behavior for every buddy
  show_presence boolean   not null default true,
  notify_mode text        not null default 'all'
    check (notify_mode in ('all', 'muted')),
  created_at  timestamptz not null default timezone('utc', now()),
  updated_at  timestamptz not null default timezone('utc', now()),
  constraint buddy_circles_owner_name_unique unique (owner_id, name)
);

create index if not exists buddy_circles_owner_idx
  on public.buddy_circles (owner_id, position);

create table if not exists public.buddy_circle_members (
  circle_id  uuid        not null references public.buddy_circles(id) on delete cascade,
  owner_id   uuid        not null references public.users(id) on delete cascade,
  buddy_id   uuid        not null references public.users(id) on delete cascade,
  added_at   timestamptz not null default timezone('utc', now()),
  -- one circle per buddy per owner; "move" = update circle_id on conflict
  primary key (owner_id, buddy_id),
  constraint buddy_circle_members_not_self check (owner_id <> buddy_id)
);

create index if not exists buddy_circle_members_circle_idx
  on public.buddy_circle_members (circle_id);

-- Reuses the shared trigger fn defined in 20260410000018_user_connections.sql.
drop trigger if exists buddy_circles_set_updated_at on public.buddy_circles;
create trigger buddy_circles_set_updated_at
before update on public.buddy_circles
for each row execute function public.set_updated_at();

-- Integrity: a membership's circle must belong to the same owner, and the target
-- must be an accepted buddy of the owner. Done in a BEFORE trigger because RLS
-- WITH CHECK can't cleanly cross-check circle ownership + buddy status together.
create or replace function public.enforce_buddy_circle_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.buddy_circles c
    where c.id = new.circle_id
      and c.owner_id = new.owner_id
  ) then
    raise exception 'CIRCLE_OWNER_MISMATCH: That circle does not belong to you.'
      using errcode = 'PT403', hint = 'CIRCLE_OWNER_MISMATCH';
  end if;

  if not exists (
    select 1
    from public.buddies b
    where b.status = 'accepted'
      and (
        (b.user_id = new.owner_id and b.buddy_id = new.buddy_id)
        or (b.user_id = new.buddy_id and b.buddy_id = new.owner_id)
      )
  ) then
    raise exception 'CIRCLE_MEMBER_NOT_BUDDY: You can only add an accepted buddy to a circle.'
      using errcode = 'PT403', hint = 'CIRCLE_MEMBER_NOT_BUDDY';
  end if;

  return new;
end;
$$;

comment on function public.enforce_buddy_circle_member() is
  'Guards buddy_circle_members: circle must belong to the owner and the target must be an accepted buddy.';

revoke all on function public.enforce_buddy_circle_member() from public, anon, authenticated;

drop trigger if exists buddy_circle_members_enforce on public.buddy_circle_members;
create trigger buddy_circle_members_enforce
before insert or update on public.buddy_circle_members
for each row execute function public.enforce_buddy_circle_member();

-- RLS: strictly owner-private on both tables. No anon access.
alter table public.buddy_circles        enable row level security;
alter table public.buddy_circle_members enable row level security;

drop policy if exists buddy_circles_owner_all on public.buddy_circles;
create policy buddy_circles_owner_all
on public.buddy_circles
for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

drop policy if exists buddy_circle_members_owner_all on public.buddy_circle_members;
create policy buddy_circle_members_owner_all
on public.buddy_circle_members
for all
to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on public.buddy_circles        to authenticated;
grant select, insert, update, delete on public.buddy_circle_members to authenticated;

-- Cross-device sync for the owner (RLS still applies to realtime).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'buddy_circles'
  ) then
    alter publication supabase_realtime add table public.buddy_circles;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'buddy_circle_members'
  ) then
    alter publication supabase_realtime add table public.buddy_circle_members;
  end if;
end;
$$;

commit;
