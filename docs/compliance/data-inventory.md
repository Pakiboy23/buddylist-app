# H.I.M. Personal Data Inventory

**App:** H.I.M. (hiitsme)  
**Last updated:** 2026-05-25  
**Prepared by:** Engineering (Claude Code session)  
**Status:** Draft — requires legal review before publication

> **Art. 9 note:** H.I.M. is a social messaging app whose user base is implicitly LGBTQ+. By virtue of being a user of this app, most identity and social-graph data carries a reasonable inference about sexual orientation or gender identity. All such fields are flagged **Art. 9 — orientation-revealing by context** in addition to any other applicable special-category designation.

---

## 1. Personal Data Table

### 1.1 Auth / Identity (Supabase `auth.users`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Email address (synthetic) | `auth.users.email` | Registration — constructed as `{screenname}@hiitsme.app` or legacy `{screenname}@buddylist.com` | Supabase Auth identifier; never shown to users | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Hashed password | `auth.users.encrypted_password` | Registration / password change | Authentication | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Auth UUID | `auth.users.id` | System-generated | Primary key linking all user data | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Sign-in timestamps | `auth.users.last_sign_in_at`, `created_at`, `updated_at` | System-generated | Fraud detection, account security | Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| JWT refresh tokens | `auth.refresh_tokens` (Supabase managed) | Session establishment | Session continuity; rotated on use | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | 3600s JWT expiry; refresh tokens rotated per `supabase/config.toml` | Supabase |
| IP address (login) | Supabase Auth logs (managed infra) | Network layer at sign-in | Fraud / abuse detection | Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Supabase log retention (see sub-processors) | Supabase |

### 1.2 Profile (`public.users`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Screenname | `public.users.screenname` | Registration | Visible identity; used in push payloads and synthetic email | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase, APNs (in push payload) |
| Status message | `public.users.status_msg` | User-entered (AIM-style away message) | Social expression / presence | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until changed or account deletion | Supabase |
| Profile bio | `public.users.profile_bio` | User-entered | Social expression | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until changed or account deletion | Supabase |
| Buddy icon (avatar) | `public.users.buddy_icon_path` (path); file in `buddy-icons` storage bucket | User-uploaded | Visual identity | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until changed or account deletion | Supabase Storage |
| Idle/active timestamps | `public.users.idle_since`, `public.users.last_active_at` | System-generated on activity | Presence display | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Rolling; updated on activity | Supabase |
| Discoverability flag | `public.users.discoverable` | User-set (default true) | Controls appearance in search/browse | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until changed or account deletion | Supabase |
| Screenname-change timestamp | `public.users.screenname_changed_at` | System-generated | Rate-limit screenname changes | Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Created / updated timestamps | `public.users.created_at`, `updated_at` | System-generated | Record integrity | Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |

### 1.3 Direct Messages (`public.messages`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Message body | `public.messages.content` | Sender input | Communication | Contract 6(1)(b) | Yes — contents of communications | Art. 9 — orientation-revealing by context | Until sender or receiver deletes account | Supabase |
| Sender / receiver IDs | `public.messages.sender_id`, `receiver_id` | System (auth) | Message routing | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context (social graph) | Until account deletion | Supabase |
| Sent timestamp | `public.messages.created_at` | System-generated | Message ordering | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Delivery / read receipts | `public.messages.delivered_at`, `read_at` | System-generated | UX feature | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Reply / forward references | `public.messages.reply_to_message_id`, `forward_source_message_id`, `forward_source_sender_id` | Sender action | Conversation threading | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Expiry (disappearing) | `public.messages.expires_at` | Sender-set | Disappearing messages feature | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until expiry or account deletion | Supabase |
| Preview type | `public.messages.preview_type` | System (media type) | Push notification rendering | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Flagged-at (moderation) | `public.messages.flagged_at` | DB BEFORE INSERT trigger | Content safety | Legal obligation 6(1)(c) / Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Edit / delete metadata | `public.messages.edited_at`, `deleted_at`, `deleted_by` | System / user action | Message history integrity | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Reactions (emoji) | `public.message_reactions.emoji` + `user_id` | User action | Social expression | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until removed or account deletion | Supabase |

### 1.4 Message Attachments (`public.message_attachments`, `public.room_message_attachments`, `chat-media` bucket)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Attachment file | `chat-media` bucket path `{userId}/{year}/{month}/{day}/{uuid}-{filename}` | User-uploaded | Media sharing in DMs and rooms | Contract 6(1)(b) | Yes — may include photos/videos | Art. 9 — orientation-revealing by context | Until sender deletes or account deletion | Supabase Storage |
| Attachment metadata | `public.message_attachments.storage_path`, `mime_type`, `file_size`, `original_filename` | System / user upload | File retrieval and display | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until message deleted or account deletion | Supabase |
| Dimensions (images) | `public.message_attachments.width`, `height` | System (upload processing) | Responsive layout | Contract 6(1)(b) | No | No | Until message deleted or account deletion | Supabase |

### 1.5 Saved Messages (`public.saved_messages`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Saved message reference | `public.saved_messages.user_id`, `message_id` | User action | Personal bookmarking | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until unsaved or account deletion | Supabase |

### 1.6 Chat Rooms (`public.rooms`, `public.room_memberships`, `public.room_messages`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Room membership | `public.room_memberships.user_id`, `room_id`, `joined_at` | User action (join room) | Access control and presence | Contract 6(1)(b) | No | Art. 9 — special category: reveals which vibe/regional rooms user belongs to; orientation-revealing by context | Until leave or account deletion | Supabase |
| Last-seen in room | `public.room_memberships.last_seen_at` | System-generated | Unread count computation | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until leave or account deletion | Supabase |
| Room message body | `public.room_messages.body` | User input | Public/semi-public communication | Contract 6(1)(b) | Yes — contents of communications | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Room message author | `public.room_messages.user_id`, `room_id` | System (auth) | Message attribution | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context (social graph) | Until account deletion | Supabase |
| Room message timestamp | `public.room_messages.created_at` | System-generated | Message ordering | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Room message flagged-at | `public.room_messages.flagged_at` | DB BEFORE INSERT trigger | Content safety | Legal obligation 6(1)(c) / Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |
| Room message reactions | `public.room_message_reactions.emoji` + `user_id` | User action | Social expression | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until removed or account deletion | Supabase |
| Room message edits/deletes | `public.room_messages.edited_at`, `deleted_at`, `deleted_by` | System / user action | Message history integrity | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context | Until account deletion | Supabase |

### 1.7 Social Graph (`public.buddies`, `public.user_connections`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Buddy relationship | `public.buddies.user_id`, `buddy_id` | User action | Buddy list feature | Contract 6(1)(b) | No | Art. 9 — reveals who the user associates with; orientation-revealing by context | Until removed or account deletion | Supabase |
| Connection status | `public.user_connections.user_a`, `user_b`, `status` (following/pending/mutual/blocked), `initiated_by` | User action | Follow/mutual-follow feature | Contract 6(1)(b) | No | Art. 9 — reveals social network; orientation-revealing by context | Until removed or account deletion | Supabase |

### 1.8 Trust & Safety (`public.blocked_users`, `public.abuse_reports`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Block record | `public.blocked_users.blocker_id`, `blocked_id` | User action | Safety / harassment prevention | Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Until unblocked or account deletion | Supabase |
| Block reason | `public.blocked_users.reason` (max 240 chars) | User-entered (optional) | Moderation context | Legitimate interest 6(1)(f) | Yes — may contain sensitive content | Art. 9 — orientation-revealing by context | Until unblocked or account deletion | Supabase |
| Abuse report | `public.abuse_reports.reporter_id`, `target_user_id`, `source_message_id` | User action | Trust & safety | Legitimate interest 6(1)(f) / Legal obligation 6(1)(c) | No | Art. 9 — orientation-revealing by context | Legal hold (delete-account Edge Function removes on both sides) | Supabase |
| Report category | `public.abuse_reports.category` | User-selected | Moderation triage | Legitimate interest 6(1)(f) | No | Art. 9 — orientation-revealing by context | Legal hold | Supabase |
| Report details | `public.abuse_reports.details` (max 1200 chars) | User-entered | Moderation context | Legitimate interest 6(1)(f) | Yes — may contain sensitive content | Art. 9 — orientation-revealing by context | Legal hold | Supabase |
| Report status / notes | `public.abuse_reports.status`, `notes` | Admin-entered | Moderation workflow | Legal obligation 6(1)(c) | No | No | Legal hold | Supabase |

### 1.9 Push Notification Tokens (`public.user_push_tokens`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Device push token | `public.user_push_tokens.token` | iOS device (APNs registration) | Push notification delivery | Consent 6(1)(a) | No | No | Until token invalidated (auto-pruned on BadDeviceToken) or account deletion | Supabase, Apple APNs |
| Platform | `public.user_push_tokens.platform` (ios/android/web) | System | Push routing | Consent 6(1)(a) | No | No | Same as token | Supabase, Apple APNs |
| Push environment | `public.user_push_tokens.push_environment` (sandbox/production) | System | APNs endpoint selection | Consent 6(1)(a) | No | No | Same as token | Supabase, Apple APNs |
| Token timestamps | `public.user_push_tokens.created_at`, `updated_at` | System-generated | Stale token detection | Consent 6(1)(a) | No | No | Same as token | Supabase |

### 1.10 User Preferences & Privacy Settings

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Share read receipts | `public.user_privacy_settings.share_read_receipts` | User-set | Read receipt feature toggle | Contract 6(1)(b) | No | No | Until changed or account deletion | Supabase |
| Notification preview mode | `public.user_privacy_settings.notification_preview_mode` (full/name_only/hidden) | User-set | Push payload privacy control | Contract 6(1)(b) | No | No | Until changed or account deletion | Supabase |
| Screen shield enabled | `public.user_privacy_settings.screen_shield_enabled` | User-set | Prevent screenshots in app | Contract 6(1)(b) | No | No | Until changed or account deletion | Supabase |
| DM conversation preferences | `public.user_dm_preferences.user_id`, `other_user_id` | User action | Per-conversation settings | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context (reveals DM partners) | Until account deletion | Supabase |

### 1.11 DM State (`public.user_dm_state`)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| DM state (unread counts, last-seen) | `public.user_dm_state.*` | System-generated | Unread badge and sync | Contract 6(1)(b) | No | Art. 9 — orientation-revealing by context (reveals active DM partners) | Until account deletion | Supabase |

### 1.12 localStorage (Client-Side, Device Only)

> These keys are stored only on-device and are not transmitted to any server except where explicitly noted. They are deleted by the OS on app uninstall.

| Key | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-----|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| `hiitsme:outbox:v1:<userId>` | `src/lib/outbox.ts` | User input (unsent messages) | Offline message queue; max 160 items, 96KB, 4000 chars/msg | Contract 6(1)(b) | Yes — message content | Art. 9 — orientation-revealing by context | Until delivered or app uninstall | None (local only) |
| `hiitsme:app-lock:v1:<userId>` | `src/lib/appLock.ts` | User-set PIN | App lock; stores enabled flag, SHA-256 PIN hash, autoLockSeconds, biometricsEnabled | Contract 6(1)(b) | No | No | Until disabled or app uninstall | None (local only) |
| `hiitsme:dm-preferences:v1:<userId>` | `src/lib/privateChat.ts` | User-set | Per-conversation UI preferences | Contract 6(1)(b) | No | No | Until changed or app uninstall | None (local only) |
| `hiitsme:privacy:v1:<userId>` | `src/lib/privateChat.ts` | User-set | Local privacy settings cache | Contract 6(1)(b) | No | No | Until changed or app uninstall | None (local only) |
| `hiitsme:chatstate:v3:<userId>` | `src/context/ChatContext.tsx` | System | Room join state and unread counts; 7-day TTL | Contract 6(1)(b) | No | Art. 9 — reveals room memberships | 7 days | None (local only) |

### 1.13 Push Notification Payload (In Transit)

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Sender screenname | `users.screenname` → APNs payload `senderName` | System | Push notification display | Consent 6(1)(a) | No | Art. 9 — orientation-revealing by context | In-flight only; not persisted by app | Apple APNs |
| Message preview | `messages.content` or `room_messages.body` (up to 140 chars) → `messagePreview` | System | Push notification display (gated by `notification_preview_mode`) | Consent 6(1)(a) | Yes — contents of communications | Art. 9 — orientation-revealing by context | In-flight only | Apple APNs |
| Target path (deep link) | Constructed from DM/room IDs | System | Deep-link navigation on tap | Consent 6(1)(a) | No | No | In-flight only | Apple APNs |
| Variant (dm/room) | System | System | Push routing | Consent 6(1)(a) | No | No | In-flight only | Apple APNs |

### 1.14 Vercel Analytics

| Field | Source | Collected from | Purpose | Lawful basis (GDPR) | Sensitive PI (CCPA) | Special category (GDPR Art. 9) | Retention | Sub-processors |
|-------|--------|----------------|---------|---------------------|---------------------|-------------------------------|-----------|----------------|
| Page view / navigation event | `@vercel/analytics` (web only) | Browser | Product analytics | Legitimate interest 6(1)(f) — **verify consent mode** | No | No | Per Vercel Analytics retention policy | Vercel |
| IP address (web) | Vercel infra (web only) | Network layer | Geo-aggregation for analytics | Legitimate interest 6(1)(f) — **verify consent mode** | No | No | Per Vercel log retention | Vercel |
| User-agent / device type | Vercel infra (web only) | Browser | Device breakdown in analytics | Legitimate interest 6(1)(f) — **verify consent mode** | No | No | Per Vercel Analytics retention | Vercel |

---

## 2. Sub-processors

| Sub-processor | Role | Data transferred | Data location | DPA / compliance reference |
|---------------|------|-----------------|---------------|---------------------------|
| **Supabase, Inc.** | Postgres database, Auth, Realtime, Storage, Edge Functions | All user data, messages, files, tokens, logs | US (AWS us-east-1 by default) | Supabase DPA + SOC 2 Type II |
| **Vercel, Inc.** | Web hosting, Vercel Functions (push-dispatch, api/ routes), Vercel Analytics | IP addresses, user-agent (web), push payloads in transit via Vercel Functions | US | Vercel DPA + SOC 2 Type II |
| **Apple Inc. — APNs** | iOS push notification delivery | Device push token, notification payload (senderName, messagePreview gated by privacy setting, deep-link path) | Apple infrastructure | Apple DPLA; no DPA available |
| **Google — FCM** | Android push notification delivery (**not yet implemented** in code — platform enum includes android but no FCM send path exists) | Would be: device token, notification payload | Google infrastructure | Google DPA (when implemented) |
| **Capacitor / Ionic** (`@capacitor/*`) | Native iOS/Android bridge | No data transmitted externally; local bridge only | N/A — on-device | Open source, no DPA |
| **`@aparajita/capacitor-biometric-auth`** | Biometric authentication | No data transmitted; uses device Secure Enclave / Keystore locally | N/A — on-device | Open source, no DPA |
| **`jose` (npm)** | JWT encoding/decoding | No data transmitted; cryptographic library | N/A — local computation | Open source, no DPA |
| **`bad-words` (npm)** | Profanity wordlist (compile-time only) | No runtime data; wordlist baked into migration SQL and `src/lib/profanityTerms.generated.ts` at build time | N/A — compile-time | Open source, no DPA |
| **Formspree** | Landing-site signup form (`hiitsme.app` — `him-landing` repo, not this repo) | Email address of sign-ups | US | Formspree Privacy Policy — **confirm DPA exists** |

---

## 3. Gaps / Questions for Legal

1. **Vercel Analytics consent gate** — `@vercel/analytics` is included in `package.json` and presumably active on the web deployment. GDPR requires consent (or a documented legitimate-interest balancing test) before behavioral analytics on EU users. No consent banner or opt-out mechanism is implemented. Confirm: (a) is analytics active? (b) does it use cookies or fingerprinting that triggers ePrivacy? (c) implement consent gate or document LI balancing test.

2. **FCM / Android push** — The `user_push_tokens.platform` enum includes `android`, and FCM is implied, but no FCM send path exists in `push-dispatch` or `api/push/dispatch.ts`. If/when Android push ships, Google must be added as a sub-processor with a signed DPA, and consent must be re-collected for the new channel.

3. **Supabase managed log retention** — Supabase retains Postgres logs, Auth logs (including IP addresses at sign-in), and Edge Function logs on managed infrastructure. Exact retention periods depend on the Supabase plan tier. Confirm current plan and log retention duration; add to privacy notice.

4. **IP address at message-send (Vercel Functions)** — `api/push/dispatch.ts` and `api/auth/recovery/*` receive the sender's IP address via Vercel's infra. These IPs appear in Vercel's access logs. Confirm whether Vercel retains raw IPs or only aggregated geo-data, and add to privacy notice.

5. **Chat media (`chat-media` bucket) — public access** — The bucket is configured `public` in migration `20260320000010_chat_media.sql`. Any attachment URL is guessable if the path pattern is known. Confirm: (a) is this intentional? (b) does Supabase Storage enforce auth on individual objects despite the bucket being public? Recommend restricting to authenticated access unless CDN-public URLs are required.

6. **Moderation data retention for abuse reports** — The `delete-account` Edge Function deletes `abuse_reports` where `reporter_id = user` OR `target_user_id = user`. If an admin has actioned a report, that record is also deleted. Confirm with legal whether actioned safety records must be retained after account deletion for legal-obligation purposes under applicable law (e.g., EU DSA Art. 17 record-keeping).

7. **Art. 9 special-category processing** — Flagging most data as orientation-revealing by context requires explicit consent or another Art. 9(2) basis. The app currently relies on Art. 6 bases (contract, legitimate interest). Legal must confirm which Art. 9(2) exemption applies — most likely (a) explicit consent or (e) manifestly made public by the data subject. A corresponding entry in the privacy notice and a consent record are required.

8. **`notification_preview_mode = full` as default** — The push payload includes message content (up to 140 chars) by default. Under GDPR and ePrivacy, transmitting message content through a third-party infrastructure (APNs) may require an explicit consent option, especially given Art. 9 sensitivity. Confirm whether the privacy-setting UI is surfaced clearly enough to constitute informed consent.

9. **Biometric data** — `@aparajita/capacitor-biometric-auth` interfaces with device biometrics. The biometric data itself never leaves the device (Secure Enclave / Android Keystore), but `appLock.ts` stores `biometricsEnabled: boolean` in localStorage. GDPR Art. 9 defines biometric data processed for the purpose of uniquely identifying a natural person as special-category. Legal should confirm whether enabling the flag alone (without processing biometric templates) triggers Art. 9 obligations.

10. **`saved_messages` retention after sender deletes** — If user A saves a message from user B, and user B later deletes their account, the `saved_messages` row for user A still holds a reference to user B's `message_id`. Confirm: is the underlying message also deleted on account deletion? (The delete-account Edge Function deletes from `messages` where `sender_id = user` — so the message body is deleted but the `saved_messages` FK may be orphaned.) Clarify intended behavior.

11. **No data processing agreement on file for Formspree** — The landing-site signup form (`him-landing` repo) uses Formspree. Confirm a DPA is in place if EU users may sign up.

12. **Retention schedules are undefined** — Most fields above list "Until account deletion" as retention. There are no automated purge jobs for expired messages (`expires_at`), stale presence timestamps, or old moderation records. A formal retention schedule with automated enforcement is required for GDPR Art. 5(1)(e) storage limitation compliance.

13. **Privacy notice** — Confirm a published privacy notice at `hiitsme.app/privacy` covers all data categories listed here, names all sub-processors, and provides Art. 13/14 disclosures including lawful bases, special-category grounds, and data-subject rights.
