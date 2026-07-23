# H.I.M. v2.1 — Focused Social Push

**Release:** v2.1 · **Push window:** launch week gated on 2.1 going live (target on/before the OPERATION PORCH LIGHT flight start, Mon Aug 3 2026), then reinforced through the flight to Sep 13
**Prepared:** 2026-07-23 · **Role:** Social Media Strategist (cross-channel lead for the 2.1 push)
**Status:** Strategy of record for the 2.1 social push. Extends — does not replace — `campaign-2026-q3/strategy/campaign-strategy.md` (OPERATION PORCH LIGHT). All copy still clears `strategy/brand-brief.md` (voice/naming) and `strategy/claims-register.md` (claims) before publishing. **Blocking dependency in §5 — read it first.**

**Companions (this doc builds on, does not repeat):**

| File | Relationship |
|---|---|
| `campaign-2026-q3/strategy/campaign-strategy.md` | The Aug 3–Sep 13 flight this push rides inside. Objectives O1–O12, §7 dead-room mitigation, budget cap, capacity math. |
| `campaign-2026-q3/strategy/brand-brief.md` | Voice, naming, nostalgia policy, tagline system. Governs all copy. |
| `campaign-2026-q3/strategy/claims-register.md` | The only source of allowed product claims. **Verified 2026-07-15 — predates every 2.1 feature (see §5.1).** |
| `campaign-2026-q3/channels/{tiktok,instagram,twitter,reddit}.md` | Per-channel specialists own concrete posts. This doc owns cross-channel strategy + the launch calendar; it hands the 2.1 beats to those plans, it does not rewrite them. |

---

## 0a. Integrator's correction — Knock IS real (supersedes the §0 "Knock" rows)

**Added 2026-07-23 by the release integrator, verified against production DB + all release branches.** This corrects the single most-important finding below.

**Knock ships and is live.** The §0 table and §0's "single most important finding" state Knock does not exist; that is wrong. Knock is implemented — it just lives in `src/app/hi-its-me/page.tsx` (`handleSendKnockToBuddy`) and `src/components/ChatWindow.tsx`, **not** in `BuddyProfileSheet.tsx` or a `knock*` file, which is why a file/profile-sheet grep missed it. Verified ground truth:

- **62 code references to Knock on `origin/main`** (the branch this plan was written against), 66 on the release branch `claude/release-hardening-2-0-2` (PR #88).
- Migrations `20260722114338_add_buzz_and_knock_message_types.sql` and `20260722150347_knock_cooldown_advisory_lock.sql` are on both branches **and applied to prod** — `enforce_knock_rules()` is a live function in the production database.
- Behavior: one-tap "👋 Knock" to a **buddy only** (throws "Knocks are only available for buddies."), **10-minute cooldown**, writes a fixed-payload `messages` row so it inherits the content filter + block guard + report sheet. It is wired into the native bridge (`sendKnock`).

**So both gestures are real and distinct — market both, honestly:**

| Gesture | What it is | Marketing status |
|---|---|---|
| **Knock** | Buddies-only "👋 wants to talk" ping, 10-min cooldown. Screen-recordable in the native build. | **Green to build content** (needs claims-register entry per §5.1, like every 2.1 feature). |
| **Follow** (`user_connections`) | One-way, no-obligation connection that gates presence/away-message visibility. This agent is the only one who found it — genuinely new intel. | **Verify live-render status first** (§5.2), as this plan correctly cautions. |

Everything else in this plan stands. Where copy below says "there is no Knock button to screen-record," read it as superseded: there is — use the real one. The Follow narrative remains valid as a *second*, complementary low-pressure gesture. Neither may be framed as an AIM/AOL "nudge™" (brand brief §7).

---

## 0. Repo verification — what 2.1 actually shipped (read before anything)

The founder's feature list was checked line-by-line against the code at `/home/user/buddylist-app`. **The push is built only from what verifiably ships.** This is the difference between a launch and a rejection.

| Founder's list | Ships? | Evidence | Marketing status |
|---|---|---|---|
| **Buddy Circles** | **YES** | `src/lib/buddyCircles.ts`, `src/components/BuddyCircles.tsx`, migration `20260722130125` | **Marquee.** Private, owner-only buddy-list organizer. |
| **Mutual context on profiles** | **YES** | `src/lib/mutualContext.ts`, `src/hooks/useMutualContext.ts`, `MutualContextCard` in `BuddyProfileSheet.tsx` / `GroupChatWindow.tsx`; RPC `get_mutual_context` | **Support feature.** Shared rooms + mutual buddies. |
| **"Seen by N" room receipts** | **YES** | `src/lib/roomReadReceipts.ts` (`countSeenByOthers`, `formatSeenByLabel`), wired into `GroupChatWindow.tsx` | **Support feature.** Aggregate count, no names — NOT per-user read receipts. |
| **Buzz** | **YES (pre-existing)** | `src/components/ChatWindow.tsx`, claims register #7 | Already approved; DM-only. Reinforce, don't "launch." |
| **Presence-first UI** | **PARTIAL** | Presence-gated profile visibility + circle presence toggles (`useConnectionStatus.ts`, `buddyCircles.ts`) | Fold into the presence/privacy story. Not a standalone marquee. |
| **Knock** ("gentle low-pressure hello") | **NO — DOES NOT EXIST** | No `knock*` file, no Knock button in `BuddyProfileSheet.tsx`, no `knock` preview type. The nearest shipped gesture is **Follow** (see below). | **DO NOT MARKET. DO NOT BUILD KNOCK CONTENT.** There is no Knock button to screen-record. |
| **Follow / connection system** (the real "low-pressure hello") | **IN CODE, LIVE-STATUS UNVERIFIED** | `user_connections` table, RPCs `get_connection_status` / `can_add_from_room`, `useConnectionStatus.ts`; `BuddyProfileSheet.tsx` only activates it when a `currentUserId` prop is passed | **Verify it's enabled in the shipped build before any Follow content** (§5.2). Treat as a stretch beat, not a launch pillar. |

**The single most important finding:** "Knock" is a name for a feature that isn't in the app. The gentle, no-obligation "hello" the founder wants to tell a story about **did ship — as `Follow`** (one-way, gates whether you can see someone's away message/status, no reciprocation required). We tell that story honestly using the real button, once we confirm it's live. We never draw a "Knock" button that a screen recording can't produce.

---

## 1. The big idea for the 2.1 push

### "Your people, sorted."

v2.0's whole brand loop is: **meet in a room → talk → add to your buddy list** (brand brief §1). v2.1 is the next sentence in that story — **what you do with the people once you've got them.** The buddy list stops being a flat list and becomes *yours*: sorted into private circles only you can see, carrying the quiet context you already share, in rooms that now tell you your message landed. And it does all of that without adding a single mechanic that swipes, ranks, locates, or turns a person into inventory (claims #22 — still the backbone).

That's the push in one line: **the buddy list grows up.** You built it in v2.0; in v2.1 you make it yours.

**Feature → message map (all on-voice, all traced to shipped code; every line still needs the §5.1 register update before it's public):**

| Feature | The line | What it honestly means |
|---|---|---|
| **Buddy Circles** (marquee) | **"Your people, sorted."** | Sort your buddy list into private circles. Only you see them. Mute a circle's alerts; hide a circle's presence from your own list. |
| **Mutual context** | **"Find your people before you even DM."** (approved Tier 3 line — it *literally* describes this feature) | A profile now shows the rooms you share and the buddies you have in common. |
| **"Seen by N" receipts** | **"You'll know it landed."** | A room message shows a quiet "Seen by N" — an honest count of who had the room open after you posted. No names. |
| **Follow** (verify first) | **"Say hi without the pressure."** | Follow someone to see their status and away message. One-way, no obligation, nothing owed. |
| **Buzz** (reinforce) | **"Nudge a buddy."** | The DM buzz is still here. Playful, real, already yours. |

**Proposed campaign line — "Your people, sorted."** is a *new* line, so per brand brief §6 it needs founder sign-off before public use (the same path "The light's on." took). It's built from Tier 1 vocabulary ("Your screenname, your status, your people.") and passes the §2 voice rules. **Until signed off, the push runs on the approved line "Find your people before you even DM." (Tier 3) plus the Tier 1 system as-is** — nothing below depends on the new line clearing.

**Why this idea is the right one for a solo-founder, dead-room-wary launch:** three of the four real 2.1 features (Circles, mutual context, Follow) are **buddy-side, not room-side.** They give a new arrival something rewarding to do even when the rooms are quiet — the exact opposite of the flight's #1 risk (campaign-strategy §7). Buddy Circles in particular rewards a user with as few as three buddies. That makes 2.1 a *retention* story as much as an acquisition one, and it's why the marquee is Circles, not the room feature.

---

## 2. Channel architecture for the push

Roles inherit the flight's channel weighting (campaign-strategy §5) and each channel's existing playbook. The 2.1 beats are handed to those plans as content substance — **not as net-new posting volume.** Everything funnels to `hiitsme.app` (UTM-tagged) and then into a **specific, warm room** (§4 dead-room rule).

### TikTok — the feature-demo engine
- **Role for 2.1:** show the real new UI doing a real thing. One added hero concept — **"C7: Your people, sorted"** — a screen-recording of actually creating a circle and filing buddies into it, handed to `channels/tiktok.md` to slot into its existing 2–3/wk cadence (it becomes a Week-1 core slot; see §3). Mutual context and "Seen by N" ride as recuts, not new shoots.
- **Hard rule inherited from `tiktok.md` §1:** real UI only. Every 2.1 demo screen-records a **shipped button.** This is why Knock produces zero content and Follow is gated on §5.2 verification.
- **CTA:** into the warmest regional or vibe room per the weekly O5 aliveness pull — never a cold one.

### Instagram — the send-to-the-group-chat engine
- **Role for 2.1:** the forwardable explainer. A **Buddy Circles carousel** ("sort your people — only you see them") built to be screenshotted and sent, plus stories interaction ("how do you sort your buddies? night owls / gym / the group chat / exes-turned-friends"). Reels are repurposed from the TikTok C7 cut (zero extra production, per `instagram.md` §4).
- **Currency stays sends + saves**, not followers (non-goal #2).

### X — the build-in-public launch home
- **Role for 2.1:** this is where the 2.1 *story* lives. The founder posts a ship-log thread — "H.I.M. 2.1 is live: here's what I added and why" — in his own voice (`channels/twitter.md` register). Highest-fit, near-zero-cost surface for a solo-founder launch. Links in bio/replies only. Coordinate voice + timing with the Twitter Engager per that playbook; this doc sets the beat, that plan writes the posts.
- **Spend:** the already-authorized X Premium (~$8/mo) covers it. **The 2.1 push adds $0 to the flight budget.**

### Reddit — NOT a launch-announcement channel
- **Role for 2.1:** none, directly. The 90/10 disclosed-founder posture (`reddit.md`) means a "we shipped 2.1!" post reads as spam and burns credibility. 2.1 features surface **only where they genuinely answer a question** ("is there a way to organize your contacts / know if anyone saw your message in a group?"). No launch post. No exceptions.

### Owned surfaces — the actual launch mechanism
- **Waitlist / early-tester group (campaign-strategy §5.7):** the Thursday drop carries first-look at Circles + mutual context and the explicit "try it, tell me what breaks, forward one asset" ask. This is where the launch really happens for a seed-stage app.
- **Seed community (S0):** ambassador forward-ask on the Circles carousel; seed members trying Circles on `hiitsme.app` and buddy-filing each other generates the first real `buddy_circle_members` rows — which are also our activation signal (§4).

### How it slots into / front-runs the flight
- **Web features are live the moment the web build deploys**; iOS features are live when the 2.1 App Store build is approved. So the launch week can demo everything on `hiitsme.app` even if the iOS build is still in review — claims-safe under #21 ("App Store and at hiitsme.app").
- The push **co-times with flight Week 1 (Sign-On Week, Aug 3–9)** rather than opening a competing second launch. Sign-On Week becomes "sign on — and here's what's new." Then each 2.1 feature **recurs at its natural flight theme-week** (§3): mutual context and Circles peak again at Week 6 (Buddy List Week — "Find your people before you even DM" was always that week's Tier 3 line); "Seen by N" recurs at Week 3 (Room Tour) and every Sunday Reset.

---

## 3. Launch calendar

Designed for a solo founder inside the flight's existing ~12–18 hr/wk budget (campaign-strategy §9). Net-new work is one asset — the C7 Buddy Circles screen-record — absorbed by the pre-flight batching session. Everything else is a re-map of content the flight already commissioned. **$0 added spend.**

**Anchor:** "Launch Day" = the day 2.1 is confirmed live for users (web deploy done; iOS build status logged). Target Launch Day on/before **Mon Aug 3** to align with the flight. If the iOS build is still in review, launch on the web build and say "on the App Store" only once the 2.1 iOS build is actually approved.

### Pre-launch (Jul 24 – Aug 2) — owned + seed only, ~1–2 hrs total
| When | Channel | Beat |
|---|---|---|
| Jul 24–Aug 2 | Founder X (personal, already live) | Soft build-in-public teaser: "been building the part where your buddy list becomes *yours*." No dated promise, no feature list yet. |
| **Thu Jul 30** | Waitlist drop | First-look at Buddy Circles + mutual context. Ask seed members to try circles on `hiitsme.app` and report friction. Forward-ready screenshot. |
| Before Launch Day | — | **GATE (§5):** confirm 2.1 is live; confirm the register has the §5.1 entries approved; confirm Follow's live status (§5.2). No public 2.1 claim clears until these are true. |

### Launch Week (Aug 3 – Aug 9) — co-timed with flight Week 1
| Day | Primary beat | Where | Notes |
|---|---|---|---|
| **Mon Aug 3** | **2.1 is live** | X thread #1 (founder: "what's new in 2.1 and why") · IG "what's new" pinned note · flight's C1 Sign-On TikTok · promotional text v1 enriched with one 2.1 line | Seed ambassador ask opens. Uses the flight's already-planned Week-1 slots. |
| **Tue Aug 4** | **Buddy Circles hero — "Your people, sorted."** | TikTok **C7** (real-UI circle-creation demo) — the week's TikTok core slot 1 · IG stories: circle how-to + "how do you sort your buddies?" poll | The marquee asset. Screen-record the actual `BuddyCircles` UI. |
| **Wed Aug 5** | Circles depth (the privacy angle) | X reply-thread: "only you see your circles" · IG **Buddy Circles carousel** (forwardable, save-worthy) | Lead with *private*. Never imply a shared group. |
| **Thu Aug 6** | Waitlist drop + forward ask | Waitlist group · IG stories ship-note mirror | Explicit "send this to one group chat" (campaign-strategy §5.7). |
| **Fri Aug 7** | **Mutual context — "Find your people before you even DM."** | TikTok/IG Reel or carousel (existing Tier 3 line) — TikTok core slot 2 · CTA into the week's warmest room | For new users the card is empty — frame it for the seed community and returning users, don't over-promise it in cold acquisition (§5). |
| **Sat Aug 8** | Light / presence | Founder in-app presence (Pakiboy24, real away message) · casual X | No production. Keeps the cadence humane. |
| **Sun Aug 9** | **"Seen by N" — "You'll know it landed."** tied to Sunday Reset | IG static/story · mirrors the in-app Sunday Reset thread (campaign-strategy §7.2) | CTA into **Sunday Reset** specifically — warm by design, so no dead-room risk. |

### Reinforcement (mapped onto existing flight weeks — no added volume)
| Flight week | 2.1 feature reprise |
|---|---|
| Week 3 · Room Tour (Aug 17–23) | "Seen by N" recurs — "post in the room, you'll know it landed." Points at whichever room the O5 pull shows warmest. |
| Week 5 · Night Owls / Sunday Reset (Aug 31–Sep 6) | "Seen by N" in the real late-night / Sunday windows. |
| **Week 6 · Buddy List Week (Sep 7–13)** | **Circles + mutual context close the loop** ("meet → talk → add → sort your people"). Follow/presence-privacy folds into the C6 privacy-receipts cut **only if verified live (§5.2).** |

---

## 4. Measurement

Extends the flight's measurement plan (campaign-strategy §3, §9; baseline-audit §3.2). Same tools only — ASC + Vercel + first-party Supabase SQL. **No new vendors, no native tracking** (non-goal #11). The attribution-honesty caveat carries verbatim: with no install attribution and no UTM-to-signup capture, channel effect is read by triangulation, not claimed as precision.

**UTMs:** keep `utm_campaign=porchlight-q3` and the existing `utm_source` set. Add `utm_content` to tag the 2.1 beat: `utm_content=circles | mutual | seenby | follow`. This lets the Vercel UTM read attribute pageviews to a *feature story*, not just a channel, without new plumbing.

**The 2.1-specific activation signal — Buddy Circles adoption.** This is the headline number to add to the Monday scorecard, and it's a good one because it's **buddy-side, so it doesn't depend on room liveness:**
- `buddy_circles` rows created during the flight, distinct owners → "share of active buddy-having users who created ≥1 circle."
- `buddy_circle_members` rows → buddies actually filed.
- Both are first-party Supabase counts in the §3.2-D style — add them to the saved SQL suite (growth-plan §1.3) during pre-flight.

**Tie-back to flight objectives:**
- Circles adoption is the leading indicator for **O6 (buddy connections)** and for retention generally — someone who sorts their list is invested in it.
- "Seen by N" engagement supports **O5 (room aliveness)** — it's a reason to post in a room and a reason to come back and check.
- 2.1 `utm_content` pageviews roll into **O8** (6,000 campaign pageviews).

**What NOT to measure:** follower growth on any channel (non-goal #2); mutual-context views (not cleanly loggable — don't invent a metric); anything requiring a per-user tracking mechanism.

**Cadence:** folds into the existing Monday scorecard and the Aug 17 / Aug 31 phase gates (campaign-strategy §9). At the gates, kill/double 2.1 formats on 2-week data exactly as the channel plans do — the Buddy Circles carousel/C7 is the pre-registered favorite to double if it earns it.

---

## 5. Guardrails (restated for anyone executing)

### 5.1 BLOCKING: the claims register predates 2.1
`strategy/claims-register.md` was verified **2026-07-15**, against HEAD `35f76e2`. Every 2.1 feature shipped **after** that (Buddy Circles migration is 2026-07-22). **Therefore none of the 2.1 features are in the APPROVED table yet, and per the register's own rule "if a product claim is not in the APPROVED table, it does not ship."** 

**Nothing in this push goes public until the Brand Guardian / claims owner adds verified 2.1 entries to the register.** This doc supplies the evidence and proposed claims-safe phrasing (§0 table + §1 map + the per-feature guardrails below) so that ratification is fast. This is a hard gate, not a formality.

### 5.2 Per-feature guardrails
- **Buddy Circles — it is PRIVATE ORGANIZATION, not a shared group.** Owner-only (RLS-gated); the `showPresence` / `notifyMode` controls change only the owner's own view, never what buddies see. Never imply buddies know their circle, never imply a group chat or a new social space, never imply anyone else can see your circles. Approved frame: "sort your people into private circles — **only you see them.**"
- **"Seen by N" — it is an AGGREGATE COUNT, not read receipts.** Derived from `room_memberships.last_seen_at`; shows a number, never names. **Never call it "read receipts in rooms"** — the register's DNC #5 forbids room read receipts because per-user read state stays DM-only, and this feature was deliberately built to *not* be that. Approved frame: "a quiet 'Seen by N' — an honest count of who had the room open. No names."
- **Mutual context — shared rooms + mutual buddies only.** It is in-app relational context, never location or proximity (respect claims #22 and non-goal #9 — nothing detects where anyone is). For a brand-new user the card is empty; do not over-promise it in cold-acquisition creative. It shines for the seed community and returning users.
- **Follow — VERIFY LIVE, then lead with privacy, not "follow."** Before any Follow content: confirm the production build actually passes `currentUserId` to `BuddyProfileSheet` so the connection UI is active (it's dormant otherwise). Then frame it as *presence privacy* ("your status isn't public — people follow to see it"), never as social-media following, and **never attach a follower count** (non-goal #2). Follow is the honest home for the "say hi without the pressure" story — Knock is not.
- **Knock — never claim it. It does not exist.** No Knock button, copy, hashtag, or mockup, on any channel, ever. The real-UI-only rule (`tiktok.md` §1, `instagram.md` §1) makes this self-enforcing: there is nothing to screen-record.
- **Buzz — unchanged.** DM-only (register #7 / DNC #5). Don't imply Buzz in rooms.

### 5.3 Anti-dating posture (sharper for these features)
Circles, mutual context, and Follow are the 2.1 features most at risk of drifting dating-ward if copy gets lazy. Hold the line:
- **Mutual context is shared friendship context, never compatibility.** Never "see what you have in common with him" in a pursue-him register. It's "the rooms and people you already share."
- **Follow is a low-pressure hello, never a like/match.** No "who's interested," no reciprocation-as-signal framing.
- **Circles are for your friends, not a roster of prospects.** "Night owls," "the group chat," "gym buddies" — never "guys I'm into."
- All existing bans stand: no `match / swipe / singles / nearby / flirt / hookup-as-offer / meet guys` (brand brief §2 rule 3); "hookup" only in the negation "not a hookup app."

### 5.4 Standing DNC lines (still bind, restated because 2.1 will tempt them)
No user counts / activity stats / "N online" ever (DNC #10) — *especially* tempting now that "Seen by N" and circle sizes exist; the number in "Seen by N" is an in-product UI element, never a marketing stat. No testimonials (DNC #11; permissioned prompt-replies only, per the amendment). No encryption language (DNC #1). No Android (DNC #6). No "invite link" (DNC #7). No "anonymous" (DNC #8). No AOL/AIM/ICQ marks (DNC #9). No "works offline" (DNC #12). 18+ on every asset (#23). The member-consent guardrail (`tiktok.md` §1.2 / campaign-strategy §5.1) applies to every capture — Circles and mutual-context demos must use consenting S0 seed members or blur non-consenting screennames, and never publish DM content.

### 5.5 Dead-room rule (the flight's #1 risk)
Every CTA lands in a **specific, warm** room per the weekly O5 aliveness pull, never a generic download and never a cold room (campaign-strategy §7.1). 2.1 helps here structurally — Circles/mutual-context/Follow are buddy-side and reward a user regardless of room temperature — so **lead the acquisition beats with the buddy-side features and reserve the room-side "Seen by N" beat for the reliably-warm rooms (Sunday Reset, and whichever the pull shows hottest).**

---

*2.1 social push · rides inside OPERATION PORCH LIGHT · H.I.M. Q3 2026 · Saman Technologies LLC (internal)*
