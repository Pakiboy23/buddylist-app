# Audit Log Gaps — H.I.M. (hiitsme)

**Prepared:** 2026-05-25  
**Sources:** `src/`, `supabase/` — full scan  
**Status:** Engineering action required before production launch  

---

## Executive Summary

H.I.M. has **no audit log infrastructure**. There is no `audit_log`, `security_events`, or equivalent table in any of the 28 Supabase migrations. The `password_reset_audit` table that existed briefly was dropped in migration `20260426083107`. The `export-account` Edge Function explicitly documents this: `"audit_logs: 'Not applicable — no user-level audit log table exists in this schema version.'"`.

This is a gap against:
- **GDPR Art. 5(2)** (accountability principle — must be able to demonstrate compliance)
- **GDPR Art. 32** (appropriate technical measures)
- **Breach runbook** `docs/compliance/breach-runbook.md` — requires audit log retention extension during an incident (T+0 step: evidence preservation)
- **Apple App Store Guideline 5.1.1** (data handling transparency)
- **Good engineering practice** for an app handling special-category data (sexual orientation by inference, GDPR Art. 9)

---

## Infrastructure Gap

### No security_events table

| | |
|---|---|
| **Severity** | Critical |
| **Migration evidence** | `password_reset_audit` created and immediately dropped — no replacement created |
| **Explicit documentation** | `supabase/functions/export-account/index.ts` line ~140: `"audit_logs: 'Not applicable — no user-level audit log table exists in this schema version.'"` |

**Recommended schema** (new migration, ship before any per-gap fixes):

```sql
create table public.security_events (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid references auth.users(id) on delete set null,
  screenname  text,
  event_type  text not null,           -- enum values listed per gap below
  ip_address  inet,                    -- from request context where available
  user_agent  text,
  outcome     text not null,           -- 'success' | 'failure' | 'partial'
  metadata    jsonb default '{}'       -- event-specific extra fields
);

-- 90-day retention (align with retention.md push_tokens window)
create index on public.security_events (created_at);
alter table public.security_events enable row level security;

-- No user-visible RLS: security events are admin-read-only
create policy "admin read security_events"
  on public.security_events for select
  using (exists (select 1 from public.admin_users where user_id = auth.uid()));
```

Add `security_events` to the retention cleanup cron (`run_retention_cleanup()`) with a 90-day window.

---

## Per-Gap Findings

Gaps are ordered by risk. **P1 = fix before launch, P2 = fix in first post-launch sprint.**

---

### GAP-01 — Sign-in failure burst (credential stuffing vector)

| | |
|---|---|
| **Priority** | P1 — critical |
| **File** | `src/app/page.tsx` |
| **Location** | Sign-in handler, inside the `for (const candidate of candidates)` loop |
| **Action** | `supabase.auth.signInWithPassword({ email: candidate, password })` |
| **Gap** | `isInvalidCredentialsError()` is caught and the loop continues, but no failure event is recorded. A credential-stuffing run against known screennames produces zero forensic trace. |
| **Recommended event_type** | `auth.signin.failure` |
| **Recommended metadata** | `{ candidate_count, attempt_number, error_code }` |
| **Note** | Supabase Auth itself logs auth events to `auth.audit_log_entries` (internal, accessible via Supabase dashboard). However, this table is not queryable via the application and is not exported in the breach runbook's evidence procedure. A mirror in `public.security_events` is required for incident response. |

---

### GAP-02 — Sign-in success (no session-open event)

| | |
|---|---|
| **Priority** | P1 |
| **File** | `src/app/page.tsx` |
| **Location** | After the first successful `signInWithPassword` resolves |
| **Action** | Successful authentication, session established |
| **Gap** | No record of when a session was opened, from which IP, or which screenname candidate matched. Impossible to reconstruct "who logged in when and from where" after an incident. |
| **Recommended event_type** | `auth.signin.success` |
| **Recommended metadata** | `{ matched_candidate_index }` |
| **Note** | IP address is available server-side only. If this event is written from the client, omit `ip_address` and note the limitation. Consider moving sign-in to a Vercel Function to capture the real IP via `x-forwarded-for`. |

---

### GAP-03 — Sign-up (new account creation)

| | |
|---|---|
| **Priority** | P1 |
| **File** | `src/app/page.tsx` |
| **Location** | Sign-up path, after `supabase.auth.signUp({ email, password })` succeeds |
| **Action** | New account created |
| **Gap** | Account creation events produce no audit trace in the application layer. Cannot determine "when was this account first created" from application logs alone (only from `auth.users.created_at`). |
| **Recommended event_type** | `auth.signup.success` |
| **Recommended metadata** | `{ screenname }` |

---

### GAP-04 — Password reset request

| | |
|---|---|
| **Priority** | P1 |
| **File** | `src/app/page.tsx` |
| **Location** | `supabase.auth.resetPasswordForEmail(email, { redirectTo })` call |
| **Action** | Password reset email dispatched |
| **Gap** | No record of reset requests. A threat actor requesting resets for all known screennames to enumerate valid accounts leaves no trace. |
| **Recommended event_type** | `auth.password_reset.requested` |
| **Recommended metadata** | `{ screenname_candidate }` |

---

### GAP-05 — Email change (account credential change)

| | |
|---|---|
| **Priority** | P1 |
| **File** | `src/app/account/page.tsx` |
| **Location** | Line ~216, `supabase.auth.updateUser({ email })` |
| **Action** | User changes their synthetic email (i.e., changes screenname-derived login) |
| **Gap** | Credential changes are high-value security events. No record of old value, new value, or whether the change was user-initiated vs. session-hijacked. |
| **Recommended event_type** | `auth.email.changed` |
| **Recommended metadata** | `{ old_email_prefix, new_email_prefix }` (screenname only, not the full synthetic email) |

---

### GAP-06 — Password change

| | |
|---|---|
| **Priority** | P1 |
| **File** | `src/app/account/page.tsx` |
| **Location** | Line ~248, `supabase.auth.updateUser({ password })` |
| **Action** | User changes password |
| **Gap** | Password changes are the single highest-value security event. No record of when passwords changed; cannot answer "was the password changed before or after the incident?" |
| **Recommended event_type** | `auth.password.changed` |
| **Recommended metadata** | `{}` (do not log old or new password; event timestamp alone is sufficient) |

---

### GAP-07 — Invalid session / forced sign-out

| | |
|---|---|
| **Priority** | P2 |
| **File** | `src/lib/authClient.ts` |
| **Location** | `getSessionOrNull()` — branch handling `invalid_refresh_token` error |
| **Action** | `supabase.auth.signOut({ scope: 'local' })` called when refresh token is invalid |
| **Gap** | Forced local sign-outs due to invalid tokens are not recorded. In a session-hijacking scenario, the original owner's client signs out silently with no trace. |
| **Recommended event_type** | `auth.session.forced_signout` |
| **Recommended metadata** | `{ reason: 'invalid_refresh_token' }` |

---

### GAP-08 — Admin access checks

| | |
|---|---|
| **Priority** | P1 |
| **File** | `src/lib/adminAuth.ts` |
| **Location** | `assertAdminUser()` function |
| **Action** | Admin route accessed — function checks `admin_users` table and returns |
| **Gap** | Admin access is not logged. Cannot determine when admins accessed the admin panel, or whether an admin account was hijacked and used for unauthorized access. GDPR Art. 5(2) accountability particularly requires this for privileged operations. |
| **Recommended event_type** | `admin.access.granted` / `admin.access.denied` |
| **Recommended metadata** | `{ route }` — passed from the caller |
| **Files affected** | `src/lib/adminAuth.ts`, `api/admin/me.ts`, `api/admin/password-reset-ticket.ts`, `api/admin/password-reset-audit.ts` |

---

### GAP-09 — Account deletion (Edge Function)

| | |
|---|---|
| **Priority** | P1 |
| **File** | `supabase/functions/delete-account/index.ts` |
| **Location** | `recordDelete()` internal function — builds results array in memory |
| **Action** | Full account erasure across ~14 tables |
| **Gap** | `recordDelete()` accumulates an in-memory results log that is returned in the HTTP response body — it is never written to any table. After the function returns, there is zero persistent record that the deletion ran, what was erased, or whether it completed successfully. The existing `account_deletion_log` table (added in migration `20260525000004_retention_cleanup_cron.sql`) is written only by the `log_user_deletion` BEFORE DELETE trigger on `public.users`, which fires during the cascade — but the trigger writes only `(user_id, screenname, deleted_at)`. The full deletion manifest (which of the 14 tables had rows, how many, any partial failures) is lost. |
| **Recommended event_type** | Write the full results JSON to a persistent `account_deletion_log_detail` column or a new `public.deletion_manifests` table before calling `auth.admin.deleteUser()`. This record must survive the deletion (user_id may become orphaned — ensure FK is `on delete set null`). |
| **Note** | The `account_deletion_log` trigger already captures the user row deletion. The gap is the per-table manifest. |

---

### GAP-10 — Account export (Edge Function)

| | |
|---|---|
| **Priority** | P2 |
| **File** | `supabase/functions/export-account/index.ts` |
| **Location** | Export handler |
| **Action** | User requests full data export (GDPR Art. 20 portability) |
| **Gap** | No record that an export was requested or delivered. Cannot answer "was user data exported before the account was deleted?" — relevant in account-takeover investigations. |
| **Recommended event_type** | `gdpr.export.requested` / `gdpr.export.delivered` |
| **Recommended metadata** | `{ export_size_bytes, tables_included: [...] }` |

---

## Recommended Implementation Order

| Step | Action | Priority |
|---|---|---|
| 1 | Create `public.security_events` table (new migration) | P1 |
| 2 | Add `security_events` to `run_retention_cleanup()` with 90-day window | P1 |
| 3 | Wire GAP-01 (signin failures) and GAP-02 (signin success) | P1 |
| 4 | Wire GAP-05 and GAP-06 (credential changes) | P1 |
| 5 | Wire GAP-08 (admin access) across all 4 admin routes | P1 |
| 6 | Update GAP-09 (deletion manifest persistence) in delete-account function | P1 |
| 7 | Wire GAP-03, GAP-04 (signup, reset request) | P1 |
| 8 | Wire GAP-07 (forced sign-out) | P2 |
| 9 | Wire GAP-10 (export events) | P2 |
| 10 | Add Supabase auth.audit_log_entries export to breach runbook evidence procedure | P2 |

---

## Open Items

| # | Item | Owner |
|---|---|---|
| 1 | Decide whether to write security_events from client (no IP) or proxy through a Vercel Function to capture real IP | Engineering |
| 2 | Determine retention window for security_events: 90 days (current push_tokens window) vs. 12 months (common security practice) | Legal + Engineering |
| 3 | Confirm whether Supabase's internal `auth.audit_log_entries` satisfies any part of the Art. 5(2) accountability requirement, or whether app-layer events are required regardless | Legal |
| 4 | Integrate security_events into breach runbook evidence preservation procedure (add `pg_dump --table=public.security_events` to T+0 checklist) | Engineering |
