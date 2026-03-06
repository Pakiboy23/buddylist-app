-- Client message idempotency for DM and room outbox retries.
-- Run this after gtm_plan.sql and chat_rooms.sql.

begin;

alter table public.messages
  add column if not exists client_msg_id text null;

alter table public.room_messages
  add column if not exists client_msg_id text null;

create unique index if not exists messages_sender_client_msg_id_idx
  on public.messages (sender_id, client_msg_id)
  where client_msg_id is not null and char_length(trim(client_msg_id)) > 0;

create unique index if not exists room_messages_sender_client_msg_id_idx
  on public.room_messages (sender_id, client_msg_id)
  where client_msg_id is not null and char_length(trim(client_msg_id)) > 0;

commit;
