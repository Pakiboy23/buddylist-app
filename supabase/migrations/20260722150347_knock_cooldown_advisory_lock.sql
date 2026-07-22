-- Close a TOCTOU race in the Knock cooldown (from 20260722114338).
--
-- The old trigger did a check-then-insert: `if exists (recent knock) then reject`
-- followed by the insert. Two concurrent Knock inserts for the same sender ->
-- receiver could both run the trigger before either committed, both see no recent
-- knock, and both succeed — bypassing the 10-minute rate limit.
--
-- Fix: take a per-pair transaction-scoped advisory lock BEFORE the cooldown check.
-- The second concurrent insert blocks until the first commits, then (READ COMMITTED)
-- its recheck sees the committed knock and is correctly rejected. Everything else in
-- the function is unchanged.

begin;

create or replace function public.enforce_knock_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.preview_type is distinct from 'knock' then
    return new;
  end if;

  -- Serialize concurrent knocks for this ordered sender/receiver pair so the
  -- cooldown check below cannot be bypassed by two simultaneous inserts.
  perform pg_advisory_xact_lock(
    hashtextextended(new.sender_id::text || ':' || new.receiver_id::text, 0)
  );

  if not exists (
    select 1
    from public.buddies b
    where b.status = 'accepted'
      and (
        (b.user_id = new.sender_id and b.buddy_id = new.receiver_id)
        or (b.user_id = new.receiver_id and b.buddy_id = new.sender_id)
      )
  ) then
    raise exception 'KNOCK_BUDDIES_ONLY: You can only knock on a buddy.'
      using errcode = 'PT403', hint = 'KNOCK_BUDDIES_ONLY';
  end if;

  if exists (
    select 1
    from public.messages m
    where m.sender_id = new.sender_id
      and m.receiver_id = new.receiver_id
      and m.preview_type = 'knock'
      and m.created_at > now() - interval '10 minutes'
  ) then
    raise exception 'KNOCK_COOLDOWN: Give them a little time before knocking again.'
      using errcode = 'PT429', hint = 'KNOCK_COOLDOWN';
  end if;

  new.content := '👋 Knock';
  return new;
end;
$$;

comment on function public.enforce_knock_rules() is
  'Restricts Knock messages to accepted buddies and one Knock per sender-recipient pair every 10 minutes (per-pair advisory lock serializes the cooldown check).';

revoke all on function public.enforce_knock_rules() from public, anon, authenticated;

commit;
