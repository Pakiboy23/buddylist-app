-- GH-13 (issue #106): first-touch acquisition source on the profile row.
--
-- Nullable and never backfilled: rows that predate this migration, and every
-- native signup, stay NULL. NULL means "not captured", which is not the same
-- as 'direct' — 'direct' means a web visitor arrived with no utm_source,
-- utm_medium or ref. Channel reads (O8) must treat the two separately.

alter table public.users
  add column if not exists acquisition_source text;

comment on column public.users.acquisition_source is
  'First-touch acquisition source, written once at web signup only: utm_source '
  'else utm_medium else ref else ''direct''. Never overwritten; sign-in and '
  'profile edits do not touch it. NULL for native signups and pre-GH-13 rows.';
