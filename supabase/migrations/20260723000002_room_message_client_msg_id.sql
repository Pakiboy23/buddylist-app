-- Idempotency key for rooms v2 room_messages, matching DMs.
--
-- DMs dedup outbox retries via a (sender_id, client_msg_id) partial unique
-- index + a 23505 reconcile path. Room messages had neither: on a flaky
-- network, a room message that commits server-side but whose ack is lost gets
-- re-inserted on the next outbox flush → duplicate room message. This adds the
-- same idempotency key for rooms.
--
-- Additive and backward-compatible: the column is nullable, so existing rows
-- and any client that predates the send-path change (which populates it) are
-- unaffected — the partial index only constrains rows where client_msg_id is
-- not null.

begin;

alter table public.room_messages
  add column if not exists client_msg_id text;

create unique index if not exists room_messages_user_client_msg_id_key
  on public.room_messages (user_id, client_msg_id)
  where client_msg_id is not null;

commit;
