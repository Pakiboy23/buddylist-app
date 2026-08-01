# H.I.M. v2.1 — Custom Product Page: Instagram

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Deliverable:** the App Store **Custom Product Page (CPP)** that Instagram's bio link + Story link stickers point at for the 2.1 push · **Prepared:** 2026-07-23 · **Role:** Instagram Curator
**Rides inside:** OPERATION PORCH LIGHT (flight Aug 3 – Sep 13, 2026) · 2.1 push big idea **"Your people, sorted."**
**Governed by (STRICT):** `strategy/claims-register.md` (approved claims only), `strategy/brand-brief.md` (voice/naming/nostalgia/visual), `channels/instagram.md` (channel plan this CPP receives traffic from), `release-2-1/asc-submission.md` (§3 screenshot rules + blockers B3–B7), `release-2-1/README.md` (six-feature registration gate)

> **Session clearance note.** The five 2.1 features named here — **Buddy Circles, Knock, mutual context, away-message replies, room "seen" counts** — are founder-approved for public metadata this session (cleared). **Follow is NOT cleared** and appears nowhere below. Room "seen" is deliberately kept out of every visual/metadata surface of this CPP (asc-submission Blocker B3) — see Flags. "Your people, sorted." is the **Instagram-side creative line** (carousel/caption); it is a pending-sign-off campaign tagline (brand brief §6) and is **not burned into any CPP screenshot** — CPP on-image captions use cleared feature phrasing + approved Tier 1–3 lines only.

---

## 1. What this CPP is, and what Instagram points at it

A CPP is a variant App Store product page with its **own up-to-10 screenshots per device size, an optional app-preview video, and one 170-char promotional text**, reachable only by its unique `?ppid=` URL. It is **not App Store search-indexed** — it serves **direct/paid/bio traffic only**, which is exactly Instagram's shape (bio link + link stickers, zero search dependency). **Name, subtitle, keywords, and description are inherited from the default 2.1 product page and cannot be changed here** (they stay frozen per asc-submission §2 / ASO index-freeze) — so this file governs the three surfaces a CPP actually owns: **screenshots, promo text, app preview.**

### The pointer

| Surface | Destination | Notes |
|---|---|---|
| **Instagram bio link** (store-bound CTA) | this CPP `?ppid=` URL | The `hiitsme.app` UTM link (`utm_source=instagram&utm_medium=social&utm_campaign=porchlight-q3`, `instagram.md` §2) remains the **web-app** home; the **"get the app on iPhone" CTA** routes to this CPP. If the bio holds one link, point it at the CPP during launch week (Aug 3–9, the Circles beat) and rotate back to the web link at the Aug 17 gate; if bio real estate allows two, run both. |
| **Story link stickers** (store-bound) | this CPP `?ppid=` URL | Stickers whose card copy is "get it on the App Store." Room-CTA stickers ("come say hi in Sunday Reset") still go to `hiitsme.app` with `utm_medium=stories`. |
| **IG Reel / carousel end-cards** | verbally "on the App Store and at hiitsme.app" (claim #21) | The tappable path is bio → this CPP. |

### URL + attribution (UTMs do not survive the App Store hop)

- **Final URL shape:** `https://apps.apple.com/app/id6761863631?ppid=<PPID>` — the `<PPID>` is minted by App Store Connect when the CPP is created. Internal slug for the console + scorecard: **`porchlight-ig-circles`**.
- **Attribution mechanic:** query UTMs are dropped at the App Store boundary, so wrap the CPP URL in an **Apple Campaign Link** carrying `ct=porchlight-ig-circles` (+ your `pt` provider token). App Store Connect → **App Analytics → attributes CPP + campaign-token traffic to source**; this is the durable read, screenshot weekly into the scorecard exactly like Instagram Insights (`instagram.md` §9, audit-gap-5 mitigation). This keeps the channel plan's **attribution-honesty** posture: correlation + source buckets, never claimed precision.
- **CPP scope reality:** a CPP is an **iPhone App Store** page. Android and web traffic ignore it (Android not marketed at all — DNC #6; web users land on `hiitsme.app`). iPhone portrait only (claim #21).

---

## 2. Carousel → page continuity (the whole design brief)

Instagram sends this traffic almost entirely off **one forwardable object: the Buddy Circles carousel** ("sort your people — only you see them," `social-push-plan` §2, Wed Aug 5) and its repurposed **C7 Reel** (real-UI circle-creation demo). The tap happens *mid-scroll, mid-story* — the visitor arrives already primed on **Circles**, in the **midnight-indigo + amber** system, in the **send-to-the-group-chat** frame of mind.

So the CPP must **catch the carousel, not restart the pitch.** The rule for this page:

1. **Slot 1 lands where the carousel paid off** — Buddy Circles, same visual system (midnight indigo `#0F1424` ground, amber `#E8A23A`, IBM Plex Mono for anything "typed," glass titlebar window per brand brief §3). A visitor should feel the store page is the next slide, not a different ad.
2. **Lead buddy-side, then rooms, then privacy.** Circles → presence → mutual context → knock → away replies are all **buddy-side** — they reward a visitor with as few as three buddies and don't depend on a room being warm (`social-push-plan` §5.5 dead-room rule). Rooms come *after* as "the place you met them," privacy closes as the reason to trust it.
3. **Every frame is real 2.1 UI**, founder-captured on-device, consent-logged (§4). No mockups, no fabricated presence or circle counts (DNC #10; asc-submission B5).

---

## 3. Ordered screenshot set (up to 10 · this CPP ships 9)

Real 2.1 UI, iPhone portrait, one on-image caption per slot. Captions are burned into the frame in the card system (amber mono for "typed" lines, cream Nunito for supporting copy). Order is tuned for the IG arrival, not the default page's rooms-first brand-loop order.

| # | Screen (real 2.1 UI) | On-image caption | Continuity / why here | Claims trace |
|---|---|---|---|---|
| **1** | **Buddy Circles** — real circles (e.g. "night owls," "the group chat," "gym") with an **Ungrouped** section; real consented screennames; **no counts** | `Your buddies, in circles only you see.` | **Catches the carousel's payoff slide.** Marquee first because that's what the IG object was about. | Buddy Circles (cleared); "only you see" = owner-only RLS, asc B-guardrail; DNC #10 (no counts) |
| **2** | **Presence-first BuddyList home** — online / idle / away rows with away-message text | `Your people, right there.` | Shows the sorted list *living* in the 2.1 home — the presence-first identity. Approved Tier 3 caption, zero sign-off. | Away messages/status #3; buddy list #4; caption GTM §3 Tier 3 |
| **3** | **Mutual context on a profile** — "rooms you're both in" + "buddies in common" card | `Find your people before you even DM.` | The buddy-side reward continues; approved Tier 3 line that *literally* describes the feature (`social-push-plan` §1). | Mutual context (cleared); caption GTM §3 Tier 3; framed as shared friendship context, never compatibility (§5.3) |
| **4** | **Knock** — buddy row / DM showing "👋 Knock — wants to talk" (staged, consented) | `Knock. A quieter way to say hi.` | The low-pressure gesture — on-brand for a friendship (not pursuit) app. | Knock (cleared): buddies-only, 10-min cooldown. **Never** "nudge™"/AIM (B7, brand brief §7) |
| **5** | **Away-message replies** — composer quoting a buddy's status into a DM draft (e.g. "grabbing coffee" → "want company?") | `Reply right to what your buddy's up to.` | Closes the buddy-side story: status as something you *act on*, "the way it used to be." | Away-message replies (cleared) + away messages #3; brand-authored status example only (no member content) |
| **6** | **Rooms list** — all 7 rooms visible | `Seven rooms. Your city or your hour.` | Pivot: "here's where you meet the people you just sorted." | 7 rooms #1 (exact names); absence backbone; caption ASO §4 |
| **7** | **Chat room** (Late Night, consented capture) | `Where the conversation happens out loud.` | One warm room, proving rooms are conversation not a grid. Late Night = reliably-warm CTA target. | 7 rooms #1; brand register; consent-sourced (§4) |
| **8** | **Notification-preview settings** — name-only mode selected | `Previews stay sender-only until you say otherwise.` | The privacy turn — reassurance for a visitor deciding whether to install a gay social app. | Notification preview privacy #12; caption ASO §4 |
| **9** | **Closing card** — H.I.M. wordmark + amber pip on midnight indigo | `No swiping. No radar. No grid. Friendship first. · 18+` | Absence backbone + Tier 1 tagline + the mandated **18+**. Mirrors the IG carousel's closing slide. | Absence #22; "Friendship first." Tier 1; 18+ #23 |

**Held off this CPP on purpose:** room **"Seen by N"** (asc B3 — claims-sensitive, kept out of all visual metadata; lives in What's New only) and **Follow** (not cleared). **Buzz** is DM-only and already approved but is not a 2.1 headline, so it's omitted here to keep the buddy-side story tight — it stays on the default page's set.

**Device sizes:** export at least one **6.9"** (iPhone 16 Pro Max) set; add 6.5"/6.7" to match whatever sizes the live default page uses. Captions must survive the smaller crops — keep them one line.

### Production + consent (binding — asc §3 / `instagram.md` §1.2, restated)

- **Real UI only**, founder-captured on-device via `scripts/take-app-store-screenshots.mjs`. Never mockups (asc B5). Before capture: build **real** Buddy Circles on a consenting seed account (real names, no fabricated presence/counts).
- Any frame with another member's screenname/message needs that member's **explicit, logged consent** (source from consenting S0 seed members); **crop/blur every non-consenting screenname**; **never publish real DM content** — the Knock/away-reply/DM frames are staged with one consenting seed member, brand-authored status text.
- **Fallback (zero capture / zero sign-off risk):** if on-device capture slips, this CPP ships with **no custom screenshots** and inherits the default 2.1 set — the promo text (§4) still makes it an Instagram-distinct page. Never ship mockups to close the gap.

---

## 4. Promotional text (170-char surface this CPP owns)

CPP-specific, leads on the Circles hook the IG object established, claims-traced, counted.

**PRIMARY (164 / 170):**

```
Sort your buddies into private circles only you can see. Pick a screenname, set an away message, drop into 7 rooms. No swiping. No radar. No grid. Friendship first.
```

**Claims trace:** "Sort your buddies into private circles only you can see" → Buddy Circles, cleared, owner-only (the "only you can see" is the mandatory private framing, `social-push-plan` §5.2). "Pick a screenname" → #2. "set an away message" → #3. "drop into 7 rooms" → #1. "No swiping. No radar. No grid." → #22. "Friendship first." → Tier 1 (brand brief §6). No dating vocabulary; no counts; no Follow; no "seen"; no AIM/AOL.

**FALLBACK (148 / 170 — Knock + explicit 18+, if you'd rather foreground the gesture):**

```
Sort your people into private circles only you see. Knock to say a quiet hi. Drop into 7 rooms. No swiping. No radar. No grid. Friendship first. 18+
```

*18+ note:* the app's age rating and closing screenshot (slot 9) already carry 18+; promo text need not repeat it, but the fallback includes it for the belt-and-suspenders read. Promotional text edits live without a build review, so either can be swapped at the Aug 17 / Aug 31 gates without touching the CPP's build record.

---

## 5. App-preview video (optional — recommended if the C7 cut exists)

The IG object is partly a **Reel** (C7 real-UI circle-creation demo, already produced under the TikTok/IG batching sessions — zero new production). That same recording is the natural CPP app preview and **extends carousel→page continuity into motion**: the visitor who tapped from the Reel sees the same footage resolve on the page.

- **Source:** the **C7 "your people, sorted" screen-record** (creating a circle, filing buddies) — real UI, consented seed account, no fabricated presence/counts.
- **Cut for the store:** ~15–20s, portrait, **first frame safe** (it plays muted, auto-loops) — open on the Buddy Circles screen so the poster frame rhymes with screenshot slot 1. Burned-in captions only; **no** licensed audio, **no** door/buddy-in sounds (brand brief §7.5), **no** on-screen `aim-*` asset strings (README note).
- **Poster frame:** the Buddy Circles screen with the amber pip visible.
- **Optional, not blocking:** if the cut isn't export-ready (`scripts/generate-app-store-previews.mjs` needs ffmpeg + the captured set), ship screenshots alone — the CPP is complete without it.

---

## Appendix — claims used on this CPP

| Register # (or 2.1 cleared) | Claim as used | Where |
|---|---|---|
| **Buddy Circles** (cleared this session) | Private, owner-only circles; "only you can see" | Slot 1, promo text, app preview |
| #3 | Away messages / status with custom text | Slot 2, slot 5, promo text |
| #4 | Buddy list of people you've met | Slot 2 |
| **Mutual context** (cleared) | Shared rooms + mutual buddies on a profile | Slot 3 |
| **Knock** (cleared) | Buddies-only "👋 wants to talk," low-pressure | Slot 4, fallback promo text |
| **Away-message replies** (cleared) | Quote a buddy's status into a DM draft | Slot 5 |
| #1 | 7 rooms, exact names | Slot 6, slot 7, promo text |
| #2 | Screenname-first identity | Promo text |
| #12 | Notification previews default to sender-only | Slot 8 |
| #22 | No swipe / no radar / no grid | Slot 9, promo text |
| #23 | 18+ | Slot 9, fallback promo text |
| Tier 1 (brand brief §6) | "Your people, right there." (Tier 3) · "Find your people before you even DM." (Tier 3) · "Friendship first." (Tier 1) | Slots 2, 3, 9, promo text |

**DNC compliance:** no Follow (not cleared); no room "Seen by N" anywhere on this CPP (B3); no counts/live figures (DNC #10 — Circles frames show no counts); no AIM/AOL/ICQ or "nudge™" (DNC #9, B7); no dating vocabulary, "hookup" absent entirely (DNC #13, brand brief §2.3); no encryption/anonymous/offline/Android/testimonial/invite-link language; no member DM content; "Your people, sorted." kept to IG-side creative, not burned into store metadata.

---

## Flags

1. **Registration gate (hard, README six-feature list).** Every 2.1 feature line on this CPP — screenshot captions naming Circles/Knock/mutual context/away replies + the Circles promo text — needs the **claims-register addendum + founder sign-off** before the CPP is submitted. This session clears the features for public metadata; the register entry must still be *filed* so the paper trail exists (asc Gate 1 / B4). Nothing here ships ahead of that.
2. **"Seen by N" excluded by design (B3).** One of the five cleared features appears **nowhere** on this CPP — no screenshot, no promo text — because it's claims-sensitive and out of visual/metadata surfaces until a register addendum reconciles it against DNC #5. Flagging so no one "completes the set" by adding it.
3. **"Your people, sorted." is not founder-signed as a tagline.** Used only in the IG carousel/caption (the object that sends traffic), never on the CPP itself. If the founder signs it off (the path "The light's on." took), it could replace the slot-1 caption at a gate.
4. **Bio-link single-slot conflict.** `instagram.md` §2 routes the bio to `hiitsme.app` (web-app parity). This CPP wants the store-bound CTA. Recommendation above: point bio at the CPP during launch week, rotate back at Aug 17, or run both if the bio supports two links. Founder/Social Strategist to confirm.
5. **UTMs die at the App Store boundary.** Attribution here is Apple Campaign Link `ct=porchlight-ig-circles` in ASC App Analytics, read by triangulation — not the Vercel UTM read. Keep the channel plan's attribution-honesty caveat in the scorecard.
6. **Screenshot capture is founder-on-device** (consented seed account, real Circles, no fabricated counts). If it slips, inherit the default set — the promo text alone still makes this an IG-distinct CPP. Never ship mockups.
7. **Follow deliberately absent** — not cleared this session; no Follow content anywhere on this page.

---

*Instagram Custom Product Page · H.I.M. v2.1 · rides OPERATION PORCH LIGHT · Saman Technologies LLC (internal). This file is `cpp-instagram.md` only — sibling CPP files belong to other agents.*
