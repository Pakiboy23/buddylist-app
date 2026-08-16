-- Rate-limit Buzz, matching the Knock hardening.
--
-- The buzz preview_type (added in 20260722114338) drives a full-screen flash +
-- haptic + sound + push on the recipient, but unlike Knock it had NO cooldown,
-- so a buddy could rapid-fire buzzes to flood/harass a recipient with no server
-- ceiling. This adds a per-pair cooldown mirroring enforce_knock_rules,
-- including the same transaction-scoped advisory lock that closes the
-- check-then-insert TOCTOU race. Buzz stays usable inside an open DM (no
-- buddies-only restriction, unlike Knock) — only the flood rate is capped.

begin;

create or replace function public.enforce_buzz_rules()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.preview_type is distinct from 'buzz' then
    return new;
  end if;

  -- Serialize concurrent buzzes for this ordered sender/receiver pair so the
  -- cooldown check cannot be bypassed by two simultaneous inserts. A distinct
  -- 'buzz:' namespace keeps this lock separate from the Knock lock.
  perform pg_advisory_xact_lock(
    hashtextextended('buzz:' || new.sender_id::text || ':' || new.receiver_id::text, 0)
  );

  if exists (
    select 1
    from public.messages m
    where m.sender_id = new.sender_id
      and m.receiver_id = new.receiver_id
      and m.preview_type = 'buzz'
      and m.created_at > now() - interval '30 seconds'
  ) then
    raise exception 'BUZZ_COOLDOWN: Give them a moment before buzzing again.'
      using errcode = 'PT429', hint = 'BUZZ_COOLDOWN';
  end if;

  new.content := '⚡ Buzz!';
  return new;
end;
$$;

comment on function public.enforce_buzz_rules() is
  'Caps Buzz to one per sender-recipient pair every 30 seconds (per-pair advisory lock serializes the cooldown check).';

revoke all on function public.enforce_buzz_rules() from public, anon, authenticated;

drop trigger if exists messages_enforce_buzz_rules on public.messages;
create trigger messages_enforce_buzz_rules
before insert on public.messages
for each row execute function public.enforce_buzz_rules();

commit;
