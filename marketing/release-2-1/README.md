# H.I.M. v2.1 — Release Readiness Package

**Assembled:** 2026-07-23 · App: H.I.M. (`com.hiitsme.app`, App ID 6761863631) · Version **2.1**

Three teams — engineering, product, and marketing — prepared this release. Every
feature claim in every file was verified against shipped code and, where
relevant, the live production database. This README is the index and the
cross-team reconciliation.

## The one action that gates everything: **merge PR #88**

All of 2.1's code (native BuddyList, Buddy Circles, Knock, mutual context,
"Seen by N", away-message replies, and the reliability fixes) lives on
`claude/release-hardening-2-0-2` (PR #88). `main` is still at #87. **Xcode Cloud
archives `main`**, so the 2.1 build that gets submitted is not produced until
#88 merges. Its CI — including the iOS Archive — is already green.

## Deliverables

| File | Team / role | What it is |
|---|---|---|
| `engineering-signoff.md` | Engineering | CI/build/migration status; the merge gate; security-advisor sweep. |
| `release-readiness.md` | Product Manager | Feature-by-feature verification vs. source; ordered Go/No-Go. |
| `asc-submission.md` | App Store Optimizer | Paste-ready "What's New", listing assessment, screenshot plan, exact ASC steps, 7 blockers. |
| `social-push-plan.md` | Social Media Strategist | Cross-channel launch strategy + calendar (rides the OPERATION PORCH LIGHT flight). |
| `social-tiktok.md` | TikTok Strategist | 5 scripted concepts, launch-week cadence, search posture, do-not list. |
| `social-twitter.md` | Twitter Engager | Launch thread, 5 standalone posts, reply strategy, 2.1 do-not list. |

## What 2.1 ships (verified against prod + code)

| Feature | Verified | Notes |
|---|---|---|
| Native BuddyList (presence-first) | ✅ | iOS Swift shell; archives clean on #88. |
| **Buddy Circles** | ✅ | `buddy_circles` / `buddy_circle_members` live in prod; owner-only RLS; private notes-to-self. |
| **Knock** | ✅ | Buddies-only ping, 10-min cooldown; `enforce_knock_rules()` live in prod; on `main` + #88. |
| **Follow** (`user_connections`) | ✅ | One-way, gates presence/away visibility. Live-render status to confirm on device (see below). |
| **Mutual context** | ✅ | `get_mutual_context` RPC — intersection-only, block-excluded, capped at 8 (gate verified below). |
| **"Seen by N"** | ✅ | Aggregate presence-derived count, never names — NOT per-person read receipts. |
| Away-message replies | ✅ | Quote a buddy's status into a DM draft. |
| Buzz (hardened) | ✅ | Now 30-s cooldown; pre-existing approved claim #7. |

## Cross-team reconciliation (resolved)

One material conflict surfaced between the marketing agents and was resolved
against ground truth (production DB + all branches):

- **"Knock" — CONFLICT, resolved: Knock is real.** The social-push-plan draft
  concluded Knock "does not exist" (a file/profile-sheet grep missed it — Knock
  lives in `page.tsx` / `ChatWindow.tsx`). Ground truth: 62 refs on `main`, two
  applied migrations, `enforce_knock_rules()` live in prod. A dated integrator's
  correction (§0a of that file) supersedes the error. **Both Knock and Follow are
  real, distinct, and marketable.**
- **"Seen by N" vs. claims-register DNC #5.** All agents agree and copy is scoped
  correctly: it is an *aggregate count that never names anyone*, materially
  different from the per-person room read receipts DNC #5 bans. Must never be
  phrased as "read receipts."

## Product-gate verifications (run against live prod DB, 2026-07-23)

The Product Manager routed two items it couldn't reach to hard gates. Both were
run and **both pass**:

1. **Mutual-context outing risk — PASS.** `private.get_mutual_context` is
   intersection-only: it lists *shared* rooms and *mutual* buddies only, caps the
   list at 8, requires the viewer to be a buddy of or share an active room with
   the target, and excludes any pair where a block exists in either direction. It
   never returns the target's full buddy list.
2. **Account-deletion completeness (Guideline 5.1.1(v)) — PASS.** All FKs on the
   new tables `ON DELETE CASCADE` off `public.users`
   (`buddy_circles.owner_id`, `buddy_circle_members.{owner_id,buddy_id,circle_id}`),
   so deleting the user row sweeps them automatically; `user_connections` is
   additionally wiped explicitly in the `delete-account` Edge Function. No orphan
   rows survive account deletion.

## Standing governance item (not release-blocking, needs founder action)

The 2.1 features (Buddy Circles, Knock, Follow, mutual context, "Seen by N",
away-message replies) all **post-date the claims register's last verification
(2026-07-15)**. They are code-true, but by the register's own rule they need
entries (drafts proposed as #25–28 across the marketing files) plus founder
sign-off before any of the copy in these files ships publicly. This is fine for
App Store "What's New"; it must clear before the campaign reuses the lines.

## Non-blocking notes carried from the specialists

- **No IAP in 2.1.** The dormant `pro_entitlement` / `is_pro` code merged but its
  migration is intentionally unapplied. No paywall, Pro badge, or SKU is
  reachable; the Paid Apps Agreement is an IAP-only dependency that does not
  block this release. (ASO Blocker B1: confirm none is reachable in the binary.)
- **Internal asset names are `aim-*`** (e.g. `/sounds/aim-instant-message.mp3`);
  that string must never appear on screen (nostalgia-trademark rule).
- **Follow live-render** activates only when `BuddyProfileSheet` receives a
  `currentUserId` prop — confirm the production render passes it before Follow
  content ships.
