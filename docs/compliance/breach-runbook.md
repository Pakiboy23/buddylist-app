# Personal Data Breach Response Runbook — H.I.M. (hiitsme)

**Version:** 1.0  
**Last updated:** 2026-05-25  
**Status:** Draft — requires legal review and role assignments before going live  
**Owner:** Engineering lead (until a DPO is appointed)

---

## 1. Definition of a personal data breach

> **GDPR Article 4(12):** A "personal data breach" means a breach of security leading to the accidental or unlawful **destruction, loss, alteration, unauthorised disclosure of, or access to**, personal data transmitted, stored or otherwise processed.

This covers not only external attacks but also:
- Accidental deletion of user data (including a bad migration or DROP TABLE)
- Misconfiguration that exposes data publicly (e.g., a Supabase RLS policy gap, an S3-equivalent bucket made public)
- Internal access without a legitimate business purpose (insider threat)
- Loss of an encrypted device containing exported data
- A sub-processor incident that affects our data (Supabase, Vercel, Apple APNs)

**Not every breach requires notification.** Art. 33(1) carve-out: if the breach is "unlikely to result in a risk to the rights and freedoms of natural persons," no regulator notification is required — but you must document your risk assessment and the reasoning (Art. 33(5)). Given H.I.M.'s LGBTQ+ user base and Art. 9 data sensitivity, the bar for "unlikely to result in risk" is **high**; default to notifying and document if you decide not to.

---

## 2. Detection triggers

### 2.1 Supabase (primary data store)

Check the following in the Supabase dashboard (Database → Logs → Postgres / Auth / Edge Functions):

| Signal | What to look for | Cadence |
|---|---|---|
| Auth log spikes | Sudden surge in `invalid login credentials` errors from many IPs — potential credential-stuffing attack | Daily review; alert if > 50 failures in 10 min from distinct IPs |
| RLS bypass errors | `permission denied for table` logged for the `postgres` or `authenticator` role accessing data it shouldn't | Any occurrence |
| Unexpected large SELECTs | Query log shows mass-read of `messages`, `users`, or `abuse_reports` by an unexpected role | Any occurrence |
| Migration failures | Failed migration that may have temporarily dropped or altered a table | Every migration deploy |
| Storage bucket exposure | `buddy-icons` or `chat-media` bucket ACL changed to public-read unexpectedly | Any config change |
| pg_cron job errors | `cron.job_run_details` shows errors on `him-retention-cleanup` — may indicate data was not purged as required | Daily review |

**How to access:** Supabase Dashboard → Logs → select service; or via MCP `get_logs` tool filtering by service.

### 2.2 Vercel (web hosting + API functions)

| Signal | What to look for |
|---|---|
| API 5xx spike | Surge in 500/503 on `/api/push/dispatch` or `/api/admin/*` — may indicate logic error exposing data |
| Unexpected 401s on admin routes | Someone enumerating `/api/admin/me` or `/api/admin/password-reset-audit` with invalid tokens |
| Build log exposure | A Vercel build that accidentally logged environment variables (check build output in deployment details) |

**How to access:** Vercel Dashboard → Project → Logs; or `vercel logs --follow` in the CLI.

> **TODO:** H.I.M. has no active error monitoring SDK (no Sentry, no Datadog, no Firebase Crashlytics). Vercel Web Vitals captures performance metrics only, not security events. **Add a real error monitoring integration** (Sentry recommended for its PII scrubbing controls) before the first production launch. Until then, rely on Supabase log polling and user-reported issues.

### 2.3 Abuse reports and user signals

- A user submitting an abuse report (`/account` → Report) citing "my account was accessed without my knowledge" is a breach signal.
- A user contacting support claiming they received a message they didn't send (account takeover).
- A cluster of users reporting the same suspicious content — may indicate a compromised account used to bulk-message.

### 2.4 Sub-processor notifications

- **Supabase** will email the account owner for security incidents on their infrastructure. Keep the account owner email monitored.
- **Vercel** notifies via the dashboard and email for security events on hosted projects.
- **Apple APNs** does not proactively notify about push-token exposure.

---

## 3. Roles and responsibilities

Assign real names to each role before activating this runbook. Placeholder labels used below.

| Role | Responsibility | Current assignee |
|---|---|---|
| **Incident Commander** | Declares the incident, coordinates all response activity, makes the call on regulatory notification | `[ENGINEERING LEAD — FILL IN]` |
| **Technical Lead** | Executes containment, forensics, evidence preservation, and remediation | `[SENIOR ENGINEER — FILL IN]` |
| **Legal / DPO** | Determines whether Art. 33 / Art. 34 notification thresholds are met; drafts and submits regulator notifications; advises on user notification | `[COUNSEL / DPO — FILL IN]` |
| **Communications** | Drafts user-facing notifications; manages any public statement; coordinates with legal on messaging | `[FILL IN — may be same as Legal for small team]` |
| **Supabase Account Owner** | Can access Supabase dashboard, pull logs, rotate service role key, and contact Supabase support | `[FILL IN]` |
| **Vercel Account Owner** | Can freeze deployments, pull logs, rotate environment variables | `[FILL IN]` |

**Escalation rule:** If the Incident Commander is unreachable, the Technical Lead assumes the role and must notify Legal within 30 minutes.

---

## 4. Timeline checklist

### T+0 — Detection

- [ ] Potential incident identified (by any of the triggers in §2).
- [ ] Incident Commander **notified immediately** (call/message — do not rely on email).
- [ ] Incident Commander **declares incident** and opens an incident log (a private Notion page, shared doc, or similar — timestamped from this moment).
- [ ] Legal notified within 15 minutes of declaration.
- [ ] Initial characterisation documented: What data? Which users? How many? Time window of exposure? Confirmed or suspected?
- [ ] Evidence preservation started (§7) — **do not delete anything**.

### T+1h — Containment

- [ ] Root cause hypothesis identified.
- [ ] Containment action taken (see examples below). Document every action with timestamp.
- [ ] Verify containment is effective — confirm the exposure vector is closed.
- [ ] Confirm no ongoing access (re-check Supabase auth logs, Vercel access logs).
- [ ] Service role key rotated if compromise of server-side credentials is suspected.
- [ ] Affected user accounts locked/suspended if account takeover is confirmed (use Supabase `auth.admin.updateUserById` with `ban_duration`).

**Containment action examples by incident type:**

| Incident type | Containment action |
|---|---|
| RLS misconfiguration | Revert the offending migration; re-deploy with corrected policy |
| Credential stuffing / brute force | Enable Supabase rate-limiting / CAPTCHA; block source IP ranges |
| Compromised service role key | Rotate key immediately via Supabase Settings → API; redeploy Vercel with new env var |
| Accidental data exposure via public bucket | Set bucket back to private in Supabase Storage |
| Bad migration deleting data | Restore from most recent pg_dump snapshot (§7.1); assess recovery window |
| Sub-processor (Supabase) incident | Follow Supabase incident response; do not treat as resolved until Supabase confirms |

### T+24h — Impact assessment

- [ ] Confirm: which specific users are affected? (List user IDs and categories of data exposed.)
- [ ] Confirm: exact time window of the breach (first possible exposure → confirmed containment).
- [ ] Determine: is the data likely to result in risk to affected users' rights and freedoms?
  - Given H.I.M.'s LGBTQ+ context and Art. 9 sensitivity: presume **high risk** unless evidence clearly supports otherwise.
- [ ] Legal completes preliminary risk assessment and advises on notification obligations.
- [ ] Prepare draft Art. 33 regulator notification (§5.1) — even if not yet submitted.
- [ ] Prepare draft Art. 34 user notification (§5.2) if high risk.
- [ ] Communicate incident status update to all internal role-holders.

### T+72h — Regulator notification (GDPR Art. 33 deadline)

- [ ] **Submit Art. 33 notification to the lead supervisory authority** (§6) if a breach has occurred and risk to users cannot be ruled out low.
  - If notification cannot be completed by T+72h: submit what is known now and explicitly state that information will follow. Art. 33(4) permits phased notification.
- [ ] Document the reasoning if notification is NOT submitted (risk assessment, evidence of low risk, lawful basis for exception).
- [ ] If multiple EU member states are affected, assess whether to notify additional SAs (§6 for contacts).
- [ ] US state AG notifications assessed (§5.3) — most US states require notification within 30 to 90 days; some as fast as 72 hours (Colorado: 30 days, Florida: 30 days).

### T+? — User notification (GDPR Art. 34)

Art. 34 notification to affected users is required "without undue delay" when the breach is **likely to result in a high risk** to their rights and freedoms. There is no fixed 72-hour deadline for user notification — but delay should be minimised.

- [ ] Legal signs off on user notification content and channel.
- [ ] Notify affected users via in-app notification and/or email (if real email addresses are on file — note: most H.I.M. users have synthetic emails only, see §5.2).
- [ ] Consider whether to notify all users (not just confirmed-affected) if the exposure was broad enough that individual identification is not possible within a reasonable time.
- [ ] Post a notice in the app's status channel / website if a broader advisory is warranted.

### T+30 days — Post-incident review

- [ ] Root cause confirmed and documented.
- [ ] Remediation confirmed complete.
- [ ] Post-incident review meeting held (§8).
- [ ] Art. 33(5) documentation completed and filed internally.
- [ ] Regulator follow-up submitted with complete information if initial notification was phased.

---

## 5. Notification templates

### 5.1 Regulator notification — GDPR Art. 33

Submit via each authority's online portal (§6). Fields below map to the Art. 33(3) required content.

---

**[DRAFT — complete all bracketed fields before submitting]**

**To:** [Supervisory Authority name and portal — see §6]  
**Subject:** Personal Data Breach Notification — H.I.M. (hiitsme) — [DATE]

**Controller details:**  
Name: hiitsme / [Legal entity name — TBD]  
Address: [Registered address]  
Contact (DPO or responsible person): [Name, email, phone]

---

**1. Nature of the breach (Art. 33(3)(a))**

[Describe the breach: type of breach (confidentiality / integrity / availability), categories of data involved, approximate number of data subjects affected, approximate number of records affected. Example: "On [DATE], a misconfigured Row Level Security policy on the public.messages table allowed authenticated users to read direct messages of other users. Approximately [N] users' messages were accessible for a period of [duration]."]

**Categories of personal data involved:** [e.g., message content, screennames, profile data, push tokens]  
**Approximate number of data subjects:** [N]  
**Approximate number of records:** [N]

**2. Likely consequences (Art. 33(3)(c))**

[Describe the risks: e.g., exposure of private communications to an unintended party; inference of LGBTQ+ identity of affected users; risk of harassment or outing given the sensitive nature of the app's community.]

**3. Measures taken or proposed (Art. 33(3)(d))**

[Describe containment: e.g., "The misconfigured policy was corrected and redeployed at [TIME]. No further unauthorised access is possible. Affected users have been notified (see Art. 34 notification submitted separately). Service credentials were rotated on [DATE]."]

**4. Contact for further information**

[Name, role, email, phone]

---

**Note on phased notification:** If submitting before the full impact assessment is complete, append: *"This notification is submitted within the 72-hour window on the basis of information currently available. A supplementary notification will follow within [N] days with the complete impact assessment per Art. 33(4)."*

---

### 5.2 Affected user notification — GDPR Art. 34

**Important caveat on delivery channel:** The majority of H.I.M. users have synthetic emails (`screenname@hiitsme.app`) that do not reach real inboxes. In-app push notification is the primary channel. If a user has added a real email address (via Settings → Account), email is available as a secondary channel.

---

**[DRAFT — complete bracketed fields before sending]**

**Subject (push / in-app):** Important notice about your H.I.M. account

---

Hi [screenname / "H.I.M. member"],

We're writing to let you know about a security incident that affected your account.

**What happened:**  
[Clear, plain-language description of the breach. E.g.: "Between [DATE] and [DATE], a technical error meant that some private messages on H.I.M. could be accessed by other logged-in users. We fixed the issue as soon as we discovered it."]

**What data was involved:**  
[List the categories specifically. E.g.: "Direct messages you sent or received during this period."]

**What we've done:**  
[E.g.: "We've fixed the technical error, rotated all server credentials, and reviewed our access controls. We have no evidence that your data was viewed or copied by anyone other than our engineering team during the investigation."]

**What you should do:**  
- Change your H.I.M. password at Settings → Account → Update Password.
- If you use the same password elsewhere, change it there too.
- [Any other specific action relevant to the incident.]

**Your rights:**  
You have the right to lodge a complaint with your data protection authority. [In the UK: the ICO at ico.org.uk. In the EU: your national DPA.]

If you have questions, contact us at: [support email or in-app support route — **TBD**].

We're sorry this happened.  
— The H.I.M. team

---

### 5.3 US state Attorney General notifications

The US does not have a federal breach notification law. Key state laws that apply to H.I.M. users (prioritise states with the largest user bases):

| State | Deadline | Authority | How to notify |
|---|---|---|---|
| California | 72 hours (if > 500 CA residents) | CA AG | Email to privacy@doj.ca.gov; see oag.ca.gov/privacy/databreach/reporting |
| Colorado | 30 days | CO AG | coag.gov/office-sections/consumer-protection |
| Florida | 30 days | FL AG | myfloridalegal.com — written notification |
| New York | "In the most expedient time possible" | NY AG | ag.ny.gov — written notification with sample form on site |
| Texas | 60 days | TX AG | ag.texas.gov/data-privacy/report-a-breach/ |
| Virginia | 60 days | VA AG; also notify affected residents | law.lis.virginia.gov |
| Washington | 30 days | WA AG | atg.wa.gov — written notice |

**Threshold note:** Most US state laws trigger when breaches affect residents of that state and involve specific data types (SSN, financial info, government IDs). H.I.M.'s message content, usernames, and push tokens are typically covered under "usernames and passwords" combined categories and under "any other information that, combined with name or ID, could enable identity theft or fraud." Given the sensitivity of H.I.M.'s data, treat any breach as presumptively reportable in all states where users are located.

**Sensitive data amplifiers:** California (CCPA/CPRA) and several other states impose heightened requirements for breaches involving sexual orientation, gender identity, or communications content — all of which H.I.M. processes.

---

## 6. Supervisory authority contact information

### Lead EU authority

⚠️ **Placeholder — legal determination required.** The "lead supervisory authority" (one-stop-shop, GDPR Art. 56) is determined by the location of the controller's **main EU establishment**. H.I.M.'s company has no confirmed EU establishment; until a presence is established:

- **No one-stop-shop applies.** Each affected EU member state's DPA must be notified individually.
- As a practical matter, notify the DPA(s) covering the largest concentrations of affected users.
- Once an EU establishment or EU representative (Art. 27) is appointed, update this section.

**⚠️ Action item:** Appoint an Art. 27 EU representative before EU users can meaningfully exercise their rights. Contact legal to begin this process.

---

### ICO — United Kingdom

**Information Commissioner's Office**  
Website: ico.org.uk  
Breach report portal: ico.org.uk/for-organisations/report-a-breach/  
Report online: report.ico.org.uk  
Phone: 0303 123 1113 (Mon–Fri, 9am–5pm UK time)  
Email (general): casework@ico.org.uk  
**72-hour clock:** Runs from the moment the controller becomes "aware" of the breach.

---

### CNIL — France

**Commission Nationale de l'Informatique et des Libertés**  
Website: cnil.fr  
Breach notification portal: notifications.cnil.fr/notifications/index  
Phone: +33 1 53 73 22 22  
English guidance: cnil.fr/en/report-a-breach  
**72-hour clock:** Runs from when the controller has "reasonable certainty" a breach has occurred.

---

### Datatilsynet — Denmark

**Danish Data Protection Agency**  
Website: datatilsynet.dk  
Breach notification portal: datatilsynet.dk/english/notification-of-data-breach  
Email: dt@datatilsynet.dk  
Phone: +45 33 19 32 00  
English breach report form: Available on the portal above.

---

### Other EU DPAs (notify as relevant based on user geography)

| Country | Authority | Breach portal |
|---|---|---|
| Germany | BfDI (federal) + Länder DPAs | bfdi.bund.de/EN; for users across states, notify the relevant Länder DPA |
| Ireland | DPC (likely lead if EU entity incorporated here) | dataprotection.ie/en/organisations/breach-notification |
| Netherlands | AP | autoriteitpersoonsgegevens.nl/en/complaints/report-a-data-breach |
| Sweden | IMY | imy.se/en/organisations/data-breach/ |

---

## 7. Evidence preservation

Preserve evidence **before** taking any remediation action that could overwrite it. If in doubt, take the snapshot first, then remediate.

### 7.1 Database snapshot

```bash
# Full pg_dump of production (run from a machine with Supabase CLI + env vars configured)
# Replace $PROJECT_REF with keckqpadzxwwmagnmpuk
export PGPASSWORD="$(supabase db dump --project-ref $PROJECT_REF --print-url | grep -oP '(?<=:)[^:@]+(?=@)')"

# Preferred: use Supabase CLI to dump the full schema + data
npx supabase db dump \
  --project-ref keckqpadzxwwmagnmpuk \
  --data-only \
  --file "incident-$(date +%Y%m%dT%H%M%SZ)-data.sql"

npx supabase db dump \
  --project-ref keckqpadzxwwmagnmpuk \
  --file "incident-$(date +%Y%m%dT%H%M%SZ)-schema.sql"

# Store the dump in a write-once, access-controlled location (not the main repo).
# Example: upload to a private S3/GCS bucket with object lock enabled.
```

**Preserve:**
- `public.messages` — full table at breach time
- `public.users` — full table
- `public.abuse_reports` — full table (relevant if breach relates to a bad actor)
- `auth.users` (via Supabase service role) — for sign-in timestamps
- `cron.job_run_details` — to show when retention cleanup last ran

### 7.2 Vercel deployment freeze

To prevent a new deployment from overwriting the state of the affected version:

```bash
# List recent deployments to identify the affected one
vercel list --scope=<team>

# Promote the LAST KNOWN GOOD deployment to production (if current is broken)
# DO NOT do this until forensics are complete on the current deployment
vercel promote <deployment-url> --scope=<team>

# Alternatively, in the Vercel dashboard:
# Deployments → find the affected deployment → overflow menu → "Keep this deployment"
# This prevents automatic garbage collection.
```

**Preserve:** Download the build output and source map from the affected deployment via Vercel Dashboard → Deployment → Files.

### 7.3 Log export before rotation

Supabase log retention varies by plan. Export before logs age out:

```bash
# Supabase MCP get_logs for each relevant service:
# Services: api, postgres, auth, edge-function, storage, realtime

# Or use the Supabase dashboard: Logs → select service → Export (CSV)
```

**Vercel logs:** Download from Dashboard → Logs → filter by date range → Export.

**Preserve logs for:**
- Auth service (failed logins, sign-in IPs)
- Postgres (query patterns during the incident window)
- Edge functions (delete-account, push-dispatch)
- Vercel API access (timestamps, source IPs)

### 7.4 Audit log retention extension

The daily `him-retention-cleanup` cron job (`pg_cron`) is configured to purge `account_deletion_log` entries older than 30 days. During an active incident, **pause the cron job** to prevent evidence from being auto-deleted:

```sql
-- Pause the cleanup job during incident investigation
update cron.job set active = false where jobname = 'him-retention-cleanup';

-- Resume after evidence is preserved
update cron.job set active = true where jobname = 'him-retention-cleanup';
```

Similarly, do not run `supabase db push` (which would apply pending migrations) until forensics are complete.

---

## 8. Post-incident review template

Hold within 30 days of incident closure. Keep this document in the internal incident record.

---

**Incident ID:** `[INC-YYYY-MM-DD-NNN]`  
**Date of incident:** [Start — End]  
**Date of review meeting:** [DATE]  
**Attendees:** [Names and roles]

---

### 8.1 Timeline summary

| Timestamp | Event | Action taken | Who |
|---|---|---|---|
| [T+0] | Detection | | |
| [T+?] | Declaration | | |
| [T+?] | Containment | | |
| [T+?] | Regulator notification | | |
| [T+?] | User notification | | |
| [T+?] | Remediation complete | | |

### 8.2 Root cause analysis

**What happened:** [One paragraph, factual, no blame]

**Root cause (technical):** [Specific code, configuration, or process that caused the breach]

**Root cause (process):** [What process gap allowed this to reach production / go undetected]

### 8.3 Impact

| Metric | Value |
|---|---|
| Users confirmed affected | |
| Users potentially affected | |
| Data categories exposed | |
| Duration of exposure | |
| Evidence of exfiltration | Yes / No / Unknown |
| Art. 33 notification filed | Yes / No + reasoning |
| Art. 34 user notification sent | Yes / No + reasoning |
| US state notifications filed | [List states] |

### 8.4 What went well

- [Process or technical control that worked as intended]

### 8.5 What did not go well

- [Gap in detection, response, or communication]

### 8.6 Action items

| # | Action | Owner | Due date | Status |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

### 8.7 Art. 33(5) documentation sign-off

> GDPR Art. 33(5) requires controllers to document all personal data breaches, including those that do not require notification.

This post-incident document, together with the incident log and evidence snapshots referenced above, constitutes the Art. 33(5) record for incident `[INC-YYYY-MM-DD-NNN]`. Approved by:

- Legal / DPO: `_________________________` Date: `____________`
- Engineering Lead: `_________________________` Date: `____________`

---

## Appendix A — Quick reference card (print and post)

```
BREACH RESPONSE — H.I.M.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
T+0    Detect → tell Incident Commander NOW
T+1h   Contain the breach, preserve evidence
T+24h  Know: who, what data, how many users
T+72h  FILE with regulator (ICO/CNIL/etc.)
T+?    Notify affected users (no undue delay)
T+30d  Post-incident review

DO NOT:
• Delete logs or alter database before snapshot
• Remediate before preserving evidence
• Send user notifications without legal sign-off
• Assume "no evidence of access" = no breach

ICO (UK):     report.ico.org.uk  |  0303 123 1113
CNIL (FR):    notifications.cnil.fr
Datatilsynet: datatilsynet.dk/english/notification-of-data-breach
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```
