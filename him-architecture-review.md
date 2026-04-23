# H.I.M. — Architecture Review
**Date:** April 2026 | **Scope:** Full stack — framework, schema, data model, realtime layer

---

## TL;DR

Your instinct is right. The architecture has real problems and they're findable. There are seven distinct issues across the stack, ranging from a critical data model contradiction to a foundational framework mismatch. None of them are unfixable, but a few need to be addressed before launch or they'll compound.

---

## What Was Reviewed

Sources pulled and analyzed:

- Supabase project: **BuddyList** (`keckqpadzxwwmagnmpuk`, us-west-2)
- Vercel project: **hiitsme-app** (deployed Next.js app)
- Code artifacts: `supabase.ts`, `GroupChatWindow.tsx` (from realtime-fix doc)
- Design system fixes doc — revealed component structure and naming
- GTM Kit — confirmed platform scope (iOS-only at launch)

---

## Issue 1 — Dual Social Graph (Critical)

**The problem:** There are two separate tables modeling user relationships:

- `buddies` — 22 rows, active, used by the app. States: `pending` / `accepted`. FKs point to `public.users`.
- `user_connections` — 0 rows, empty, never used. States: `following` / `pending` / `mutual` / `blocked`. FKs point to `auth.users` (not `public.users`).

These are fundamentally different models. `buddies` is a symmetric friendship system. `user_connections` is an asymmetric follow graph. They have different state machines, different FK targets, different semantics.

**What happened:** At some point you considered switching the social model from mutual buddy connections to a Twitter-style follow graph. You built the table but never migrated to it. Now you have a ghost table sitting in the schema that looks intentional but isn't used by anything.

**Why it matters:** Any new developer (or future version of you) reading this schema will not know which one is authoritative. It creates a fork in how you think about the product — the buddy model and the follow model lead to completely different product decisions.

**Fix:** Drop `user_connections`. If you ever want a follow graph, you'll redesign it then with full product intent behind it. Right now it's noise.

---

## Issue 2 — Next.js + Capacitor Is the Wrong Framework Pairing (High)

**The problem:** The app is built in Next.js and wrapped in Capacitor for iOS. This is a real mismatch.

Next.js is a server-rendering framework. Its core value is SSR, server components, API routes, and edge delivery. Capacitor packages a web app as an iOS binary and serves it locally — there is no server. You're running Next.js as a static export or in full SPA mode, which means you're getting none of the SSR value and all of the framework complexity.

The realtime-fix doc is a direct symptom of this. The issue described — "Capacitor's HTTP session and WebSocket session can diverge" — is a class of bug that exists because Next.js's auth layer and Supabase's WebSocket layer make different assumptions about the runtime environment. In a browser, that's fine. Inside a Capacitor container, the assumptions break.

The fix in that doc (`detectSessionInUrl: false`, explicit `setAuth()` on subscribe, client-side filter removal) is all correct — but it's patching a gap caused by the framework mismatch, not solving anything at the root.

**What the right stack looks like for this app:**

| Layer | Current | Better for this product |
|---|---|---|
| Frontend | Next.js + Capacitor | React + Vite + Capacitor |
| Or, go native | — | React Native (Expo) |
| Backend / DB | Supabase | Supabase (keep this) |
| Auth | Supabase Auth | Supabase Auth (keep this) |
| Realtime | Supabase Realtime | Supabase Realtime (keep this) |

React + Vite + Capacitor is lighter, faster to build, and has zero SSR surface area to fight. Expo/React Native is the right call if native performance or native UI components become important for the social layer (animations, gesture handling, etc.).

**Honest caveat:** Migrating the framework mid-build is costly. If you're close to launch and the Capacitor issues are manageable with patches like the realtime fix, ship it. But this is the thing to fix in v2 and the reason future bugs will keep feeling unexplainable.

---

## Issue 3 — Room Membership Is Tracked Twice (High)

**The problem:** Two tables track the same thing — that a user is in a room:

- `room_participants` — `room_key` + `user_id`, `joined_at`, `updated_at`. That's it.
- `user_active_rooms` — `user_id` + `room_key`, `room_name`, `unread_count`, `last_read_at`, `updated_at`.

Every "join room" action writes to both. Every "leave room" action should remove from both. `room_participants` has 13 rows. `user_active_rooms` also has 13 rows. They're in sync right now, but you're one edge case away from them diverging.

`user_active_rooms` is the richer table — it has unread counts and read state. `room_participants` is the simpler one that probably predates it. 

**Fix:** Merge `room_participants` into `user_active_rooms`. Add the missing `joined_at` column to `user_active_rooms` and drop `room_participants`. Any query that uses `room_participants` for membership checks should point to `user_active_rooms`.

---

## Issue 4 — Inconsistent Primary Key Types Across Message Tables (Medium)

**The problem:**

- `messages.id` — `bigint` (sequential auto-increment identity)
- `room_messages.id` — `uuid`

These are two different identifier strategies on what should be parallel systems. The downstream effect is visible in the attachment tables:

- `message_attachments.message_id` — `bigint`
- `room_message_attachments.message_id` — `uuid`

You can't write a single helper function that references a message ID without knowing which type it is. You can't build a unified "message" abstraction. You can't safely join across these without type casting.

**Fix:** Pick one. UUID is the right call — it's consistent with the rest of your schema, doesn't leak sequence information, and works cleanly in Supabase Realtime payloads. Migrate `messages.id` to UUID. This is a migration with data implications (14 users, 163 messages right now — doable before launch, painful after scale).

---

## Issue 5 — Presence Field Sprawl on the Users Table (Medium)

**The problem:** The `users` table has too many overlapping fields trying to represent the same thing:

```
status          — text, default 'Available'  (the enum: Available, Away, Busy…)
status_msg      — text, default 'I am away from my computer.'  (an away message?)
away_message    — text, nullable  (also an away message?)
is_online       — boolean
last_seen       — timestamp
idle_since      — timestamp (nullable)
last_active_at  — timestamp (nullable)
```

That's two fields representing away message text (`status_msg` vs `away_message`) and four fields tracking online/presence state (`is_online`, `last_seen`, `idle_since`, `last_active_at`). The default on `status_msg` ("I am away from my computer.") is a relic from early development that's been left in place.

**What this should look like:**

```
status          — enum ('available', 'away', 'busy', 'offline')
away_message    — text, nullable  (one field, not two)
last_active_at  — timestamp  (one field for last known activity)
```

`is_online` and `idle_since` are derivable from `status` and `last_active_at`. `last_seen` is a duplicate of `last_active_at` under a different name. `status_msg` is either a duplicate of `away_message` or was the original name that got replaced without cleanup.

**Fix:** Consolidate to three fields. Remove `is_online`, `last_seen`, `idle_since`, and `status_msg`. Make sure `status` has a proper enum constraint (it currently has none — anything can be written to it). This is a clean-up migration, not a redesign.

---

## Issue 6 — Duplicate Attachment Table Structure (Medium)

**The problem:** `message_attachments` and `room_message_attachments` are structurally identical:

```
id, message_id, uploader_id, bucket, storage_path,
file_name, mime_type, size_bytes, created_at
```

Same columns. Same constraints. Same default bucket (`'chat-media'`). Same 10MB size cap. The only difference is the FK type on `message_id` (bigint vs uuid — which is itself a symptom of Issue 4).

**Two options:**

Option A (preferred): Unify into a single `message_attachments` table with a `context` column (`'dm'` or `'room'`) and a normalized `message_id` (uuid, after fixing Issue 4).

Option B (acceptable): Keep them separate but document them explicitly as intentionally parallel. Less clean but less migration risk at this stage.

---

## Issue 7 — Custom Password Reset Infrastructure on Top of Supabase Auth (Low)

**The problem:** There are four tables for a custom password reset flow:

- `account_recovery_codes` (7 rows)
- `password_reset_tickets` (7 rows)
- `password_reset_audit` (17 rows)
- `password_reset_attempts` (2 rows)

Supabase Auth has password reset built in. This custom implementation has its own ticket issuance, audit trail, rate limiting, and recovery code system — all things Supabase handles natively.

**Why this happened:** H.I.M. uses screennames, not emails, as the primary login identifier. Supabase's built-in password reset relies on email. Since email is secondary (or potentially not exposed to users), a custom flow was necessary. That part is understandable.

**The concern:** You're now maintaining security-sensitive auth infrastructure. Recovery codes, ticket salts, rate limiting logic — all of this can go wrong in ways that aren't obvious. Make sure this is tested thoroughly and that the audit table is actually being queried (it's not useful if it's just written to and never read for anomaly detection).

This is a low severity issue now, but it becomes medium severity post-launch when there are real users trying to recover accounts.

---

## Summary Table

| Issue | Severity | Fix complexity | Do it before launch? |
|---|---|---|---|
| Dual social graph (`buddies` + `user_connections`) | Critical | Low (drop a table) | Yes |
| Next.js + Capacitor mismatch | High | High (framework migration) | No — ship, fix in v2 |
| Room membership tracked twice | High | Medium (merge tables) | Yes |
| Inconsistent message PKs | Medium | Medium (data migration) | Yes — 163 rows now |
| Presence field sprawl | Medium | Low (schema cleanup) | Yes |
| Duplicate attachment tables | Medium | Medium | After launch |
| Custom password reset infra | Low | None right now | No, but test it |

---

## What to Do This Week

1. Drop `user_connections`. No migration needed — it's empty.
2. Add `joined_at` to `user_active_rooms`, migrate data from `room_participants`, drop `room_participants`.
3. Migrate `messages.id` to UUID while you have 163 rows, not 163,000.
4. Clean up the `users` table presence fields — remove `status_msg`, `is_online`, `last_seen`, `idle_since`, add an enum constraint to `status`.

Items 1–4 together are maybe 2–3 hours of migration work at current data volume. After launch, each of those gets progressively harder.

---

*H.I.M. Architecture Review | Saman Technologies*
