-- OneSignal device subscription mapping for mobile push.
-- Run this in Supabase SQL Editor as a privileged role.

alter table public.users
add column if not exists onesignal_id text;
