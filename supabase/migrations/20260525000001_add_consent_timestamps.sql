-- Add consent audit columns to public.users.
-- age_confirmed_at: timestamp when the user checked "I am 17 or older" at registration.
-- art9_consent_at:  timestamp when the user gave explicit Art. 9 GDPR consent at registration.
-- Both are NULL for accounts created before this migration.

alter table public.users
  add column if not exists age_confirmed_at  timestamptz,
  add column if not exists art9_consent_at   timestamptz;

comment on column public.users.age_confirmed_at is
  'Timestamp the user confirmed they are 17+ at registration. NULL for pre-migration accounts.';

comment on column public.users.art9_consent_at is
  'Timestamp the user gave explicit Art. 9 GDPR consent at registration. NULL for pre-migration accounts.';
