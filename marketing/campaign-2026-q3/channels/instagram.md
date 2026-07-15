# H.I.M. Q3 2026 — Instagram Channel Plan

**Campaign:** OPERATION PORCH LIGHT (internal name — never in public copy) · Flight Mon Aug 3 – Sun Sep 13, 2026
**Prepared:** 2026-07-15 · **Role:** Instagram Curator
**Executes:** `campaign-strategy.md` §5.2 (Instagram — the send-this-to-the-group-chat engine), §6 weekly themes, §7.1 (every asset lands in a specific room)
**Governed by:** `strategy/brand-brief.md` (voice, naming, visual identity, nostalgia policy), `strategy/claims-register.md` (only APPROVED claims ship — see Claims Used appendix), `strategy/baseline-audit.md` (measurement sources), `strategy/trend-research.md` §d/§e (platform mechanics, Meta policy posture)
**Sibling plan:** `channels/tiktok.md` — Reels here are repurposed from its concepts C1/C3/C5/C6 per strategy §5.2; production rules and consent logging are shared, not duplicated.

---

## 0. Role on the bench

Instagram is **not** our discovery engine (that's TikTok) and follower growth is explicitly not a goal (strategy non-goal #2). Instagram's job is **DM-forwarding velocity**: assets designed to be screenshotted, saved, and sent to the group chat, with the 25–40-member seed community (S0) as the initial forwarding network (strategy §5.2, §7.3 ambassador ask).

Posture consequences, binding:

- **Sends + saves per post are the currency.** Likes, reach, and follower count are logged but never targeted.
- **Meta reach is treated as bonus**, given the documented policy climate (trend research §e). If reach craters, we log it in the weekly scorecard and keep shipping — no thrash, judged on 2-week windows at the Aug 17 / Aug 31 phase gates.
- **$0 paid.** No boosting, no Meta ads, no whitelisting (strategy §8, non-goal #4).
- **Broadcast channel:** not a week-1 task. Revisit at the Aug 31 phase gate only if a real following materializes (strategy §5.2).

---

## 1. Binding production rules (every post, every story)

1. **Real UI only.** Any screenshot or screen recording is the shipped iPhone or web app — glass titlebar windows, buddy-list rows, away-message composer, rooms list. Never mock up fake UI, member counts, or activity that doesn't exist (brand brief §3, claims register DNC #10). Typographic "status cards" (§3) are clearly stylized brand graphics — wordmark + amber pip, no fake chrome pretending to be a member's screen.
2. **Member-consent guardrail (strategy §5.1, applies verbatim to Instagram).** Captures showing another member's screenname or messages require that member's explicit, logged consent — practical path: scheduled captures with consenting S0 seed members. Otherwise crop or blur ALL non-consenting screennames and message content. **Never publish DM content.** The Buzz demo is staged with one consenting seed member, framed so only the buzz rows and shake are visible.
3. **Never on camera:** credential entry, anyone's face or legal name except the founder by his own choice, location-revealing content, any mechanic pressuring a member to reveal identity (brand brief §2 rule 6; strategy non-goal #9).
4. **Vocabulary:** no AOL/AIM/ICQ marks or trade dress anywhere — image text, caption, audio, alt text, hashtags (brand brief §7). No dating vocabulary (match, swipe-as-offer, singles, nearby, flirt). "Hookup" only as the negation "not a hookup app." The word "lonely" never appears (strategy §1.1 two-track rule). Away-message examples on cards are **brand-authored** in the shipped register ("doomscrolling," "finally cleaning my apartment") — never presented as a real member's status.
5. **Every post carries:** "H.I.M." styled per naming rules (never HIM/Him), lowercase `hiitsme.app`, and "18+" in the caption or closing card (claims #21, #23). CTAs point into a **specific room**, never a generic download (strategy §7.1).
6. **Taglines:** brand brief §6 Tier 1–3 lines only. "The light's on." does not ship unless founder sign-off lands (strategy §1.1); nothing below depends on it.
7. **Accessibility standard:** custom alt text on every feed image and carousel slide (specs below); Reels ship with burned-in captions/subtitles (Instagram has no custom alt text for Reels — the cover frame gets descriptive text in the caption's first line instead of "link in bio" filler).

---

## 2. Account + profile setup (pre-flight week, Jul 27)

- **Handle:** `@hiitsme` (mirrors the TikTok plan §2; fall back to `@hiitsme.app`). Display name: `H.I.M. — Friendship first` (name field is searchable; Tier 1 line only).
- **Bio:** "Friendship-first social app for gay men. Your screenname, your status, your people. Not a hookup app. 18+" (Tier 1 lines, verbatim).
- **Bio link:** `https://hiitsme.app/?utm_source=instagram&utm_medium=social&utm_campaign=porchlight-q3` — per the strategy §6 pre-flight UTM convention. Story link stickers use `utm_medium=stories` on the same source/campaign so Vercel can split bio vs. sticker traffic.
- **Category:** App page / Social. Support address consistency: support@hiitsme.app.
- **Pinned posts:** pin CA (absence-claims carousel) after Week 1 and CB (room tour) after Week 3 — the two assets a first-time profile visitor should hit.
- **Zero followers is fine.** The seed community is the distribution; the ambassador ask (strategy §7.3) is what moves these assets, not the algorithm.

---

## 3. Grid concept — "The Buddy List Grid"

The grid should read at a glance like the app reads: **midnight indigo + amber, monospace where things are "typed," warm cream as the daytime counterpoint** (brand brief §3). Three card families rotate so any three-post row shows the system, not a mood board:

| Family | Look | Used for |
|---|---|---|
| **Status cards** | Midnight indigo `#0F1424` ground, amber `#E8A23A` monospace (IBM Plex Mono) headline styled like a typed away message with a blinking-cursor motif, small H.I.M. wordmark + amber pip, squircle corners (~1.4rem radius language) | Away-message memes, prompts, one-liners (S1, S3) |
| **Window cards** | Real UI capture set inside generous indigo or cream margins — the glass titlebar, buddy-list rows, rooms list; never full-bleed screenshots | Reels covers, room tour slides, receipts slides (R1–R3, CB, CC) |
| **Daylight cards** | Warm stone/cream `#F5F1E8` ground, walnut-brown text, amber accents; Nunito for supporting copy | Daytime/relocation register (S2, CA interior slides) |

Rules: anaar red `#9C2E2E` is a garnish, never a background. No pastiche of anyone else's trade dress — no running-man-alike mascots, no recreated door/buddy sounds in Reels audio (brand brief §7.5). Amber pip appears somewhere on every cover — it is the campaign's quiet visual through-line (strategy §1.1). Templates are built once in pre-flight in a free tool ($0 content tooling, strategy §8) so statics re-arm weekly as text swaps.

---

## 4. Feed calendar — 3/week floor, batched

Strategy §5.2 sets 3–4 feed posts/week. **Commitment: 3/week (18 posts over the flight)** — the 9 flagship posts below plus ~9 low-cost slots: Reels repurposed from TikTok cuts (already produced under the TikTok plan's batching sessions) and status-card re-arms (text-swap templates). This holds inside the founder's §9 weekly load because Instagram originates almost nothing: Reels are recuts, statics are templates.

| Week · Theme (strategy §6) | Flagship posts | Repurpose / re-arm slots |
|---|---|---|
| 1 · Aug 3–9 · Sign-On Week | **R1** (Tue Aug 4) · **CA** (Fri Aug 7) | TikTok C2 founder-story recut |
| 2 · Aug 10–16 · Away Message Week | **R2** (Tue Aug 11) · **S1** (Sun Aug 16, ~6pm ET, mirrors the in-app Sunday Reset thread) | Status-card re-arm: "your away message for a Tuesday that got away from you" |
| 3 · Aug 17–23 · Room Tour Week | **CB** (Tue Aug 18) | TikTok C4 city recut; single-room status card for the week's warmest room (per O5 aliveness pull — never point at a cold room) |
| 4 · Aug 24–30 · New City, No Crew | **S2** (Tue Aug 25) | TikTok C5 relocation recut (Thu Aug 27); Everywhere Else status card |
| 5 · Aug 31–Sep 6 · Night Owls & Sunday Reset | **S3** (Wed Sep 2, posted ~11pm ET) | Sunday Sep 6 (Labor Day wknd): "Sunday Reset, long-weekend edition" status card, Sun evening |
| 6 · Sep 7–13 · Buddy List Week + wrap | **CC** (Tue Sep 8) · **R3** (Thu Sep 10) | Winner rerun: re-share the flight's best sends-per-reach post with a new cover |

Phase gates Aug 17 / Aug 31: kill or double formats on 2-week sends+saves data. The away-message status card is the pre-registered favorite to double (same call as TikTok's C3).

---

## 5. The nine flagship posts

### Reels (repurposed from TikTok concepts per strategy §5.2; scripts below are the IG edits)

---

#### R1 — Reel · "Arriving somewhere" (Week 1 · Tue Aug 4 · from TikTok C1)

**IG edit:** 20s trim of the C1 hero. Burned-in captions throughout; first frame safe for feed crop; original audio (VO + real typing sounds — no licensed-track dependency).

| Time | Screen | VO / burned-in text |
|---|---|---|
| 0–1.5s | Boot splash: pulsing amber rounded square, monospace "H.I.M." | "Remember when going online felt like arriving somewhere?" |
| 1.5–4s | Buddy-list window opens — glass titlebar, own screenname in monospace (consent/blur rules per §1.2) | "A screenname that's yours." |
| 4–8s | Away-message composer: type "doomscrolling," set it, it appears on the profile | "An away message that says what you're up to." |
| 8–13s | Rooms list scroll — all 7 room names; pause on Late Night: "For the night owls. No judgment." | "A buddy list of people you actually know — and rooms where the conversation happens out loud." |
| 13–20s | End card: wordmark + amber pip · "Friendship first." · hiitsme.app · 18+ | "No swiping. No radar. No grid. It's back — and this time it's ours." |

**Cover frame:** boot splash with "arriving somewhere" in cream type.

**Caption:**
> Remember when going online felt like arriving somewhere? A screenname that's yours. An away message that says what you're up to. A buddy list of people you actually know. Seven rooms where the conversation happens out loud. No swiping. No radar. No grid. Friendship-first, for gay men — on the App Store and at hiitsme.app (link in bio). 18+
> #gayfriendship #friendshipapp #lgbtq #newstalgia

**Cover alt text (used on the feed-grid cover and echoed in caption line 1):** Dark app screen with a glowing amber rounded square above the letters H.I.M. in spaced monospace type — the app's boot splash.

---

#### R2 — Reel · Away-message prompt + Buzz (Week 2 · Tue Aug 11 · from TikTok C3)

**IG edit:** 22s. The CTA is rebuilt for the sends KPI — this is the flight's designated group-chat forward.

| Time | Screen | VO / burned-in text |
|---|---|---|
| 0–1.5s | Away-message composer, cursor blinking | "Your away message for a Sunday you refuse to leave the house — go." |
| 1.5–9s | Type/delete/retype in the real composer: "grabbing coffee (it's 4pm)" → "finally cleaning my apartment" → "planning the week I will not have" | (no VO — the typing carries it) |
| 9–13s | Commit; profile shows the away message; cut to buddy-list own-status row | "Set an away message so your buddies know what you're up to." |
| 13–18s | Buzz demo (staged per §1.2: one consenting seed member, only buzz rows + window shake in frame, zero message bodies) | "And if your buddy's been 'away' all day — buzz him." Text: "yes. buzzing is back." |
| 18–22s | End card: "Your screenname, your status, your people." · hiitsme.app · 18+ | "Send this to the group chat. Collect their away messages." |

**Caption:**
> Your away message for a Sunday you refuse to leave the house — go. Wrong answers welcome in the comments. And yes: if your buddy's been "away" all day, you can buzz him. Send this to the group chat and collect their away messages. Friendship-first app for gay men — not a dating app. 18+ · link in bio
> #awaymessage #gayfriendship #gayfriends #sundayreset

**Cover alt text:** App compose screen on a dark background with the typed away message "finally cleaning my apartment" and a blinking cursor.

**Comment policy (binding, DNC #11 amendment):** replies stay in-thread. A reply may be reposted only with explicit logged permission, verbatim, framed as "a reply to this week's prompt" — never as an endorsement. When in doubt, don't repost.

---

#### R3 — Reel · "Your list, your rules" (Week 6 · Thu Sep 10 · from TikTok C6)

**IG edit:** 28s. Settings shown on iPhone only — app lock and screen-adjacent claims are native-scoped (claims #13 guidance).

| Time | Screen | VO / burned-in text |
|---|---|---|
| 0–1.5s | Buddy list, closed like a wallet | "This app assumes you don't want everyone in your business." |
| 1.5–8s | The loop, fast: consented room conversation → tap a screenname → profile sheet → buddy request sent → accepted → new buddy-list row (founder + one consenting seed member; real request, real accept; consent logged) | "Meet in a room. Actually talk. Then add him. Your buddy list is people you've actually met — nobody's inventory." |
| 8–12s | Settings: read-receipts toggle flipped off on camera | "Read receipts in DMs — with an off switch." |
| 12–17s | Settings: notification-preview modes; linger on name-only marked as default | "Previews default to sender-only. Message text never hits your lock screen unless you choose." |
| 17–21s | Settings: app lock — PIN + Face ID toggle (iPhone) | "Face ID app lock on iPhone." |
| 21–25s | Long-press → report sheet; profile sheet showing Block + Report (demo on the founder's own test content) | "Block and report on every profile, every message, every room. Every report is reviewed." |
| 25–28s | End card: "Friendship first." · hiitsme.app · 18+ | "Your screenname, your status, your people. Your list, your rules." |

**Caption:**
> A gay friendship app that treats privacy like a feature: read receipts with an off switch, notification previews that keep message text off your lock screen (that's the default), Face ID app lock on iPhone, block + report on every profile, every message, every room — and every report is reviewed. No swiping. No radar. No grid. Save this for the privacy-alert friend. 18+ · link in bio
> #gayfriendship #privacy #friendshipapp

**Cover alt text:** Phone settings screen in dark mode showing a read-receipts toggle switched off, framed by a cream border with the H.I.M. wordmark.

---

### Carousels (designed for saves + sends; alt text per slide)

---

#### CA — Carousel · "Built different by design." (Week 1 · Fri Aug 7 · 7 slides)

| Slide | Copy (on-card) | Alt text |
|---|---|---|
| 1 | **A social app for gay men built for friendship.** (wordmark + amber pip) | Cover card on deep indigo: "A social app for gay men built for friendship." in cream type, H.I.M. wordmark with a small amber dot. |
| 2 | **No swiping.** | The words "No swiping." in large amber monospace type on a deep indigo background. |
| 3 | **No radar.** — nothing detects where you are. Rooms are chosen, never detected. | "No radar." in amber monospace with a smaller cream line: nothing detects where you are. |
| 4 | **No grid.** — you're a screenname here, not a photo in a wall of photos. | "No grid." in amber monospace with a smaller cream line about being a screenname, not a photo. |
| 5 | **What's here instead:** a screenname that's yours. An away message that says what you're up to. A buddy list of people you actually know. | Cream card listing three things in walnut-brown type: a screenname that's yours, an away message that says what you're up to, a buddy list of people you actually know. |
| 6 | **Seven rooms where conversation happens out loud:** New York City · Los Angeles · Chicago · Atlanta · Everywhere Else · Late Night · Sunday Reset | Cream card listing seven chat room names, with a small amber pip beside each. |
| 7 | **H.I.M. — Friendship first.** On the App Store and at hiitsme.app · 18+ | Closing card on indigo: H.I.M. — Friendship first. On the App Store and at hiitsme.app. 18+. |

**Caption:**
> A social app for gay men built for friendship. Not a dating app — there's nothing here that swipes, detects, or ranks you. Just a screenname, an away message, a buddy list, and seven rooms where people are actually talking. Save this for the friend who keeps saying "I just want gay friends." Link in bio. 18+
> #gayfriendship #makingfriendsasanadult #lgbtq

---

#### CB — Carousel · Room tour: "That's the whole map." (Week 3 · Tue Aug 18 · 9 slides)

Room descriptions quoted verbatim from the shipped rooms (claims #1). Slides 2–8 pair each room name with its real blurb plus one line of brand voice.

| Slide | Copy (on-card) | Alt text |
|---|---|---|
| 1 | **There are exactly seven rooms. That's the whole map.** | Cover card on indigo: "There are exactly seven rooms. That's the whole map." in cream type with the H.I.M. wordmark. |
| 2 | **New York City** — "The city that never sleeps." Say hi and drop which borough you're repping. | Room card for New York City with its description, "The city that never sleeps." |
| 3 | **Los Angeles** — "West Coast vibes, sun and screens." | Room card for Los Angeles with its description, "West Coast vibes, sun and screens." |
| 4 | **Chicago** — "Chi-town. The Second City. Our kind of town." | Room card for Chicago with its description, "Chi-town. The Second City. Our kind of town." |
| 5 | **Atlanta** — "ATL forever." | Room card for Atlanta with its description, "ATL forever." |
| 6 | **Everywhere Else** — "Not NYC, LA, Chicago, or ATL? This is your room." The room for everyone the map forgot. | Room card for Everywhere Else with its description, "Not NYC, LA, Chicago, or ATL? This is your room." |
| 7 | **Late Night** — "For the night owls. No judgment." Awake when you are. | Room card for Late Night with its description, "For the night owls. No judgment." |
| 8 | **Sunday Reset** — "Prep, reflect, recharge. See you Monday." | Room card for Sunday Reset with its description, "Prep, reflect, recharge. See you Monday." |
| 9 | **You pick your room. Nothing detects where you are.** hiitsme.app · 18+ | Closing card: "You pick your room. Nothing detects where you are." with hiitsme.app and 18+. |

**Caption:**
> There are exactly seven rooms. That's the whole map. Four cities, one room for everyone the map forgot, one for the night owls, one for planning the week from the sofa. You pick your room — nothing detects where you are. No radar, no grid. Say which one's yours in the comments, then come say hi in it. Link in bio. 18+
> #gayfriendship #newintown #makingfriendsasanadult

---

#### CC — Carousel · "Your list, your rules." (Week 6 · Tue Sep 8 · 7 slides)

| Slide | Copy (on-card) | Alt text |
|---|---|---|
| 1 | **This app assumes you don't want everyone in your business.** | Cover card on indigo: "This app assumes you don't want everyone in your business." in cream type. |
| 2 | **The whole loop:** meet in a room → actually talk → add him. Your buddy list is people you've actually met. | Card showing a three-step loop in monospace type: meet in a room, actually talk, add him. |
| 3 | **Read receipts in DMs — with an off switch.** | Card with an illustrated toggle in the off position and the words "Read receipts in DMs — with an off switch." |
| 4 | **Notification previews default to sender-only.** Message text never hits your lock screen unless you choose. | Card stating notification previews default to sender-only, with a small lock-screen-style banner showing only a sender name. |
| 5 | **Face ID app lock on iPhone.** PIN too, if that's more your speed. | Card with "Face ID app lock on iPhone" in cream type on indigo. |
| 6 | **Block + Report on every profile, every message, every room.** Every report is reviewed. | Card stating Block and Report are on every profile, message, and room, and that every report is reviewed. |
| 7 | **Your screenname, your status, your people. Your list, your rules.** hiitsme.app · 18+ | Closing card with the line "Your screenname, your status, your people." plus hiitsme.app and 18+. |

**Caption:**
> This app assumes you don't want everyone in your business. Read receipts you can turn off. Notification previews that keep message text off your lock screen — that's the default, not a buried setting. Face ID app lock on iPhone. Block and report on every profile, every message, every room, and every report is reviewed. Your screenname, your status, your people. Save this one. 18+ · link in bio
> #gayfriendship #privacy #friendshipapp

---

### Statics (status cards built to be screenshotted and sent)

---

#### S1 — Static · Sunday away-message card (Week 2 · Sun Aug 16, ~6pm ET)

**Card (status-card family):** midnight indigo ground; amber monospace headline styled as a typed away message with cursor:

> your away message for a Sunday you refuse to leave the house:
> ~~grabbing coffee (it's 4pm)~~
> ~~planning the week I will not have~~
> **doomscrolling▌**

Small wordmark + pip, `hiitsme.app · 18+` in the corner. (All example messages are brand-authored in the shipped register — no member content.)

**Caption:**
> It's Sunday. The house is winning. Drop your away message in the comments — in the app, your buddies actually see it. Status as self-expression, the way it used to be. The Sunday Reset room is planning the week from the sofa right now-ish. 18+ · hiitsme.app, link in bio
> #awaymessage #sundayreset #gayfriendship

**Alt text:** Dark card styled like a typed status message. Two crossed-out away messages — "grabbing coffee (it's 4pm)" and "planning the week I will not have" — above the final choice, "doomscrolling," with a blinking cursor.

**Timing note:** posts the same evening the in-app Sunday Reset thread opens (strategy §7.2), so the CTA lands in a warm room.

---

#### S2 — Static · "New city, no crew." (Week 4 · Tue Aug 25)

**Card (daylight family):** warm cream ground, walnut-brown type, amber accent:

> **Just moved?**
> Contacts list: coworkers and exactly one landlord.
> The city rooms are where you say hi before you owe anyone a face.
> Not in NYC, LA, Chicago, or ATL? **Everywhere Else is your room.**
> H.I.M. · hiitsme.app · 18+

**Caption:**
> Just moved? Contacts list full of coworkers and exactly one landlord? The city rooms are where you say hi before you owe anyone a face — you pick your room, nothing detects where you are. And if your city isn't NYC, LA, Chicago, or Atlanta: Everywhere Else is the room for everyone the map forgot. Send this to the friend who just moved. 18+ · link in bio
> #newintown #gayfriendship #makingfriendsasanadult

**Alt text:** Warm cream card reading "Just moved? Contacts list: coworkers and exactly one landlord. The city rooms are where you say hi before you owe anyone a face." with the H.I.M. wordmark and 18+.

---

#### S3 — Static · Late Night card (Week 5 · Wed Sep 2, posted ~11pm ET)

**Card (status-card family):** near-black indigo, single glowing amber pip, monospace:

> **"For the night owls. No judgment."**
> — the Late Night room, one of seven
> awake when you are · hiitsme.app · 18+

**Caption:**
> Posting this at 11pm on purpose. "For the night owls. No judgment." — that's the actual room description. If you're up, the Late Night room is too. People check in throughout the night; come say hi. 18+ · link in bio
> #gayfriendship #friendshipapp #nightowls

**Alt text:** Nearly black card with one small glowing amber dot and the quote "For the night owls. No judgment." attributed to the Late Night room.

**Timing note:** week 5's late-night posting window mirrors the in-app ritual (strategy §6 week 5, §7.2). Real timestamp — never fake a time of day.

---

## 6. Stories cadence + interactive formats

**Cadence: 4–5 story days/week**, batched alongside the feed templates. Stories are where the participation mechanics live; the feed is where the forwardable objects live.

### Weekly rhythm

| Day | Story | Interactive format |
|---|---|---|
| Tue | Feed-post amplification: share the day's post + link sticker (`utm_source=instagram&utm_medium=stories&utm_campaign=porchlight-q3`) | Link sticker into hiitsme.app |
| Wed | "Which room are you tonight?" | **Poll**, rotating pairs: Late Night vs Sunday Reset · "your city's room" vs Everywhere Else. Room choice is self-selection by design — never "where are you?" |
| Thu | Ship-note mirror of the Thursday waitlist drop (strategy §5.7): one screenshot of what shipped or one honest founder line | Emoji slider ("how retro is this feature, 1 pip to 5 pips") |
| Fri | **"Set your away message" prompt:** "Your away message for this weekend — type it." | **Question sticker.** Replies are shared to story only if they contain no identifying info; shared verbatim; framed as "replies to this week's prompt," never as endorsements (DNC #11 amendment). Instagram anonymizes question-sticker reshares by default; we still screen every reply before sharing. |
| Sun ~5pm ET | Sunday Reset runway: "The week-planning thread opens at 6." | **Countdown sticker** to the in-app Sunday Reset thread (strategy §7.2), then an evening share of the week's Sunday card |

**Recurring extras:** week 2 onward, a Tuesday this-or-that poll in the away-message register ("doomscrolling" vs "finally cleaning my apartment"); week 3 (Room Tour), one room card per day to stories with its verbatim blurb; week 5, a late-night story posted inside the 11pm–1am window.

### Interactive-format guardrails (binding)

- **Never** the location sticker, "add yours" photo chains, face-reveal prompts, or any mechanic that pressures identity or place disclosure (brand brief §2 rule 6; strategy non-goal #9). Polls ask which **room**, never which city you're *in* — rooms are chosen, not detected.
- Question-sticker replies containing a name, face, handle, workplace, or precise location are never reshared, even with permission — screen first, share second.
- No quiz/poll ever implies member counts or activity levels ("how many people are online" is banned — DNC #10). A playful quiz like "how many rooms are there? (hint: it's the whole map)" is fine; honest smallness is the brand.
- Members are never asked to drop their own screennames publicly; if someone volunteers theirs in a reply, we don't amplify it (claims register #24 guidance).
- Every story capture of the app obeys the §1.2 consent guardrail.

---

## 7. Hashtag system

Instagram ranks captions and covers above tags; hashtags are a light assist. **3–5 per post**, assembled as **1 broad + 1–2 niche + 1–2 community/brand**:

| Pool | Tags |
|---|---|
| **Broad** (reach, pick 1) | #lgbtq #gay #queer |
| **Niche** (intent, pick 1–2) | #gayfriendship #friendshipapp #makingfriendsasanadult #newintown #gayfriends #platonicfriendship |
| **Community/brand** (format + culture, pick 1–2) | #awaymessage #sundayreset #nightowls #newstalgia #buildinpublic #indieapp |

**Never:** #datingapp, #gaydating, or any dating-adjacent tag (brand brief §2 rule 3); no competitor-name tags; no legacy-IM trademark tags (DNC #9); no city tags paired with language implying we detect location.

---

## 8. Collab + UGC guardrails (FTC-consistent)

Scope per strategy §5.8: micro-creators (10K–100K), gifted access and genuine relationships only — no paid placements, no contracts, no scripted reads (non-goal #3).

1. **Material connection = disclosure. Always.** Early access, gifts, or any thank-you of value (even coffee money, strategy §8) is a material connection under FTC guidance. Creators must disclose clearly and conspicuously: Instagram's Paid Partnership label where available, plus a plain-language first-line disclosure ("gifted early access") — never buried in hashtags, and spoken aloud in Reels, not just written.
2. **We brief facts, not scripts.** The creator brief (a document we control — brand brief §7.1 applies: no AOL/AIM/ICQ marks in it) contains: the approved-claims one-pager (from `claims-register.md`), the banned-vocabulary list (§1.4), the 18+ line, and the capture checklist. The creator's opinions, words, and edit are their own. If a creator won't disclose, we don't work with them.
3. **Capture checklist for creators:** real UI only; blur/crop every screenname that isn't theirs or a consenting member's; never show DM content; never show credential entry; never claim features off the approved list (the one-pager is exhaustive for them).
4. **Collab posts** (Instagram co-author feature) are allowed with disclosed creators — disclosure obligations unchanged.
5. **No paid amplification of creator content** — no boosting, no whitelisting/allowlisting (Meta $0, strategy §8).
6. **UGC reposting follows the DNC #11 amendment, exactly:** explicit permission for the specific repost, permission logged (DM screenshot or message reference in the tracker), words unedited and unparaphrased, framed as "a reply to this week's prompt" — never as a review, testimonial, or "users love it" endorsement. No composites, no paraphrases, no invented quotes, ever.
7. **Outing protection overrides permission.** Even with consent, we don't repost content that would broadcast a member's presence in a gay app alongside identifying info; the norm we model is cropping others' screennames (strategy §5.1). Creators posting themselves using the app are exercising their own choice about their own identity — that's theirs to make, never ours to require.
8. **Target:** 3–5 genuine creator relationships by flight end; zero is acceptable, forced content is not (strategy §5.8).

---

## 9. KPIs — tied to baseline-audit measurement sources

Primary win conditions remain the campaign objectives (strategy §3). Channel KPIs below are secondary; each names its measurement source from `baseline-audit.md` §3.2 where one exists. **Attribution honesty (baseline audit §4, restated):** no install attribution and no UTM-to-signup capture exist, so Instagram's effect on installs/signups is read by triangulation only — ASC source-type buckets + referrer domains, Vercel UTM aggregates, and timing correlation against the content calendar. The weekly scorecard states this limitation rather than inventing precision.

| KPI | Target (by Sep 13) | Measurement source |
|---|---|---|
| Feed posts shipped | **≥18** (3/wk floor held all 6 weeks; 9 flagship + repurpose/re-arm slots) | Manual content log appended to `reporting/weekly-scorecard.md` (strategy §9) |
| Story days | **≥4/week** with at least one interactive sticker | Manual content log in the weekly scorecard |
| Sends per post (the channel's currency, strategy §5.2) | Every flagship post's send count logged; **≥3 posts reach ≥15 combined sends+saves**; sends-per-reach trend improves across the two phase-gate windows | Instagram Insights (per-post shares/saves) — *not in the baseline-audit inventory*, so screenshot weekly into the scorecard for durability (audit gap 5 mitigation) |
| Saves on carousels | **CA, CB, CC each reach ≥8 saves** by flight end (save-worthiness is the design brief for carousels) | Instagram Insights, screenshot-logged as above |
| Prompt participation | Away-message question sticker or prompt post draws **≥10 replies/comments per arm** from week 3 onward (the S0 seed community alone can carry this — that's the point) | Instagram Insights + manual count in the scorecard |
| Campaign web traffic from Instagram | **≥1,200 pageviews on hiitsme.app with `utm_source=instagram`** across the flight (≈20% of O8's 6,000; bio link + story link stickers, split by `utm_medium=social` vs `stories`) | Vercel Web Analytics — pageviews + UTM breakdowns (baseline audit §3.2-C) |
| Store-referrer signal | `instagram.com` / `l.instagram.com` appear among ASC top referring domains in the Web Referrer source bucket (directional; no absolute target — first flight with data, same posture as O9) | App Store Connect — downloads by source type + top referring domains (baseline audit §3.2-A) |
| Timing correlation | Signup deltas within 48h of any breakout post, logged (correlation evidence only, per the attribution-honesty rule) | Supabase SQL — `public.users.created_at` daily counts (baseline audit §3.2-D) read against the content calendar |
| Room-landing effect | Message + membership upticks in the specific room each flagship post pointed at (supports O5; no channel-level numeric target) | Supabase SQL — `room_messages.created_at` by `room_id`, `room_memberships.joined_at` (baseline audit §3.2-D) |
| Explicit non-KPIs | Followers, likes, reach — logged, never targeted (strategy non-goal #2; Meta reach is bonus per §5.2) | — |

**Reporting:** all of the above roll into the Monday weekly scorecard (strategy §9); format kill/double verdicts land at the Aug 17 and Aug 31 phase gates. If Meta suppression is suspected (trend research §e), it's logged as an observation, not compensated with spend.

---

## Appendix — Claims used

Every product claim relied on in this plan, mapped to `strategy/claims-register.md` APPROVED numbers. No claim outside this list appears in any card copy, script, caption, alt text, or story format above.

| Register # | Claim as used here | Where used |
|---|---|---|
| #1 | 7 chat rooms — New York City, Los Angeles, Chicago, Atlanta, Everywhere Else, Late Night, Sunday Reset; seeded descriptions quoted verbatim ("The city that never sleeps." · "West Coast vibes, sun and screens." · "Chi-town. The Second City. Our kind of town." · "ATL forever." · "Not NYC, LA, Chicago, or ATL? This is your room." · "For the night owls. No judgment." · "Prep, reflect, recharge. See you Monday.") | R1, CA slide 6, CB (all slides), S1, S2, S3, stories polls + Room Tour week stories |
| #2 | Screenname-first identity — no real name, not photo-first ("a screenname that's yours"; "you're a screenname here, not a photo in a wall of photos"; "say hi before you owe anyone a face") | R1, CA slides 4–5, S2 |
| #3 | Away messages + status with custom text ("set an away message so your buddies know what you're up to"; brand-authored examples "doomscrolling," "finally cleaning my apartment," typed in the real composer) | R1, R2, S1, Friday question-sticker prompt, Tuesday polls |
| #4 | Buddy list of people you've actually met; buddy request → accept loop shown live (real request, real accept) | R1, R3, CA slide 5, CC slide 2 |
| #7 | Buzz — DM-only nudge with shake animation ("buzz him"); staged per the consent guardrail | R2 |
| #9 | Read receipts in DMs — with an off switch | R3, CC slide 3 |
| #12 | Notification previews default to sender-only; message text never on the lock screen unless chosen | R3, CC slide 4 |
| #13 | Face ID app lock — iPhone copy only, shown on iPhone (PIN mentioned as shipped alternative) | R3, CC slide 5 |
| #15 | Block + Report on every profile, every message, every room; "every report is reviewed" (no SLA, no "team" — DNC #3/#4 respected) | R3, CC slide 6 |
| #21 | Available on the App Store and at hiitsme.app | All captions/end cards |
| #22 | Absence claims — no swipe mechanic, no proximity/location radar, no photo-first grid; rooms chosen, never detected | R1, R3, CA slides 2–4, CB slide 9, S2, captions |
| #23 | 18+ | Every caption and closing card (rule §1.5) |

**Approved brand language used (brand brief §6 Tier 1–3 + §2 examples — brand copy, not product claims):** "Friendship first." · "Your screenname, your status, your people." · "Not a hookup app." · "A social app for gay men built for friendship." · "Built different by design." · "status as self-expression, the way it used to be" · "the things that made the early internet feel like home" register ("a screenname that's yours…") · "It's back — and this time it's ours." (§2 example) · "People check in throughout the day/night" (LD §E.7 register) · "say hi and drop which borough you're repping" (LD §E.3 register).

**DNC compliance notes:** no encryption language (DNC #1); no data-export overclaims (DNC #2 — export not referenced at all); no AI/team/SLA moderation language (DNC #3, #4); DM-only features scoped to DMs (DNC #5); no Android mention (DNC #6); no invite-link copy (DNC #7); no "anonymous" (DNC #8); no legacy-IM trademarks in any element including alt text and tags (DNC #9); no user counts, live counts, or fabricated activity (DNC #10); no testimonials — prompt replies handled per the DNC #11 amendment; no "works offline" (DNC #12); no dating positioning (DNC #13).

---

*Instagram channel plan · OPERATION PORCH LIGHT · H.I.M. Q3 2026 · Saman Technologies LLC (internal)*
