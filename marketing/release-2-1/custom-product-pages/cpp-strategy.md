# H.I.M. v2.1 — Custom Product Pages (CPP) Master Strategy

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version context:** v2.1 (features + reliability, **no IAP**) · **Prepared:** 2026-07-23 · **Role:** App Store Optimizer (ASO lead / CPP owner)
**Status:** Master strategy of record for the 2.1 Custom Product Page portfolio. This doc **defines the named portfolio**; the three channel specialists (`social-tiktok.md`, `social-twitter.md`, Instagram) and the Social Media Strategist (`social-push-plan.md`) align their link/creative plans to the page names below. It does not rewrite their channel tactics.

**Governed by:**
- `campaign-2026-q3/strategy/claims-register.md` — the only source of allowed product claims (STRICT).
- `campaign-2026-q3/strategy/brand-brief.md` — voice, naming, nostalgia policy, tagline system.
- `campaign-2026-q3/channels/app-store-optimization.md` — §0 index freeze, §1 listing, §4 screenshot rules, §5 promo-text calendar.
- `release-2-1/asc-submission.md` — the 2.1 default-page submission (What's New, KEEP-listing decision, screenshot plan, blockers B1–B7).
- `release-2-1/README.md` §"What 2.1 ships" — the six new claims and their code paths.

**Clearance note (resolves the standing Gate 1 concern for CPP copy):** the FIVE 2.1 feature lines used in this portfolio — **Buddy Circles, Knock, mutual context, away-message replies, and room "seen" counts** — were **founder-approved this session for public App Store metadata** (the 2.1 "What's New" shipped live with them). They are therefore cleared for CPP copy. Each is traced to shipped code below. **Follow (`user_connections`) is NOT cleared** (live-render unverified per README §"Follow live-render") and appears **nowhere** in this portfolio — no page, no screenshot, no line.

Character counts below are Unicode character counts (em dash = 1 char), computed 2026-07-23. **Re-count in App Store Connect at entry time — the ASC counter is the arbiter.**

---

## 0. What a Custom Product Page is — and the one insight this whole strategy turns on

### 0.1 The mechanics (get these exact)

A Custom Product Page (CPP) is an **alternate face of the same app listing**, reachable only by a **unique deep-link URL** carrying a `?ppid=` product-page ID. Per app you may create **up to 35** CPPs. Each CPP lets you customize exactly **three** things and nothing else:

| Customizable per CPP | Limit |
|---|---|
| **Screenshots** | up to 10 per device size |
| **App preview video** | 1 (optional) |
| **Promotional text** | 1 field, **max 170 characters** |

Everything else — **App Name, Subtitle, Keywords, and the full Description — is INHERITED from the default product page and cannot be changed per CPP.** A CPP is not a second listing; it is a re-skin of the storefront's visual + promo surface for a specific audience arriving from a specific link.

### 0.2 The insight: CPPs are NOT indexed for App Store Search

This is the strategic pivot of the entire portfolio. **CPPs never appear in App Store search or Browse results.** The only way anyone reaches one is a **direct URL** you place in a paid ad, a TikTok/IG bio link, a link-in-reply, or a campaign link. That single fact flips the constraint that governs the default page:

| | **Default product page** | **A Custom Product Page** |
|---|---|---|
| Discoverable in Search/Browse | Yes — it *is* the indexed surface | **No — direct URL only** |
| Feeds the keyword index / 4.3 keyword-stuffing risk | Yes — every word is read literally by App Review and the index | **No — screenshots + promo text are not indexed and carry no keyword weight** |
| Governed by the flight's **index-measurement freeze** (ASO §0) | Yes — name/subtitle/keywords held stable so the O9 Search baseline stays interpretable | **No — a CPP changes zero indexed fields, so it cannot contaminate the O9 read** |
| Should it lean into the new 2.1 features? | **No** — `asc-submission.md` §2/B6 deliberately keeps `circles`/`knock`/`presence` OUT of the indexed listing this cycle | **Yes — fully. A CPP is the correct home to feature 2.1, with zero indexing or 4.3 cost** |

**Why this matters, stated plainly.** The default page is doing careful, conservative work this flight: it holds the June listing stable so the first-ever ASC Search baseline (O9) reads cleanly, and it keeps the un-registered-until-now feature vocabulary out of the surfaces App Review reads most literally. A CPP is exempt from *both* pressures. It changes no indexed field, so it cannot break the O9 measurement. It is never crawled for search, so featuring "Buddy Circles" or "Knock" on it adds no keyword-stuffing (4.3) exposure. **The default page stays disciplined; the CPPs get to be loud about 2.1.** That division of labor is the reason to build this portfolio now.

Two disciplines that do **not** relax on a CPP, because they are about truth and safety, not indexing:
- **Claims discipline.** Every CPP line still traces to shipped code or an approved claim. Not-indexed buys freedom from the *keyword* rules, never from the *claims register*.
- **Real-UI + member-consent rules** (`asc-submission.md` §3, ASO §4). Every screenshot is real 2.1 UI captured on-device; any frame showing another member's screenname/message needs that member's explicit, logged consent (source from consenting S0 seed members, crop/blur everyone else); **never** publish real DM content; iPhone **portrait only**, no iPad, no mockups.

---

## 1. Strategic rationale — why these pages, tied to campaign objectives

The 2.1 push ("the buddy list grows up" — `social-push-plan.md` §1) hands each channel a feature story. Those stories currently funnel to `hiitsme.app` and then into a warm room. CPPs add a **second, App-Store-native landing surface** so that when a channel's creative sends someone to *download*, the store page they land on **matches the creative they just watched** — instead of the generic default page whose conservative, feature-silent design was built for a different job (search converts, not campaign-click converts).

**How the portfolio maps to campaign objectives:**

- **O9 (store funnel — conversion vs the Jul 27 snapshot).** CPPs are measured on their own conversion rate against the default page (ASC CPP analytics, §4). A CPP that beats the default for its traffic source is a direct, attributable conversion win — and because it touches no indexed field, it does this **without disturbing the O9 Search baseline** the flight is protecting.
- **O1 (installs) / O8 (campaign pageviews).** Every channel already drives UTM-tagged traffic; a CPP gives that traffic a message-matched store destination, lifting install conversion on the traffic we're already paying attention/effort for.
- **Dead-room mitigation (campaign §7, push-plan §5.5).** Three of the four pages lead with **buddy-side** features (Circles, Knock, mutual context) that reward a new arrival even when rooms are quiet — the same reason 2.1's marquee is Circles, not the room feature.
- **Channel alignment (one page per specialist).** The portfolio is built so each channel specialist has one page whose promo + screenshots match their creative, and the Social Media Strategist owns the cross-channel/evergreen page. Named below so the sibling files can reference them by name.

**Why four pages, not one big one:** a CPP's power is *message match* — the store page mirrors the ad. One generic CPP would forfeit that. Four narrow pages, each matched to a channel's angle, is the point of the feature. (35 are allowed; four is the disciplined start — add city-specific variants in Q4 only if H3 city-intent evidence lands, ASO §3.)

---

## 2. The recommended CPP portfolio (4 pages)

Each page: internal name (never public), audience/campaign + driving channel, one paste-ready promotional text (counted, claims-traced), ordered screenshot direction (real 2.1 UI screen + on-image caption per slot), and an app-preview verdict.

**Screenshot inventory referenced (all real 2.1 UI, on-device capture per `asc-submission.md` §3):** BuddyList presence hero · Buddy Circles (real circles + "Ungrouped") · Knock (buddy row/DM "👋 Knock — wants to talk") · Away-message composer · Away-message reply (status quoted into a DM draft) · Profile sheet with mutual context · Chat room (Late Night, consented) · Rooms list (7 rooms) · Screenname setup · Notification-preview settings.

**Caption legend:** `[Tier3]` = already-approved caption (GTM §3 / brand brief §6 Tier 3), no sign-off needed. `[feature-cleared]` = names one of the five session-cleared features, cleared for use, drafted verbatim from `asc-submission.md` §3. `[approved-line]` = shipped/approved brand line.

**Deliberately excluded from every screenshot set:** the room **"Seen by N"** receipt. It is claims-sensitive (DNC #5 carve-out — aggregate count, never "read receipts"). It is cleared for *text* use but is a weak, easily-misread *visual*; mirroring `asc-submission.md` B3, it stays out of screenshots. The concept lives in copy only, phrased strictly as an aggregate count.

---

### CPP-1 — internal name: **"Sorted"** (Buddy Circles hero)

- **Audience / campaign:** S3 (nostalgia natives + newstalgics) and broad TikTok discovery; the marquee 2.1 story. Serves flight Week 1–2 and reprises Week 6 (Buddy List Week).
- **Driving channel:** **TikTok** — the `social-tiktok.md` "C7: Your people, sorted" screen-record of creating a circle and filing buddies. This CPP is the store destination for the TikTok bio link during the Circles beat.
- **Promotional text (paste-ready, 153/170):**

  > `Your buddy list, made yours. Sort your people into private circles only you see. Mute one, hide another. No swiping. No radar. No grid. Friendship first.`

- **Screenshot direction (ordered):**
  1. **Buddy Circles** (real circles + "Ungrouped", consented screennames, no counts) — caption **"Your buddies, in circles only you see."** `[feature-cleared]`
  2. **BuddyList presence hero** (online/idle/away rows) — caption **"Your people, right there."** `[Tier3]`
  3. **Away-message composer** — caption **"Your status says more than you think."** `[Tier3]`
  4. **Rooms list** (7 rooms) — caption **"Seven rooms. Your city or your hour."** (built from claim #1 + Tier 1; if this new caption misses sign-off, fall back to a Tier 3 frame — see §5 fallback)
  5. **Profile sheet with mutual context** — caption **"See what you already share."** `[feature-cleared]`
- **App preview video: YES — highest-value page for it.** The C7 circle-creation screen-record already exists for TikTok; re-export it to App Store preview specs (portrait, 15–30s, real UI, consented). Motion sells "sort your people" far better than a static frame, and this is the page most likely to earn paid/bio traffic. Reuse, don't reshoot.

---

### CPP-2 — internal name: **"New City"** (relocation / rooms)

- **Audience / campaign:** S1 (New City, No Crew) — moving Aug–Sep for a job/school/fresh start. Peaks flight Week 4 (relocation season). **Cold-acquisition safe:** leads with rooms + screenname + absence claims, **not** mutual context (whose card is empty for brand-new users — push-plan §5.2/§5.3 caution).
- **Driving channel:** **Instagram** — the forwardable "which room are you" / relocation carousels and Reels; this CPP is the store destination when IG sends a new-in-town viewer to download.
- **Promotional text (paste-ready, 158/170):**

  > `Just moved? Say hi in the New York City, Los Angeles, Chicago, or Atlanta rooms — or Everywhere Else. You pick your room; no location radar. Friendship first.`

- **Screenshot direction (ordered):**
  1. **Rooms list** (7 rooms) — caption **"Seven rooms. Your city or your hour."** (new; Tier 3 fallback available)
  2. **Chat room** (Late Night, consented capture) — caption **"Find your people before you even DM."** `[Tier3]`
  3. **Screenname setup** — caption **"Pick a name that's actually you."** `[Tier3]`
  4. **BuddyList presence hero** — caption **"Your people, right there."** `[Tier3]`
- **App preview video: NO (optional).** This page is rooms-and-place, well told by static frames; the region names in the promo text carry the intent. Skip the production cost. Revisit only if IG traffic to this ppid proves high-volume at a gate.

---

### CPP-3 — internal name: **"Quiet Hello"** (Knock + privacy)

- **Audience / campaign:** S2 (Done With the Grid) — has the incumbent apps and resents them; privacy-alert; wants a low-pressure, platonic lane. Steady across the flight; reinforced Week 6 (privacy-receipts close).
- **Driving channel:** **X** — the founder build-in-public ship-log and reply threads (`social-twitter.md`); this CPP is the store destination for the bio/reply link when the Knock + presence-privacy story is in play. (Bare "Search 'H.I.M.'" is banned — brand-collision with Hims; a `?ppid=` link sidesteps the loose-branded-search problem entirely, ASO §1.3 companion rule.)
- **Promotional text (paste-ready, 159/170):**

  > `A quieter way to keep up with your people. Knock to say a low-key hello, set an away message, keep previews sender-only. No swiping. No grid. Friendship first.`

- **Screenshot direction (ordered):**
  1. **Knock** (buddy row/DM "👋 Knock — wants to talk", staged with one consenting seed member) — caption **"Knock. A quieter way to say hi."** `[feature-cleared]`
  2. **Away-message composer** — caption **"Your status says more than you think."** `[Tier3]`
  3. **Notification-preview settings** — caption **"Previews stay sender-only until you say otherwise."** (new; claim #12; needs caption sign-off — Tier 3 fallback frame available)
  4. **BuddyList presence hero** — caption **"Your people, right there."** `[Tier3]`
- **App preview video: NO.** Knock is a one-tap gesture; a single crisp static frame reads instantly, and X's link traffic is lower-volume and founder-driven. Not worth the export.

---

### CPP-4 — internal name: **"Buddy List, Reborn"** (evergreen / cross-channel)

- **Audience / campaign:** the full 2.1 brand loop as one story — meet → talk → add → **sort your people** — for cross-channel use, press links, the waitlist Thursday drop, and any generic "download H.I.M." bio link. Evergreen; the default campaign destination when no channel-specific angle applies.
- **Driving channel:** **Social Media Strategist (cross-channel)** — owns this page; it is the catch-all ppid the strategist points press, owned surfaces, and any un-themed link at.
- **Promotional text (paste-ready, 161/170):**

  > `H.I.M. opens on your people — who's online, who's away, what they're up to. Sort them into private circles, knock to say hi, reply to a status. Friendship first.`

- **Screenshot direction (ordered):**
  1. **BuddyList presence hero** — caption **"Your people, right there."** `[Tier3]`
  2. **Buddy Circles** (real circles + "Ungrouped", consented) — caption **"Your buddies, in circles only you see."** `[feature-cleared]`
  3. **Knock** (staged, consented) — caption **"Knock. A quieter way to say hi."** `[feature-cleared]`
  4. **Away-message reply** (a buddy's status quoted into a DM draft, staged/consented) — caption **"Reply straight to what they're up to."** (new; feature-cleared "away-message replies"; needs caption sign-off — see §5)
  5. **Chat room** (Late Night, consented) — caption **"Find your people before you even DM."** `[Tier3]`
  6. **Profile sheet with mutual context** — caption **"See what you already share."** `[feature-cleared]`
- **App preview video: OPTIONAL — reuse only.** If the CPP-1 C7 preview exists, drop it here too (same clip, valid). Do not commission a separate evergreen video; static frames tell the loop adequately.

---

## 3. Exact App Store Connect creation steps (per CPP)

Do this once per page, four times. Assumes the 2.1 build is live/approved (or, for a web-only soft launch, that copy says "on the App Store" only once the 2.1 iOS build is actually approved — claim #21).

1. **App Store Connect → Apps → H.I.M. → left sidebar, under "App Store" → "Custom Product Pages" → the "+" (Create Custom Product Page).**
2. **Reference Name:** enter the **internal** name ("Sorted" / "New City" / "Quiet Hello" / "Buddy List, Reborn"). This name is **private to ASC — never shown to users** — so it can be as internal as you like. Save to create the page (it opens in a Draft state, one editable version).
3. **Localization:** the CPP inherits the default page's localizations, name, subtitle, keywords, and description automatically — **leave all of those alone; they are not editable here and must not be.** Open the primary localization (English U.S.) to edit the three customizable surfaces.
4. **Screenshots:** upload the ordered set for this page (§2) for **each device size the default listing uses** — at minimum one **6.9"** (iPhone 16 Pro Max) set; add 6.5"/6.7" if the default listing carries them. Portrait iPhone only, real UI, consented captures, no mockups. Order them exactly as listed.
5. **App Preview (optional):** for CPP-1 (and optionally CPP-4), upload the exported preview video (portrait, ≤30s, real UI). Skip for CPP-2/CPP-3.
6. **Promotional Text:** paste this page's 170-char text from §2. **Verify the ASC character counter** shows ≤170 before saving.
7. **Submit the CPP version for review:** click **"Submit for Review"** on the CPP. A CPP that carries custom **screenshots/preview** goes through App Review as its own version (it can be reviewed independently of, and in parallel with, the app version). Approval typically lands in ~24h for an app already in good standing.
8. **Retrieve the `?ppid=` URL:** once the CPP is **Approved / Live**, its unique URL appears on the CPP detail page (the "URL" / share field). Format:
   `https://apps.apple.com/app/id6761863631?ppid=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`
   Copy it and hand it to the owning channel. **Append the flight UTMs** for triangulation consistency (push-plan §4): e.g. `…?ppid=<id>&utm_source=tiktok&utm_campaign=porchlight-q3&utm_content=circles`. (ASC CPP analytics key off the `ppid`; the UTMs feed the Vercel/web-referrer triangulation, not ASC.)
9. **Later edits:** **promotional-text-only** changes on an approved CPP publish **without a new review** (mirrors default-page promo-text behavior). **Screenshot or preview** changes require **re-submitting the CPP for review.** The ASC console is the arbiter of what triggers review at entry time.

**Suggested `utm_content` tags for the four ppids:** `circles` (CPP-1), `rooms` (CPP-2), `knock` (CPP-3), `buddylist` (CPP-4) — so the Vercel read attributes to a *page/story*, not just a channel.

---

## 4. Measurement — reading per-CPP conversion vs the default page

**Tools only:** ASC Custom Product Page analytics + the flight's existing ASC/Vercel/first-party-SQL triangulation. **No new vendors, no native tracking** (push-plan §4, non-goal #11). The attribution-honesty caveat carries verbatim: no install attribution exists; direction over magnitude at seed-stage volumes.

**Where the numbers live:** ASC surfaces per-CPP metrics keyed to each `ppid` — **impressions, product page views, conversion rate, and downloads** — alongside the same metrics for the **default product page**. This is native, first-party, and requires zero plumbing.

**How to read it (the core comparison):**
- **Per-CPP conversion rate vs the default page's conversion rate.** The CPP's whole job is message-match: someone who watched the TikTok Circles demo should convert *better* on the Circles CPP than the same person would on the generic default page. The readable signal is **CPP conversion rate − default-page conversion rate** for the same window.
- **Judge on 2-week windows, never single weeks** (ASO §3 volatility rule). At tens-to-low-hundreds of page views per CPP per week, a single-week swing is noise. Log absolute numbers; resist computing rates on tiny denominators.
- **Everything anchors to the Jul 27 snapshot** for the default-page baseline; CPPs have no pre-flight history, so their baseline is their own first two-week window.
- **Cross-check with Vercel `utm_content`** — a CPP getting page views but weak downloads, while the same story's `hiitsme.app` pageviews are healthy, tells you the store creative (not the channel) is the weak link.

**What a win looks like:**
- **Primary win:** a CPP's conversion rate sits **meaningfully and repeatably above the default page's** for its traffic over two consecutive windows. That is the page earning its build.
- **Secondary win:** the CPP concentrates a channel's install intent — e.g. CPP-1 shows the highest conversion during the Circles beat weeks, confirming message-match works.
- **Portfolio win:** at the Aug 31 gate and the wrap, **double the winning page(s), kill or re-cut the laggards** (same kill/double discipline as the channel plans). CPP-1 (Circles) is the pre-registered favorite to double if it earns it.
- **Non-win that is still useful:** a CPP that *under*-performs the default page for its source is a signal the creative→store handoff is off — re-cut the screenshots (a re-review), don't thrash the default listing.

**What NOT to measure:** follower growth (non-goal #2); any per-user tracking; and — restated hard — **the "Seen by N" in-product number is never a marketing metric** (DNC #10). Report CPP counts as CPP performance only.

**Cadence:** folds into the existing Monday scorecard and the Aug 17 / Aug 31 phase gates. Add one row per ppid to the scorecard: page views, conversion rate, delta vs default page, notes on the driving channel's activity that window (triangulation).

---

## 5. Claims-compliance pass — every line of copy

Two disciplines apply to CPPs (§0.2): **claims** (unchanged from the register) and **truth/safety** (real-UI, consent). The keyword/index rules do **not** apply (not indexed). Every public string in this portfolio is passed below.

### 5.1 Promotional text (the four public 170-char fields)

| Line / phrase | Traces to | Verdict |
|---|---|---|
| "Your buddy list, made yours." / "Sort your people into private circles only you see. Mute one, hide another." (CPP-1) | **Buddy Circles** — `src/lib/buddyCircles.ts` (owner-only RLS `20260722130125`; `showPresence`/`notifyMode` are owner-side-only controls; "Ungrouped" section). Session-cleared feature. | PASS — private/owner-only framed correctly; no "shared group" implication (push-plan §5.2). |
| "No swiping. No radar. No grid." (CPP-1, CPP-3) | Claim **#22** absence enumeration (approved backbone). | PASS. |
| "Friendship first." (all four) | Tier 1 tagline (brand brief §6). | PASS. |
| "Just moved? Say hi in the New York City, Los Angeles, Chicago, or Atlanta rooms — or Everywhere Else." (CPP-2) | Claim **#1** (exact room names) + S1 register (GTM §2 "Gay men who just moved somewhere new"). | PASS — exact room names; "Just moved?" not the internal theme name. |
| "You pick your room; no location radar." (CPP-2) | Claim **#22** (rooms are self-selected, never GPS). | PASS — anti-outing posture held (brand brief §2 rule 6). |
| "Knock to say a low-key hello" (CPP-3, CPP-4 "knock to say hi") | **Knock** — `handleSendKnockToBuddy` in `src/app/hi-its-me/page.tsx`; migrations `20260722114338`/`20260722150347`; `enforce_knock_rules()` live in prod (buddies-only, 10-min cooldown). Session-cleared. | PASS — generic "knock/hello"; **not** framed as a "nudge™" or any AIM/AOL mark (DNC #9, B7). |
| "set an away message" / "reply to a status" (CPP-3, CPP-4) | Away messages: claim **#3**. **Away-message replies** — `src/lib/awayMessageReply.ts` (quote a buddy's status into a DM draft). Session-cleared. | PASS. |
| "keep previews sender-only" (CPP-3) | Claim **#12** (notification previews default to sender-only). | PASS — matches approved phrasing. |
| "H.I.M. opens on your people — who's online, who's away, what they're up to." (CPP-4) | Native presence-first BuddyList (README §"What 2.1 ships"); presence states = claim **#3**. | PASS — honest presence description; no counts. |

**Portfolio-wide negative checks (all four pass):** no `match/swipe(as offer)/singles/nearby/flirt/hookup-as-offer/meet guys` (brand brief §2 rule 3); no "read receipts" anywhere (DNC #5 — and "Seen by N" is absent from all promo text); no user counts / "N online" (DNC #10); no encryption language (DNC #1); no Android (DNC #6); no "invite link" (DNC #7); no "anonymous" (DNC #8); no AOL/AIM/ICQ marks (DNC #9); no "works offline" (DNC #12); no deletion absolutism (DNC #14); no dating positioning (DNC #13). **Follow appears nowhere** (unverified live-render). "18+" is inherited from the default page's description/age rating; no CPP contradicts it.

### 5.2 On-image captions

| Caption | Status | Trace / note |
|---|---|---|
| "Your people, right there." | `[Tier3]` cleared | GTM §3 buddy-list caption. |
| "Find your people before you even DM." | `[Tier3]` cleared | GTM §3; also literally describes mutual context. |
| "Pick a name that's actually you." | `[Tier3]` cleared | GTM §3. |
| "Your status says more than you think." | `[Tier3]` cleared | GTM §3. |
| "Your buddies, in circles only you see." | `[feature-cleared]` | Verbatim from `asc-submission.md` §3; Buddy Circles owner-only. |
| "Knock. A quieter way to say hi." | `[feature-cleared]` | Verbatim from `asc-submission.md` §3; Knock. Not a "nudge™". |
| "See what you already share." | `[feature-cleared]` | Verbatim from `asc-submission.md` §3; mutual context (shared rooms + mutual buddies, never "compatibility" — push-plan §5.3). |
| "Seven rooms. Your city or your hour." | **NEW — caption sign-off (brand brief §6)** | Built from claim #1 + Tier 1. Fallback: use a Tier 3 rooms frame ("Find your people before you even DM.") if sign-off slips. |
| "Previews stay sender-only until you say otherwise." | **NEW — caption sign-off** | Claim #12. Fallback: drop the frame; page stands. |
| "Reply straight to what they're up to." | **NEW — caption sign-off** | Away-message replies (feature-cleared), but this exact phrasing is net-new. Fallback: drop the frame from CPP-4; the loop still reads. |

**Caption fallback rule (brand brief §6):** the three `NEW` captions are built only from cleared-feature + Tier 1 vocabulary but their exact wording is net-new, so they need founder sign-off before publish. If any misses sign-off, use the noted Tier-3/drop fallback — **every page remains shippable on approved-only captions.** The `[Tier3]` and `[feature-cleared]` captions ship as-is.

### 5.3 Screenshot production compliance (binding, all pages)

- Every frame is **real 2.1 UI** captured on-device (`scripts/take-app-store-screenshots.mjs`); **no mockups**, no fabricated Circle counts / presence / activity (DNC #10, ASO §4).
- Any frame showing another member's screenname/message uses a **consenting S0 seed member** (consent logged in the tracker) or blurs/crops the non-consenting member.
- **No real DM content** — the Knock and away-message-reply frames are staged with one consenting seed member.
- Internal asset strings (`aim-*` sound filenames) must **never** be visible on screen (README non-blocking note; nostalgia-trademark rule).
- iPhone **portrait only**; 6.9" required, 6.5"/6.7" to match the default listing (claim #21 — no iPad).

---

## 6. Sequencing & dependencies

1. **Default-page 2.1 submission first** (`asc-submission.md`) — CPPs inherit its name/subtitle/keywords/description, and the description must already carry the four compliance corrections (18+, "a copy of your data anytime", "your account and your content are deleted", filter phrasing) before CPPs go live, since they inherit it.
2. **Capture the real 2.1 screenshot set once** (§5.3) — the same on-device capture session feeds `asc-submission.md` §3 and all four CPPs; set up real Buddy Circles + a consenting second seed member before capturing.
3. **Caption sign-off** on the three NEW captions (§5.2) — or confirm fallbacks.
4. **Build the four CPPs** (§3), submit for review, retrieve ppids.
5. **Hand ppids to channels** with UTM-appended URLs; each specialist swaps their bio/link destination to their page's ppid during that feature's beat.
6. **Measure** per §4 from the first live window; review at Aug 17 / Aug 31 gates and the wrap.

---

## 7. Claims used (appendix)

| # / feature | As used here | Where |
|---|---|---|
| #1 rooms (7, exact names) | CPP-2 promo, CPP-1/CPP-2 rooms frames | §2 |
| #2 screenname-first | CPP-2 screenname frame | §2 |
| #3 away messages + status | CPP-1/CPP-3 promo, away composer frames | §2 |
| #12 sender-only previews | CPP-3 promo + settings frame | §2 |
| #22 absence claims (no swipe/radar/grid) | CPP-1/CPP-2/CPP-3 promo | §2 |
| #21 App Store + web, iPhone portrait | production rules, §3 launch note | §2, §5.3 |
| Buddy Circles (session-cleared) | `buddyCircles.ts`, mig `20260722130125` | CPP-1, CPP-4 |
| Knock (session-cleared) | `page.tsx` `handleSendKnockToBuddy`, migs `20260722114338`/`150347`, `enforce_knock_rules()` | CPP-3, CPP-4 |
| Mutual context (session-cleared) | `src/lib/mutualContext.ts`, `get_mutual_context` | CPP-1, CPP-4 |
| Away-message replies (session-cleared) | `src/lib/awayMessageReply.ts` | CPP-3, CPP-4 |
| Room "seen" counts (session-cleared) | `src/lib/roomReadReceipts.ts` — **text-only, aggregate, never "read receipts"; excluded from all screenshots** | §2 exclusion note |

**DNC rules actively enforced:** #1 (no encryption), #5 (no room "read receipts"; Seen-by-N kept aggregate + out of screenshots), #6 (no Android), #7 (no invite-link), #8 (no "anonymous"), #9 (no AOL/AIM/ICQ marks incl. `aim-*` asset strings on screen), #10 (no counts/stats), #12 (no "works offline"), #13 (no dating vocabulary), #14 (no deletion absolutism). **Follow (`user_connections`) excluded entirely — unverified live-render.**

---

*Custom Product Pages master strategy · H.I.M. v2.1 · rides inside OPERATION PORCH LIGHT · Saman Technologies LLC (internal). Sibling files in this directory belong to other agents — this file is `custom-product-pages/cpp-strategy.md` only.*
