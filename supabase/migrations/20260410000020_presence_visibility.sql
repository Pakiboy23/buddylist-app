-- Presence visibility gating for the following/mutual social graph.
-- can_see_presence(viewer_id, subject_id) is the authoritative check used by
-- the application layer to gate away message and presence rendering.
--
-- Rules:
--   viewer == subject       → always visible (own data)
--   mutual connection       → full visibility
--   viewer follows subject  → viewer can see subject's presence + away message
--   no connection           → not visible
--
-- Note: PostgreSQL RLS is row-level; column-level visibility is enforced in
-- the application layer via this function + the useConnectionStatus hook.

begin;

create or replace function public.can_see_presence(viewer_id uuid, subject_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Own data is always visible
    viewer_id = subject_id
    -- Mutual buddies have full visibility
    or exists (
      select 1 from public.user_connections
      where user_a = least(viewer_id, subject_id)
        and user_b = greatest(viewer_id, subject_id)
        and status = 'mutual'
    )
    -- Viewer follows subject: viewer sees subject's presence (one-way)
    or exists (
      select 1 from public.user_connections
      where user_a = least(viewer_id, subject_id)
        and user_b = greatest(viewer_id, subject_id)
        and status = 'following'
        and initiated_by = viewer_id
    );
$$;

grant execute on function public.can_see_presence(uuid, uuid) to authenticated;

commit;
