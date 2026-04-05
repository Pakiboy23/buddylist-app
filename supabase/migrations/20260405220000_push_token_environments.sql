-- Track APNs environment per device token so local/dev iOS builds can use
-- sandbox push while TestFlight/App Store builds use production push.

begin;

alter table public.user_push_tokens
  add column if not exists push_environment text null
  check (push_environment in ('sandbox', 'production'));

create index if not exists user_push_tokens_ios_environment_idx
  on public.user_push_tokens (platform, push_environment, last_registered_at desc)
  where platform = 'ios';

commit;
