-- One device token belongs to one account.
--
-- user_push_tokens is keyed (user_id, token), so the same device token could be
-- registered under any number of accounts and nothing removed the old rows when
-- a device switched accounts. push-dispatch resolves tokens by recipient, so a
-- notification for the account that used to be signed in on a device was
-- delivered to whoever is signed in on it now — including the message preview.
--
-- Verified 2026-09-01: token …502B3D was live under three accounts
-- (sk8erboii24 from Jul 9, sk8erboii2 from Jul 24, Pakiboy24 from Jul 24).
--
-- Fixed in the database rather than in the client so it holds for every caller
-- and for rows already written.

-- 1. Going forward: registering a token claims it exclusively.
create or replace function public.claim_push_token_for_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Serialize claims on this token. Without it two devices registering the
  -- same token concurrently each delete rows the other has not committed yet,
  -- both inserts succeed, and the duplicate ownership this migration exists to
  -- remove comes straight back. The lock is transaction-scoped, so the second
  -- claim waits, then sees and clears the first.
  perform pg_advisory_xact_lock(hashtextextended(new.token, 0));

  -- SECURITY DEFINER because the RLS delete policy only lets a caller remove
  -- their own rows, and the row being cleared here belongs to someone else.
  delete from public.user_push_tokens
   where token = new.token
     and user_id <> new.user_id;
  return new;
end;
$$;

revoke all on function public.claim_push_token_for_user() from public;
revoke all on function public.claim_push_token_for_user() from anon, authenticated;

drop trigger if exists user_push_tokens_claim_token on public.user_push_tokens;
create trigger user_push_tokens_claim_token
  before insert on public.user_push_tokens
  for each row execute function public.claim_push_token_for_user();

-- 2. Existing duplicates: keep the most recent registration for each token and
--    drop the rest. A device can only be signed into one account, so the older
--    rows are precisely the ones that would misdeliver.
delete from public.user_push_tokens t
 using public.user_push_tokens newer
 where t.token = newer.token
   and t.user_id <> newer.user_id
   and (newer.last_registered_at, newer.user_id) > (t.last_registered_at, t.user_id);

-- 3. The backstop. The lock above orders concurrent claims; this makes a second
--    owner impossible to store at all, whatever writes it. Created after the
--    cleanup, which is what makes the column unique in the first place.
create unique index if not exists user_push_tokens_token_key
  on public.user_push_tokens (token);

comment on index public.user_push_tokens_token_key is
  'One device token, one account. Paired with claim_push_token_for_user(), which clears the previous owner before insert.';

comment on function public.claim_push_token_for_user() is
  'Makes a device token exclusive to the account registering it, so a push is never delivered to an account that no longer owns the device.';
