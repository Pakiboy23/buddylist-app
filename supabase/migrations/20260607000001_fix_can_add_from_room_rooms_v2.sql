-- Fix can_add_from_room for rooms v2.
--
-- The function still referenced public.room_participants (the rooms v1 table),
-- which was renamed to _archive_room_participants in
-- 20260509184623_rooms_v2_launch_schema.sql and no longer exists in the public
-- schema. Verified live: public.room_participants is absent; only
-- _archive_room_participants remains. As a result every "add a buddy from a
-- shared room" path errored at runtime (this function gates the user_connections
-- INSERT RLS policy), and users were shown the unsatisfiable hint
-- "Join a room with them first".
--
-- Rewrite it against the rooms v2 membership table, public.room_memberships
-- (columns room_id, user_id, joined_at, last_seen_at), keeping the same
-- signature, volatility (STABLE), SECURITY DEFINER, and search_path semantics.
-- Two users may add each other when they share at least one room_id.

create or replace function public.can_add_from_room(p_user_id uuid, p_target_id uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $function$
  select exists (
    select 1
    from public.room_memberships rm1
    join public.room_memberships rm2
      on rm1.room_id = rm2.room_id
    where rm1.user_id = p_user_id
      and rm2.user_id = p_target_id
  );
$function$;
