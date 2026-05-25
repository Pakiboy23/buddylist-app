-- Audit log for auth-sensitive actions (sign-in, credential changes, admin access, etc.).
-- Retention: 90 days, enforced by run_retention_cleanup().

create table if not exists public.security_events (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid        references auth.users(id) on delete set null,
  event_type  text        not null,
  outcome     text        not null check (outcome in ('success', 'failure', 'partial')),
  metadata    jsonb       not null default '{}'
);

create index on public.security_events (created_at);
create index on public.security_events (user_id) where user_id is not null;

alter table public.security_events enable row level security;

-- Authenticated users may insert their own events.
create policy "authenticated insert own security_events"
  on public.security_events for insert
  to authenticated
  with check (user_id = auth.uid());

-- Anon role may insert events without a user_id (e.g. failed sign-in before auth succeeds).
create policy "anon insert null-user security_events"
  on public.security_events for insert
  to anon
  with check (user_id is null);

-- No SELECT policy — reads go through service-role which bypasses RLS.

-- ---------------------------------------------------------------------------
-- Update run_retention_cleanup() to prune security_events older than 90 days.
-- ---------------------------------------------------------------------------
create or replace function public.run_retention_cleanup()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_abuse_reports   int;
  v_push_tokens     int;
  v_deletion_log    int;
  v_security_events int;
begin
  delete from public.abuse_reports
  where  status in ('reviewed', 'dismissed')
    and  created_at < now() - interval '24 months';
  get diagnostics v_abuse_reports = row_count;

  delete from public.user_push_tokens
  where  last_registered_at < now() - interval '90 days';
  get diagnostics v_push_tokens = row_count;

  delete from public.account_deletion_log
  where  deleted_at < now() - interval '30 days';
  get diagnostics v_deletion_log = row_count;

  delete from public.security_events
  where  created_at < now() - interval '90 days';
  get diagnostics v_security_events = row_count;

  return jsonb_build_object(
    'abuse_reports_deleted',  v_abuse_reports,
    'push_tokens_deleted',    v_push_tokens,
    'deletion_log_pruned',    v_deletion_log,
    'security_events_pruned', v_security_events,
    'ran_at',                 now()
  );
end;
$$;

grant execute on function public.run_retention_cleanup() to postgres;
