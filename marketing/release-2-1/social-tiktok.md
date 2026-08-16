# H.I.M. v2.1 — TikTok Launch Content

**Release:** v2.1 ("presence-first BuddyList") · App `com.hiitsme.app` · MARKETING_VERSION 2.1
**Prepared:** 2026-07-23 · **Role:** TikTok Strategist
**Sits inside:** `campaign-2026-q3/channels/tiktok.md` (OPERATION PORCH LIGHT, flight Aug 3 – Sep 13) — this doc EXTENDS that plan with the 2.1-specific concepts; it does not replace it. Same account (`@hiitsme`), same bio link, same cadence-of-record (2–3/wk), same batching model, same KPIs.
**Governed by:** `strategy/brand-brief.md` (voice, naming, nostalgia policy, tagline system incl. "The light's on."), `strategy/claims-register.md` (only APPROVED claims ship). All product truth verified against shipped code at the paths in the appendix.
**Feature ground truth:** `release-2-1/engineering-signoff.md` (2.1 = presence-first UI, Buddy Circles, Knock, Buzz cooldown, mutual context, away-message replies, "Seen by N" room receipts).

---

## 0. What's new in 2.1 — and the one governance flag

2.1 ships **five screen-recordable, on-brand surfaces** the existing tiktok.md could not use because they didn't exist when the claims register was verified (2026-07-15, HEAD `35f76e2`). All five are now in the build (migrations dated Jul 22–23; PR #88). I verified each against source before scripting — evidence paths are in the appendix.

| 2.1 feature | One-line truth (grounded) | Screen-recordable? |
|---|---|---|
| **Buddy Circles** | Private, **owner-only** groups to organize your buddy list. A buddy sits in at most one circle; the rest are "Ungrouped." Per-circle you can hide that circle's presence from your own list or mute its DM alerts. **Buddies never see circles or know they're in one.** | Yes — "＋ Circle", the picker in a buddy's profile sheet |
| **Knock** | A gentle, low-pressure "👋 hello" to a **buddy** (buddies-only, enforced server-side). One Knock per person every 10 minutes. Lands as "You knocked" / "[name] knocked — wants to talk." | Yes — Knock button inside a DM |
| **Mutual context ("You both know")** | On a buddy's profile: shared rooms + mutual buddies, with the product's own words underneath — **"not a compatibility score."** | Yes — the "You both know" card |
| **"Seen by N" room receipts** | On your **own** last message in a room: an aggregate **count** ("Seen by 3"), derived from who had the room open. It shows a number, **never who**, and exposes nothing the roster didn't already. | Yes — your own message row in a room |
| **Buzz** (existing claim #7, now hardened) | DM-only nudge — shake + haptic + push. Now capped at one per person / 30 seconds. | Yes — staged in a consented DM per the existing consent rule |

**GOVERNANCE FLAG (must clear before any of these post):** Buddy Circles, Knock, mutual context, and "Seen by N" are **not yet in the APPROVED claims table** — the register predates them. Buzz (#7) already is. Before launch week, the Brand Guardian should add register entries #25–28 using the evidence paths in the appendix below, and confirm the "Seen by N" phrasing carve-out against DNC #5 (see the do-not list, item 4 — the shipped behavior is an aggregate presence-count, NOT per-person room read receipts). **I've written every hook and caption to survive that review** — nothing below claims more than the code does. But treat this as "scripted, pending formal claim sign-off," identical posture to how tiktok.md handled "The light's on." before its sign-off.

Everything else from tiktok.md §1 (binding production rules), §2 (account setup), §5 (search), §6 (trend adaptation), §7 (captions/hashtags) applies unchanged. **The consent + real-UI + no-counts + no-dating rules are not relaxed for 2.1.**

---

## 1. Posting cadence — launch week + fit into the Aug 3–Sep 13 flight

2.1 is the flight's marquee. The existing calendar's 6 weekly themes already map cleanly onto the new features, so **2.1 becomes the hero content of the flight rather than a separate push** — no new account, no cadence break.

**Cadence-of-record holds: 2–3 posts/week (floor 12, ceiling 18 over the flight).** Launch week is the one deliberate spike: it uses both core slots **and** the flex slot (3 posts), so the streak still holds at 2/wk in the leaner weeks.

**Two mapping options — pick based on when 2.1 is actually live to record (PR #88 must merge → TestFlight → the features are real on-device):**

**Option A — 2.1 is live for flight open (Aug 3).** Preferred. Lead the whole flight with it:

| Week | tiktok.md theme | 2.1 hero for the week |
|---|---|---|
| 1 · Aug 3–9 · **LAUNCH WEEK** | Sign-On Week | **2C1 Knock** (Tue) · **2C4 presence tour / "The light's on."** (Thu) · **flex: 2C3 mutual-context** (Sat) — 3 posts |
| 2 · Aug 10–16 | Away Message Week | **2C5 "ways to say hi without saying anything"** (Knock + Buzz combo) · away-message-reply recut · Sunday variant |
| 3 · Aug 17–23 | Room Tour Week | keep tiktok.md **C4 room tour** · flex: **2C4 "Seen by N"** room-receipts recut |
| 4 · Aug 24–30 | New City, No Crew | keep **C5 relocation POV** · **2C1 Knock** cut B ("the new-friend follow-up") · *Aug 24 phase gate* |
| 5 · Aug 31–Sep 6 | Night Owls & Sunday Reset | **2C1 Knock** late-night recut (posted 11pm–1am) · Buzz late-night cut · Sunday variant |
| 6 · Sep 7–13 | Buddy List Week + wrap | **2C2 Buddy Circles** (hero) · 2C2 privacy-receipts recut · winner rerun |

**Option B — 2.1 goes live mid-flight (build still in review Aug 3).** Run tiktok.md's original C1–C6 for Weeks 1–2 as written, then treat **the Monday of the week 2.1 clears review as "Launch Week"** and slot the 3-post spike there, pushing the table above forward. The founder decides which is true at batching time; the concepts don't change.

**Batching (unchanged from tiktok.md §3):** two ~90-min sessions per fortnight. Because Knock, Buzz, and Buddy Circles all live on the same DM/BuddyList surface, one consented capture session with a seed member yields the raw material for **2C1, 2C2, 2C3, and 2C5 at once**. Post when the founder can sit in comments for the first 30–60 min — reply velocity is distribution.

---

## 2. The five 2.1 concepts — fully scripted

Portrait 9:16, dark "Midnight" hero look (midnight indigo + amber). Hook lands inside ~1.5s. Runtimes 18–30s. Every end card: **H.I.M.** wordmark + amber pip · `hiitsme.app` · **18+** · CTA into a **specific room**. Real UI only; all consent/blur rules from tiktok.md §1.2 apply in full.

---

### 2C1 — Knock: "the low-pressure hello" (LAUNCH-WEEK HERO · Week 1 Tue; recuts Wk 4, Wk 5)

The marquee 2.1 interaction and the most emotionally legible. Knock solves a feeling everyone has: *I want to reach out but I don't want to be a Whole Text.*

**Hook (on-screen text + spoken, 0.0–1.5s):** "The 'hey, you up? no reason' button, but for friends."

**Beat-by-beat:**

| Time | Screen | VO / on-screen text |
|---|---|---|
| 0.0–1.5s | Buddy list, a buddy's row with a live presence dot | Hook text + spoken hook |
| 1.5–5s | Tap the buddy → their DM opens (consented seed member; empty or old thread, no message bodies in frame) | VO: "Sometimes you don't have anything to say. You just want him to know you thought of him." |
| 5–9s | Tap the **👋 Knock** button in the composer bar; brief soft sound + the row appears: "You knocked" | On-screen: "👋 Knock — no message required" · VO: "So you knock." |
| 9–14s | Cut to the same event from the *recipient's* framing (second consented account / founder's test device): the incoming row reads "[screenname] knocked — wants to talk" | VO: "He gets a little knock. Not a paragraph. Not a 'we need to talk.' A knock." |
| 14–19s | Back to the composer; on-screen text stack: "buddies only" · "once every 10 min" · "no pressure to reply" | VO: "It only works on your actual buddies. You can't spam it. And nobody owes you a reply." |
| 19–24s | End card: wordmark + pip · "The light's on." · hiitsme.app · 18+ · "Come find your people → Everywhere Else" | VO: "The gay friendship app where saying hi is one tap. Not a dating app. Link in bio." |

**Shot list (all real):** buddy list with real presence dot (non-consenting names blurred); DM open with the Knock button visible; the Knock send + "You knocked" row; the received "…knocked — wants to talk" row on a second consented device; the on-screen constraint stack. **No message bodies in frame** (Knock rows carry no content — that's what makes this safe to film).

**Caption:** "Knock: the low-pressure way to say hi to a friend. One tap, no paragraph, no pressure to reply. H.I.M. is a friendship-first app for gay men — not a dating app. Buddies only. 18+. Link in bio. #gayfriendship #friendshipapp #gaytiktok #lowpressure"

**Cuts:** (a) 24s hero; (b) **Wk 4 "new-friend follow-up"** recut — VO reframed for someone who just met a buddy in a city room: "You met one guy in the Chicago room. You don't want to smother it. Knock." ends on the Chicago room; (c) **Wk 5 late-night** recut recorded/posted 11pm–1am: "It's 1am, he's 'away,' you don't want to wake a whole conversation. Knock." ends in Late Night.

---

### 2C2 — Buddy Circles: "organize your people (they will never know)" (Week 6 HERO)

The single most on-brand-for-the-audience feature in 2.1, because its whole design is *privacy*: circles are owner-only. This is the "you don't want everyone in your business" thesis (tiktok.md C6) made literal.

**Hook (on-screen text + spoken, 0.0–1.5s):** "You can sort your friends into private groups and they have NO idea."

**Beat-by-beat:**

| Time | Screen | VO / on-screen text |
|---|---|---|
| 0.0–1.5s | Buddy list, a few buddies (consented / blurred) | Hook text + spoken hook |
| 1.5–5s | Tap **＋ Circle**; type a name in the real input ("The Group Chat IRL") → Add | VO: "Make a circle. Name it whatever you want." On-screen: "private · owner-only" |
| 5–9s | Open a buddy's profile sheet; the circle picker; file him into the circle | VO: "Drop a buddy into it." |
| 9–14s | Back to the list — the buddy now sits under the circle; others sit under "Ungrouped" | VO: "Now your list is organized the way *your* brain works." |
| 14–19s | Circle settings on camera: toggle **hide presence** for a circle; toggle **mute** for another | VO: "You can even hide a circle's presence so it's not in your face — or mute its pings. Your view. Your rules." On-screen: "changes only what YOU see" |
| 19–24s | Hold on the organized list; end card: wordmark · "Your list, your rules." · hiitsme.app · 18+ · "→ Sunday Reset" | VO: "Nobody gets told what circle they're in. Nobody gets a rank. A friendship app for gay men — not a dating app. Link in bio." |

**Shot list:** ＋ Circle create flow (founder's account); circle picker in a buddy profile sheet (consented buddy, or founder's own second test account); the list showing circle + Ungrouped sections; the per-circle hide-presence and mute toggles. All real UI.

**Caption:** "Buddy Circles: sort your friends into private groups only you can see. Hide a circle's presence, mute its pings — your view, your rules, and nobody ever knows what circle they're in. Friendship-first app for gay men, not a dating app. 18+. Link in bio. #gayfriendship #privacy #friendshipapp #gaytiktok"

**Recut:** 12s "privacy rapid-fire" cut — ＋ Circle → hide presence → mute → done, no VO, on-screen text only, for the second Week 6 slot. Pairs naturally with tiktok.md C6's settings-tour cut.

**Do-not for this one (critical):** never say or imply a buddy is *notified*, *ranked*, or *can see* their circle. The code is owner-only RLS — "he'll know he's your favorite" would be a false claim. The whole punchline is that they *don't* know.

---

### 2C3 — Mutual context: "even the 'you have things in common' screen refuses to be a dating app" (Week 1 flex / Sat)

The sharpest anti-positioning asset in the whole flight, because the *product itself* makes the argument. The "You both know" card literally reads **"not a compatibility score."** That is a gift — screen-record it and let it talk.

**Hook (on-screen text + spoken, 0.0–1.5s):** "Every other app turns 'we have stuff in common' into a match percentage. Watch what this one does instead."

**Beat-by-beat:**

| Time | Screen | VO / on-screen text |
|---|---|---|
| 0.0–1.5s | A buddy's profile sheet, scrolling toward the "You both know" card | Hook text + spoken hook |
| 1.5–6s | Land on the card header: "You both know 🤝" and the subhead | VO reads the shipped subhead verbatim: "Shared rooms and mutual buddies — *not a compatibility score.*" On-screen: highlight "not a compatibility score" |
| 6–11s | The shared-rooms chips (# room names) | VO: "It shows the rooms you're both in." |
| 11–16s | The "N mutual buddies" chips (consented / blurred screennames) | VO: "And friends you both already know. That's it. No percent. No 'you're a 92% match.' No ranking a person." |
| 16–21s | Back up to the full card | VO: "Because this isn't a dating app. It's a friendship app for gay men, and it's built like one — all the way down to this screen." |
| 21–26s | End card: wordmark · "It's not about who you're attracted to. It's about who you want in your life." · hiitsme.app · 18+ · "→ Everywhere Else" | VO: "Come find people you have something in common with. Link in bio." |

**Shot list:** buddy profile sheet scroll to the "You both know" card; the shared-room chips; the mutual-buddy chips (consent/blur); the verbatim subhead in frame. All real UI — the "not a compatibility score" line must be legibly on screen (it's the whole point and it's genuinely shipped copy).

**Caption:** "A friendship app that shows what you have in common — and refuses to turn it into a match score. 'Shared rooms and mutual buddies. Not a compatibility score.' That's the actual screen. H.I.M. — friendship-first for gay men, not a dating app. 18+. Link in bio. #gayfriendship #notadatingapp #gaytiktok #friendshipapp"

**Cut:** 8s "the receipt" cut — just the hook → the card → "not a compatibility score" held → end card. Keyed to the search phrase "apps that aren't dating apps."

---

### 2C4 — Presence-first tour: "The light's on." (Week 1 Thu; "Seen by N" recut Wk 3)

The 2.1 UI is presence-first — this is the spiritual successor to tiktok.md C1, updated to show what actually changed: presence dots, away messages, away-message replies, and the new "Seen by N" room receipt. Anchor tagline: **"The light's on."**

**Hook (on-screen text + spoken, 0.0–1.5s):** "You can tell who's around before you say a single word."

**Beat-by-beat:**

| Time | Screen | VO / on-screen text |
|---|---|---|
| 0.0–1.5s | Boot splash → buddy list resolving, presence dots lighting up | Hook text + spoken hook |
| 1.5–5s | Slow scroll: available dots, an away message on a buddy's row ("finally cleaning my apartment") | VO: "Presence first. A dot that says he's around. An away message that says what he's up to." |
| 5–9s | Open the away-message composer on the founder's own account; type "planning the week I will not have"; set it | VO: "Set yours." On-screen: "status as self-expression, the way it used to be" |
| 9–14s | **Away-message reply** (2.1): reply to a buddy's away message right from the surface (consented; frame the interaction, not private bodies) | VO: "New in 2.1 — you can reply straight to someone's away message. It's a whole conversation starter." |
| 14–19s | Enter a room; post a real message from the founder's account; hold on the own-message row showing **"Seen by 3"** | VO: "And in the rooms — your own message tells you how many people saw it. A number. Never who. Just… the light's on." On-screen: "Seen by N — a count, never names" |
| 19–24s | Back to buddy list; end card: wordmark · "The light's on." · hiitsme.app · 18+ · "→ Late Night" | VO: "The gay friendship app where you can feel the room's awake. Not a dating app. Link in bio." |

**Shot list:** boot splash; buddy list with real presence dots + a real away message (consent/blur); away-message composer set flow (founder's account); away-message reply interaction (consented, no private bodies); a real room post by the founder; the own-message "Seen by N" label. **"Seen by N" must be shown only on the founder's OWN message** — that's the only place it renders, and it's a count with no names.

**Caption:** "Presence-first: see who's around, set an away message, reply right to someone's — and in the rooms your own message shows how many people saw it (a count, never names). H.I.M., a friendship-first app for gay men. Not a dating app. 18+. Link in bio. #gayfriendship #newstalgia #gaytiktok #friendshipapp"

**Cuts:** (a) 24s hero; (b) **Wk 3 "Seen by N" recut** — lead on the room + the receipt, VO: "It's not read receipts. It doesn't name anyone. It just tells you the room saw you. Presence, not surveillance." ends in the room named in Week 3's aliveness pull; (c) Wk 5 late-night recut ending in Late Night, posted 11pm–1am.

---

### 2C5 — "Ways to say hi without saying anything": Knock + Buzz (Week 2 HERO — Away Message Week)

Batches off the same capture as 2C1. Frames the two micro-interactions as the screennames-era love language: presence and a nudge, not a performance.

**Hook (on-screen text + spoken, 0.0–1.5s):** "Three ways to reach a friend on here without typing a single word."

**Beat-by-beat:**

| Time | Screen | VO / on-screen text |
|---|---|---|
| 0.0–1.5s | DM composer with a buddy (consented; no bodies) | Hook text + spoken hook |
| 1.5–6s | **1.** React to his last message with an emoji (real reaction UI) | On-screen: "1. a reaction" · VO: "One — react. He knows you saw it." |
| 6–12s | **2.** Tap **👋 Knock**; "You knocked" row appears | On-screen: "2. a knock 👋" · VO: "Two — knock. 'Thinking of you,' no paragraph." |
| 12–18s | **3.** Tap **⚡ Buzz**; the window shake/flash + "⚡ Buzz!" row (staged per tiktok.md §1.2 — only the buzz event + shake visible, consent logged) | On-screen: "3. a buzz ⚡ (yes, it shakes)" · VO: "Three — buzz. If he's been 'away' all day… buzz him." |
| 18–23s | Composer at rest; on-screen: "no essay required" | VO: "Sometimes friendship is just letting someone know you're there." |
| 23–28s | End card: wordmark · "Your screenname, your status, your people." · hiitsme.app · 18+ · "→ Everywhere Else" | VO: "A friendship-first app for gay men. Not a dating app. Link in bio." |

**Shot list:** emoji-reaction on a message (consented DM, no readable bodies); the Knock send + row; the consented, cropped Buzz demo (shake + "⚡ Buzz!" only, no message content, consent logged per §1.2). Buzz is DM-only — never imply it in a room.

**Caption:** "Away messages are back — and so are the tiny ways to say hi. React, knock 👋, or buzz ⚡ (yes, it still shakes the screen). Friendship-first app for gay men, not a dating app. What did your away message used to say? 18+. Link in bio. #awaymessage #gayfriendship #gaytiktok #newstalgia"

**Comment policy (binding, from tiktok.md §3 C3):** the "what did your away message say" prompt invites replies — they stay in-thread. Repost a reply ONLY with explicit logged permission, verbatim, framed as "a reply to this week's prompt," never as an endorsement (claims register DNC #11 amendment).

**Cuts:** (a) hero; (b) Knock-only 8s cut (feeds 2C1's search terms); (c) Buzz-only cut for a Wk 5 late-night slot.

---

*(Optional 6th, low-lift, on the tiktok.md C2 pattern) — **2C6 founder "what shipped in 2.1"** build-in-public talking-head: Haaris to camera, "I'm a solo founder and I just shipped Knock, Buddy Circles, and a 'you both know' screen that refuses to be a match score — here's why," intercut with 2C1–2C4 B-roll. Facts on the record only; no user counts, no testimonials (tiktok.md §6 rules). Slot it as a flex/wrap cut in Week 6 or the Aug 24 phase gate.)*

---

## 3. Search / SEO posture (extends tiktok.md §5)

Ranking inputs, in weight order (unchanged): **caption keywords > spoken words > on-screen text > hashtags.** Say the query phrase **out loud** in at least one beat of every hero cut — the VO lines above already do.

**Carry-over target phrases (keep):** "gay friendship app" · "how to make gay friends" · "how to make gay friends in nyc / chicago / atlanta / la" · "apps that aren't dating apps" · "not a dating app" · "making friends as an adult" · "new in town."

**New 2.1 intent phrases to rotate in (each maps to a concept):**
- "low pressure way to reach out to a friend" · "how to say hi without being annoying" → **2C1 Knock, 2C5**
- "app to organize your friends" · "private friend groups" → **2C2 Buddy Circles**
- "friendship app that isn't a dating app" · "app that's not about matching" → **2C3 mutual context** (the strongest-converting phrase for this audience; the on-screen "not a compatibility score" is the proof)
- "how to know if a friend is online" · "presence app" · "away message app" → **2C4**

**Rules (unchanged):** front-load the query phrase in the caption's first sentence; the rest stays in brand voice (warm, funny, specific). Long captions are fine. Once a week, search "gay friendship app" and "gay friends app" logged-out and screenshot into the weekly scorecard (tiktok.md §8 KPI).

**Hashtags: 3–5 per post** (1 community + 1–2 intent + 1 format/context). 2.1 additions to the pools: intent → `#lowpressure` `#friendgroup`; format/context → `#buildinpublic` (2C6 only). Never `#datingapp`/`#gaydating`, no competitor tags, no legacy-IM trademark tags.

---

## 4. Do-not list — for anyone filming 2.1 (claims-register-derived)

Print this and tape it to the tripod. Every item is a real trap specific to these features.

1. **Buddy Circles are invisible to buddies. Never imply otherwise.** No "put him in your favorites and he'll know," no "rank your friends," no notification/badge to the buddy. Owner-only RLS — a "he sees his circle" claim is materially false. The *punchline is that they don't know.*
2. **Mutual context is NOT a match/compatibility signal.** Never say "see how compatible you are," "your match," "your %," or frame the "You both know" card as dating. The shipped copy says "not a compatibility score" — keep it that way on screen and in caption.
3. **Knock is buddies-only and rate-limited.** Never show or imply knocking a stranger or a non-buddy (server blocks it), and never imply you can spam it (10-min cooldown). Never call it a "nudge™" or reference another app's name for the mechanic. Knock creates no message body — don't fabricate one.
4. **"Seen by N" is an aggregate COUNT, never names, and is NOT "read receipts in rooms."** Show it only on the founder's OWN message (the only place it renders). Never say "see who read your room message," never name anyone, never call it read receipts (DM read receipts are a separate feature; per DNC #5 rooms have no per-person read receipts — the 2.1 receipt is a presence-derived count that "exposes nothing new"). Say "a count, never names."
5. **Buzz is DM-only.** Never imply Buzz in a room. Staged demo only, consent logged, only the shake + "⚡ Buzz!" event visible — no message bodies (tiktok.md §1.2).
6. **No counts, no scale, ever.** No "N online," no member counts, no "thousands," no fake activity. Presence shown on camera must be REAL (a consenting seed member actually online). Honest smallness is the brand (brand brief §2 rule 2, DNC #10).
7. **No testimonials / endorsement framing.** Comment replies stay in-thread; repost only per the DNC #11 amendment (explicit logged permission, verbatim, "reply to this week's prompt," never "users love it").
8. **No dating vocabulary.** No match/swipe/singles/nearby/flirt/hot; "hookup" only as "not a hookup app." The word "lonely" never appears. No dating-adjacent hashtags.
9. **No legacy-IM trademarks or trade dress** in video, text, caption, or audio — no AOL/AIM/ICQ, no running-man, no recreated sign-on/door/buzz sounds (brand brief §7.5). **Filming caution:** the app's internal sound files and CSS classes are named `aim-*` (e.g. `/sounds/aim-instant-message.mp3`, `aim-rich-html`) — never let a filename, dev console, or settings string with "aim" appear on screen, and build every edit on original audio (VO + real typing/ambient) so it survives the sound being muted.
10. **Native-only claims stay on iPhone.** Face ID app lock, screen shield, and the native BuddyList surface are iOS — never show them as web (DNC #15). Portrait iPhone only, no iPad mockups.
11. **Standing:** name is always "H.I.M." (never HIM/Him); domain lowercase `hiitsme.app`; "18+" on every end card + caption; approved taglines only ("The light's on." is cleared); every video ends pointing at a specific room, not a generic download (tiktok.md §1.7).

---

## Appendix — Claims used + new register entries to open

**Existing APPROVED claims relied on:** #2 (screenname-first), #3 (away messages/status), #4 (buddy list + request→accept loop), #6 (emoji reactions in DMs), #7 (Buzz — DM-only nudge, shake), #15 (Block + Report everywhere — for the wrap/settings recuts), #21 (App Store + web), #22 (no swipe/radar/grid), #23 (18+). Approved brand language: "Friendship first." · "Your screenname, your status, your people." · "The light's on." (Tier 1) · "It's not about who you're attracted to. It's about who you want in your life." · "Your list, your rules." (tiktok.md C6) · "status as self-expression, the way it used to be."

**NEW — open these register entries before launch week (evidence verified 2026-07-23, PR #88 branch):**

| Proposed # | Claim as used here | Evidence path | Phrasing guardrail |
|---|---|---|---|
| **#25 Buddy Circles** | Private, owner-only groups to organize your buddy list; a buddy is in ≤1 circle; per-circle hide-presence + mute; buddies never see circles | `src/lib/buddyCircles.ts` (owner-only RLS note, one-circle-per-buddy upsert, `showPresence`/`notifyMode`); `src/components/BuddyCircles.tsx`; migration `20260722130125` | "Private groups only you can see." Never "buddies are notified/ranked/can see their circle." |
| **#26 Knock** | Buddies-only low-pressure "👋" nudge; one per pair / 10 min; renders "You knocked" / "[name] knocked — wants to talk"; no message body | `supabase/migrations/20260722114338_add_buzz_and_knock_message_types.sql` (`enforce_knock_rules`: buddies-only + 10-min cooldown); `20260722150347` (advisory lock); `src/components/ChatWindow.tsx` (Knock button + rows ~1781, ~2241) | "Knock a buddy." Buddies only, rate-limited, no paragraph. Don't call it a "nudge™" or reference other apps. |
| **#27 Mutual context** | "You both know" on a buddy profile: shared rooms + mutual buddies, self-labeled "not a compatibility score" | `src/lib/mutualContext.ts` (`get_mutual_context` RPC); `src/components/MutualContextCard.tsx` (verbatim "not a compatibility score"); `src/components/BuddyProfileSheet.tsx` | Quote the shipped "not a compatibility score" line. Never frame as a match/% signal. |
| **#28 "Seen by N" room receipt** | On your OWN last room message: an aggregate count of co-members who had the room open (derived from `last_seen_at` heartbeat). A number, never names. NOT per-person read receipts | `src/lib/roomReadReceipts.ts` (`countSeenByOthers`, `formatSeenByLabel` → "Seen by N"); `src/components/GroupChatWindow.tsx` (line ~310, own-message only) | "Seen by N — a count, never names." Reconcile against DNC #5: this is presence-derived aggregate, not room read receipts. Never name who saw it. |

**DNC compliance for this doc:** no encryption language (DNC #1); no Android mention (DNC #6); no invite-link copy (DNC #7); no "anonymous" (DNC #8); no legacy-IM trademarks or sounds anywhere public-facing (DNC #9, brand brief §7.5); no user counts or fabricated activity (DNC #10); no testimonials — replies per DNC #11 amendment (DNC #11); no dating positioning (DNC #13); native-only features scoped to iPhone (DNC #15).

---

*v2.1 TikTok launch content · extends OPERATION PORCH LIGHT · H.I.M. Q3 2026 · Saman Technologies LLC (internal). Scripted pending Brand Guardian sign-off on new claims #25–28.*
