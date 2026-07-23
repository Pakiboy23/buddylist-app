-- H.I.M. Pro entitlement scaffolding (dormant until 2.1).
--
-- Adds the server-side source of truth for Pro status. NOTHING in the 2.0.2
-- app reads this yet — it ships ahead of the StoreKit/paywall work so the 2.1
-- entitlement webhook has a column to write to and RLS/functions have a flag
-- to check. Default false means every existing and new user is non-Pro until a
-- verified purchase flips it.
--
-- Trust boundary: is_pro is written ONLY by the service role (the future
-- receipt-validation edge function / RevenueCat webhook), never by the client.
-- The users_update_own policy (migration 20260320000001) already restricts
-- self-updates via the anon/authenticated roles, and we do not grant column
-- privileges on is_pro to those roles, so a client cannot self-promote.
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
  'H.I.M. Pro entitlement. Written only by the service role via the 2.1 receipt-validation webhook; never client-writable.';
comment on column public.users.pro_source is
  'Which SKU granted Pro: monthly | annual | founding. Null when not Pro.';

-- Partial index — Pro members are a small subset; keeps entitlement lookups cheap.
create index if not exists users_is_pro_idx on public.users (id) where is_pro;

-- Belt-and-suspenders: revoke any column-level UPDATE on the entitlement
-- fields from the client roles so a future broadening of users_update_own
-- can never let a member self-promote to Pro.
revoke update (is_pro, pro_source, pro_since) on public.users from anon;
revoke update (is_pro, pro_source, pro_since) on public.users from authenticated;

commit;
