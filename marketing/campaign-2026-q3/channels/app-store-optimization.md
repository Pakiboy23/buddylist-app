# H.I.M. Q3 2026 — App Store Optimization Channel Plan

**Campaign:** OPERATION PORCH LIGHT (internal name — never in public copy) · Flight Mon Aug 3 – Sun Sep 13, 2026
**Prepared:** 2026-07-15 · **Role:** App Store Optimizer
**Executes:** `campaign-strategy.md` §5.5 (ASO — the conversion surface every channel lands on), §6 phase gates (Aug 3 / Aug 17 / Aug 31), O9 (store funnel)
**Governed by:** `strategy/brand-brief.md` (voice, naming, nostalgia policy), `strategy/claims-register.md` (only APPROVED claims ship — see Claims Used appendix), `strategy/baseline-audit.md` §1–2 (store baseline + keyword analysis), §3.2 (measurement sources)

Character counts below are Unicode character counts (em dash = 1 char), verified 2026-07-15. Re-count in App Store Connect / Play Console at entry time — the console's counter is the arbiter.

---

## 0. What this plan can and cannot touch during the flight

Per baseline audit §1 ("Editability during the flight"):

| Lever | Editable when | Flight status |
|---|---|---|
| iOS promotional text (170 chars) | Anytime, no build, no review of the binary | **The one live lever.** Rotates at each phase gate — see §5 calendar |
| iOS keyword field, app name, subtitle, full description, screenshots | Only with a new build submission | Rides the **July build decision** (strategy §5.5, pre-flight checklist). If no July build, waits for the next natural release — never force a submission for metadata alone |
| Play listing (title / short / long) | n/a — app is **not live** on Play | **Drawer copy only** (DNC #6). Drafted in §2 of this doc, filed, unpublished. Zero public Android mentions this flight |
| Web meta tags (`index.html`) | Anytime via `dist/` redeploy | Out of scope here — owned by web/landing workstream; noted because ASC "Web Referrer" attribution depends on hiitsme.app links staying live |

**Decision tree for the July build — DECIDED 2026-07-15: the build SHIPS (founder sign-off; submit by ~Jul 31, logged in the pre-flight checklist).** Execution follows the first branch; the second remains only as the fallback if the submission slips:

- **Build ships in July** → keyword Option A (§1.3), full-description corrections (§1.4), and the refreshed screenshot set (§4) all ride it; live approximately Aug 3; keyword hypotheses H1–H2 read against the full flight.
- **No July build** → promotional text (§5) is the entire live ASO motion; §1.3–1.4 and §4 are staged for the next natural release; H1–H2 reads shift to whenever the build lands (they are written to survive either timeline); H3 is unaffected (it reads from ASA probes and social correlation, not the keyword field).

---

## 1. iOS listing — iteration proposals vs baseline

Baseline of record: baseline audit §1 (June 2026 live listing, v2.0 build 177).

### 1.1 App name — KEEP (no change this flight)

| | Copy | Chars / 30 |
|---|---|---|
| Baseline (live) | `H.I.M. — Friends, Not Dates` | 27 |
| Proposal | **No change** | — |

Rationale: the name was set in June 2026 and carries the strongest indexed tokens we own (`friends`, `dates`-as-negation). This is the first flight with measured ASC data (O9); changing the heaviest-weighted index surface mid-measurement would destroy the baseline comparison. Name changes also require a build + review and carry 4.3 re-review risk for zero identified upside.

### 1.2 Subtitle — KEEP (no change this flight; one alternate logged for Q4)

| | Copy | Chars / 30 |
|---|---|---|
| Baseline (live) | `Gay friendship, retro style` | 27 |
| Proposal | **No change** | — |
| Q4 candidate (log only) | `A gay buddy list, reborn` (LD §A approved alternate) | 24 |

Rationale: same index-stability argument as §1.1 — one metadata variable changes per build (the keyword field), or reads become uninterpretable. Two notes for the Q4 decision:

- The other approved alternate, `Make gay friends, not matches` (29 chars), is approved *brand language* (brand brief §6 Tier 2) but a poor *indexed metadata* choice: the token `matches` enters exactly the dating-category semantic cluster the June listing deliberately stripped (LD §A keyword note, 4.3 posture). Do not put it in name/subtitle/keywords; keep it for social and landing copy.
- `A gay buddy list, reborn` would index `buddy`, duplicating the keyword field's `buddy` — if it ever ships, reclaim those 6 chars (`buddy,`) for a city term per §3 H3.

### 1.3 Keyword field — REVISE (rides the July build; founder sign-off required)

| | String | Chars / 100 |
|---|---|---|
| Baseline (live) | `gay,friends,friendship,community,chat,rooms,buddy,lgbtq,queer,messaging,im,away,screenname,platonic` | 99 |
| **Option A (proposed)** | `community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,group,penpal,platonic,screenname` | 97 |
| Variant B (Q4 contingency, only if H3 confirms) | `community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,nyc,chicago,atlanta,screenname` | 95 |
| **Variant C (branded-token option — founder sign-off; may ride the July build in place of Option A)** | `community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,group,hiitsme,platonic,screenname` | 98 |

Option A is the baseline audit §2.3 revision, adopted unchanged: drops the three name/subtitle duplicates (`gay`, `friends`, `friendship` — ~23 wasted chars per §2.1) plus `im`/`away`/`messaging`; adds `messenger,social,men,talk,group,penpal`. It is a hygiene-and-coverage revision, not a data-driven one — no keyword-rank data exists (baseline audit §3.3). This flight generates the first read (§3).

Variant B trades `group,penpal,platonic` for `nyc,chicago,atlanta` and is **not** proposed for the July build — it ships in a Q4 build only if hypothesis H3 (§3) produces evidence that city-intent search is real. Do not burn chars on cities before the evidence exists.

**Variant C — brand-collision mitigation (added 2026-07-15, founder sign-off pending).** App Store results for bare "H.I.M."-adjacent queries are crowded by Hims (telehealth) and other HIM-named apps, so a listener who hears the name and searches loosely may never find us. Variant C swaps `penpal` → `hiitsme` (98/100) to guarantee an exact match on the ownable domain token people type after hearing "hi, it's me" / seeing hiitsme.app. Costs the weakest coverage term in Option A; everything else identical. Companion rule shipping regardless of this variant: campaign CTAs never say bare "Search 'H.I.M.'" — always the full "H.I.M. friends not dates" phrase or the hiitsme.app link (see `channels/twitter.md` §3.2). A rename decision, if the flight's O9 branded-search data ever argues for one, belongs to the Q4 wrap memo — not pre-flight.

**Name/subtitle stay as-is (assessed 2026-07-15, founder asked).** "Hi, It's Me" in the App Name or Subtitle was considered and declined for this flight: its tokens (`hi`,`its`,`me`) are stop words with near-zero search weight, while the current fields carry irreplaceable value — "Friends, Not Dates" is the category disambiguator a stranger can't misread next to Hims *and* the exact-match target of the compound search CTA, and the subtitle's `gay`/`friendship`/`retro` are indexed terms the keyword field deliberately omits. The expansion already greets every product-page visitor in the description's first line. **Measurable trigger to revisit:** if the ASA probe runs, add exact-match terms `hi its me app` and `him app` (~$1–2/day) — impression volume there is direct evidence of the loose-branded-search path; real volume → Q4 subtitle test first, name change only after that, both decided at the wrap.

Standing exclusions (all three strings comply): no dating vocabulary (`date/dating/hookup/match/meet/single/nearby/flirt` — 4.3 risk, brand brief §2 rule 3), no competitor names (2.3.10), no AOL/AIM/ICQ marks even in hidden metadata (brand policy + 2.3.7).

### 1.4 Full description — three corrections + one precision edit (ride the July build or next release)

The live description is LD §A. Corrections, in priority order:

1. **(Mandated — baseline audit §1)** `Gay men 17+ looking for friendship…` → `Gay men 18+ looking for friendship…` (claims #23; ASC rating is already 18+ — listing must agree).
2. **(Mandated — baseline audit §1)** `Download a full copy of your data whenever you want.` → `Download a copy of your data anytime.` (claims #19 / DNC #2 — export is capped: 2,000 most recent sent DMs + 2,000 room messages, once per 24h, own-authored only; "full" and "whenever" both overstate).
3. **(New proposal, this plan)** `Delete your account anytime, in two taps, with everything erased.` → `Delete your account anytime, in two taps — your account and your content are deleted.` Rationale: DNC #14 bans deletion absolutism ("everything erased"); server-side security/audit events are retained. The baseline audit flagged two stale lines; this is a third the claims register catches. Founder sign-off requested with the same metadata touch.
4. **(Optional precision edit)** `A content filter screens objectionable language before it's delivered.` → `A content filter screens messages for objectionable language before recipients see them.` Rationale: claims #16 approved phrasing; the filter hides flagged messages from recipients pending review — it does not block delivery, and the sender still sees their own text (register nuance notes).

Everything else in the live description stays — it is the copy App Review approved and every line traces to APPROVED claims.

### 1.5 Promotional text — REVISE on a rotating calendar (live lever, no build needed)

Baseline (live, LD §A, within the 170 limit): `A friendship-first space for gay men — screennames, away messages, buddy lists, and chat rooms. No swiping. No hookups. Just real conversations with people who get it.`

Proposed rotation in §5. The baseline text is also the standing fallback: if any rotation misses founder sign-off, the live text stays — it is fully claims-compliant.

---

## 2. Google Play — drawer copy (DNC #6: filed, not published)

**Posture:** iOS is live; Play is not. Android release automation merged July 2026 but no repo artifact confirms a production rollout (baseline audit §1). This section exists so the listing is ready **the day the founder submits** — it satisfies strategy §5.5 ("draft the missing short description and full description… drawer copy; nothing public") and non-goal #1. Nothing here ships publicly during this flight.

**Pre-publish verification gate (blocking, checked at submission time, not now):**
- Confirm Play production rollout is actually live before any public Android word anywhere (DNC #6).
- Verify FCM push works on the production Android build before keeping the notification-preview line (claims #11 marks FCM as "wired in code," not verified live; claim #12's preview modes ride the push pipeline). If unverified, cut that bullet — the listing stands without it.
- Verify biometric app lock behaves on Android hardware before keeping the app-lock line (claims #13 covers fingerprint via the Capacitor plugin; native-only).
- Complete the content-rating questionnaire per `ANDROID_PLAY_RELEASE.md` §7 (target 18+ audience, consistent with claims #23).

### 2.1 Title (30 char max)

| | Copy | Chars / 30 |
|---|---|---|
| Baseline | None exists (`ANDROID_PLAY_RELEASE.md` §7 planned bare `H.I.M.`) | — |
| **Proposal** | `H.I.M. — Friends, Not Dates` | 27 |

Rationale: Play has no keyword field, so title text is the heaviest ranking surface — bare `H.I.M.` (6 chars) wastes 24 of them. Matching the iOS name also keeps cross-store brand identity exact (brand brief §4).

### 2.2 Short description (80 char max) — did not exist anywhere; drafted here

| | Copy | Chars / 80 |
|---|---|---|
| **Primary** | `A friendship app for gay men — chat rooms, buddy lists, away messages. 18+.` | 75 |
| Alternate 1 | `Gay friendship, retro style — chat rooms, buddy lists, away messages. 18+.` | 74 |
| Alternate 2 | `Friendship-first social app for gay men. Chat rooms, buddy lists, away messages.` | 80 |

Primary leads with the positioning sentence (LD §A first-line register), carries the highest-value Play keyword tokens (`friendship`, `gay`, `chat rooms`, `buddy`), and states 18+ (claims #23). Alternate 2 sits at exactly 80/80 — use only if the console counter agrees.

### 2.3 Full description (4,000 char max) — drafted from the corrected iOS listing

**2,733 chars.** Seeded from LD §A with all four §1.4 corrections applied, DM feature set expanded (Play's description doubles as its keyword surface — baseline audit §2.4), Face ID/Touch ID re-scoped to PIN + fingerprint for Android (claims #13 / DNC #15), and no push claim beyond the gated notification-preview bullet.

```
H.I.M. ("Hi, It's Me") is a friendship app for gay men — not a dating app, and not a hookup app.

It's built on the things that made the early internet feel like home: a screenname that's yours, an away message that says what you're up to, a buddy list of people you actually know, and chat rooms where conversations happen out loud. No swiping. No match queue. No "people nearby." No photo-first browsing. Just talking — the way friendships actually start.

WHY H.I.M. IS DIFFERENT
Most apps for gay men are built to pair you off. H.I.M. is built to help you make friends. There is no swipe mechanic, no proximity radar, and no algorithm pushing you toward romance. You meet people in chat rooms, get to know them in conversation, and add them to your buddy list when there's a real connection.

CHAT ROOMS
Drop into regional rooms (New York City, Los Angeles, Chicago, Atlanta, and Everywhere Else) or vibe rooms like Late Night and Sunday Reset. You choose your room — nothing is based on your location. Jump into the conversation and meet people who share your corner of the world or your time of day. When the conversation is good, invite your buddies into the room.

BUDDY LIST + AWAY MESSAGES
Build a buddy list of people you've actually met in the rooms. Set an away message so your buddies know what you're up to — "grabbing coffee," "doomscrolling," "finally cleaning my apartment." It's status as self-expression, the way it used to be.

DIRECT MESSAGES
Private one-to-one conversations. Send text, photos, and voice notes. React with emoji, edit or unsend, and search your history. Turn on disappearing messages (5 minutes, 1 hour, 24 hours, or 7 days) when you want a conversation to stay light. Read receipts come with an off switch. Messages queue offline and send when you're back online.

BUILT FOR SAFETY AND PRIVACY
- Block and Report on every profile, every message, every room. Every report is reviewed.
- A content filter screens messages for objectionable language before recipients see them.
- Notification previews default to sender-only, so message text never lands on your lock screen unless you choose.
- App lock with a PIN and fingerprint unlock keeps your conversations yours.
- Delete your account anytime, right in the app — your account and your content are deleted.
- Download a copy of your data anytime.

WHO IT'S FOR
Gay men 18+ looking for friendship and community — new-in-town, starting over, between friend groups, or just tired of every app being about dating. If you've ever wished there were a place to just talk, this is it.

H.I.M. is made by Saman Technologies LLC.

Privacy Policy: https://hiitsme.app/privacy
Terms of Service: https://hiitsme.app/terms
Questions? support@hiitsme.app
```

Line-by-line claims trace: opening + absence enumeration (#22, DNC #13 inverse-safe), rooms (#1), room choice not location (#22), buddy invite in-app only (#17, DNC #7 — no link language), buddy list + away messages (#3, #4), DMs text/photos/voice notes (#5, DM-scoped per DNC #5), reactions/edit/search (#6), disappearing timers verbatim (#8), read-receipt off switch (#9), offline outbox honest phrasing (#10, DNC #12), block/report + "every report is reviewed" (#15, DNC #4), content filter approved phrasing (#16, DNC #3), notification previews (#12 — gated), app lock re-scoped (#13, DNC #15), deletion without absolutism (#18, DNC #14), data export without "full" (#19, DNC #2), 18+ (#23), legal links (#20).

---

## 3. Three keyword hypotheses — and how to read them at seed-stage volumes

**Ground rules for reading anything (seed-stage honesty).** There is no keyword-rank tooling and no repo record of ranks (baseline audit §3.3); ASC's search-terms detail won't populate meaningfully at our volumes. The readable signals are ASC's aggregate buckets (§3.2-A): impressions, product page views, conversion rate, and downloads **by source type** (App Store Search / Browse / App Referrer / Web Referrer). At an expected baseline of tens-to-low-hundreds of search impressions per week:

- **Judge on 2-week windows, never single weeks** (mirrors the strategy §5.1 volatility clause). A single-week swing at these volumes is noise.
- **Everything compares to the Jul 27 snapshot** (`reporting/baseline-snapshot-2026-07-27.md`, strategy §3 anchoring rule). No snapshot, no read — the snapshot is blocking.
- **Direction over magnitude.** A sustained 2-window rise is signal; a percentage is decoration at n<100/week. Log absolute numbers in the weekly scorecard and resist computing rates on tiny denominators.
- **Confound control is the source-type split.** Social pushes (TikTok Room Tour week, the Reddit founder post) move Browse/App Referrer/Web Referrer; only keyword/metadata changes plausibly move *Search* impressions. Log the content calendar next to every read (strategy §3 triangulation rule).
- If the July build doesn't ship, H1/H2 clocks start when the build lands; report "not yet testable" in the scorecard rather than a fake read.

### H1 — Category-noun coverage lifts Search impressions

- **Change:** Option A adds `messenger,social,men,talk,group` (generic category nouns; `social`/`men` were in the April field and dropped without stated reason — baseline audit §2.2).
- **Prediction:** App Store Search impressions rise vs the Jul 27 snapshot within 2–4 weeks of the build going live, because the field finally covers phrase combos like "gay social," "gay messenger," "gay group chat."
- **Read:** ASC impressions, source type = App Store Search, weekly log (O9), judged on 2-week windows. **Confirm** = two consecutive windows above the snapshot trend with no simultaneous press/social spike in the Search bucket's timeframe. **Refute** = flat Search impressions across 4+ weeks post-build. If the strategy §8 ASA test runs, ASA impression counts on "gay friendship app" / "friendship app" exact-match are a free search-volume proxy to sanity-check against.

### H2 — Friendship-intent long-tail converts better than it impresses

- **Change kept in Option A:** `penpal,platonic,screenname,talk` retained despite low volume (baseline audit §2.2 calls them zero-competition, intent-perfect).
- **Prediction:** Search-source **conversion rate** (downloads ÷ impressions from Search) holds or improves vs snapshot even as H1's generic terms add impressions — i.e., the long-tail traffic that does arrive is high-intent and downloads. The usual failure mode of adding generic nouns is conversion dilution; the long-tail terms are the hedge.
- **Read:** ASC conversion rate by source type = Search, **full-flight aggregate vs snapshot** — this one is explicitly too small for weekly reads; take one read at the Aug 31 gate and one in the wrap. **Confirm** = Search conversion ≥ snapshot while Search impressions grew. **Refute** = impressions up, conversion down two windows running → the generic nouns are pulling wrong-intent traffic; revisit the string in Q4 (drop `group` or `social` first, they're the most category-diluting).

### H3 — City-intent search is real demand the field doesn't cover yet

- **Change:** none this flight — deliberately. Cities are absent from Option A; Variant B (§1.3) is the payoff if this confirms.
- **Prediction:** "gay chat nyc" / "gay friends chicago"-shaped demand exists and H.I.M.'s regional rooms (claims #1) are the exact landing surface for it.
- **Read (two cheap probes, no keyword chars spent):**
  1. **ASA probe (optional, needs campaign-lead sign-off):** strategy §8 authorizes an exact-match ASA test on three terms ("gay friendship app," "gay chat rooms," "friendship app"). Extending the probe set with 2–3 city terms ("gay chat nyc," "gay friends chicago") is a scope addition to §8 — flag it at the Aug 17 gate; ~$2–3/day of the existing budget. ASA impression counts on those terms are direct search-volume evidence regardless of whether anyone taps. **Confirm** = a few hundred impressions per term over 2 weeks.
  2. **Organic correlation (free, always on):** Room Tour week (Aug 17–23) posts city content daily; watch ASC Web Referrer + App Referrer downloads and Vercel UTM pageviews on city-content days vs non-city days (§3.2-A, §3.2-C). Directional only — say so in the scorecard.
- **Payoff:** confirm → Variant B ships in the Q4 build (cities replace `group,penpal,platonic`). Refute or no-read → keyword field stays Option A; cities remain a social-content play only.

---

## 4. Screenshot caption copy set

For the next build's screenshot refresh (tooling exists: `scripts/take-app-store-screenshots.mjs`, `scripts/generate-app-store-previews.mjs`). iPhone portrait only — no iPad mockups (claims #21). Order = narrative order of the brand loop (brand brief §1): rooms → conversation → buddy list.

**Production rules (binding):** every screenshot is real UI — never mock up member counts or activity that doesn't exist (brand brief §3, DNC #10). Any frame showing another member's screenname or message requires that member's explicit, logged consent — source room moments from consenting S0 seed members, crop/blur everyone else (strategy §5.1 member-consent guardrail). Never show DM content from real conversations; the DM/Buzz frames are staged with one consenting seed member.

| # | Screen | Caption | Status |
|---|---|---|---|
| 1 | Rooms list (7 rooms visible) | "Seven rooms. Your city or your hour." | NEW — founder sign-off needed (built from claims #1 + Tier 1 vocabulary) |
| 2 | Chat room (Late Night, consented capture) | "Find your people before you even DM." | APPROVED (GTM §3, Tier 3) |
| 3 | Screenname setup | "Pick a name that's actually you." | APPROVED (GTM §3, Tier 3) |
| 4 | Away-message composer | "Your status says more than you think." | APPROVED (GTM §3, Tier 3) |
| 5 | Buddy list | "Your people, right there." | APPROVED (GTM §3, Tier 3) |
| 6 | DM with voice note (staged, consented) | "Say it out loud — voice notes in DMs." | NEW — founder sign-off needed (claims #5, DM-scoped per DNC #5) |
| 7 | Buzz moment (staged, consented) | "Buzz a buddy." | Register-approved phrasing (claims #7 phrasing guidance) — confirm as caption |
| 8 | Notification-preview settings | "Previews stay sender-only until you say otherwise." | NEW — founder sign-off needed (claims #12) |
| 9 | App lock screen | "Face ID / Touch ID app lock keeps your conversations yours." | APPROVED language (LD §A live description line) |
| 10 | Profile sheet | "First impression isn't your face. It's your vibe." | APPROVED (GTM §3, Tier 3) |

**Fallback if sign-off on the NEW lines doesn't land:** ship the five approved GTM §3 captions on frames 2–5 + 10 and hold the set at five screenshots — approved-only, still a full story. New lines follow brand brief §6 (new taglines need founder sign-off) and are built exclusively from Tier 1–3 vocabulary and register phrasing guidance.

---

## 5. Promotional-text calendar — synced to campaign weeks

The one always-editable iOS surface (170 chars). Rotations land on the strategy §6 phase gates. Each version needs founder sign-off before its gate date; the fallback for any missed sign-off is the current live text (claims-compliant, stays up).

| Gate | Live dates | Campaign weeks served | Copy | Chars / 170 | Claims |
|---|---|---|---|---|---|
| **v1 — Aug 3** | Aug 3–16 | Wk 1 "Sign-On Week" + Wk 2 "Away Message Week" | `Sign on, pick a screenname, and drop into 7 rooms — New York City to Everywhere Else, Late Night to Sunday Reset. No swiping. No radar. No grid. Friendship first.` | 162 | #1, #2, #22; Tier 1 tagline |
| **v2 — Aug 17** | Aug 17–30 | Wk 3 "Room Tour Week" + Wk 4 "New City, No Crew" (relocation register) | `Just moved? Say hi in the New York City, Los Angeles, Chicago, or Atlanta rooms — or Everywhere Else. You choose your room; no location radar. Friendship first.` | 160 | #1, #22; S1 segment register |
| **v3 — Aug 31** | Aug 31–Sep 13+ | Wk 5 "Night Owls & Sunday Reset" + Wk 6 "Buddy List Week" (rituals register) | `Up at 1am? Late Night is up too. Planning your week from the sofa? That's Sunday Reset. Set an away message, buzz a buddy, and stay a while. Friendship first.` | 158 | #1, #3, #7; S4 segment register |
| Post-flight | Sep 14 → | Until Q4 plan | Revert to the LD §A baseline text or keep v3 — wrap-report decision | — | — |

Notes: v2 deliberately avoids "new city, no crew" verbatim in public copy (it's an internal theme name; "Just moved?" is the approved audience register — GTM §2 "Gay men who just moved somewhere new"). No version uses "lonely" (strategy §1.1 two-track rule), user counts (DNC #10), or "The light's on." (signed off 2026-07-15 after these versions were locked — they ship as written; the line is available for post-flight rotations). Entry task each gate day: paste into ASC → verify the console char counter → save; ~5 minutes, belongs to the Monday scorecard block for weeks 3 and 5, and to the Aug 3 launch checklist for v1.

---

## 6. Review-response templates

Solo founder replies, in his own name — that's an asset, not a gap. Standing rules for **every** reply:

- **Privacy first, always:** never reference the reviewer's account, activity, rooms, or anything not in their own public review text. A store reply that confirms someone's membership details is outing-adjacent (brand brief §2 rule 6). Move all account-specific matters to support@hiitsme.app.
- **No SLA, no "team," no "24/7," ever** (DNC #3, #4). The only moderation sentence permitted: "Every report is reviewed."
- No roadmap dates or feature promises (strategy non-goal #12). No asking for rating changes (Apple frowns; it also isn't us).
- Warm, specific, short. Sign "— Haaris, founder" (founder is publicly on the record: GTM §4, brand brief §4).

**Template 1 — Positive review**

> Thank you — this is exactly what H.I.M. is built for. If a room's ever quiet when you drop in, leave a message anyway; people check in throughout the day. And if you ever have ideas, support@hiitsme.app comes straight to me. — Haaris, founder

(Registers used: LD §E.7 quiet-room reframe. Adapt the first clause to whatever they praised; never paste verbatim across many reviews — Apple surfaces duplicate-looking dev replies.)

**Template 2 — Bug report**

> Sorry this bit you — that's not the experience I want anyone to have. I'm the founder and the developer, and a fix moves fastest when I can reproduce it: if you're up for it, email support@hiitsme.app with your iPhone model and what you tapped right before it happened. Thank you for flagging it. — Haaris, founder

(When the fix ships, update the reply — ASC allows editing — with one line: "Update: fixed in version X.Y. Thank you again for the report." Never promise the fix date in advance.)

**Template 3 — Feature request**

> Thank you for this — requests like yours are how the roadmap gets shaped. I won't promise a date (one-person company, honest roadmap), but it's logged and it matters that you took the time. If you want to talk it through: support@hiitsme.app. — Haaris, founder

(If the request is something deliberately absent — swiping, who's-nearby, a grid — decline warmly and own the position: "That one's a deliberate no: H.I.M. doesn't do location radar or photo-first browsing, and that's a promise to the people here, not a missing feature." Claims #22 as a positive.)

**Template 4 — Hostile review, two branches**

*Branch A — angry but substantive (bad experience, harsh words):* respond once, no defensiveness, take it to support.

> I hear you, and I'm sorry H.I.M. missed for you. If something specific broke or felt off, I'd genuinely like to know — support@hiitsme.app reaches me directly, and every report there gets read. — Haaris, founder

*Branch B — bigoted, harassing, or bad-faith (attacks the community, not the product):* **default is no reply.** Report the review via ASC if it violates Apple's review guidelines. If a reply is warranted because the review makes materially false safety claims that other readers might believe, reply once, factually, and never again:

> H.I.M. is a friendship-first app for gay men, 18+. Block and Report are on every profile, every message, and every room, and every report is reviewed. — Haaris, founder

(Never argue, never match tone, never engage a thread. One reply maximum, then done — the reply is for future readers, not the reviewer.)

---

## 7. KPIs — per-lever, tied to baseline-audit measurement sources

All comparisons anchor to the Jul 27 baseline snapshot (strategy §3 anchoring rule). Attribution honesty caveat applies verbatim: no install attribution exists; source-type buckets and referrer domains are the ceiling (baseline audit §4 gap 1).

| KPI | Target | Measurement source (baseline audit) | Cadence |
|---|---|---|---|
| App Store **Search** impressions | Up vs Jul 27 snapshot — no absolute target, first flight with data (O9) | ASC impressions by source type (§3.2-A) | Weekly log; 2-week window reads |
| Product-page conversion rate | Directionally ≥ snapshot; flag any 2-window decline (O9, H2) | ASC conversion rate by source type (§3.2-A) | Weekly log; judged at Aug 31 gate + wrap |
| First-time downloads | Contribute to O1 base case (100–165 flight total; stretch 250) | ASC total downloads, first-time vs redownload (§3.2-A) | Weekly |
| Web Referrer store traffic | hiitsme.app visible among top referring domains from week 2 on (triangulation for social channels' store hops) | ASC source type = Web Referrer + referrer domains (§3.2-A) | Weekly |
| Promotional-text rotations | 3/3 shipped on gate dates (Aug 3 / Aug 17 / Aug 31) | Manual — §5 calendar, logged in weekly scorecard | Per gate |
| Keyword hypotheses | H1–H3 verdicts (confirm/refute/not-testable) logged in `reporting/flight-wrap-2026-09.md` | ASC §3.2-A + ASA console if the §8 test runs; Vercel UTM for H3 organic read (§3.2-C) | Aug 31 gate + wrap |
| Review responses | 100% of new App Store reviews answered within the weekly scorecard cycle; zero replies violating §6 rules | Manual tracking sheet (same pattern as O10 press tracking — no tooling, that's fine) | Weekly (Monday block) |
| Play drawer copy | Filed pre-flight (this doc, §2) + **zero** public Android mentions all flight (DNC #6 audit — a compliance KPI, target is 0 violations) | Manual check of all published campaign copy | Per gate |
| ASC category confirmation | Baseline audit §1 open item: confirm live category (Social Networking expected) and log it in `strategy/baseline-audit.md` | ASC (§3.2-A) | Once, pre-flight |

Escalation rule: if Search impressions or conversion crater (>2 windows down with no explanatory event), do **not** thrash metadata mid-flight — promotional text stays on calendar, and the keyword post-mortem waits for the wrap. One variable at a time is the whole point of this flight's measurement design.

---

## 8. Pre-flight checklist (ASO items, week of Jul 27)

- [ ] Jul 27 baseline snapshot captures ASC: impressions, PPV, conversion, downloads — all split by source type (blocking for every KPI above; strategy §3)
- [ ] Founder decision logged: July build yes/no (§0 decision tree)
- [ ] If yes: keyword Option A (§1.3), description corrections 1–3 (+optional 4) (§1.4), screenshot set (§4) staged in ASC on the build
- [ ] Founder sign-off: promotional text v1/v2/v3 (§5); fallback confirmed if any miss
- [ ] Founder sign-off: NEW screenshot captions (§4) or five-caption fallback confirmed
- [ ] Play drawer copy (§2) reviewed by founder, filed, unpublished — with the §2 pre-publish verification gate attached to the file
- [ ] ASC category read and logged into baseline audit §1 (open item)
- [ ] Review-response templates (§6) accepted by founder; review-tracking row added to the weekly scorecard sheet
- [ ] H3 ASA city-probe scope addition flagged for the Aug 17 gate decision (§3)

---

## Claims used (appendix)

Every product claim this document relies on, by claims-register number:

| # | Claim as used here | Where in this doc |
|---|---|---|
| 1 | 7 chat rooms — New York City, Los Angeles, Chicago, Atlanta, Everywhere Else, Late Night, Sunday Reset | §2.3, §4 (frames 1–2), §5 (v1–v3), §3 H3 |
| 2 | Screenname-first identity — no real name, not photo-first | §2.3, §4 (frame 3), §5 v1 |
| 3 | Away messages + status | §2.3, §4 (frame 4), §5 v3 |
| 4 | Buddy list — add people you've actually met (not claimed as buddy-only DMs) | §2.3, §4 (frame 5) |
| 5 | DMs with text, photos, voice notes (DM-scoped) | §2.3, §4 (frame 6) |
| 6 | Reactions, edit/unsend, inline search | §2.3 (Direct Messages block) |
| 7 | Buzz a buddy (DM-only) | §4 (frame 7), §5 v3 |
| 8 | Disappearing messages in DMs — 5m / 1h / 24h / 7d verbatim timers | §2.3 |
| 9 | Read receipts in DMs with an off switch | §2.3 |
| 10 | Offline outbox — "messages queue offline and send when you're back online" (never "works offline") | §2.3 |
| 12 | Notification previews default to sender-only | §2.3 (gated for Android), §4 (frame 8) |
| 13 | App lock — Face ID / Touch ID (iOS copy), PIN + fingerprint (Android drawer copy), native-only | §2.3, §4 (frame 9) |
| 15 | Block + Report on every surface; "every report is reviewed" | §2.3, §6 (templates 1–4) |
| 16 | Content filter screens messages for objectionable language before recipients see them | §1.4 (correction 4), §2.3 |
| 17 | Invite your buddies into a room — in-app action, no links | §2.3 |
| 18 | Delete your account anytime, in the app — account and content deleted (no absolutism) | §1.4 (correction 3), §2.3 |
| 19 | Download a copy of your data anytime (never "full copy") | §1.4 (correction 2), §2.3 |
| 20 | Legal + support pages live (hiitsme.app/privacy, /terms, support@hiitsme.app) | §2.3, §6 |
| 21 | Available on iPhone (App Store) and the web; iPhone portrait only | §0, §4 production rules |
| 22 | No swiping, no proximity/location radar, no photo-first grid (absence claims) | §1.4, §2.3, §5 v1–v2, §6 (template 3 decline) |
| 23 | 18+ | §1.4 (correction 1), §2.2, §2.3 |

DNC rules actively enforced in this doc: #2 (no "full copy"), #3/#4 (no AI/team/SLA moderation language), #5 (DM-only features scoped), #6 (Android drawer-only), #7 (no invite-link copy), #9 (no AOL/AIM/ICQ marks, including hidden metadata), #10 (no user counts), #12 (no "works offline"), #13 (no dating vocabulary in any metadata surface), #14 (no deletion absolutism), #15 (no biometric claims for web).

---

*App Store Optimization channel plan · OPERATION PORCH LIGHT · H.I.M. Q3 2026 · Saman Technologies LLC (internal)*
