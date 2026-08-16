-- Add discoverable flag to users for Browse / Search hiding.
-- Imported retroactively from production migrations table.
alter table public.users
  add column if not exists discoverable boolean not null default true;

comment on column public.users.discoverable is
  'When false the user is hidden from Browse and Search discovery surfaces.';
