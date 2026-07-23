-- H.I.M. Pro entitlement scaffolding (dormant until 2.1).
--
-- Adds the server-side source of truth for Pro status. NOTHING in the 2.0.2
-- app reads this yet — it ships ahead of the StoreKit/paywall work so the 2.1
-- entitlement webhook has a column to write to and RLS/functions have a flag
-- to check. Default false means every existing and new user is non-Pro until a
-- verified purchase flips it.
--
-- Trust boundary: is_pro/pro_source/pro_since are writable ONLY by the service
-- role (the future receipt-validation edge function / RevenueCat webhook) and
-- DB admins. This is enforced by the protect_pro_entitlement trigger below —
-- NOT by column GRANTs. A column-level `REVOKE UPDATE (col)` is a no-op while
-- the role still holds table-level UPDATE, which `authenticated` does under
-- Supabase's default grants (and needs, for the users_update_own policy). So a
-- revoke would not actually stop a signed-in client from writing its own
-- is_pro; the trigger does, by reverting any entitlement change from a
-- non-service caller (covers both the self-UPDATE path and the signup INSERT).
--
-- Pairs with the ASC products created 2026-07-21 (subscription group
-- "H.I.M. Pro": com.hiitsme.app.pro.monthly $2.99, com.hiitsme.app.pro.annual
-- $24.99; non-consumable com.hiitsme.app.pro.founding $49.99). See
-- marketing/monetization/2-1-pro-plan.md for the full plan of record.

begin;

alter table public.users
  add column if not exists is_pro boolean not null default false,
  -- Lets support/analytics tell a lifetime Founding Member apart from a
  -- renewing subscriber without exposing receipt internals.
  add column if not exists pro_source text
    check (pro_source is null or pro_source in ('monthly', 'annual', 'founding')),
  add column if not exists pro_since timestamptz;

comment on column public.users.is_pro is
  'H.I.M. Pro entitlement. Written only by the service role via the 2.1 receipt-validation webhook; the protect_pro_entitlement trigger reverts any client write.';
comment on column public.users.pro_source is
  'Which SKU granted Pro: monthly | annual | founding. Null when not Pro.';

-- Partial index — Pro members are a small subset; keeps entitlement lookups cheap.
create index if not exists users_is_pro_idx on public.users (id) where is_pro;

-- Enforce the trust boundary in a trigger (see header for why not GRANTs).
-- SECURITY INVOKER (the default) is REQUIRED: the guard reads current_user,
-- which under an invoker function is the role executing the DML — 'authenticated'
-- for a PostgREST client call, 'service_role' for the webhook, 'postgres'/
-- 'supabase_admin' for migrations/admin. A SECURITY DEFINER function would see
-- the owner instead and defeat the check.
create or replace function public.protect_pro_entitlement()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin') then
    if tg_op = 'INSERT' then
      -- New rows (signup) can never self-grant Pro.
      new.is_pro := false;
      new.pro_source := null;
      new.pro_since := null;
    else
      -- Updates from a client keep whatever the row already had.
      new.is_pro := old.is_pro;
      new.pro_source := old.pro_source;
      new.pro_since := old.pro_since;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_pro_entitlement on public.users;
create trigger protect_pro_entitlement
  before insert or update on public.users
  for each row
  execute function public.protect_pro_entitlement();

commit;
