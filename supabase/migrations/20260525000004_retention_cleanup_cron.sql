-- Retention windows and scheduled cleanup job.
--
-- Note: password_reset_audit and account_recovery_codes were dropped in
-- 20260426083107_drop_password_recovery.sql — those retention windows are not applicable.
--
-- Note: pg_cron must be enabled in the Supabase dashboard (Database → Extensions → pg_cron)
-- before this migration runs. The `create extension` call below is a no-op if already enabled.

create extension if not exists pg_cron with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Account deletion log
--    Captures a lightweight tombstone before each public.users row is deleted.
--    Used to enforce the 30-day residual-data legal-hold window.
-- ---------------------------------------------------------------------------
create table if not exists public.account_deletion_log (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null,
  screenname  text,
  deleted_at  timestamptz not null default now()
);

-- No RLS policies intentionally — admin access via service role only.
alter table public.account_deletion_log enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Trigger: capture tombstone BEFORE each user deletion
-- ---------------------------------------------------------------------------
create or replace function public.log_user_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.account_deletion_log (user_id, screenname, deleted_at)
  values (old.id, old.screenname, now());
  return old;
end;
$$;

drop trigger if exists trg_log_user_deletion on public.users;
create trigger trg_log_user_deletion
  before delete on public.users
  for each row execute function public.log_user_deletion();

-- ---------------------------------------------------------------------------
-- 3. Retention cleanup function
--    Returns a jsonb summary of rows deleted per category.
--
--    Windows enforced:
--      abuse_reports (reviewed/dismissed)   24 months  — 'open'/'actioned' retained for legal hold
--      user_push_tokens                     90 days    — stale device tokens
--      account_deletion_log                 30 days    — residual tombstones after legal hold expires
-- ---------------------------------------------------------------------------
create or replace function public.run_retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abuse_reports  int;
  v_push_tokens    int;
  v_deletion_log   int;
begin
  -- Abuse reports: only delete closed records (reviewed / dismissed).
  -- 'open' and 'actioned' records are kept indefinitely for legal-obligation purposes
  -- (EU DSA Art. 17 / applicable law). Legal to confirm exact hold period.
  delete from public.abuse_reports
  where  status in ('reviewed', 'dismissed')
    and  created_at < now() - interval '24 months';
  get diagnostics v_abuse_reports = row_count;

  -- Push tokens: prune tokens not refreshed in the past 90 days.
  -- APNs / FCM will have already invalidated stale tokens; this removes the DB rows.
  delete from public.user_push_tokens
  where  last_registered_at < now() - interval '90 days';
  get diagnostics v_push_tokens = row_count;

  -- Account deletion log: clear tombstones older than 30 days.
  -- The 30-day window covers residual data that may linger due to cascades or async jobs.
  delete from public.account_deletion_log
  where  deleted_at < now() - interval '30 days';
  get diagnostics v_deletion_log = row_count;

  return jsonb_build_object(
    'abuse_reports_deleted', v_abuse_reports,
    'push_tokens_deleted',   v_push_tokens,
    'deletion_log_pruned',   v_deletion_log,
    'ran_at',                now()
  );
end;
$$;

-- pg_cron runs jobs as the postgres role; grant execute explicitly.
grant execute on function public.run_retention_cleanup() to postgres;

-- ---------------------------------------------------------------------------
-- 4. Schedule: daily at 03:00 UTC
--    Idempotent: unschedule any existing job with this name, then re-add.
-- ---------------------------------------------------------------------------
do $$
begin
  perform cron.unschedule('him-retention-cleanup');
exception when others then null;
end $$;

select cron.schedule(
  'him-retention-cleanup',
  '0 3 * * *',
  $cron$ select public.run_retention_cleanup(); $cron$
);
