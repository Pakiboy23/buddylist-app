-- Break RLS recursion on room_memberships SELECT by routing the membership
-- check through a SECURITY DEFINER helper. Also extends room_messages
-- read policy to hide messages from / to blocked users.
-- Imported retroactively from production migrations table.

-- Helper bypasses RLS via SECURITY DEFINER to break the recursion
-- on room_memberships SELECT policy.
CREATE OR REPLACE FUNCTION public.is_room_member(p_room_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_memberships
    WHERE room_id = p_room_id AND user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) TO authenticated;

-- Replace recursive SELECT policy on room_memberships
DROP POLICY IF EXISTS memberships_select_room_members ON public.room_memberships;

CREATE POLICY memberships_select_room_members
ON public.room_memberships
FOR SELECT
TO authenticated
USING (
  public.is_room_member(room_id, auth.uid())
);

-- Replace SELECT policy on room_messages (queried room_memberships, tripping recursion)
DROP POLICY IF EXISTS messages_select_member ON public.room_messages;

CREATE POLICY messages_select_member
ON public.room_messages
FOR SELECT
TO authenticated
USING (
  public.is_room_member(room_id, auth.uid())
  AND (
    user_id = auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.blocked_users bu
      WHERE (bu.blocker_id = auth.uid() AND bu.blocked_id = room_messages.user_id)
         OR (bu.blocker_id = room_messages.user_id AND bu.blocked_id = auth.uid())
    )
  )
);

-- Replace INSERT policy on room_messages (also queried room_memberships)
DROP POLICY IF EXISTS messages_insert_member ON public.room_messages;

CREATE POLICY messages_insert_member
ON public.room_messages
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND public.is_room_member(room_id, auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.rooms r
    WHERE r.id = room_messages.room_id AND r.is_active = true
  )
);
