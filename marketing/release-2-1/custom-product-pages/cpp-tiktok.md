# H.I.M. v2.1 — TikTok Custom Product Pages (CPP creative)

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version:** 2.1 · **Prepared:** 2026-07-23 · **Role:** TikTok Strategist
**Owns:** the CPP variant(s) that TikTok traffic lands on. **Does not own:** the master CPP portfolio / ppid registry — that's the App Store Optimizer's `cpp-strategy.md` (not yet written to this directory as of this file; see Coordination flags).
**Governed by:** `strategy/claims-register.md` (STRICT — approved claims only), `strategy/brand-brief.md` (voice/naming/nostalgia), `release-2-1/asc-submission.md` (§3 default-page screenshot plan, §5 blockers), `release-2-1/README.md` (canonical six-claim sign-off list), `campaign-2026-q3/channels/tiktok.md` + `release-2-1/social-tiktok.md` (the videos these pages must match).

---

## 0. What this file is — and the two gates it inherits

A **Custom Product Page (CPP)** shares the app's binary but overrides three surfaces on a unique, non-search-indexed `?ppid=` URL: **up to 10 screenshots/device**, **one optional app-preview video**, and **one 170-char promotional text**. Everything else — **app name, subtitle, keywords, description, icon — is inherited from the default page and cannot change here.** So the levers below are screenshots, promo text, and (optionally) one video. That's it.

This file drafts those levers for the pages TikTok points at. It inherits the same two hard gates as the rest of the 2.1 package, plus one CPP-specific relief:

1. **Gate 1 — new-feature copy needs founder sign-off + register addendum.** Buddy Circles, Knock, mutual context, away-message replies, "Seen by N", and Follow post-date the claims register's last verification (2026-07-15) and are **not yet in the APPROVED table**. Every screenshot caption and promo line below that *names* one of them is **scripted pending sign-off** — identical posture to `asc-submission.md` Gate 1 and `social-tiktok.md` §0. The canonical six-claim list to register is in `README.md`; open those entries before any of this publishes. Nothing below claims more than the code does.
2. **Gate 2 — no IAP / no Pro anywhere.** 2.1 carries no in-app purchase. No CPP screenshot, caption, promo line, or app-preview frame may show or imply Pro, a paywall, or a SKU (`asc-submission.md` Blocker B1).
3. **CPP relief — index-freeze does NOT apply here.** The O9 App-Store-Search baseline freeze (`asc-submission.md` B6) protects the *indexed* metadata: name, subtitle, keywords. **CPPs are not search-indexed** (direct/paid traffic only), so naming Knock and Circles in CPP screenshots/promo is *index-safe* — the only gate on it is Gate 1's caption sign-off, not the freeze. This is the whole reason a CPP is the right home for the new-feature story while the default page stays frozen.

**Also still binding (unchanged from `social-tiktok.md` §1 + §4 do-not list):** real 2.1 UI only (no mockups, no fabricated presence/counts — DNC #10); logged S0 consent for any second member's screenname, crop/blur everyone else, no DM message bodies in frame; iPhone **portrait only**, no iPad (claim #21); "Seen by N" is an aggregate **count, never names, never "read receipts"** and stays **out of CPP screenshots and the app preview** (DNC #5 / Blocker B3); native-only claims stay on iPhone; name always **H.I.M.**, domain lowercase `hiitsme.app`, **18+** present; **no dating vocabulary** (no match/swipe/singles/nearby/flirt/hot; "hookup" only as "not a hookup app"; "lonely" never); **no AOL/AIM/ICQ marks and no recreated legacy-IM sounds** — and the app's internal `aim-*` asset filenames must never appear on screen or be audible.

---

## 1. TL;DR — the decision

- **Three CPPs, one live at a time.** TikTok gives a small account exactly one bio link, so the "portfolio" works by **swapping which ppid the bio link resolves to, per hero week.** All three are cheap to produce: same on-device capture session as `asc-submission.md` §3, then reorder + recaption. Promo text is free to change and version-independent.

| CPP | Serves the viewer who just watched… | Leads with | Live during |
|---|---|---|---|
| **CPP-TT-KNOCK** *(primary / default)* | 2C1 Knock, 2C5 "ways to say hi", 2C6 founder | Knock screen | Weeks 1, 2, 4, 5 |
| **CPP-TT-CIRCLES** | 2C2 Buddy Circles, C6 "your list, your rules" | Buddy Circles screen | Week 6 (Buddy List Week) |
| **CPP-TT-PRESENCE** *(also the evergreen fallback)* | 2C4 "The light's on.", 2C3 mutual context, C4 room tour | BuddyList presence hero | Week 3 (Room Tour) + default for mixed traffic |

- **Bio-link architecture:** keep the bio link pointing at `hiitsme.app` (per `channels/tiktok.md` §2 — it's the one link and it serves web + iOS). The **landing page routes iOS visitors to the active week's CPP `?ppid=` URL** and everyone else to the web app. I supply the ppid→hero mapping and the weekly swap; the landing-router itself is a dependency (see §2 + Coordination flags). Launch-week alternative: point the bio link **directly** at `CPP-TT-KNOCK`'s App Store URL for cleaner store-intent.
- **App preview: YES for CPP-TT-KNOCK only** (a re-cut from the raw Knock capture — VO/end-card/CTA stripped, ~18s, **silent audio track**). Optional for CIRCLES/PRESENCE; screenshots carry them. Details in §6.
- **Message-match lives in one frame:** the CPP's **first screenshot (or app-preview poster frame)** is what the viewer sees in the half-second after the tap. It must continue the exact interaction from the video they just watched. Every set below is ordered to that rule.

---

## 2. How TikTok traffic reaches a CPP (bio-link architecture)

TikTok's only durable link surface for a small account is the profile bio link (`channels/tiktok.md` §2). A CPP lives at an App Store URL of the form:

```
https://apps.apple.com/app/id6761863631?ppid={{ppid-uuid}}
```

The `ppid` UUID is minted by App Store Connect when each CPP is created (they don't exist yet — placeholders below). Two ways to connect the bio link to it:

**Recommended — landing-router (preserves web fallback + keeps UTM):**
Bio link stays the strategy's `https://hiitsme.app/?utm_source=tiktok&utm_medium=social&utm_campaign=porchlight-q3`. The landing page detects iOS and 302s to the **active week's CPP ppid URL** (carrying the ppid through), while non-iOS visitors get the web app. Swapping the week's hero = flipping one config value (the default ppid the router points at). This keeps the strategy's single-link rule intact and doesn't strand Android/desktop viewers.

**Launch-week alternative — direct swap:**
For Launch Week, when nearly all hero traffic is iOS-intent, point the bio link string **directly** at `CPP-TT-KNOCK`'s App Store URL. Purest store-intent and cleanest CPP attribution; cost is losing the web fallback for non-iOS taps. Founder's call at batching time.

**Weekly bio-link (ppid) swap schedule — mapped to `social-tiktok.md` §1 Option A (2.1 live for Aug 3 open).** Bio link can't vary per-video, so it follows the week's *dominant* hero:

| Week | Dominant hero(es) | Bio link resolves to |
|---|---|---|
| 1 · Aug 3–9 (Launch) | 2C1 Knock + 2C4 presence | **CPP-TT-KNOCK** |
| 2 · Aug 10–16 | 2C5 Knock+Buzz | **CPP-TT-KNOCK** |
| 3 · Aug 17–23 (Room Tour) | C4 rooms + 2C4 "Seen by N" recut | **CPP-TT-PRESENCE** |
| 4 · Aug 24–30 (New City) | 2C1 Knock cut B | **CPP-TT-KNOCK** |
| 5 · Aug 31–Sep 6 (Night Owls) | 2C1/Buzz late-night | **CPP-TT-KNOCK** |
| 6 · Sep 7–13 (Buddy List) | 2C2 Buddy Circles | **CPP-TT-CIRCLES** |

If `social-tiktok.md` **Option B** is true (2.1 clears review mid-flight), the bio link stays on the default-page or PRESENCE CPP until the "Launch Week" spike lands, then follows the same table shifted forward. `CPP-TT-PRESENCE` is the safe default any week the hero is ambiguous.

**Attribution honesty (carry `channels/tiktok.md` §8 verbatim intent):** there is no install attribution and no UTM-to-signup capture. CPP performance is read by ASC's CPP-level metrics (impressions, product-page views, conversion by ppid — the one place TikTok gets discrete store-side numbers) triangulated against the content calendar. The weekly scorecard states this limitation rather than inventing precision.

---

## 3. Message-match map (video → CPP → first frame)

| TikTok concept (hook) | Bio link that week → CPP | First screenshot the viewer lands on | Continuity |
|---|---|---|---|
| **2C1 Knock** — "the 'hey, you up? no reason' button, but for friends" | CPP-TT-KNOCK | Knock screen — "Knock — one tap, no paragraph." | Same interaction, same words ("no paragraph") |
| **2C5** — "three ways to reach a friend without typing a word" | CPP-TT-KNOCK | Knock screen | Knock is the middle beat of the video; page leads on it |
| **2C4** — "you can tell who's around before you say a word" / "The light's on." | CPP-TT-PRESENCE | BuddyList presence hero — "The light's on." | Same tagline, same presence-dot frame |
| **2C3** — "it refuses to be a dating app" / "not a compatibility score" | CPP-TT-PRESENCE | Presence hero → frame 2 is the mutual-context card with the shipped "not a compatibility score" line in-frame | The proof line the video promised is right there |
| **C4** room tour — "exactly seven chat rooms" | CPP-TT-PRESENCE | Presence hero → Late Night room frame | Room world the tour just walked |
| **2C2 Buddy Circles** — "sort your friends into private groups and they have NO idea" | CPP-TT-CIRCLES | Buddy Circles screen — "Private circles only you can see." | Same feature, same privacy punchline |
| **C6** "your list, your rules" | CPP-TT-CIRCLES | Buddy Circles screen | Circles is C6's thesis made literal |

---

## 4. The three CPPs — screenshots + promo text

**Format for every set:** 6.9" iPhone (1320 × 2868), PNG/RGB/no alpha, **portrait only**. Real 2.1 UI captured on-device by the founder in the same session as `asc-submission.md` §3 (same consent/blur/no-bodies rules). On-image overlay caption per slot; **sign-off status flagged per caption** — Tier 1/Tier 3 lines are pre-approved brand language; **[Gate 1]** lines name a new feature and need founder sign-off + the register addendum before publish. **"Seen by N" appears in none of these sets** (B3). Apple allows 10 frames; these run 5 for pace — the first two do the work.

---

### 4.1 · CPP-TT-KNOCK — primary (`?ppid={{ppid-knock}}`)

**Serves:** taps from 2C1 (weeks 1/4/5), 2C5 (week 2), 2C6 founder. The marquee 2.1 interaction and the most emotionally legible — the page must open on Knock itself.

**Screenshots (ordered):**

| # | Real 2.1 screen | On-image caption | Caption status |
|---|---|---|---|
| 1 | **Knock in a DM** — "👋 Knock — wants to talk" row + Knock button, staged with a consenting seed member, **no message bodies in frame** | **Knock — one tap, no paragraph.** | [Gate 1] — Knock (#26) |
| 2 | **BuddyList presence hero** — online/idle/away rows, a real away message | **Your people, right there.** | Tier 3 (approved, brand brief §6) |
| 3 | **Mutual context "You both know" card** — shared rooms + mutual buddies; the shipped **"not a compatibility score"** line legibly in-frame (consent/blur on chips) | **See what you already share.** | [Gate 1] — mutual context (#27) |
| 4 | **Late Night room** (consented capture) | **Find your people before you even DM.** | Tier 3 (approved, GTM §3) |
| 5 | **Away-message composer** | **Your status says more than you think.** | Tier 3 (approved, GTM §3) |

*(Optional 6th: away-message reply interaction — "Reply right to a buddy's status." [Gate 1, away-reply]. Add only if the founder wants a 2.1-heavier set; screenshots 1–5 stand alone.)*

**Promotional text (156 chars — under 170):**
> `Knock is the one-tap hello for a friend — no paragraph, no pressure. H.I.M.: a friendship-first app for gay men. Not a dating app. No swiping, no radar. 18+`

- Status: **[Gate 1]** (names Knock).
- Claims trace: Knock one-tap/low-pressure → claim #26 (pending); "friendship-first app for gay men" / "not a dating app" → brand brief §1 + DNC #13; "No swiping, no radar" → claim #22; "18+" → claim #23.

---

### 4.2 · CPP-TT-CIRCLES — Buddy List Week (`?ppid={{ppid-circles}}`)

**Serves:** taps from 2C2 (week 6 hero) and C6. Its whole design is privacy — the "you don't want everyone in your business" thesis made literal. The punchline is that **buddies never know they're in a circle**; never imply otherwise (owner-only RLS — a "he'll know" claim is materially false; `social-tiktok.md` §4 item 1).

**Screenshots (ordered):**

| # | Real 2.1 screen | On-image caption | Caption status |
|---|---|---|---|
| 1 | **Buddy Circles** — real circles + an "Ungrouped" section, consented screennames, **no counts** | **Private circles only you can see.** | [Gate 1] — Buddy Circles (#25) |
| 2 | **BuddyList presence hero** | **Your people, right there.** | Tier 3 (approved) |
| 3 | **Knock in a DM** (staged, consented, no bodies) | **Knock. A quieter way to say hi.** | [Gate 1] — Knock (#26) |
| 4 | **Late Night room** (consented) | **Find your people before you even DM.** | Tier 3 (approved) |
| 5 | **Away-message composer** | **Your status says more than you think.** | Tier 3 (approved) |

**Promotional text (147 chars):**
> `Buddy Circles: sort your friends into private groups only you can see. They never know. A friendship-first app for gay men — not a dating app. 18+`

- Status: **[Gate 1]** (names Buddy Circles).
- Claims trace: private/owner-only/"they never know" → claim #25 (pending; owner-only RLS, buddies not notified); "friendship-first app for gay men" / "not a dating app" → brand brief §1 + DNC #13; "18+" → claim #23.

---

### 4.3 · CPP-TT-PRESENCE — "The light's on." + evergreen fallback (`?ppid={{ppid-presence}}`)

**Serves:** taps from 2C4 (weeks 1/3/5), 2C3 (week 1 flex), C4 room tour (week 3), and any week the hero is ambiguous. Anchor tagline **"The light's on."** (Tier 1, cleared 2026-07-15). Frame 2 delivers the 2C3 promise — the shipped **"not a compatibility score"** line as real UI.

**Screenshots (ordered):**

| # | Real 2.1 screen | On-image caption | Caption status |
|---|---|---|---|
| 1 | **BuddyList presence hero** — presence dots + a real away message | **The light's on.** | Tier 1 (approved, cleared 2026-07-15) |
| 2 | **Mutual context "You both know" card** — "not a compatibility score" in-frame (consent/blur) | **See what you already share.** | [Gate 1] — mutual context (#27) |
| 3 | **Away-message composer** | **Your status says more than you think.** | Tier 3 (approved) |
| 4 | **Knock in a DM** (staged, consented, no bodies) | **Knock — one tap, no paragraph.** | [Gate 1] — Knock (#26) |
| 5 | **Late Night room** (consented) | **Find your people before you even DM.** | Tier 3 (approved) |

**Promotional text (155 chars):**
> `See who's around before you say a word — presence dots, away messages, a buddy list that's yours. A friendship-first app for gay men. Not a dating app. 18+`

- Status: **Tier-3/approved vocabulary only** — this promo names no gated new feature (presence/away messages/buddy list = claims #3/#4, already approved), so it can ship even if Gate 1 slips. Safest of the three.
- Claims trace: presence/away messages → claim #3; buddy list → claim #4; "friendship-first app for gay men" / "not a dating app" → brand brief §1 + DNC #13; "18+" → claim #23.

---

## 5. Why this ordering (message-match rationale)

- **The first frame is the whole game.** After a tap, the viewer sees one still (or the preview poster) before deciding to stay. If a Knock video sends them to a page that opens on a generic buddy list, the thread snaps. Each CPP therefore opens on the exact screen the video's hook was about.
- **Frame 2 pays off the video's promise, not just its topic.** KNOCK frame 3 and PRESENCE frame 2 are the mutual-context card carrying the shipped **"not a compatibility score"** copy — the literal proof 2C3 dangled ("watch what this one does instead"). The proof is real shipped UI, not an overlay claim, which is why it survives review.
- **Tail frames are the approved evergreen set.** Frames 4–5 across all three CPPs reuse the pre-approved Tier-3 room + away-composer frames from `asc-submission.md` §3, so most of each set needs zero new sign-off and the pages read as one app.
- **Not-a-dating-app is stated on every page**, in promo and via the mutual-context frame, because TikTok's highest-converting phrase for this audience is "apps that aren't dating apps" / "not a dating app" (`social-tiktok.md` §3) — and the CPP is where that intent either converts or bounces.

---

## 6. App-preview video decision

**Cut one app preview for CPP-TT-KNOCK. Optional for the other two.**

**Why yes, for KNOCK:** a CPP app preview autoplays at the top of the page and re-shows the interaction in motion — the strongest possible continuation of a Knock video. Knock is also the cleanest feature to film for Apple: the Knock rows carry **no message body**, so there's nothing to blur and no bodies to leak.

**Which cut:** **not the finished TikTok.** Source it from the **raw real-UI screen recording** in the 2C1/2C5 batching capture and re-cut it to Apple's rules:
- **Strip** the VO, the on-screen marketing text stack, the end card, the wordmark, and the "link in bio" CTA — Apple app previews must be app capture, not an ad (Guideline 2.3.x; a promo end-card / external CTA gets previews rejected).
- **Keep** only the on-device flow: buddy list with real presence dots → open a buddy's DM (consented, no bodies) → tap **👋 Knock** → "You knocked" row → cut to the received "[screenname] knocked — wants to talk" row on the second consented device. ~15–20s.
- **Poster (first) frame:** the buddy list with presence dots — a clean real frame, never a title card.
- **Audio: ship a silent track.** Do **not** carry the app's Knock/Buzz sound — those files are the internal `aim-*` assets (`/sounds/aim-instant-message.mp3`), and a recreated legacy-IM sound is a brand-brief §7.5 / DNC #9 risk even with the filename off screen. Previews autoplay muted anyway; build for muted. (Same rule the TikTok edits already follow: survive the sound being off.)
- **Sign-off:** the preview *shows* Knock, so it's **[Gate 1]** — same sign-off as the Knock captions.

**CIRCLES / PRESENCE previews — optional, defer.** Circles and presence read fine as stills and the capture burden isn't free (a Circles preview must show real owner-only circles with consented names and no counts). Screenshots carry weeks 3 and 6. Add a PRESENCE preview later only if week-3 CPP conversion underperforms the KNOCK page and the founder wants to test motion. **Never** put "Seen by N" in any preview (B3).

**Production path:** export via the repo's `scripts/generate-app-store-previews.mjs` (needs ffmpeg + the captured set) at the 6.9" iPhone portrait app-preview spec. If ffmpeg/capture isn't available, **screenshots alone are a valid CPP** — the preview is upside, not a blocker.

---

## 7. Production + do-not (taped to the tripod)

Everything in `social-tiktok.md` §4 applies. The CPP-specific traps:

1. **Real UI, no mockups.** The 9 placeholder mockups from the July build are never for ASC — CPP included (`asc-submission.md` §4). Founder captures on-device.
2. **Consent + no bodies.** Any second member's screenname needs logged S0 consent; crop/blur everyone else; **no DM message bodies** in any Knock/Circles/room frame or the preview.
3. **"Seen by N" stays out** of every screenshot and the app preview (aggregate count, never names, never "read receipts" — DNC #5 / B3).
4. **Circles are invisible to buddies** — no caption or frame implying a buddy is notified, ranked, or can see their circle (owner-only RLS; the punchline is that they don't know).
5. **Mutual context is not a match/compatibility signal** — overlay captions must never use "match," "match score," "compatible," or "%." Mirror the shipped **"not a compatibility score"** (it rides in-frame as real UI; the overlay stays "See what you already share").
6. **No dating vocab, no counts, no scale, no Pro/IAP, no legacy-IM marks or `aim-*` on screen or in audio, iPhone portrait only, native-only features stay iPhone.**
7. **Every page reads 18+** — via promo text (all three carry it) and inherited metadata.

---

## 8. Coordination flags

- **DEPENDENCY — ASO master `cpp-strategy.md` / ppid registry.** This directory has no `cpp-strategy.md` yet (the App Store Optimizer owns it). The three `{{ppid-*}}` placeholders here must be filled with the real UUIDs ASC mints at CPP creation and registered in that master file. My CPP names (`CPP-TT-KNOCK` / `-CIRCLES` / `-PRESENCE`) and their screenshot/promo/video specs are the TikTok slice of that portfolio — hand them to the ASO for ppid assignment and de-dup against any other channel's CPPs. If another channel already needs a Knock or presence page, we may share a ppid rather than mint duplicates.
- **DEPENDENCY — landing-router (iOS → ppid).** The recommended bio-link architecture (§2) needs `hiitsme.app` to 302 iOS visitors to the active week's CPP ppid. That's the landing-page owner's build, not mine. If it's not in place by Launch Week, fall back to the **direct-swap** (bio link = `CPP-TT-KNOCK` App Store URL) and accept the loss of web fallback for non-iOS taps.
- **GATE 1 — six-claim register addendum.** Every **[Gate 1]** caption, promo line, and the KNOCK app preview is *scripted pending sign-off*. The canonical set to register (per `README.md`) is six: Buddy Circles, Knock, Follow, mutual context, "Seen by N", away-message replies. Only Buddy Circles, Knock, mutual context, and away-replies are *named* in this file's copy; Follow and "Seen by N" are deliberately not surfaced on any TikTok CPP. Nothing here publishes until the founder/Brand Guardian opens those entries.
- **GATE 2 — confirm no Pro/IAP reachable** in the 2.1 binary before any CPP goes live (`asc-submission.md` B1). CPP creative shows none regardless.
- **Capture-session sharing.** All three CPP screenshot sets + the KNOCK preview come from **one** on-device session — the same one `asc-submission.md` §3 already asks the founder to run. Reuse it; don't schedule a second consented shoot.

---

## Appendix — claims used

| Register # | Claim as used | Where | Status |
|---|---|---|---|
| #3 | Away messages + status / presence | PRESENCE (promo + frames), all sets (composer frame) | Approved |
| #4 | Buddy list of people you've met | all sets (presence hero), PRESENCE promo | Approved |
| #22 | No swiping, no radar, no grid | KNOCK promo | Approved |
| #23 | 18+ | all three promo texts | Approved |
| #26 | **Knock** — buddies-only, one-tap, no message body, rate-limited | KNOCK + CIRCLES + PRESENCE captions, KNOCK promo, KNOCK app preview | **Pending (Gate 1)** |
| #25 | **Buddy Circles** — private, owner-only; buddies never see/are notified | CIRCLES caption + promo | **Pending (Gate 1)** |
| #27 | **Mutual context** — shared rooms + mutual buddies, "not a compatibility score" | KNOCK + PRESENCE frame | **Pending (Gate 1)** |
| — (away-reply) | Reply to a buddy's away message | optional KNOCK frame 6 | **Pending (Gate 1)** |

**Approved brand language used:** "The light's on." (Tier 1) · "Your people, right there." · "Find your people before you even DM." · "Your status says more than you think." (Tier 3) · "friendship-first app for gay men" / "not a dating app" (brand brief §1, DNC #13).

**DNC compliance:** no encryption language (#1); no Android (#6); no invite links (#7); no "anonymous" (#8); no legacy-IM marks or `aim-*` sounds/strings on screen (#9); no counts/fabricated activity (#10); no testimonials (#11); no dating positioning (#13); "Seen by N" and native-only features scoped per #5/#15; no Pro/IAP (Gate 2).

---

*TikTok CPP creative · extends OPERATION PORCH LIGHT · H.I.M. v2.1 · Saman Technologies LLC (internal). Scripted pending Gate-1 sign-off on new claims. Sibling files in this directory belong to other agents — this file is `cpp-tiktok.md` only.*
