# On-device Storage Inventory

Audited: 2026-05-25  
Scope: `src/` — all `localStorage`, `sessionStorage`, and `clientStorage` usage.

**sessionStorage** — not used anywhere in the codebase.  
**Cookies** — not set by the app. Supabase JS client uses `localStorage` for session persistence, not cookies.

## Inventory

| Key | Storage | Purpose | Expiry | Strictly Necessary |
|-----|---------|---------|--------|-------------------|
| `sb-*-auth-token` | localStorage | Supabase auth session (access + refresh tokens). Key format is `sb-{projectRef}-auth-token`. | Cleared on sign-out; refresh token rotates on each use (~7 days idle expiry) | **Yes** — authentication |
| `hiitsme_theme` | localStorage | User's color-scheme preference (`light` / `dark` / `system`). Removed when user selects "system". | Until changed or browser data cleared | **Yes** — UI rendering |
| `hiitsme:away-presets:{userId}` | localStorage | User's saved away-message presets. Per-user (keyed by UUID). | Cleared on sign-out | **Yes** — core messaging feature |
| `hiitsme:away-settings:{userId}` | localStorage | Auto-away configuration (threshold, reply-enabled flag). Per-user. | Cleared on sign-out | **Yes** — core messaging feature |
| `hiitsme:away-cooldowns:{userId}` | localStorage | Timestamps used to throttle auto-reply frequency. Per-user. | Cleared on sign-out | **Yes** — prevents reply spam |
| `hiitsme:buddy-sort:{userId}` | localStorage | Buddy-list sort order preference. Per-user. | Cleared on sign-out | **Yes** — UI state |
| `hiitsme:outbox:v1:{userId}` | localStorage | Offline message queue for reliable delivery when connectivity is lost. Per-user. | Cleared on delivery or sign-out | **Yes** — offline-tolerant messaging |
| `hiitsme_rich_text_format` | localStorage | Rich-text composer format state (bold, italic, etc.). Not user-specific. | Until changed or browser data cleared | **Yes** — UI state for message composer |
| `hiitsme:dm-preferences:v1:{userId}` | localStorage | Per-conversation preferences (pinned, muted, archived, chat theme). Per-user. | Cleared on sign-out | **Yes** — core UX |
| `hiitsme:privacy:v1:{userId}` | localStorage | Local cache of privacy settings (read receipts, notification preview mode). Per-user. | Cleared on sign-out | **Yes** — avoids redundant network calls for privacy-sensitive UI |
| `hiitsme:app-lock:v1:{userId}` | localStorage | App-lock settings: enabled flag, SHA-256 PIN hash (never the raw PIN), auto-lock duration, biometrics flag. Per-user. | Cleared on sign-out | **Yes** — security feature |
| `storage_notice_acknowledged` | localStorage | Records that the user dismissed the EU storage disclosure banner. | Until browser data cleared | **Yes** — avoids repeatedly showing the notice |
| `__hiitsme_storage_probe__` | localStorage | Transient write-then-delete used to detect whether localStorage is available. Never persisted. | Immediately removed | **Yes** — internal storage availability check |

## Classification

All keys are **strictly necessary** — they exist to deliver the core service the user explicitly requested. No keys are used for:
- Advertising or ad targeting
- Cross-site tracking
- Analytics
- Non-essential personalisation that persists beyond the user's chosen preferences

Because all storage is strictly necessary, GDPR ePrivacy consent is not required. However, a one-time disclosure notice is shown to EU/EEA/UK users to meet transparency obligations under GDPR Article 13.

## Cleared on sign-out

All per-user keys (those containing `{userId}` in the key name) are removed from localStorage when the user signs out. Theme and rich-text format preferences are device-level and survive sign-out, but contain no personal data.

## Cleared on account deletion

Account deletion triggers the `delete-account` Edge Function which wipes all server-side data. Device-local keys are cleared in the sign-out step that follows account deletion.
