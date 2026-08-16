# H.I.M. v2.1 — App Store Release Readiness

**Author:** Alex (PM) · **Prepared:** 2026-07-23 · **Status:** Draft for Go/No-Go
**Release branch:** `claude/release-hardening-2-0-2` (HEAD `8787678`, marketing version bumped to **2.1** in `8923dae`)
**Publisher:** Saman Technologies LLC · Bundle: `com.hiitsme.app` · Supabase project `keckqpadzxwwmagnmpuk`

**How this was verified:** every feature and claim below was traced to shipped source on the release branch (file paths cited). Where a claim could **not** be fully verified in code I say so explicitly and route it to the Go/No-Go gates. Governing references read: `marketing/campaign-2026-q3/strategy/brand-brief.md`, `.../claims-register.md`, `.../reporting/asc-july-build-sheet.md`.

---

## 1. 2.1 Feature Inventory (verified against code)

### New social features

| Feature | One-line user benefit | Verified in |
|---|---|---|
| **Native iOS BuddyList (presence-first)** | Sign on to a live buddy list that leads with who's around, not a queue of faces. | `src/lib/nativeShell.ts` (`NativeMilestoneOne*` bridge: buddies, circles, presence, conversations, rooms; `sendKnock`, `setBuddyCircle`, `createBuddyCircle`); `publishNativeMilestoneOneState`; `src/app/hi-its-me/page.tsx` builds `nativeMilestoneOneBuddies` / `nativeMilestoneOneCircles` (lines ~3855–3895). Chrome ownership guard `routeOwnsNativeShellChrome`. |
| **Buddy Circles** | Privately organize your buddy list (Family / Work / Besties) — only you ever see it, and you can hide a circle's presence or mute its alerts. | `src/lib/buddyCircles.ts`, `src/components/BuddyCircles.tsx` (create/rename/delete/assign, `CirclePicker`), `page.tsx` handlers (~5706–5816), migration `supabase/migrations/20260722130125_buddy_circles.sql` (owner-only RLS + `enforce_buddy_circle_member` trigger). |
| **Knock** | Send a buddy a quiet "hi, thinking of you" — no thread to keep up, buddies only. | `page.tsx` `handleSendKnockToBuddy` (~5632): gated by `acceptedBuddyIdsRef` ("Knocks are only available for buddies."), writes a `messages` row with `preview_type: 'knock'`; receive-side alert in the `public:messages` handler (~4284); 10-min per-pair cooldown in `handleSendMessage` (`KNOCK_COOLDOWN = 10 * 60_000`, ~5480). |
| **Buzz (rate-limited)** | Get a buddy's attention inside a DM — now capped so it can't be spammed. | `page.tsx` `handleSendMessage` buzz path (`preview_type: 'buzz'`, `'⚡ Buzz!'`, ~5470–5504); client cooldown **30s per pair** mirroring the server `buzz_cooldown` trigger; receive-side buzz flash/haptic (~4279). |
| **Mutual context on profiles** | See the rooms and buddies you already share before you say hi ("You both know" — not a compatibility score). | `src/lib/mutualContext.ts` (`get_mutual_context` RPC), `src/hooks/useMutualContext.ts`, `src/components/MutualContextCard.tsx`; surfaced in `BuddyProfileSheet.tsx` and the room roster in `GroupChatWindow.tsx`. |
| **Away-message replies** | Reply straight to a buddy's away message; and if you're away, buddies get your away note as an auto-reply. | `src/lib/awayMessageReply.ts` (`buildAwayMessageReplyDraft`), `page.tsx` `handleReplyToAwayMessage` (~5430, seeds a quoted DM draft); auto-responder `sendAutoAwayReply` (~4139, cooldown-guarded). |
| **"Seen by N" room receipts + clearer read-receipt setting** | See how many people caught your latest room message; clearer control over DM read receipts. | `src/lib/roomReadReceipts.ts` (`countSeenByOthers` / `formatSeenByLabel`, derived from `room_memberships.last_seen_at`); DM read-receipt toggle copy clarified (commit `89e48e2`). **Note:** this is an aggregate **count on your own latest message**, not per-user room read state — it exposes nothing the roster doesn't already show. |

### Reliability / hardening fixes

| Fix | User-facing benefit | Verified in |
|---|---|---|
| **Chat-room navigation freeze** | Rooms no longer appear frozen after tapping in on iOS. | `nativeShell.ts` `routeOwnsNativeShellChrome` (hides native chrome on standalone `/hi-its-me/rooms*` routes so back/tab commands aren't dropped); commit `5549e81`. |
| **Presence-ring accuracy** | The green "online" ring only pulses for people who are actually online. | commits `855f9e7` (stop ring pulsing on every avatar), `a7c88da` (don't mark optimistically-invited buddies as active). |
| **"Last active" accuracy** | Buddy "Last active" reflects the true sign-off moment. | presence `leave` handler stamps `last_active_at` at real sign-off (`page.tsx` ~3548); best-effort final stamp in `handleSignOff` (~4362); commit `a63a3ee`. |
| **Account self-heal** | Accounts with a missing profile row repair themselves instead of breaking buddy/room actions. | `src/lib/profileRepair.ts` `upsertOwnProfileWithRepair`, `page.tsx` bootstrap (~3149); commits `90ffc4e`/`57da7d6`. |
| **Outbox message-loss fix** | Queued messages no longer get dropped on retry. | commit `3f493d9` ("harden release — outbox message loss…"); outbox path in `page.tsx` + `src/lib/outbox.ts`. |
| **Room-message dedup** | Room messages don't double-post on reconnect/retry. | commit `3f493d9`; `sendRoomMessageWithClientMessageId` + `room_message_client_msg_id` migration (applied to prod). |

---

## 2. "What's New" copy

### App Store release notes (paste into ASC "What's New")

```
What's new in 2.1

Your buddy list, front and center.

• Buddy Circles — group your buddies into private circles (only you ever
  see them), and quiet the ones you want to.
• Knock — send a buddy a low-key "hi." No thread to keep up, no pressure.
• Buzz — get a buddy's attention in a DM (now gently rate-limited).
• You both know — see the rooms and buddies you already share before you
  say hi.
• Reply right to a buddy's away message.
• "Seen by" on your latest room message, plus clearer read-receipt controls.

Under the hood: a smoother native buddy list, more accurate presence and
"last active," and fixes for room navigation, message delivery, and
sign-on.

Thanks for being here early.
```

(~640 chars, well under 4000. Voice check: honest smallness, no counts, no dating vocabulary, no "encrypted/anonymous," Face ID not invoked, retro-generic — passes brand-brief §2 and the claims-register DO-NOT-CLAIM table.)

### One-line version

```
Buddy Circles, Knock, and a faster native buddy list — plus presence, delivery, and sign-on fixes.
```

**Claims-register note:** Buddy Circles, Knock, Mutual context, Away-message replies, and "Seen by N" post-date the register (verified 2026-07-15 @ `35f76e2`) and are **not yet listed** there. The copy above is defensible against shipped code, but before any *campaign* asset repeats these, add them to the APPROVED table with these evidence paths. "Buzz" is already Approved #7.

---

## 3. App Review Risk Assessment — new UGC/social surfaces

Apple Guideline **1.2** (user-generated content) requires: (a) a content filter, (b) a report mechanism, (c) a block mechanism, (d) published contact, (e) acting on reports. H.I.M. already satisfies all five (claims-register #15/#16, CLAUDE.md trust-and-safety). The question for 2.1 is whether the **new** surfaces preserve that coverage.

| New surface | Is it free-text UGC? | Moderatable | Blockable | Reportable | Verdict |
|---|---|---|---|---|---|
| **Knock** | No — fixed `'👋 Knock'` payload | Flows through the `messages` insert path → same content-moderation trigger; buddies-only gate | Yes — sender is a buddy; block via profile sheet removes them | Yes — renders as a DM message; DM long-press → `MessageReportSheet` | **Low risk.** Not a content vector; inherits full DM safety. |
| **Buzz** | No — fixed `'⚡ Buzz!'` payload | Same as Knock | Yes | Yes (DM message) | **Low risk.** 30s cooldown removes the spam/harassment angle that a nudge could otherwise carry. |
| **Buddy Circle names** | Yes — free text (≤40 chars) | **Not needed for others' safety:** circle names are strictly owner-private (owner-only RLS, `20260722130125`; the buddy never learns a circle exists). No other user can ever see the string. | n/a (never shown to anyone else) | n/a | **No 1.2 exposure.** A circle name is a private label, like a note-to-self. |
| **Mutual context** ("shared rooms" + "mutual buddies") | No (derived) | Shows room names + **screennames of mutual buddies** | Reach the person via their profile → block/report | Same | **Low risk *if* it is a true intersection** (see privacy note below). Every "mutual buddy" is by definition already the viewer's own accepted buddy, so the viewer learns nothing new. |
| **Away-message replies** | Yes — but it's just a normal DM with a quoted preamble | Full content-moderation trigger + `displayBodyForMessage` placeholder for recipients | Yes (DM) | Yes (DM long-press) | **Low risk.** Identical safety surface to any DM. |
| **"Seen by N"** | No — aggregate count from `room_memberships.last_seen_at` | n/a | n/a | n/a | **Low risk.** Aggregate only; exposes nothing the roster doesn't already. |

**Block/Report coverage confirmed in code:** `BuddyProfileSheet.tsx` always renders Block + Report (`onBlockBuddy`, `onSubmitReport`, `ABUSE_REPORT_CATEGORY_OPTIONS`); DM messages (including Buzz/Knock/away-reply/forward) are reportable via `MessageReportSheet`; room messages carry Report + Block-sender (CLAUDE.md). The blocked-sender inbound guard (`blockedUserIdsRef` in the `public:messages` handler) drops Buzz/Knock from blocked users.

### Privacy posture of Mutual context — the one item to close before submit

The client contract (`mutualContext.ts`, `MutualContextCard.tsx`) treats the payload as an **intersection** ("mutual buddies," "You both know," `+N more`), which is the standard, safe mutual-friends model: it can only reveal people the viewer already knows. **However, I could not read the body of the `get_mutual_context` SECURITY DEFINER RPC** — its migration is not among the files I could enumerate on this branch. The residual risk, if the RPC were mis-implemented, is that it returns the *target's full buddy list* (outing-adjacent for this audience) rather than the intersection, and/or that it doesn't exclude blocked pairs.

**Concrete mitigation (gate before submit):** confirm `get_mutual_context` (a) returns only the set-intersection of both users' `status='accepted'` buddies, and (b) excludes any pair where a block exists. A 2-minute `pg_get_functiondef('public.get_mutual_context')` check on prod closes this. Until confirmed, treat mutual buddies as **unverified** for outing safety.

### Other Guideline exposure

- **5.1.1(v) — data deletion (the guideline that rejected v2.0 twice):** 2.1 adds three tables — `buddy_circles`, `buddy_circle_members` (FKs → `public.users(id) ON DELETE CASCADE`) and `user_connections` (FKs → `auth.users(id) ON DELETE CASCADE`). They *should* cascade away when `delete-account` removes the profile/auth rows, **but this exact class of bug (a stale table breaking the cascade) caused Rejection #2.** Do not assume — verify (gate below).
- **2.1 — completeness/crashes:** net-positive. The chat-room "freeze" fix (`routeOwnsNativeShellChrome`) directly removes a stranded-navigation state that reads as an App Review "unresponsive" verdict; outbox/dedup/self-heal reduce broken-state reports.
- **1.2(d) contact + moderation staffing:** unchanged and fine — do **not** let any surface imply a moderation team or SLA (claims-register DNC #3/#4). Reports "are reviewed." Full stop.
- **Naming:** "Knock" is a generic verb, no third-party trademark; "Buzz" already approved. Neither implies AIM/AOL/ICQ trade dress. Clear.

---

## 4. Go / No-Go Submission Checklist (ordered gates)

Ship only when every gate is green, in order.

1. **[HARD GATE] Merge PR #88 into `main` first.** Nothing else proceeds until it lands. Rebase the 2.1 release work on the merged main and re-run preflight.
2. **Confirm prod migration state:**
   - `buzz_cooldown` and `room_message_client_msg_id` — **already applied to prod** (given); reconfirm present.
   - `20260722130125_buddy_circles.sql` — applied to prod (owner-only RLS + enforce trigger).
   - `get_mutual_context` RPC and any **Knock server-side cooldown** trigger — applied to prod.
   - **`pro_entitlement` migration stays UNAPPLIED / dormant.** Do not apply. (H.I.M. Pro is plan-of-record only; no IAP ships — claims-register DNC excludes Pro.)
3. **[5.1.1(v) GATE] Verify account deletion covers the new tables.** Confirm `delete-account` (or FK cascade) erases `buddy_circles`, `buddy_circle_members`, and `user_connections` end-to-end against a **data-bearing** test account (per the Session-9 rule that empty accounts give false passes).
4. **[PRIVACY GATE] Verify `get_mutual_context` returns intersection-only and excludes blocked pairs** (see §3). Until confirmed, mutual buddies are not cleared for outing safety.
5. **Confirm Knock's abuse ceiling.** Verify the server-side 10-min Knock cooldown trigger exists; if it's client-only it's bypassable — acceptable as a launch risk (buddies-only, fixed payload, fully reportable) but should be logged.
6. **Trust-and-safety smoke test on new surfaces:** block + report reachable from a Buzz/Knock message, from a mutual-context profile, and from the room roster; blocked sender's Buzz/Knock is suppressed inbound.
7. **iOS build:** version is **2.1** (`8923dae`); bump `CURRENT_PROJECT_VERSION` above the last ASC build (≥ existing max). `npm run ios:preflight` green (lint, unit, build, sync, assets). Archive → upload.
8. **Bundle sync guard:** `dist/`, `native-web/`, and `ios/App/App/public` in sync (CI guard; always full `npm run ios:sync`, never `npx cap copy`).
9. **ASC metadata:** paste the §2 "What's New"; **keep** App Name `H.I.M. — Friends, Not Dates` and Subtitle `Gay friendship, retro style`; screenshots must be **real UI** (no fabricated counts); promo-text rotation per the July build sheet. Add the 2.1 features to the claims register before any campaign reuse.
10. **Not a gate for 2.1:** the **Paid Apps Agreement is an IAP-only dependency.** Since no IAP ships (Pro dormant), it does **not** block this submission — do not let it stall the release, and do not enable any Pro UI that would imply a purchase.
11. **Submit for review**, then monitor first-48h crash/anomaly and the moderation queue for the new surfaces.

**PM call:** 2.1 is a strong, on-brand release — it deepens the buddy-list loop the brand is built on without adding a single dating mechanic, and the reliability fixes retire real App Review risk. I'd rate it **Go, conditional on gates 1, 3, and 4** (PR #88 merged, deletion cascade verified, mutual-context intersection confirmed). Gates 3 and 4 are quick database checks but they sit on the two guidelines most likely to bite this specific app — I won't wave them through on inference.
