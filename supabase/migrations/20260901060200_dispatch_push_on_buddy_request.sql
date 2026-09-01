-- Announce server-side buddy requests.
--
-- 20260819060000 gave messages and room_messages a server-side dispatch path,
-- but buddies was left out: push for a buddy request only ever fired from
-- src/lib/buddyRequest.ts, client-side. Requests written straight to Postgres —
-- every GH-01 request the founder engine has sent — arrived silently.
--
-- Verified 2026-09-01: 75 engine buddy requests sent during the flight, zero
-- push-dispatch calls with kind 'buddy_request'.
--
-- Same discriminator as the message triggers: auth.uid() IS NULL means nobody
-- was awake to dispatch client-side, so nothing double-fires.

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
  -- buddies has no id column (its PK is user_id/buddy_id), so the row
  -- identifier used for logging is built per table.
  v_row_id text;
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
    v_row_id := new.id::text;
    v_body := jsonb_build_object('kind', 'dm', 'messageId', v_row_id);
  elsif tg_table_name = 'buddies' then
    -- Only a new pending request is worth a notification. An acceptance is
    -- written by the accepting client, which sends its own buddy_accept push.
    if new.status is distinct from 'pending' then
      return null;
    end if;
    -- push-dispatch re-reads this pair before naming the actor, so the secret
    -- alone cannot attribute a request to an account that did not make one.
    v_row_id := new.user_id::text || '->' || new.buddy_id::text;
    v_body := jsonb_build_object(
      'kind', 'buddy_request',
      'buddyId', new.buddy_id::text,
      'actorId', new.user_id::text
    );
  else
    v_row_id := new.id::text;
    v_body := jsonb_build_object('kind', 'room', 'roomMessageId', v_row_id);
  end if;

  -- Fire-and-forget. Push delivery must never be able to fail the write.
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
    raise warning 'push dispatch enqueue failed for % %: %', tg_table_name, v_row_id, sqlerrm;
  end;

  return null;
end;
$$;

drop trigger if exists dispatch_push_on_buddy_request_insert on public.buddies;
create trigger dispatch_push_on_buddy_request_insert
  after insert on public.buddies
  for each row execute function public.dispatch_push_for_inserted_row();

comment on function public.dispatch_push_for_inserted_row() is
  'Announces server-side (auth.uid() IS NULL) inserts on messages, room_messages and buddies to the push-dispatch Edge Function via pg_net. Client inserts dispatch client-side and are skipped here.';
