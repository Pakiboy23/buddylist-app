-- Supabase's function defaults granted EXECUTE directly to anon when
-- repair_own_profile() was created. Revoking from PUBLIC alone therefore did
-- not remove anonymous access. The function is a signed-in self-repair path
-- and already validates auth.uid(), so make its database grants match that
-- contract explicitly.

begin;

revoke execute on function public.repair_own_profile() from anon;
revoke execute on function public.repair_own_profile() from public;
grant execute on function public.repair_own_profile() to authenticated;

commit;
