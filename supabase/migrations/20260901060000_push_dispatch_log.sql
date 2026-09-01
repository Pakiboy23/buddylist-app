-- Push delivery outcome log.
--
-- push-dispatch returned HTTP 200 whether it reached every recipient or none of
-- them: the body carried {delivered, attempted} and nothing persisted it. The
-- function's own logs hold only boot/shutdown lines, so a total delivery failure
-- was indistinguishable from success.
--
-- Verified 2026-09-01: the whole project held 8 device tokens across 5 users,
-- the newest non-founder token predating the Aug 3 flight, while four weeks of
-- automated DMs, room prompts and 75 buddy requests were dispatched. Every one
-- of those calls returned 200. The row that would have caught it on day one is
-- `recipients > 0 and tokens = 0` — dispatched to people, reached no device.
--
-- Written by the Edge Function under the service role. No client role can read
-- it: RLS is on with no policies, and service_role bypasses RLS.

create table if not exists public.push_dispatch_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  variant text not null check (variant in ('dm', 'room', 'buddy')),
  kind text not null,
  automation boolean not null default false,
  actor_id uuid null references public.users(id) on delete set null,
  -- Text rather than uuid: the three variants point at different tables
  -- (a message, a room message, the recipient of a buddy request) and this
  -- column is for reading back, never for joining.
  subject_id text null,
  recipients integer not null default 0,
  tokens integer not null default 0,
  attempted integer not null default 0,
  delivered integer not null default 0,
  pruned integer not null default 0,
  -- [{platform, env, status, reason}]. Never contains a device token.
  failures jsonb not null default '[]'::jsonb
);

create index if not exists push_dispatch_log_created_idx
  on public.push_dispatch_log (created_at desc);

-- The operational query: sends that reached nobody.
create index if not exists push_dispatch_log_unreached_idx
  on public.push_dispatch_log (created_at desc)
  where delivered = 0 and recipients > 0;

alter table public.push_dispatch_log enable row level security;

comment on table public.push_dispatch_log is
  'One row per push-dispatch call: who it was for, how many devices were reachable, and what APNs/FCM said. Service-role only.';
comment on column public.push_dispatch_log.recipients is
  'Recipient accounts resolved for this send.';
comment on column public.push_dispatch_log.tokens is
  'Device token rows found for those accounts. recipients > 0 with tokens = 0 means the send reached nobody because nobody has push registered.';
comment on column public.push_dispatch_log.pruned is
  'Tokens deleted during this send because APNs/FCM reported them permanently dead.';
