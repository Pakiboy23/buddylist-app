-- Disable legacy push webhook wiring.
-- Run this in Supabase SQL editor to remove DB-side webhook triggers.

drop trigger if exists messages_send_push_webhook on public.messages;
drop trigger if exists room_messages_send_push_webhook on public.room_messages;
drop function if exists public.enqueue_send_push_webhook();
