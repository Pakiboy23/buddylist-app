# v2.1 — Engineering Release Sign-off

**Prepared:** 2026-07-23 · App: H.I.M. (`com.hiitsme.app`, App ID 6761863631)

## Status: GREEN, pending one merge gate

| Gate | State |
|---|---|
| PR #88 CI — build + unit tests | ✅ success |
| PR #88 — Vercel preview | ✅ deployed |
| PR #88 — Xcode Cloud Build (device + simulator) | ✅ success |
| PR #88 — **Xcode Cloud Archive - iOS** | ✅ **success** (native Swift incl. create-circle compiles + archives) |
| Unit tests | ✅ 167 pass · `tsc --noEmit` clean · lint clean |
| Prod migrations (buzz_cooldown, room_message_client_msg_id) | ✅ applied + verified live |
| `pro_entitlement` migration | ⏸️ intentionally unapplied (dormant until 2.1 monetization go) |
| Web/native bundle resync | ✅ committed, index.html↔chunks consistent |
| `MARKETING_VERSION` | ✅ 2.1 (matches the ASC `PREPARE_FOR_SUBMISSION` record) |

## The one gate: merge PR #88
All of 2.1's content (native BuddyList, the folded-in create-circle flow, and the four hardening fixes) lives on `claude/release-hardening-2-0-2`. `main` is still at #87. **Xcode Cloud archives `main`**, so #88 must merge before the 2.1 build that gets submitted is produced. The PR-branch archive already proves it builds.

## What's in 2.1 (engineering view)
- **New social surface (native iOS BuddyList):** presence-first UI, Buddy Circles (private grouping), Knock (buddies-only, 10-min cooldown), Buzz (now 30-s cooldown), mutual context, away-message replies.
- **Rooms/messaging:** "Seen by N" receipts, clearer read-receipt setting.
- **Reliability fixes shipped this cycle:** chat-room navigation freeze, presence-ring accuracy, "Last active" accuracy, account self-heal, **outbox message-loss**, **room-message duplicate-on-retry** dedup.

## Security-advisor sweep (live DB)
Ran Supabase security advisors post-migration. **No 2.1-introduced findings.** Standing backlog (pre-existing, NOT release-blocking; log for a future hardening pass):
- ~30 `SECURITY DEFINER` functions carry `EXECUTE` to `anon`/`authenticated` (rooms, presence, unread, `repair_own_profile`). Most are the app's intended RPC API and validate `auth.uid()` internally; the `anon` grants on state-mutating RPCs (`clear_dm_unread`, `bump_*`) are sloppy-but-inert (they no-op without an auth context) and worth tightening.
- `public.debug_auth()` — a debug RPC executable by `authenticated`; drop it in a cleanup migration.
- `pg_net` extension in `public` schema; `account_deletion_log` has RLS-on/no-policy (deny-all, correct for an internal audit log).

## Post-submission watch
After #88 merges, Xcode Cloud archives 2.1 → TestFlight. Confirm the uploaded build's marketing version reads **2.1** and attach it to the 2.1 ASC record before submitting for review.
