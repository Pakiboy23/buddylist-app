-- GH-14: make Loop 3 (buddy pulls buddy into a room) measurable.
-- Invite-joins and self-joins write identical room_memberships rows today,
-- so the invite loop is invisible in SQL (growth-plan §Loop 3 measurement
-- gap). Stamp invite-joins with the inviter; everything else stays NULL.

alter table public.room_memberships
  add column invited_by uuid null references public.users(id) on delete set null;

comment on column public.room_memberships.invited_by is
  'Set only by rooms-invite Edge Function when a buddy is pulled into a room. NULL = self-join or legacy.';

-- Enforce the "set only by the Edge Function" contract at the database.
-- The existing memberships_insert_own / memberships_update_own policies only
-- check user_id = auth.uid(), and RLS has no column-level control — without
-- this guard a client could self-join with a forged invited_by, or mutate it
-- on its own row, making the GH-14 metric unreliable. Service-role writes
-- (the Edge Function's admin client) and owner-run SECURITY DEFINER RPCs
-- pass through; client writes get invited_by forced to NULL on INSERT and
-- preserved from OLD on UPDATE (so last_seen_at heartbeats are unaffected).
create or replace function public.protect_room_membership_invited_by()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin')
     or coalesce(auth.role(), '') = 'service_role' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.invited_by := null;
  else
    new.invited_by := old.invited_by;
  end if;
  return new;
end;
$$;

create trigger room_membership_protect_invited_by
  before insert or update on public.room_memberships
  for each row execute function public.protect_room_membership_invited_by();
