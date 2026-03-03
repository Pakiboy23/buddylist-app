-- Trigger webhook for push notifications on new messages.
-- Works without the supabase_functions schema by using pg_net directly.
-- Project ref: keckqpadzxwwmagnmpuk.

create extension if not exists pg_net;

create or replace function public.enqueue_send_push_webhook()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_url text := 'https://keckqpadzxwwmagnmpuk.supabase.co/functions/v1/send-push';
  v_headers jsonb := jsonb_build_object('Content-Type', 'application/json');
  v_body jsonb;
begin
  v_body := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'schema', TG_TABLE_SCHEMA,
    'record', to_jsonb(NEW),
    'old_record', null
  );

  perform net.http_post(
    url := v_url,
    headers := v_headers,
    body := v_body,
    timeout_milliseconds := 5000
  );

  return NEW;
end;
$$;

drop trigger if exists messages_send_push_webhook on public.messages;
create trigger messages_send_push_webhook
after insert on public.messages
for each row
execute function public.enqueue_send_push_webhook();

-- Optional but recommended for this app because group chat writes to room_messages.
drop trigger if exists room_messages_send_push_webhook on public.room_messages;
create trigger room_messages_send_push_webhook
after insert on public.room_messages
for each row
execute function public.enqueue_send_push_webhook();
