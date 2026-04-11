-- Connection event helper RPCs
-- In-app banners for connection events (follow, buddy request, mutual) are handled
-- client-side via the Supabase realtime subscription in GlobalNotificationListener.tsx.
-- Push notifications for connection events require a separate Edge Function + pg_net;
-- that is out of scope here. These two RPCs let the client accept or decline a pending
-- buddy request without needing to know the canonical (user_a < user_b) ordering.

CREATE OR REPLACE FUNCTION accept_buddy_request(p_other_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_a uuid := LEAST(auth.uid(), p_other_id);
  v_user_b uuid := GREATEST(auth.uid(), p_other_id);
BEGIN
  UPDATE user_connections
     SET status     = 'mutual',
         updated_at = now()
   WHERE user_a       = v_user_a
     AND user_b       = v_user_b
     AND status       = 'pending'
     AND initiated_by = p_other_id;  -- only the recipient (non-initiator) may accept
END;
$$;

CREATE OR REPLACE FUNCTION decline_buddy_request(p_other_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_user_a uuid := LEAST(auth.uid(), p_other_id);
  v_user_b uuid := GREATEST(auth.uid(), p_other_id);
BEGIN
  DELETE FROM user_connections
   WHERE user_a       = v_user_a
     AND user_b       = v_user_b
     AND status       = 'pending'
     AND initiated_by = p_other_id;  -- only the recipient (non-initiator) may decline
END;
$$;

GRANT EXECUTE ON FUNCTION accept_buddy_request(uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION decline_buddy_request(uuid) TO authenticated;
