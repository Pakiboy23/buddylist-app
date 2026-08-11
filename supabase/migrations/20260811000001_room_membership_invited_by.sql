-- GH-14: make Loop 3 (buddy pulls buddy into a room) measurable.
-- Invite-joins and self-joins write identical room_memberships rows today,
-- so the invite loop is invisible in SQL (growth-plan §Loop 3 measurement
-- gap). Stamp invite-joins with the inviter; everything else stays NULL.

alter table public.room_memberships
  add column invited_by uuid null references public.users(id) on delete set null;

comment on column public.room_memberships.invited_by is
  'Set only by rooms-invite Edge Function when a buddy is pulled into a room. NULL = self-join or legacy.';
