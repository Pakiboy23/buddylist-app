# H.I.M. v2.1 — Custom Product Pages: Channel Map + Campaign Integration

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version:** 2.1 (features + reliability, no IAP) · **Prepared:** 2026-07-23 · **Role:** Social Media Strategist (cross-channel lead)
**Rides inside:** OPERATION PORCH LIGHT flight (Aug 3 – Sep 13, 2026) and the v2.1 social push (`social-push-plan.md`).

**Governed by (copy still clears these before publishing):** `campaign-2026-q3/strategy/brand-brief.md` (voice/naming/nostalgia), `campaign-2026-q3/strategy/claims-register.md` (allowed claims), `campaign-2026-q3/strategy/campaign-strategy.md` (flight objectives, budget, attribution posture).

**Companion (this doc reconciles to, does not duplicate):** `custom-product-pages/cpp-strategy.md` — the ASO's master CPP portfolio. That file names the pages and owns screenshot/promo-text production. **This file owns the channel→page mapping, message-match discipline, launch sequencing, and measurement tie-in.** If the ASO's portfolio names or page count differ from mine, reconcile by **function** (mapping table in §0.2), not by label.

---

## 0. What CPPs are, and why they fit this launch

### 0.1 The mechanics that shape everything below

- Each CPP has a **unique `?ppid=` deep link** — `https://apps.apple.com/app/id6761863631?ppid=<ppid>` (the `<ppid>` is the identifier ASC assigns at creation; the readable slugs in this doc are planning placeholders to be swapped for the real ASC ppids).
- A CPP varies **only** its **screenshots / app preview** and its **170-character promotional text**. **Name, subtitle, keywords, and full description are inherited from the default product page** — unchanged, already claims-clean ("H.I.M. — Friends, Not Dates" / "Gay friendship, retro style" / the frozen keyword string / the corrected description).
- **CPPs are NOT search-indexed.** They surface by direct URL only — paid ads, bios, link stickers, campaign drops. They earn nothing from browse/search.
- Up to **35 per app.** We use **4**. The 31-page headroom is free A/B capacity for the phase gates (§3, §4).

### 0.2 Why this is the right tool for 2.1 (three reasons, all load-bearing)

1. **CPPs let us tell the 2.1 feature story at the store without touching the indexed listing.** The ASO deliberately froze name/subtitle/keywords and held the default promotional text on the flight calendar to keep the O9 App-Store-Search baseline interpretable (`asc-submission.md` §2, §B6). A CPP's per-page 170-char promo text and screenshot set are **separate surfaces** — so we can run "Buddy Circles" and "Knock" messaging on `?ppid=` pages while the default page stays frozen. **CPPs resolve the tension between "announce 2.1" and "don't break the index-measurement freeze."**
2. **Message-match without new plumbing.** A CPP gives each creative a store page whose screenshots + promo text mirror the post that sent the user — the single biggest lever on paid/campaign conversion, at $0.
3. **Per-page store analytics we don't otherwise have.** ASC reports product-page views, downloads, and conversion rate **per ppid**. That is a cleaner store-side read than the default page's blended funnel (§4).

### 0.3 The four pages (reconciled to the assumed ASO portfolio)

| Planning slug | Function (reconcile ASO's page to this) | Built on | Claims posture |
|---|---|---|---|
| **CPP-PRESENCE** | Presence-first / nostalgia page — sign-on, buddy list, away messages, rooms | v2.0 UI, already-approved frames + Tier 1–3 vocab | Ships day one; no 2.1 dependency |
| **CPP-NOTDATING** | Anti-dating / "not a dating app" page — absence claims + rooms | v2.0 UI, approved frames + claim #22 backbone | Ships day one; no 2.1 dependency |
| **CPP-CIRCLES** | Buddy Circles page (marquee) + mutual context | **2.1 UI** (Circles, mutual context) | Feature claims cleared this session; screenshots gated on the 2.1 build being live (§3) |
| **CPP-KNOCK** | Knock page — the quieter hello | **2.1 UI** (Knock, buddies-only) | Feature claim cleared this session; screenshots gated on 2.1 live (§3) |

**Hard exclusions baked into all four (session constraints):**
- **Follow is NOT cleared** — it appears on **no** CPP screenshot, caption, or promo line. (The C6/R3 "your list, your rules" privacy creative loses its Follow fold entirely for CPP purposes.)
- **Room "seen" counts** = aggregate presence-derived number, **never** "read receipts," never names. Following the ASO's B3 caution (`asc-submission.md` §3), "Seen by N" stays **out of every CPP screenshot set**; it lives in organic social only. No CPP leads on it.
- No H.I.M. Pro / IAP / subscription language anywhere. No dating vocabulary. No user counts. No testimonials. No AIM/AOL/ICQ marks; Knock/Buzz never framed as a "nudge™". Real UI only; member-consent guardrail on every capture.

### 0.4 The 170-char promo text per page (claims-checked, paste-ready to ASO)

Drafted from APPROVED claims + Tier 1–3 vocab. The ASO owns final promo/screenshot production; these are the message-match anchors.

- **CPP-PRESENCE:** `Remember when going online felt like arriving somewhere? A screenname that's yours, an away message that says what you're up to, a buddy list of people you know. 18+`
- **CPP-NOTDATING:** `A friendship app for gay men — not a dating app. No swiping. No radar. No grid. Just rooms where the conversation's already going, and a buddy list you built on purpose. 18+`
- **CPP-CIRCLES:** `Find your people before you even DM. Sort your buddy list into private circles only you can see, and see the rooms and buddies you already share. Friendship first. 18+`
- **CPP-KNOCK:** `Knock — a quieter way to say hi. One tap tells a buddy you're around. No pressure, no wall of text. A friendship app for gay men, not a dating app. 18+`

> **Tagline flag:** the marquee push line **"Your people, sorted."** is a *new* tagline and needs founder sign-off before public use (brand brief §6; `social-push-plan.md` §1). Until it clears, CPP-CIRCLES runs on the **approved Tier 3 line "Find your people before you even DM,"** which literally describes mutual context. If "Your people, sorted." is signed off, it can lead the CPP-CIRCLES promo line and its hero caption; nothing here depends on it clearing.

---

## 1. Channel → CPP map

### 1.1 Link-tier policy (read first — this reconciles CPPs with the flight's web funnel)

The flight routes bio traffic through **`hiitsme.app` (UTM-tagged)** on purpose: it is the only surface Vercel can measure, and O8 (6,000 campaign pageviews) depends on it (baseline audit §3.2-C; `channels/*` bio links). CPP `?ppid=` links are **App Store URLs** — they convert straight to the store and are read in **ASC**, but they carry no Vercel UTM and skip the web funnel. So the two are **complements, not substitutes**:

- **Tier-1 (persistent single-link bios) stay `hiitsme.app`** on TikTok and X — protects O8 and the flight's attribution spine. CPPs enter these channels through their **pinned content and self-reply links**, not by replacing the bio.
- **Tier-2 (per-creative link surfaces) carry the matched CPP `?ppid=`** — IG story link stickers, IG bio secondary slot, X feature-post self-replies, waitlist/seed drops, and ASA ad variations. These are the moments where message-match matters most and where ASC gives a clean per-ppid read that doesn't need Vercel.
- **Optional measured bio-swap (phase-gate test, §4):** during the Circles hero window we may temporarily point the TikTok/IG primary bio at CPP-CIRCLES, compare ASC CPP conversion against the `hiitsme.app` funnel, then revert. Bounded, $0, and it answers "does direct-to-CPP beat the web funnel for us?" without risking O8 for the whole flight.

### 1.2 The map

| Surface | What goes there | Rationale |
|---|---|---|
| **TikTok — bio** | **`hiitsme.app` UTM link stays** (protects O8). CPP presence is via the **pinned video** (below), not the bio. Optional: bio-swap to **CPP-CIRCLES** for the Tue–Fri launch-week Circles window only, as the §4 test. | TikTok gives a small account one link; the flight already invested it in the measurable web funnel. |
| **TikTok — pinned video** | Pin the week's hero; its on-screen "link in bio" points at the bio link. During Launch Week pin **C7 (Buddy Circles)**; the bio-swap window makes that a direct CPP-CIRCLES path. | Pin = the highest-traffic creative; align it with whichever CPP is live and hero. |
| **X — bio (website field)** | **`hiitsme.app` UTM link stays** (`utm_content=bio`, per `channels/twitter.md`). | O8 + the flight's X attribution row (X4). |
| **X — pinned post** | The **launch thread T1** stays pinned; its self-reply link stays the **`hiitsme.app`** anchor as scripted (do not rewrite T1). | T1 is the O8 anchor and a sibling-owned asset. |
| **X — 2.1 ship-log thread** (new, Mon Aug 3, `social-push-plan.md` §3) | Self-reply link → **CPP-CIRCLES** (`?ppid`). | The 2.1 story's marquee is Circles; send store-ready readers straight to the matched page. |
| **X — feature-post self-replies** | Away-message posts (T5) → **CPP-PRESENCE**; room-tour thread (T7) → **CPP-NOTDATING**; privacy post (T15) → **CPP-CIRCLES**; a Knock post (new) → **CPP-KNOCK**. | Per-post message-match; bio stays the general funnel. |
| **IG — bio (link-in-bio)** | Primary **`hiitsme.app`** (funnel) **+ one CPP secondary slot** rotated to the live hero: **CPP-CIRCLES** launch week → **CPP-NOTDATING** Week 3 → **CPP-CIRCLES** Week 6. (IG "link in bio" supports multiple links; label the CPP entry plainly, e.g. "New: sort your buddies.") | Keeps the funnel and adds a direct-store shortcut for profile visitors. |
| **IG — story link stickers** | Matched CPP per story: Circles stories → **CPP-CIRCLES**; away-message / Sunday cards → **CPP-PRESENCE**; "new city" / room stories → **CPP-NOTDATING**; Knock how-to → **CPP-KNOCK**. Keep `utm_medium=stories` on any parallel `hiitsme.app` sticker so Vercel can still split sticker traffic. | Link stickers are inherently per-creative — the tightest message-match surface we have. |
| **IG — pinned posts** | Pin the **Buddy Circles carousel** after Launch Week and the **room-tour carousel (CB)** after Week 3 (per `channels/instagram.md` §2); their story-sticker/bio companions carry the matched CPP. | Aligns pinned evergreen with the live CPPs. |
| **Waitlist / early-tester Thursday drop** (`campaign-strategy.md` §5.7) | The forward-ready asset's link → the drop's featured CPP: Jul 30 first-look + Launch-Week drop → **CPP-CIRCLES**; later drops match that week's beat. | App-ready audience → direct-to-store; cleanest ASC per-ppid read, no Vercel dependency. |
| **Seed community (S0) ambassador forward-asset** | The "send this to one group chat" asset links to **CPP-CIRCLES** (Circles is the buddy-side, room-temperature-independent hero). | Message-match to the marquee; seed members are already app-ready. |
| **Apple Search Ads** (optional, weeks 3–6, `campaign-strategy.md` §8) | Assign a matched CPP to each exact-match ad group: `gay friendship app` → **CPP-NOTDATING**; `gay chat rooms` → **CPP-NOTDATING**; `friendship app` → **CPP-PRESENCE**. Zero dating keywords. | ASA + CPP is the canonical pairing and the **one channel with native attribution** — highest-value, cleanest-measured CPP use. |
| **Reddit** | **NONE. No CPP link is dropped on Reddit.** | Reddit gets no launch push (flight §5.3; `social-push-plan.md` §2). The 90/10 disclosed-founder posture means a `?ppid` campaign link reads as marketing and burns credibility. Where the app genuinely answers a thread, the founder uses the bare `hiitsme.app` / "it's on the App Store" phrasing per `channels/reddit.md` §2 — never a CPP. This exclusion is deliberate and absolute. |

---

## 2. Message-match discipline

**The rule:** the CPP a user lands on must match the creative that sent them. A viewer primed on Buddy Circles must land on Circles screenshots + the Circles promo line — never a generic page. A mismatch is a bounce and a wasted, unrepeatable click. Below, every campaign creative is paired to exactly one page.

### 2.1 Routing logic (so any new asset self-classifies)

- Presence / nostalgia / sign-on / away messages / buddy list → **CPP-PRESENCE**
- "Not a dating app" / absence claims (no swipe/radar/grid) / room tour / relocation / city → **CPP-NOTDATING**
- Buddy Circles / mutual context / "your people, sorted" / the buddy-list-grows-up story → **CPP-CIRCLES**
- Knock / the quieter hello → **CPP-KNOCK**

### 2.2 Creative → page pairings (from the channel plans + 2.1 push)

| Creative (source) | Theme | Lands on |
|---|---|---|
| TikTok **C1** "Arriving somewhere" (`tiktok.md`) | Sign-on, away messages, buddy list, nostalgia | **CPP-PRESENCE** |
| TikTok **C2** founder story | "Not a dating app," no grid, why I built it | **CPP-NOTDATING** |
| TikTok **C3** away-message prompt + Buzz | Away messages / status | **CPP-PRESENCE** |
| TikTok **C4** room tour (7 rooms) | Rooms, chosen not detected, no radar/grid | **CPP-NOTDATING** |
| TikTok **C5** "New city, no crew" | Relocation, rooms, no radar | **CPP-NOTDATING** |
| TikTok **C6** "Your list, your rules" | Buddy loop + privacy receipts (Follow fold **removed** — not cleared) | **CPP-CIRCLES** |
| TikTok **C7** Buddy Circles demo (`social-push-plan.md` §2–3) | Buddy Circles | **CPP-CIRCLES** |
| IG **R1** Reel / **CA** intro is presence → R1 | "Arriving somewhere" | **CPP-PRESENCE** |
| IG **CA** carousel "Built different by design." | Absence claims | **CPP-NOTDATING** |
| IG **R2** / **S1** away-message | Away messages / Sunday status | **CPP-PRESENCE** |
| IG **CB** room-tour carousel | Rooms, "that's the whole map" | **CPP-NOTDATING** |
| IG **S2** "New city, no crew." | Relocation | **CPP-NOTDATING** |
| IG **S3** Late Night card | Presence / night-owl ritual | **CPP-PRESENCE** |
| IG **CC** / **R3** "Your list, your rules." | Buddy loop + privacy (no Follow) | **CPP-CIRCLES** |
| IG **Buddy Circles carousel** (`social-push-plan.md` §2) | Buddy Circles | **CPP-CIRCLES** |
| IG mutual-context Reel/carousel (Aug 7 beat) | Mutual context ("find your people before you DM") | **CPP-CIRCLES** |
| X **T1** launch thread | Overview / founder story | **`hiitsme.app` anchor** (not a CPP — O8 anchor, scripted) |
| X **T5** away-message moment | Away messages | **CPP-PRESENCE** |
| X **T7** room-tour thread | Rooms | **CPP-NOTDATING** |
| X **T15** privacy receipts | Privacy + buddy list | **CPP-CIRCLES** |
| X 2.1 ship-log thread (new) | 2.1 marquee (Circles) | **CPP-CIRCLES** |
| X Knock post (new) | Knock | **CPP-KNOCK** |
| Waitlist / seed forward-asset (Circles) | Buddy Circles | **CPP-CIRCLES** |
| ASA `gay friendship app` / `gay chat rooms` | Intent | **CPP-NOTDATING** |
| ASA `friendship app` | Intent | **CPP-PRESENCE** |

### 2.3 Match integrity rules (binding)

1. **One creative → one page.** Never let a link's ppid drift from the page whose screenshots/promo match the post. If a post is re-cut for a new theme, re-check its ppid.
2. **A page's promo line must echo the creative's hook.** CPP-CIRCLES promo says "find your people…" because the Circles/mutual-context creatives say it. If a creative's core line isn't reflected on its landing page, fix one of them before it ships.
3. **Don't send cold-acquisition traffic to a page that's empty for new users.** Mutual context is empty on a brand-new profile (`social-push-plan.md` §5.2). CPP-CIRCLES therefore **leads its screenshots with Buddy Circles** (rewards a user with as few as three buddies) and treats the mutual-context frame as support — never the hero for a first-time viewer.
4. **Follow is on no page.** Any privacy/"your list, your rules" creative routed to CPP-CIRCLES must not carry a Follow line, because CPP-CIRCLES has no Follow content.
5. **Room "seen" stays organic-only.** No creative whose hook is "you'll know it landed" gets a dedicated CPP; route it to CPP-CIRCLES (buddy-side) or CPP-NOTDATING (rooms) and keep the "seen" framing in the caption, never on the store page.

---

## 3. Launch-week sequencing (mapped onto the flight calendar)

**Anchor (inherits `social-push-plan.md` §3):** "Launch Day" = the day 2.1 is confirmed live for users. Web features are live on `hiitsme.app` the moment the web build deploys; **iOS features are live only when the 2.1 App Store build is approved.** Because a CPP's screenshots are App Store screenshots, **CPP-CIRCLES and CPP-KNOCK screenshot sets activate only when the 2.1 iOS build is approved.** CPP-PRESENCE and CPP-NOTDATING have no 2.1 dependency and go live at flight start.

| When (flight week) | CPP action | Deployed on |
|---|---|---|
| **Pre-flight · Jul 27 – Aug 2** | Create all 4 CPPs in ASC as drafts. Load 170-char promo (§0.4) + screenshot sets (real UI, logged S0 consent, reuse the `asc-submission.md` §3 captures — $0). **PRESENCE + NOTDATING ready to publish. CIRCLES + KNOCK staged; publish gated on 2.1 approval.** Record the real ppids into this map + the link templates. | — |
| **Mon Aug 3 · Wk1 Sign-On** | Publish **CPP-PRESENCE + CPP-NOTDATING** live. | TikTok pinned/bio-swap-eligible, IG bio secondary + stickers, X T5/T7 self-replies |
| **Tue Aug 4 · Wk1** | **CPP-CIRCLES live** (marquee) — gated on 2.1 approval; if iOS still in review, run promo text live + hold the feature screenshots until approved, and route Circles traffic to the web build via `hiitsme.app` until the store page can show real 2.1 UI. | C7 pinned, IG Circles stickers, X 2.1 ship-log self-reply, waitlist, seed forward-asset; optional TikTok/IG bio-swap window |
| **Around the first Knock creative · Wk1** | **CPP-KNOCK live** (gated on 2.1 approval). Deployed only where Knock-specific creative runs. | X Knock post, IG Knock how-to sticker |
| **Wed–Sun Aug 5–9 · Wk1** | Circles depth + "Seen by N" tied to Sunday Reset (organic caption only, not on any CPP). | Per §1.2 map |
| **Aug 17 phase gate · Wk3 Room Tour** | Read ASC CPP conversion per ppid (§4); kill/double. **CPP-NOTDATING** carries room-tour/city creative + ASA. | IG bio secondary → NOTDATING, ASA groups |
| **Aug 31 phase gate · Wk5** | Second CPP conversion read; rotate any A/B variants (35-page headroom). | — |
| **Wk6 Buddy List Week · Sep 7–13** | **CPP-CIRCLES peaks again** — Circles + mutual context close the brand loop ("meet → talk → add → sort your people"). | IG bio secondary → CIRCLES, X T15 self-reply, C6/CC creative |
| **Wrap · week of Sep 14** | CPP per-ppid conversion into the flight wrap; Q4 recommendation on which pages to keep/kill/scale and whether to index any 2.1 term. | — |

**Gate reminders carried from siblings:** the five 2.1 feature claims are **cleared this session for public metadata**, satisfying `asc-submission.md` B4 / `social-push-plan.md` §5.1 for CPP purposes — but the CPP screenshot activation still waits on the 2.1 **build** being live (you can't screenshot Circles/Knock UI in a store page before the binary shows it). Follow stays excluded (not cleared). Nothing on a CPP names Pro/IAP (asc B1).

---

## 4. Measurement tie-in ($0 added spend)

CPP analytics **fold into the existing first-party + ASC plan** with no new tooling and no added media budget — CPPs are free to create (up to 35), and their screenshots reuse assets the flight already produced (`asc-submission.md` §3). **The 2.1 push adds $0 to the flight budget**; CPPs keep that true.

### 4.1 What CPPs add to the read

- **Per-ppid store funnel (folds into O9).** ASC reports **product-page views, downloads, and conversion rate per CPP.** This is a *cleaner* store-side signal than the default page's blended funnel: because CPPs aren't indexed, their views are almost entirely campaign/bio/paid traffic, so per-ppid conversion is a near-direct read of each feature story's store performance. Add a **CPP block to the Monday scorecard** (`campaign-strategy.md` §9): rows for CPP-PRESENCE / CPP-NOTDATING / CPP-CIRCLES / CPP-KNOCK — views, conversion rate, week-over-week.
- **ASA + CPP = native attribution.** If the optional ASA test runs, its CPP ad variations carry full ASC attribution — the one place in the whole flight where a channel's install effect is *not* triangulation. Treat ASA/CPP conversion as the flight's cleanest paid read.
- **Triangulation improves, honestly.** Keep `utm_content=circles|mutual|seenby|knock` on the parallel `hiitsme.app` funnel links (`social-push-plan.md` §4). Now each feature story has **two independent reads** — the web funnel's `utm_content` pageviews (Vercel) and the matched CPP's ASC conversion — that corroborate each other. Where they agree, confidence rises; where they diverge, we learn which surface the audience prefers.
- **Downstream activation is already wired.** CPP-CIRCLES conversion → signup → **`buddy_circles` / `buddy_circle_members` rows** (the 2.1 activation signal, `social-push-plan.md` §4) is a full first-party funnel, all in ASC + Supabase SQL. That closes the loop from store impression to real in-product behavior without a single tracker.

### 4.2 Attribution honesty (carried verbatim in posture)

CPPs sharpen store-side granularity but do **not** give cross-device install attribution beyond ASC's source buckets. The weekly scorecard states this limitation rather than inventing precision (baseline audit §4). Per-ppid conversion is read as strong directional evidence, corroborated by the web-funnel `utm_content` and signup-timing correlation — never as isolated channel truth.

### 4.3 Phase-gate use (the free A/B lever)

At Aug 17 / Aug 31, use the 31-page headroom to **A/B a hero** at $0 — e.g. CPP-CIRCLES-A (Circles hero) vs CPP-CIRCLES-B ("your people, sorted" hero, if the tagline clears) — split across two link surfaces, compared on ASC conversion. Kill/double 2.1 CPP formats on 2-week data exactly as the channel plans do (the Circles carousel/C7 is the pre-registered favorite to double). The optional **bio-swap test** (§1.1) runs here too: bounded window, ASC-measured, reverted after.

### 4.4 What NOT to measure

- No follower growth on any channel (non-goal #2).
- No CPP "impressions" targets — CPPs aren't indexed; there's no browse/search volume to chase.
- Nothing requiring a per-user tracking mechanism; **Data Used to Track You stays None** (asc §4). CPPs add no SDK, no data type, no manifest change.

---

## 5. Reconciliation + flags for the ASO / founder

- **Page-name reconciliation:** when `cpp-strategy.md` lands, map its pages to mine by function (§0.3) and adopt its ppid slugs/labels; this map keys on function, so no rework — only the four placeholder slugs get swapped for the ASO's real ppids.
- **"Your people, sorted." tagline** needs founder sign-off before it leads any CPP promo/hero (brand brief §6). Safe default is live now (Tier 3 "Find your people before you even DM").
- **CIRCLES/KNOCK screenshot activation is gated on the 2.1 iOS build being approved.** If iOS review runs past Aug 3, publish their promo text, hold their feature screenshots, and route their traffic to `hiitsme.app` until the store page can show real 2.1 UI.
- **Follow excluded from all CPPs** (not cleared this session). Revisit only if/when Follow is both live-render-verified (`social-push-plan.md` §5.2) and register-cleared.
- **"Seen by N" excluded from all CPP screenshots** per the ASO's B3 caution — aggregate count, never read receipts/names; kept to organic captions.
- **Bio-link tension is real and intentional:** Tier-1 bios stay `hiitsme.app` to protect O8; CPPs live on per-creative surfaces + optional measured bio-swap. If the ASO/founder would rather optimize store conversion over web pageviews, the swap test (§1.1, §4.3) is the low-risk way to decide — don't rip out the funnel wholesale mid-flight.

---

*CPP channel map · rides inside OPERATION PORCH LIGHT · H.I.M. v2.1 · Saman Technologies LLC (internal)*
