-- OneSignal device subscription mapping for mobile push.
-- Run this in Supabase SQL Editor as a privileged role.

alter table public.users
add column if not exists onesignal_id text;

create index if not exists users_onesignal_id_idx on public.users (onesignal_id);
