-- Switch the join/leave flow to SECURITY DEFINER RPCs that take p_room_id and
-- derive the user from auth.uid() server-side. Bypasses the RLS WITH CHECK
-- failure on room_memberships INSERT we've been hitting on web + iOS.
-- Imported retroactively from production migrations table.

CREATE OR REPLACE FUNCTION public.join_room_by_id(p_room_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
  v_room_active boolean;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT is_active INTO v_room_active FROM public.rooms WHERE id = p_room_id;
  IF v_room_active IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'room_not_found');
  END IF;
  IF NOT v_room_active THEN
    RETURN json_build_object('ok', false, 'error', 'room_inactive');
  END IF;

  INSERT INTO public.room_memberships (room_id, user_id, last_seen_at)
  VALUES (p_room_id, v_uid, now())
  ON CONFLICT (room_id, user_id)
  DO UPDATE SET last_seen_at = EXCLUDED.last_seen_at;

  RETURN json_build_object('ok', true, 'user_id', v_uid::text);
END;
$$;

REVOKE ALL ON FUNCTION public.join_room_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_room_by_id(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.leave_room_by_id(p_room_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  DELETE FROM public.room_memberships
  WHERE room_id = p_room_id AND user_id = v_uid;

  RETURN json_build_object('ok', true, 'user_id', v_uid::text);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_room_by_id(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.leave_room_by_id(uuid) TO authenticated;

-- Diagnostic RPC. Will be removed after we confirm the join flow works.
CREATE OR REPLACE FUNCTION public.debug_auth()
RETURNS json
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT json_build_object(
    'uid', auth.uid()::text,
    'role', auth.role(),
    'jwt_sub', current_setting('request.jwt.claim.sub', true),
    'has_jwt_claims', current_setting('request.jwt.claims', true) IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION public.debug_auth() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.debug_auth() TO authenticated, anon;
