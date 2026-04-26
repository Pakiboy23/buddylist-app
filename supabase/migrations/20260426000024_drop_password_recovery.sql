-- Drop the recovery-code-based password recovery system.
--
-- Replaced by Supabase's email-link password reset (auth.resetPasswordForEmail
-- → /reset-password page → auth.updateUser).
--
-- Tables introduced by 20260320000003_password_recovery_admin.sql that are
-- no longer used:
--   account_recovery_codes
--   password_reset_attempts
--   password_reset_tickets
--   password_reset_audit
--
-- Kept on purpose:
--   admin_users — still read by the new src/lib/adminAuth.ts assertAdminUser()
--   public.set_updated_at() — likely reused by other tables
--
-- This migration is forward-only (no rollback). The recovery-code path is
-- gone for good in the new auth model; restoring it would require restoring
-- the application code as well.

begin;

-- Drop dependent indexes explicitly so the drop order is unambiguous in
-- environments where indexes were created out-of-order.
drop index if exists public.password_reset_tickets_user_idx;
drop index if exists public.password_reset_tickets_expires_idx;
drop index if exists public.password_reset_tickets_active_idx;
drop index if exists public.password_reset_audit_created_idx;

-- Triggers
drop trigger if exists account_recovery_codes_set_updated_at on public.account_recovery_codes;
drop trigger if exists password_reset_attempts_set_updated_at on public.password_reset_attempts;

-- Policies (drop before tables so they don't linger if a table-drop is partial)
drop policy if exists account_recovery_codes_select_own on public.account_recovery_codes;
drop policy if exists account_recovery_codes_insert_own on public.account_recovery_codes;
drop policy if exists account_recovery_codes_update_own on public.account_recovery_codes;

-- Tables
drop table if exists public.password_reset_audit;
drop table if exists public.password_reset_tickets;
drop table if exists public.password_reset_attempts;
drop table if exists public.account_recovery_codes;

commit;
