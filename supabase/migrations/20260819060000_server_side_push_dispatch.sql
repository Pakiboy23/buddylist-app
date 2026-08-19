-- Server-side push dispatch.
--
-- Push was dispatched ONLY from the client, immediately after a send
-- (src/lib/pushDispatch.ts). Anything written to Postgres directly — the
-- founder engine's welcome DMs, buddy-request nudges and daily room prompts —
-- therefore arrived completely silently: no client was awake to announce it.
-- Verified 2026-08-19: push-dispatch had zero invocations in 24h while 14
-- automated DMs and 3 room prompts were delivered.
--
-- This adds the missing half: an AFTER INSERT trigger that calls push-dispatch
-- over pg_net for server-side inserts only. Client inserts still dispatch from
-- the client, so nothing double-fires — auth.uid() is the discriminator (NULL
-- for service-role/SQL inserts, populated for PostgREST calls from a session).

-- 1. Shared secret the trigger presents to the Edge Function. Generated here,
--    stored encrypted in Vault, never in the repo. Created only if absent so
--    re-running this migration cannot rotate it out from under the function.
do $$
declare
  v_url text := 'https://keckqpadzxwwmagnmpuk.supabase.co/functions/v1';
begin
  if not exists (select 1 from vault.secrets where name = 'push_fanout_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'push_fanout_secret',
      'Shared secret authenticating server-side push dispatch (DB trigger -> push-dispatch Edge Function).'
    );
  end if;
  if not exists (select 1 from vault.secrets where name = 'edge_functions_base_url') then
    perform vault.create_secret(v_url, 'edge_functions_base_url', 'Base URL for this project''s Edge Functions.');
  end if;
end $$;

-- 2. Accessor for the Edge Function. SECURITY DEFINER because vault is not
--    reachable through PostgREST; execute is granted to service_role only, so
--    no client role can read the secret.
create or replace function public.push_fanout_secret()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'push_fanout_secret' limit 1;
$$;

revoke all on function public.push_fanout_secret() from public;
revoke all on function public.push_fanout_secret() from anon, authenticated;
grant execute on function public.push_fanout_secret() to service_role;

-- 3. Trigger: announce server-side inserts.
create or replace function public.dispatch_push_for_inserted_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_secret text;
  v_base   text;
  v_body   jsonb;
begin
  -- Client inserts already dispatch from the client; only server-side writes
  -- (auth.uid() IS NULL) need announcing here.
  if auth.uid() is not null then
    return null;
  end if;

  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_fanout_secret' limit 1;
  select decrypted_secret into v_base   from vault.decrypted_secrets where name = 'edge_functions_base_url' limit 1;
  if v_secret is null or v_base is null then
    return null;
  end if;

  if tg_table_name = 'messages' then
    v_body := jsonb_build_object('kind', 'dm', 'messageId', new.id::text);
  else
    v_body := jsonb_build_object('kind', 'room', 'roomMessageId', new.id::text);
  end if;

  -- Fire-and-forget. Push delivery must never be able to fail a message write.
  begin
    perform net.http_post(
      url     := v_base || '/push-dispatch',
      body    := v_body,
      headers := jsonb_build_object(
        'content-type', 'application/json',
        'x-him-fanout-secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'push dispatch enqueue failed for % %: %', tg_table_name, new.id, sqlerrm;
  end;

  return null;
end;
$$;

drop trigger if exists dispatch_push_on_message_insert on public.messages;
create trigger dispatch_push_on_message_insert
  after insert on public.messages
  for each row execute function public.dispatch_push_for_inserted_row();

drop trigger if exists dispatch_push_on_room_message_insert on public.room_messages;
create trigger dispatch_push_on_room_message_insert
  after insert on public.room_messages
  for each row execute function public.dispatch_push_for_inserted_row();

comment on function public.dispatch_push_for_inserted_row() is
  'Announces server-side (auth.uid() IS NULL) message inserts to the push-dispatch Edge Function via pg_net. Client inserts dispatch client-side and are skipped here.';
