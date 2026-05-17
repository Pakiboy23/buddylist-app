-- Drop unused last_seen column from users.
-- Imported from production migrations table (was applied via SQL editor or CLI
-- in mid-April 2026); committed retroactively so the repo matches the live DB.
ALTER TABLE public.users DROP COLUMN IF EXISTS last_seen;
