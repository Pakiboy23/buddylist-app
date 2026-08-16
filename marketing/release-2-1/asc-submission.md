# H.I.M. v2.1 — App Store Connect Submission (ASO / listing)

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version:** 2.1 (MARKETING_VERSION 2.1), features + reliability, **no IAP** · **Prepared:** 2026-07-23 · **Role:** App Store Optimizer
**Governed by:** `strategy/claims-register.md` (STRICT — approved claims only), `strategy/brand-brief.md` (voice/naming/nostalgia), `channels/app-store-optimization.md` (§0 index freeze, §1 listing, §4 screenshot rules), `reporting/asc-july-build-sheet.md` (paste-ready fields, limits)

**What 2.1 ships (verified in code at HEAD, 2026-07-23):** native BuddyList presence-first home · **Buddy Circles** (`src/lib/buddyCircles.ts` — private owner-only groups, one circle per buddy, per-circle mute + hide-presence, owner-only RLS `20260722130125`) · **Knock** (`src/app/hi-its-me/page.tsx` ~5632 — one-tap "👋 Knock — wants to talk" to a buddy, buddy-only, 10-min cooldown) · **Buzz now rate-limited** (existing claim #7, anti-spam) · **mutual context** (`src/lib/mutualContext.ts` — shared rooms + mutual buddies on a profile) · **"Seen by N" room receipts** (`src/lib/roomReadReceipts.ts` — aggregate count derived from existing room presence heartbeat) · **away-message replies** (`src/lib/awayMessageReply.ts` — quote a buddy's status into a DM draft) · reliability fixes.

> **Read this first — two hard gates before anything below ships:**
>
> 1. **The five 2.1 features are NOT in the approved claims register.** The register (`claims-register.md`) was verified against `35f76e2`, which predates these features; its rule is "if a product claim is not in the APPROVED table, it does not ship" in public metadata. I have confirmed each feature exists in code (paths above), so an addendum is low-friction — but every new-feature line in *What's New*, the description, and screenshot captions **needs founder sign-off + a register addendum** before submit (brand brief §6 also requires sign-off on new captions/taglines). Copy below is drafted paste-ready to that gate, not around it.
> 2. **H.I.M. Pro must not appear anywhere in this 2.1.** The monetization plan of record (`marketing/monetization/2-1-pro-plan.md`) was written assuming "2.1 = Pro, October." That assumption is now **stale**: this 2.1 is the features+reliability release and carries **no IAP**. The DRAFT Pro products (`subscription group 22254438`, `…pro.monthly/annual/founding`) stay attached to **no build**. See Blocker B1 — a visible non-functional purchase is a rejection, and the Paid Apps Agreement may still be unsigned.

---

## 1. "What's New in This Version" (paste-ready)

Field limit 4,000 chars. Draft below is **~1,090 chars**. On-brand, founder voice, claims-checked. **Gate 1 sign-off required** (five new-feature lines).

```
This one's about the buddy list.

H.I.M. now opens on your people. Your buddy list is front and center — who's online, who's idle, who's away and what they're up to — the way signing on used to feel.

New in this version:

• Buddy Circles — sort your buddies into private circles only you can see. Mute a circle or hide its presence when you want a quieter list. Nothing changes on your buddies' end.

• Knock — a gentle "hey, you around?" for a buddy. One tap, no pressure, no wall of text.

• Mutual context — open a buddy's profile and see the rooms you're both in and the buddies you have in common.

• Away-message replies — reply straight to what a buddy's status says. "grabbing coffee" → "want company?"

• Room "seen" counts — see how many people caught your message in a room.

Plus a round of reliability fixes: steadier presence, smoother delivery, and a calmer Buzz.

No swiping. No radar. No grid. Just your people, right there.

— Haaris, founder
```

**Claims trace (every line honest to code + register):**

| Line | Traces to | Note |
|---|---|---|
| "your people, right there" | Approved Tier 3 caption (buddy list) | brand brief §6 |
| "the way signing on used to feel" | Era-generic nostalgia | brand brief §7 — no AOL/AIM/ICQ mark |
| Buddy Circles "only you can see… Nothing changes on your buddies' end" | `buddyCircles.ts` (owner-only RLS, owner-side controls) | Honest; not absolutist |
| Knock "gentle… one tap" | code: buddy-only signal, 10-min cooldown | New — sign-off |
| Mutual context "rooms you're both in and buddies you have in common" | `mutualContext.ts` (sharedRooms + mutualBuddies) | New — sign-off |
| Away-message replies example | `awayMessageReply.test.ts` (quote → draft) | New — sign-off |
| Room "seen" counts (aggregate) | `roomReadReceipts.ts` `countSeenByOthers` | **Claims-sensitive — see Blocker B3** |
| "a calmer Buzz" | Buzz now rate-limited (claim #7) | Approved feature |
| "No swiping. No radar. No grid." | Claim #22 absence enumeration | Approved backbone |
| "— Haaris, founder" | Founder publicly on record | brand brief §4; optional, founder may cut |

**Two safe fallbacks (zero unresolved sign-off risk):**

- **Drop the room-"seen" line** (Blocker B3) — delete that one bullet; the rest stands. This is the recommended default unless B3 is resolved.
- **Minimal, register-clean version** (uses only already-approved vocabulary, no new-feature naming — ships even if Gate 1 slips):
```
Your buddy list, front and center. H.I.M. now opens on your people — who's online, who's away, and what they're up to.

This version brings new ways to keep up with your buddies, plus reliability fixes: steadier presence, smoother delivery, and a calmer Buzz.

No swiping. No radar. No grid. Just your people, right there.
```
Avoid the bare Apple boilerplate ("bug fixes and stability improvements") — 2.1's headline *is* the presence-first buddy list; say so.

---

## 2. Does the listing need updates for 2.1?

**Short answer: name, subtitle, and keywords — KEEP unchanged. Description — keep stable; apply the mandated compliance corrections only if the live listing doesn't already carry them. Do not index the new features this cycle.**

Three reasons this is the right call, not laziness:

1. **Index-measurement freeze (ASO plan §0).** The Q3 flight deliberately holds name/subtitle/keywords stable so the O9 App-Store-Search baseline stays interpretable — "one metadata variable changes per build, or reads become uninterpretable" (§1.2). Stuffing "circles / knock / presence" mid-measurement destroys the read for zero proven upside and adds Guideline 4.3 re-review risk.
2. **Not claims-verified for indexable surfaces.** The five new terms aren't in the approved register yet (Gate 1). Keyword/subtitle/name are the surfaces App Review reads most literally.
3. **What's New already carries the news.** The update field is the correct home for feature announcements; the indexed listing is not.

### 2.1 KEEP as-is

| ASC field | Value | Chars |
|---|---|---|
| App Name | `H.I.M. — Friends, Not Dates` | 27/30 |
| Subtitle | `Gay friendship, retro style` | 27/30 |
| Keywords | `community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,group,penpal,platonic,screenname` (Option A) or the founder-signed Variant C (`…hiitsme…`) | 97–98/100 |

Do **not** add `circles`, `knock`, `presence`, `groups`. `group` is already in Option A and covers the grouping concept generically.

### 2.2 Description — CONDITIONAL

**First verify the live 2.0 description.** Two states:

- **If the live listing already shows the four §1.4 corrections** (18+, "a copy of your data anytime", "your account and your content are deleted", "before recipients see them") → **KEEP the description unchanged. No edit.**
- **If the live listing still shows any stale line** — `Gay men 17+`, `full copy of your data whenever you want`, `everything erased`, or the old content-filter phrasing → **2.1 must carry the corrected description** (`asc-july-build-sheet.md` §1, 2,431/4,000). This is a **compliance fix, not a feature edit**: a "17+" listing next to an 18+ age rating is a listing-consistency rejection risk (Blocker B2). Paste the corrected block from the build sheet verbatim.

**Do not add Buddy Circles / Knock / presence copy to the description this cycle.** If the founder insists on reflecting 2.1 in the description, the *only* register-safe, minimal insert — append to the existing `BUDDY LIST + AWAY MESSAGES` block, **Gate 1 sign-off required**, and it does spend index chars so I recommend deferring to a Q4 build read against H1/H2:

```
Sort your buddies into private circles only you can see. Knock to say a quiet hello. And on any profile, see the rooms and buddies you already share.
```

### 2.3 Promotional text — leave on the flight calendar

Promotional text is version-independent and edits live without review; **it is not part of the 2.1 build decision.** Leave whatever the §5 calendar has live (v3 through Sep 13; after the flight, revert to the LD §A baseline or hold v3 per the wrap decision). Do not clobber it while editing the version record.

---

## 3. Screenshot / app-preview plan

**§4 production rules are binding:** every frame is **real UI** — never mock member counts, presence, or activity that doesn't exist (DNC #10). Any frame showing another member's screenname/message needs that member's **explicit, logged consent** (source from consenting S0 seed members; crop/blur everyone else). **No real DM content** — DM/Knock frames are staged with one consenting seed member. iPhone **portrait only**, no iPad (claim #21).

Presence-first is the 2.1 identity, so the story **opens on the buddy list**, then the two headline new mechanics, then keeps the existing approved frames.

| # | Screen | Caption | Status |
|---|---|---|---|
| 1 | **BuddyList (presence hero)** — online/idle/away rows with away messages | `Your people, right there.` | **NEW frame**, caption is approved Tier 3 → no caption sign-off needed |
| 2 | **Buddy Circles** — real circles + an "Ungrouped" section, real consented screennames, no counts | `Your buddies, in circles only you see.` | NEW — **caption sign-off (Gate 1)** |
| 3 | **Knock** — buddy row/DM showing "👋 Knock — wants to talk" (staged, consented) | `Knock. A quieter way to say hi.` | NEW — **caption sign-off (Gate 1)** |
| 4 | Chat room (Late Night, consented capture) | `Find your people before you even DM.` | Existing approved (GTM §3) |
| 5 | Away-message composer | `Your status says more than you think.` | Existing approved |
| 6 | Profile sheet **with mutual context** (shared rooms + mutual buddies) | `See what you already share.` (or keep approved `First impression isn't your face. It's your vibe.`) | SWAP — new caption needs **Gate 1**; approved fallback available |

**Deliberately NOT a screenshot:** the room "Seen by N" receipt (Blocker B3 — keep the claims-sensitive feature out of indexed visual metadata; it lives in What's New only, if at all).

**Founder must capture on-device (Mac, ~10 min):**
```bash
PLAYWRIGHT_USER_A_SCREENNAME=<consenting seed screenname> \
PLAYWRIGHT_USER_A_PASSWORD=<password> \
node scripts/take-app-store-screenshots.mjs
```
Before capturing: set up **real** Buddy Circles on the seed account (real names, no fabricated presence), have a consenting second seed member available for the Knock/room frames, log consent in the tracker, crop/blur any non-consenting member. Export the required device size(s) — at least one **6.9"** (iPhone 16 Pro Max) set; add 6.5"/6.7" if the current listing uses it. App previews (video) are optional this cycle — `scripts/generate-app-store-previews.mjs` needs ffmpeg + the captured set; screenshots alone are fine.

**Fallback (zero capture, zero sign-off):** keep the **current live screenshot set unchanged** for 2.1. What's New still carries the story. **Never upload mockups** (§4) — the 9 placeholder mockups from the July build are not for ASC.

---

## 4. Exact ASC submission steps for 2.1

Assumes the 2.1 build has passed `npm run ios:preflight` (green), MARKETING_VERSION = 2.1, build number incremented, archived and uploaded via Xcode/Transporter, and finished processing in TestFlight.

1. **App Store Connect → Apps → H.I.M. → App Store tab → the `2.1 Prepare for Submission` version** in the left sidebar.
2. **Build section → "Add Build" (⊕) → select the processed 2.1 build.** Confirm it shows version 2.1 and the new build number.
3. **"What's New in This Version"** (this field only exists on updates) → paste §1 (or the resolved fallback). Verify the console char counter.
4. **Promotional Text** → leave as-is per §2.3 (do not edit as part of the build).
5. **Description / Keywords / Subtitle / App Name** → apply §2: **KEEP** unless the live description is stale, in which case paste the corrected description from `asc-july-build-sheet.md` §1. Do not touch name/subtitle/keywords.
6. **Screenshots** → per §3: add/swap the new-feature frames (real UI, consented) **or** confirm the existing set carries over unchanged. Portrait iPhone only.
7. **App Review Information** → confirm reviewer **contact** is current; provide a **working seed demo login** (screenname + password) in the demo-account fields — reviewers need to reach the buddy list, rooms, Circles, and Knock. Add a Notes line: *"Friendship app for gay men, 18+. Screenname/password sign-in (no email). Demo account has seeded buddies and circles. No in-app purchases in this version."*
8. **Version Release** → choose **Phased Release for automatic updates (7-day)** — appropriate for a reliability release; or Manual if you want to align with a specific date. (Not tied to the Q3 flight, which ends Sep 13.)
9. **Add for Review → Submit to App Review.** At submit, ASC may show the export-compliance question — see the table below; with the Info.plist key set it should not block.

### Age rating / encryption / privacy answers

| Question | Answer for 2.1 | Changed by the new features? |
|---|---|---|
| **Export compliance / encryption** | `ITSAppUsesNonExemptEncryption = false` in Info.plist (unchanged). Standard HTTPS/TLS only; **no E2E encryption** anywhere (DNC #1). If prompted: uses only exempt/standard encryption → No. No CCATS/year-end docs. | **No.** Circles/Knock/mutual context/"seen"/away replies are plaintext Postgres rows over TLS — no new crypto. |
| **Age rating** | **18+**, unchanged (set Session 9 / PR #57). UGC + unrestricted web access already drove 18+. | **No.** No new mature-content questionnaire trigger. Confirm the UGC / Unrestricted Web Access answers stay exactly as set — do not let the 2025 questionnaire re-prompt reset them. |
| **App Privacy ("nutrition label")** | Unchanged. New data is covered by existing declarations: **User Content** (messages; Knock is a message signal; Circles are owner-only user content), **Identifiers** (screenname/user ID), **Usage Data**, **Diagnostics**. **Data Used to Track You = None** (no tracking added). | **Verify, expect no change.** No new data *type*; no new SDK; Buddy Circles data is owner-only and not shared/sold/tracked. |
| **Privacy manifest** (`PrivacyInfo.xcprivacy`) | Unchanged — no new required-reason API, no new third-party SDK. | **No.** |
| **Content Rights** | Unchanged (no third-party content). | No. |

---

## 5. Submission blockers (ASO / listing-specific)

**B1 — H.I.M. Pro / IAP leakage (highest rejection risk).** The monetization doc's "2.1 = Pro" framing is stale for *this* release. Before submit, verify: **no in-app purchase is attached to the 2.1 version**; the binary has **no reachable** paywall, "H.I.M. Pro" row, Founding Member SKU, "Restore Purchases," or Pro badge; the DRAFT products stay attached to no build. A visible non-functional purchase = Guideline 2.1 / 3.1.1 rejection, and the **Paid Apps Agreement may be unsigned** (Pro can't transact regardless). *Do not surface, mention, or screenshot Pro anywhere in 2.1.*

**B2 — Listing/age-rating consistency.** If the live description still reads `Gay men 17+` (the stale LD line), it contradicts the 18+ rating and is a rejection risk — 2.1 **must** carry the corrected description (§2.2). Verify the live listing before deciding KEEP vs. correct.

**B3 — "Seen by N" room receipts vs. claims register DNC #5.** The register lists **room read receipts as a deliberate DM-only non-feature**; 2.1 adds an *aggregate* room "seen" count. This is not a per-person read receipt (code: `countSeenByOthers`, derived from presence already visible in the roster) — but it contradicts the register as written. **Do not use "read receipts" language for rooms** in any public copy. Before the What's New room-"seen" line ships: (a) add a register addendum reconciling it, or (b) drop the line (§1 fallback). Keep it out of keywords, subtitle, and screenshots regardless.

**B4 — New features not in the approved claims register (Gate 1).** Buddy Circles, Knock, mutual context, away-message replies are code-verified but not in the approved table. Every public line naming them (What's New, any description insert, screenshot captions in §3) needs **founder sign-off + a register addendum** before submit. Register addendum is low-friction — code paths are cited throughout this doc.

**B5 — Screenshot production gate.** New frames need **real UI + logged S0 consent** (crop/blur others, no real DM content, no fabricated Circle/presence counts — DNC #10). Founder must capture on-device (§3). If not captured, **keep the existing live set** — never ship mockups.

**B6 — Index-freeze discipline.** Resist adding `circles`/`knock`/`presence` to keywords/subtitle/name for 2.1 — it breaks the O9 baseline read and adds 4.3 risk for zero proven upside. City terms (H3/Variant B) and any new-feature indexing wait for a Q4 build decided at the flight wrap.

**B7 — Nostalgia/naming compliance.** Knock and Buzz must stay generic — never framed as an AOL/AIM "nudge™" or any legacy IM trademark, in copy or hidden metadata (DNC #9, brand brief §7). Buzz is approved (#7); Knock is new (B4).

---

*App Store Optimizer · H.I.M. v2.1 ASC submission · Saman Technologies LLC (internal). Sibling files in this directory belong to other agents — this file is `asc-submission.md` only.*
