-- Rate-limit column for the self-service data export (GDPR right of access).
-- NULL = never exported. Set by the export-account edge function on each export.
-- Enforced server-side: one export per 24 hours per user.

alter table public.users
  add column if not exists last_exported_at timestamptz;

comment on column public.users.last_exported_at is
  'Timestamp of the most recent GDPR data export for this user. NULL = never exported. '
  'The export-account edge function rejects requests within 24 h of this timestamp.';
