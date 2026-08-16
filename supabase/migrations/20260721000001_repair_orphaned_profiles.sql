-- Self-service repair for accounts whose public.users profile row is missing.
--
-- Failure mode in the field: an authenticated account with NO public.users row.
-- Every FK to users(id) then fails for them — buddy requests error with
-- "buddies_user_id_fkey", room joins with "room_memberships_user_id_fkey",
-- they don't appear in fresh search results, and requests sent their way go to
-- nothing. The app's sign-in bootstrap upsert should recreate the row, but it
-- fails forever when an orphaned profile row — typically left behind by a
-- partially-failed account deletion (fixed in #62) and then a re-registration
-- of the same screenname — still holds the screenname/synthetic email under a
-- dead id, tripping unique constraints.
--
-- repair_own_profile():
--   1. no-op if the caller already has a row;
--   2. deletes profile rows matching the caller's email/screenname whose id no
--      longer exists in auth.users (true orphans — data a completed deletion
--      would have removed anyway; live accounts are never touched);
--   3. inserts the caller's row, falling back to a suffixed screenname if a
--      live account genuinely holds the name.
--
-- Abuse note: the caller controls their auth metadata screenname, but step 2
-- only ever deletes rows with no auth.users record — garbage by definition.

begin;

create or replace function public.repair_own_profile()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_screenname text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if exists (select 1 from public.users where id = v_uid) then
    return 'exists';
  end if;

  select
    au.email,
    coalesce(nullif(trim(au.raw_user_meta_data->>'screenname'), ''), split_part(au.email, '@', 1))
  into v_email, v_screenname
  from auth.users au
  where au.id = v_uid;

  if v_email is null then
    raise exception 'No auth record found for caller';
  end if;

  delete from public.users u
  where (lower(u.email) = lower(v_email) or lower(u.screenname) = lower(v_screenname))
    and not exists (select 1 from auth.users au where au.id = u.id);

  begin
    insert into public.users (id, email, screenname, status, is_online)
    values (v_uid, v_email, v_screenname, 'available', false)
    on conflict (id) do nothing;
  exception
    when unique_violation then
      insert into public.users (id, email, screenname, status, is_online)
      values (
        v_uid,
        v_email,
        v_screenname || '-' || left(replace(v_uid::text, '-', ''), 4),
        'available',
        false
      )
      on conflict (id) do nothing;
  end;

  return 'repaired';
end;
$$;

revoke all on function public.repair_own_profile() from public;
grant execute on function public.repair_own_profile() to authenticated;

commit;
