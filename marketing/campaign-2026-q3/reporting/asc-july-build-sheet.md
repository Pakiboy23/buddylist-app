# ASC July Build Sheet — paste-ready metadata

**For:** the signed-off July metadata build (submit by ~Jul 31; live target Aug 3) · **Prepared:** 2026-07-15
**Sources:** `channels/app-store-optimization.md` §1.3 (keywords), §1.4 (description corrections), §5 (promotional text); `him-launch-deliverables.md` §A (baseline). Every field below was machine-verified against its ASC character limit on 2026-07-15.

**How to use:** open App Store Connect → your app → the new version. Paste each field exactly as shown. Fields marked KEEP need no touch. Then attach the screenshots (§ below) and submit with the What's New text.

---

## 1. Fields

| ASC field | Action | Chars / limit |
|---|---|---|
| App Name | **KEEP** — `H.I.M. — Friends, Not Dates` | 27/30 |
| Subtitle | **KEEP** — `Gay friendship, retro style` | 27/30 |
| Keywords | **REPLACE** with Option A below | 97/100 |
| Description | **REPLACE** with corrected text below | 2431/4000 |
| Promotional Text | **REPLACE** with v1 below on Aug 3 (v2 Aug 17, v3 Aug 31 — no build needed) | 162/170 |
| What's New | Template below | 96/4000 |

### Keywords (Option A — replaces the live string)

```
community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,group,penpal,platonic,screenname
```

Drops the name/subtitle duplicates (`gay`, `friends`, `friendship`) and `im,away,messaging`; adds `messenger,social,men,talk,group,penpal`. No dating vocabulary, no competitor names, no legacy-IM marks (standing exclusions, §1.3).

**Optional — needs your sign-off: Variant C** swaps `penpal` → `hiitsme` (98/100) so anyone typing the domain token after hearing the name gets an exact match — mitigation for the crowded HIM/Hims search results (`channels/app-store-optimization.md` §1.3 Variant C). Paste Option A **or** Variant C, not both:

```
community,chat,rooms,buddy,lgbtq,queer,messenger,social,men,talk,group,hiitsme,platonic,screenname
```

### Full Description (corrected — 4 edits vs the live listing)

Edits applied: (1) 17+ → **18+** · (2) "full copy of your data whenever you want" → **"a copy of your data anytime"** · (3) deletion line loses the absolutism ("everything erased" → **"your account and your content are deleted"**) · (4) content-filter line now matches how the filter actually works (**"before recipients see them"**). Edits 1–2 were mandated by the baseline audit; 3–4 are the claims-register precision edits proposed in §1.4 — all four are included below; strike 3–4 before pasting if you disagree.

```
H.I.M. ("Hi, It's Me") is a friendship app for gay men — not a dating app, and not a hookup app.

It's built on the things that made the early internet feel like home: a screenname that's yours, an away message that says what you're up to, a buddy list of people you actually know, and chat rooms where conversations happen out loud. No swiping. No match queue. No "people nearby." No photo-first browsing. Just talking — the way friendships actually start.

WHY H.I.M. IS DIFFERENT
Most apps for gay men are built to pair you off. H.I.M. is built to help you make friends. There is no swipe mechanic, no proximity radar, and no algorithm pushing you toward romance. You meet people in chat rooms, get to know them in conversation, and add them to your buddy list when there's a real connection.

CHAT ROOMS
Drop into regional rooms (New York City, Los Angeles, Chicago, Atlanta, and Everywhere Else) or vibe rooms like Late Night and Sunday Reset. See who's around, jump into the conversation, and meet people who share your corner of the world or your time of day.

BUDDY LIST + AWAY MESSAGES
Build a buddy list of people you've actually met in the rooms. Set an away message so your buddies know what you're up to — "grabbing coffee," "doomscrolling," "finally cleaning my apartment." It's status as self-expression, the way it used to be.

DIRECT MESSAGES
Private one-to-one conversations with the buddies you choose. Send text, photos, and voice notes. Messages queue offline and send when you're back online.

BUILT FOR SAFETY AND PRIVACY
- Block and Report on every profile, every message, every room.
- A content filter screens messages for objectionable language before recipients see them.
- Notification previews default to sender-only, so a message snippet never lands on your lock screen where someone could read it over your shoulder.
- Face ID / Touch ID app lock keeps your conversations yours.
- Delete your account anytime, in two taps — your account and your content are deleted.
- Download a copy of your data anytime.

WHO IT'S FOR
Gay men 18+ looking for friendship and community — new-in-town, starting over, between friend groups, or just tired of every app being about dating. If you've ever wished there were a place to just talk, this is it.

H.I.M. is made by Saman Technologies LLC.

Privacy Policy: https://hiitsme.app/privacy
Terms of Service: https://hiitsme.app/terms
Questions? support@hiitsme.app
```

### Promotional Text rotation (paste on the gate dates; editable anytime, no build)

| Version | Paste on | Text | Chars |
|---|---|---|---|
| v1 | **Aug 3** | `Sign on, pick a screenname, and drop into 7 rooms — New York City to Everywhere Else, Late Night to Sunday Reset. No swiping. No radar. No grid. Friendship first.` | 162/170 |
| v2 | Aug 17 | `Just moved? Say hi in the New York City, Los Angeles, Chicago, or Atlanta rooms — or Everywhere Else. You choose your room; no location radar. Friendship first.` | 160/170 |
| v3 | Aug 31 | `Up at 1am? Late Night is up too. Planning your week from the sofa? That's Sunday Reset. Set an away message, buzz a buddy, and stay a while. Friendship first.` | 158/170 |

### What's New

```
Design updates, performance fixes, and stability improvements. Thanks for being in early access.
```

---

## 2. Screenshots

**State of play (2026-07-15):** this environment has no app credentials and browser egress is sandboxed, so the authenticated frames could not be captured from the live app here. What was produced instead:

- **9 mockup placeholders** (3 devices × buddy list / DM / rooms) from `scripts/take-app-store-screenshots.mjs` — delivered to you as a zip, NOT committed (repo policy) and **not for ASC upload** (§4 production rule: real UI only). Use them to judge composition and captions.
- The script's rooms mockup was **corrected in this build**: it previously showed five nonexistent rooms with fabricated "N online" counts (DNC #10 violation); it now shows the 7 real rooms with verbatim seeded blurbs and no counts.

**To produce the real set (on your Mac, ~10 minutes):**

```bash
PLAYWRIGHT_USER_A_SCREENNAME=<seed screenname> \
PLAYWRIGHT_USER_A_PASSWORD=<password> \
node scripts/take-app-store-screenshots.mjs
```

Stage the captures per the §4 consent rules: consenting S0 seed members only, consent logged, no DM content beyond the staged frames, crop/blur anyone else.

### Caption set (overlay in your screenshot tool)

| Frame | Caption | Status |
|---|---|---|
| Rooms list | "Seven rooms. Your city or your hour." | **needs your sign-off** (new line) |
| Chat room (Late Night) | "Find your people before you even DM." | approved |
| Screenname setup | "Pick a name that's actually you." | approved |
| Away-message composer | "Your status says more than you think." | approved |
| Buddy list | "Your people, right there." | approved |
| DM with voice note | "Say it out loud — voice notes in DMs." | **needs your sign-off** (new line) |
| Buzz moment | "Buzz a buddy." | register phrasing — confirm as caption |
| Notification-preview settings | "Previews stay sender-only until you say otherwise." | **needs your sign-off** (new line) |
| App lock | "Face ID / Touch ID app lock keeps your conversations yours." | approved |
| Profile sheet | "First impression isn't your face. It's your vibe." | approved |

**Fallback (zero further sign-offs needed):** ship only the five approved captions on chat room / screenname / away message / buddy list / profile — a complete five-frame story.

### App previews (video)

`scripts/generate-app-store-previews.mjs` needs ffmpeg and the captured screenshot set — run on your Mac after the real captures if you want previews this cycle. Optional; screenshots alone are fine for the July build.

---

## 3. Submission checklist

- [ ] Real screenshots captured on Mac (or five-frame approved fallback decided)
- [ ] Caption sign-offs above resolved (or fallback)
- [ ] Fields pasted from §1; ASC char counters agree
- [ ] `npm run ios:preflight` green · version/build bumped · Archive → upload
- [ ] What's New pasted; submit for review
- [ ] On approval: confirm promo text v1 is live Aug 3 (calendar task)
