# H.I.M. v2.1 — Custom Product Page: X / build-in-public

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version context:** 2.1 (features + reliability, **no IAP**) · **Prepared:** 2026-07-23 · **Role:** Twitter Engager (platform-specialist bench)
**This file is the X-targeted Custom Product Page only.** Sibling files in `release-2-1/` belong to other agents; this file does not modify them or any code.

**Extends / never overrides:** `channels/twitter.md` (standing X playbook — voice, link discipline §3.1, CTA conventions), `release-2-1/social-twitter.md` (the 2.1 launch thread TV1 + posts PV1–PV5 this page is the visual continuation of), `release-2-1/asc-submission.md` (§3 screenshot production rules, §5 blockers), `strategy/brand-brief.md` (voice, tagline system, naming, nostalgia), `strategy/claims-register.md` (only approved claims ship).

**Feature clearance (this session):** the five 2.1 features named below — **Buddy Circles, Knock, mutual context, away-message replies, room "seen" counts** — are founder-approved for public metadata this session. They may appear on this CPP without a further sign-off gate. **NOT cleared and excluded here:** **Follow** (`user_connections`) — a one-way presence gate that is real in code but not cleared for public copy; and **H.I.M. Pro / any subscription** (dormant `is_pro`, no IAP shipped). Neither appears anywhere on this page.

---

## 0. What a CPP is (and what this one can and can't change)

A Custom Product Page is a **variant of the live App Store product page** with its own unique `?ppid=` URL. It is **not search-indexed** — it only appears to people who arrive by that exact link (bio, pinned thread, self-reply). That makes it the correct tool for X, because X's whole traffic model is direct/link, not App Store search.

**What a CPP lets me change (variant-specific):**

- Up to **10 screenshots per device size** — a bespoke set (§2 below)
- An optional **app-preview video** (§3)
- One **promotional text** field, 170 chars (§4)

**What a CPP inherits from the default page and I CANNOT change here:** App Name (`H.I.M. — Friends, Not Dates`), Subtitle (`Gay friendship, retro style`), Keywords, and the full Description. Those stay exactly as the ASO plan sets them (`asc-submission.md` §2 — KEEP unchanged; index-freeze discipline §B6). **A CPP therefore does not touch the O9 keyword-index measurement at all** — it is not indexed, so it sidesteps the entire index-freeze concern that governs the default page. That is why the 2.1 features can appear on this CPP's screenshots even though `asc-submission.md` §B6 keeps them out of the *indexed* listing: this surface is a private link, not a search result.

**One thing a CPP does not change:** it is still the H.I.M. product page, so **App Review sees these screenshots too.** Every §2/§3 production rule from `asc-submission.md` §3 and §B5 applies in full — real UI only, logged S0 consent for any member content, no DM content from real conversations, no fabricated presence/counts, iPhone portrait only.

---

## 1. Which CPP the X bio + pinned point to

**One CPP for the X channel, referenced internally as `x-buildinpublic`** (Apple assigns the actual `ppid` token when the page is created in ASC — use whatever ASC generates; this name is just the internal label). It is the visual continuation of the 2.1 launch thread: someone reads Haaris's build-in-public ship-log thread (TV1), taps through, and lands on a product page whose screenshots tell the *same* story in the same order — presence-first "the light's on," then the two headline mechanics (Circles, Knock), then the anti-dating backbone.

### 1.1 How X actually links to it (honoring `twitter.md` §3.1 link discipline)

`twitter.md` §3.1 is binding: **the link in the X bio and in the pinned-thread self-reply is always the `hiitsme.app` UTM link, never a raw App Store URL** — because `hiitsme.app` is the only attribution-measurable hop (Vercel UTM), and App Store links strip attribution. A CPP `?ppid=` URL is a raw App Store URL, so it must **not** replace the bio/self-reply link. The reconciliation:

| Surface | What it links to | Unchanged from standing plan? |
|---|---|---|
| **X bio website field** | `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=bio` | Yes — `twitter.md` §1.2 / §3.1 |
| **Pinned thread self-reply (TV1 tweet 11)** | `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=v21-launch-thread` | Yes — `social-twitter.md` §1 |
| **The App Store hop those `hiitsme.app` pages forward to, for `utm_source=x` sessions** | the App Store URL carrying **this CPP's `?ppid=`** | **New coordination item — see flag below** |

So X keeps its measurable `hiitsme.app` link; `hiitsme.app` then forwards X-sourced visitors onward to the App Store with the `x-buildinpublic` `ppid` appended, so they land on this tailored page instead of the generic default. Attribution survives on the `hiitsme.app` hop; the CPP survives on the onward hop.

> **⚑ Cross-workstream flag (blocking for the CPP to actually receive X traffic):** the `hiitsme.app → App Store` forward that appends `?ppid=` for `utm_source=x` sessions is owned by the **web/landing workstream**, not this file and not the ASC listing. If that forwarding is not wired, the bio/pinned links still work but land on the **default** product page and this CPP gets zero traffic. Two acceptable fallbacks, founder's call: (a) web workstream adds the `ppid` forward (preferred — keeps §3.1 measurement intact); or (b) the CPP `?ppid=` URL is used **directly** in the pinned self-reply *in addition to* the `hiitsme.app` link, accepting the §3.1 attribution loss on that one tap for the sake of the tailored page. Do **not** put a raw `?ppid=` App Store URL in the **bio** — the bio stays the measurable `hiitsme.app` link regardless.

### 1.2 Why this page and not the default page

X's referred visitor is pre-warmed by a *founder ship-log about presence and saying hi*. The default page opens on the generic brand-loop story (rooms → conversation → buddy list, per `asc-submission.md` §3 / ASO §4). This CPP re-orders to open on exactly what the thread promised — **presence-first "the light's on," Buddy Circles, Knock** — so the page matches the ad. Same real UI, different first three frames. That match is the entire reason a CPP exists.

---

## 2. The ordered screenshot set (real 2.1 UI · on-image caption per slot)

Eight frames. Order mirrors the launch-thread narrative (`social-twitter.md` TV1): presence-first → Circles → Knock → status → status-replies → mutual context → a room → the anti-dating close. Screenshots are scroll-glanced, so slots 1–3 carry the load and repeat the thread's promise verbatim in feeling.

All captions are drawn from approved tagline vocabulary (brand-brief §6 Tier 1–3) or founder-voice product truth scoped to a cleared claim. On-image text is short by design (readable at gallery thumbnail size).

| # | Screen (real 2.1 UI) | On-image caption | Caption provenance / claim |
|---|---|---|---|
| 1 | **Presence-first BuddyList home** — online / idle / away rows with away-message lines ("grabbing coffee," "doomscrolling") | **The light's on.** | Tier 1 approved tagline (brand-brief §6; founder sign-off 2026-07-15). Presence-first UI is cleared. This is X's whole angle in one frame — the thread closes on "The light's on" (TV1 tweet 10); the page opens on it. |
| 2 | **Buddy Circles** — real named circles + an "Ungrouped" section; real consented screennames; **no counts** | **Your buddies, in circles only you see.** | Buddy Circles (cleared). Matches `asc-submission.md` §3 frame 2. Private/owner-only is the load-bearing truth — the caption says "only you see," never implies the buddy is told. |
| 3 | **Knock** — a buddy row / DM showing "👋 Knock — wants to talk" (staged between founder-owned accounts, no real DM content) | **Knock. A quieter way to say hi.** | Knock (cleared). Matches `asc-submission.md` §3 frame 3. Warm, never "chasing someone who went quiet" (`social-twitter.md` §3 tone check). |
| 4 | **Away-message composer** — setting a custom status | **Your status says more than you think.** | Approved Tier 3 caption (GTM §3). Claim #3 (away messages / status). |
| 5 | **Away-message reply** — quoting a buddy's status into a DM draft ("grabbing coffee" → "want company?"), staged between founder-owned accounts | **Reply right to what they're up to.** | Away-message replies (cleared). Founder-voice, scoped to the real mechanic (`awayMessageReply.ts`). No real DM content shown. |
| 6 | **Profile sheet with mutual context** — shared rooms + buddies in common | **See what you already share.** | Mutual context (cleared). Matches `asc-submission.md` §3 frame 6. Intersection-only, block-excluded, capped (README product-gate PASS) — the frame shows shared items only, never a buddy's full list. |
| 7 | **Chat room (Late Night)** — dense timestamped message rows (consented S0 capture, others cropped/blurred) | **Find your people before you even DM.** | Approved Tier 3 caption (GTM §3). Claim #1 (rooms; "Late Night: For the night owls. No judgment."). |
| 8 | **Rooms list (7 rooms visible)** — the anti-dating backbone frame | **No swiping. No radar. No grid.** | Claim #22 (absence enumeration — the campaign's honest backbone). Closes the set on the positioning the thread led with (TV1 tweet 1: "not a dating app"). |

**Deliberately NOT a screenshot on this page:** the room **"Seen by N"** receipt. It is cleared this session and could be shown as an aggregate, but it does not earn a scarce gallery slot against the eight above, and keeping it out avoids any at-a-glance "read receipts" misread by a scrolling viewer (`asc-submission.md` §B3 — never phrase or frame room "seen" as read receipts or per-person). It lives in the thread copy and What's New, not here. Also **not shown:** Follow (not cleared), any Pro/upgrade surface (no IAP — `asc-submission.md` §B1), any live "N online" count (DNC #10).

**Production (founder captures on-device, per `asc-submission.md` §3 / §B5):**
- Set up **real** Buddy Circles on the seed account (real names, no fabricated presence).
- Have one consenting second seed member available for the room frame (7); the Knock (3) and away-reply (5) frames are staged between **the founder's own two accounts** — never a real member's DM.
- Log consent in the tracker; crop/blur any non-consenting screenname.
- Export at least one **6.9"** (iPhone 16 Pro Max) set; add 6.5"/6.7" if the current listing uses them. Portrait only, no iPad.
- Tooling: `scripts/take-app-store-screenshots.mjs` (same script the default set uses).

**Fallback if new frames aren't captured in time:** do **not** ship this CPP with mockups. Either (a) publish the CPP with only frames 4, 7, 8 (three approved-caption real frames already producible) plus the current live set, or (b) hold the CPP entirely and let the bio/pinned links point at the default page until captures land. A CPP with fabricated UI is a worse outcome than no CPP (`asc-submission.md` §4, §B5).

---

## 3. App-preview video (optional this cycle)

**Recommendation: skip for launch, add later if there's appetite.** A CPP app preview is a nice-to-have, not a gate; the eight still frames carry the story, and a video adds a real production + review burden (`generate-app-store-previews.mjs` needs ffmpeg + a captured, consented clip set).

**If Haaris does want one** (it suits the build-in-public channel well — it can literally be the same real-UI screen recordings already shot for the thread), the tight 15–20s cut that continues the thread:

1. Sign-on → the **presence-first home populating** (who's signed on, away messages) — "the light's on" beat.
2. **Filing a buddy into a circle** (founder's own account) — the Circles beat.
3. **A Knock landing** (👋, between founder-owned test accounts) — the Knock beat.
4. End card: the real rooms list under **No swiping. No radar. No grid.**

Same real-UI, same-consent rules as §2 (founder-owned accounts for any DM/Knock/circle moment; no real member DM content; no fabricated counts). No voiceover claim beyond what's on screen. If it's not clean and real, ship the stills alone.

---

## 4. Promotional text (170-char field · counted · claims-traced)

The CPP's one text field. It edits live without a build/review, so it can rotate — but launch on the version that carries X's story: presence-first, private circles, Knock, the anti-dating line, and the tagline the thread closes on.

**Primary (161 / 170 chars):**

```
H.I.M. opens on your people now — who's signed on, who's away, what they're up to. Private buddy circles. Knock to say hi. No swiping, no grid. The light's on.
```

**Claims trace (every clause honest to code + cleared/approved):**

| Clause | Traces to | Status |
|---|---|---|
| "opens on your people now — who's signed on, who's away, what they're up to" | Presence-first UI + claim #3 (away messages / status) | Cleared / Approved. "Signed on / away / what they're up to" = presence, **not** a count (DNC #10 safe). |
| "Private buddy circles" | Buddy Circles — owner-only (`buddyCircles.ts`, RLS `20260722130125`) | Cleared. "Private" is the load-bearing word; never implies the buddy sees the circle. |
| "Knock to say hi" | Knock — 👋, buddies-only, 10-min cooldown | Cleared. Warm register, no pressure framing. |
| "No swiping, no grid" | Claim #22 (absence enumeration) | Approved backbone. A quotable subset of "no swiping / no radar / no grid / no photo-first browsing." |
| "The light's on." | Tier 1 tagline (brand-brief §6, founder sign-off 2026-07-15) | Approved. |

**Alternate (168 / 170) — fuller absence enumeration, if preferred:**

```
H.I.M. opens on your people now — who's online, who's away, what they're up to. Private buddy circles. Knock to say hi. No swiping, no radar, no grid. The light's on.
```

**Standing fallback:** if a rotation ever misses sign-off, the live LD §A baseline promo text (fully claims-compliant) stays up — same discipline as ASO §5. This CPP's promo text is version-independent; it does not need to change when the flight's default-page promo-text calendar (ASO §5) rotates, and rotating it here does not disturb that calendar.

**Not in this field, ever:** user counts / "N online" (DNC #10), dating vocabulary — match/swipe/singles/nearby (brand rule 3; "no swiping" is the approved negation), "read receipts" for the room "seen" count (`asc-submission.md` §B3), Pro / upgrade / pricing (no IAP — §B1), Follow (not cleared), Android (DNC #6), "encrypted" / "works offline" (DNC #1, #12), AIM/AOL/"nudge™" (DNC #9), testimonials (DNC #11).

---

## 5. Pre-publish checklist (this CPP)

- [ ] Frames captured on-device, **real UI**, portrait iPhone, ≥1× 6.9" set; consent logged for every member screenname shown; non-consenting screennames cropped/blurred; no real DM content (§2; `asc-submission.md` §3/§B5)
- [ ] No fabricated presence or counts on any frame; no "N online" (DNC #10)
- [ ] Buddy Circles frame never implies the buddy sees the circle; mutual-context frame shows shared items only (README product-gate PASS)
- [ ] Room "seen" count is **not** shown or captioned as "read receipts" (it isn't in this set at all — §2) (`asc-submission.md` §B3)
- [ ] No Follow, no Pro/IAP/upgrade surface anywhere on the page (`asc-submission.md` §B1)
- [ ] Promo text ≤170 (primary 161) and every clause claims-traced (§4)
- [ ] App Name / Subtitle / Keywords / Description confirmed **inherited, unchanged** (CPPs can't change them; index-freeze intact — `asc-submission.md` §2, §B6)
- [ ] Bio + pinned self-reply links remain the measurable `hiitsme.app` UTM links (`twitter.md` §3.1); the `hiitsme.app → ?ppid=` forward is wired **or** the §1.1 fallback is chosen with founder sign-off
- [ ] Nothing here changes on a code/binary basis — screenshots + preview + promo text are the only CPP levers

---

*Custom Product Page (X / build-in-public) · H.I.M. v2.1 · Saman Technologies LLC (internal) · extends OPERATION PORCH LIGHT X channel plan + the 2.1 X launch content. This file is `cpp-twitter.md` only.*
