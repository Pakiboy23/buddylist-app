# H.I.M. Data Retention Windows

**Last updated:** 2026-05-25  
**Prepared by:** Engineering (Claude Code session)  
**Status:** Draft — requires legal review before publication

---

## Overview

Retention windows are enforced by a `pg_cron` job (`him-retention-cleanup`) that runs daily at 03:00 UTC and calls `public.run_retention_cleanup()`. The function returns a jsonb summary of deleted row counts for audit purposes.

Migration: `supabase/migrations/20260525000004_retention_cleanup_cron.sql`

---

## Retention Schedule

| Data category | Table / location | Retention window | Automated enforcement | Rationale |
|---------------|-----------------|------------------|-----------------------|-----------|
| **Account & profile** | `public.users`, `auth.users` | Until account deletion | `delete-account` Edge Function | Contract performance — account data is required while the user has an account. |
| **Direct messages** | `public.messages` | Until sender or receiver deletes their account | `delete-account` Edge Function (cascades) | Contract performance. Both parties authored or received the message content. |
| **Room messages** | `public.room_messages` | Until author deletes their account | `delete-account` Edge Function | Contract performance. |
| **Message attachments** | `chat-media` Storage bucket, `public.message_attachments` | Until message is deleted or account deletion | `delete-account` Edge Function | Contract performance. |
| **Abuse reports — open / actioned** | `public.abuse_reports` (status = `open` or `actioned`) | Indefinite / legal hold | Not automated — retained for safety & legal obligation | Legal obligation (GDPR Art. 6(1)(c); EU DSA Art. 17 record-keeping). Active investigations and actioned records must not be purged automatically. Legal to confirm specific hold period under applicable law. |
| **Abuse reports — closed** | `public.abuse_reports` (status = `reviewed` or `dismissed`) | 24 months from creation | `run_retention_cleanup()` — daily | Legitimate interest in retrospective moderation context, balanced against minimisation (Art. 5(1)(e)). Closed reports are no longer under active investigation. |
| **Blocks** | `public.blocked_users` | Until user unblocks or account deletion | `delete-account` Edge Function | Legitimate interest — block records must persist to enforce the safety feature. |
| **Push tokens** | `public.user_push_tokens` | 90 days from `last_registered_at` | `run_retention_cleanup()` — daily | Token validity: APNs/FCM invalidate stale tokens. Retaining them beyond 90 days of inactivity provides no service benefit and constitutes unnecessary personal data retention. |
| **Account deletion tombstones** | `public.account_deletion_log` | 30 days from `deleted_at` | `run_retention_cleanup()` — daily | Covers residual data that may persist in external systems (e.g., Storage CDN caches, APNs queued notifications) during the legal-hold/audit window. Deleted after 30 days. |
| **Blocks** | `public.blocked_users` | Until user unblocks or account deletion | `delete-account` Edge Function | Safety feature — block must persist as long as both accounts exist. |
| **Social graph** | `public.buddies`, `public.user_connections` | Until removed or account deletion | `delete-account` Edge Function | Contract performance. |
| **Push notification payloads (in-flight)** | APNs / FCM infrastructure | Not retained by H.I.M. | N/A — Apple/Google policy | H.I.M. does not control APNs/FCM log retention. See Apple DPLA / Google DPA. |
| **Auth logs (IP addresses at sign-in)** | Supabase Auth managed infrastructure | Per Supabase plan tier | Supabase managed | Legitimate interest — fraud / abuse detection. Exact period depends on plan. Legal to confirm and document. |
| **Vercel access logs (IP addresses)** | Vercel managed infrastructure | Per Vercel plan tier | Vercel managed | Legitimate interest — security monitoring. See Vercel DPA. |
| **Vercel Analytics** | Vercel Analytics (web only) | Per Vercel Analytics policy (anonymised) | Vercel managed | See Vercel DPA. Consent mode should be verified — see data-inventory.md gap #1. |
| **On-device storage (localStorage)** | User's device | Until app uninstall or account deletion | OS / user action | Device-local; not transmitted. |

### Not applicable

| Category | Reason |
|----------|--------|
| Recovery codes (used / unused) | `account_recovery_codes` table dropped in migration `20260426083107_drop_password_recovery.sql`. Password recovery is now admin-ticket-based. No retention window to enforce. |
| Password reset audit log | `password_reset_audit` table dropped in same migration. |

---

## pg_cron Job Details

**Job name:** `him-retention-cleanup`  
**Schedule:** `0 3 * * *` (03:00 UTC daily)  
**Function:** `public.run_retention_cleanup()`  
**Returns:**
```json
{
  "abuse_reports_deleted": 0,
  "push_tokens_deleted":   0,
  "deletion_log_pruned":   0,
  "ran_at":                "2026-05-25T03:00:00.000Z"
}
```

To run manually and inspect results:
```sql
select public.run_retention_cleanup();
```

To check cron job status:
```sql
select jobname, schedule, command, active
from   cron.job
where  jobname = 'him-retention-cleanup';
```

To inspect recent run history:
```sql
select start_time, end_time, status, return_message
from   cron.job_run_details
where  jobname = 'him-retention-cleanup'
order  by start_time desc
limit  10;
```

---

## Open items (legal review required)

1. **Abuse reports legal hold period** — `open` and `actioned` records are retained indefinitely. Legal must specify the maximum hold period under applicable law (EU DSA Art. 17, local law) and whether that changes once both parties have deleted their accounts.
2. **Supabase managed log retention** — IP-at-login and Edge Function logs are retained per Supabase plan-tier policy. Confirm current plan and exact duration; add to privacy notice.
3. **Disappearing messages purge** — `public.messages.expires_at` is set by the sender but no automated purge job exists for expired messages. A separate cron step should be added once the feature is fully launched.
4. **Art. 5(1)(e) compliance** — This schedule represents the engineering team's initial proposal. Legal must review all windows before publication.
