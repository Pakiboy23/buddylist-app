# Google Play Store Listing — H.I.M. (hiitsme)

**Package:** `com.hiitsme.app`
**Prepared:** 2026-06-26
**Status:** Draft — ready to paste into Play Console → Grow → Store presence → Main store listing
**Voice note:** App-facing copy intentionally uses the broadened "friendship-first" framing per commit #60 (`chore(copy): drop "gay men" from app-facing copy`). The internal GTM kit (`him-gtm-kit.md`) keeps the "for gay men" positioning for strategy/press only — do **not** paste that framing into the public Play listing. Override deliberately if you want a narrower public framing.

---

## Quick reference (field-by-field)

| Field | Value |
|---|---|
| App name (≤30 chars) | `H.I.M. — Friendship First` (25) |
| Short description (≤80 chars) | `A friendship-first social app: screennames, status, buddy lists & rooms.` (72) |
| Category | Social |
| Tags | Social, Communication |
| Contact email | s.haarisshariff@gmail.com |
| Website | https://hiitsme.app |
| Privacy policy URL | https://hiitsme.app/privacy |
| Content rating | High maturity / 17+ (see §Content rating) |
| Ads | No ads |
| In-app purchases | None |
| Data safety | See `docs/compliance/google-play-data-safety.md` |

### App name alternatives (pick one, ≤30 chars)
- `H.I.M. — Friendship First` (25) ← recommended
- `H.I.M. — Social & Friends` (25)
- `H.I.M.: Hi, It's Me` (19)

---

## Short description (≤80 chars)

```
A friendship-first social app: screennames, status, buddy lists & rooms.
```

(72 characters)

---

## Full description (≤4000 chars)

```
H.I.M. — Hi, It's Me.

A social app built around friendship, not hookups. No swipe mechanics, no match queue, no endless feed — just a real social layer for your actual life.

H.I.M. brings back what online social used to feel like: a screenname that's actually you, a status that tells your people where you're at, a buddy list of the connections you actually want, and rooms full of conversations already in progress. It's the spirit of classic instant messaging, rebuilt for how people want to connect today.

WHAT MAKES IT DIFFERENT

• Your screenname, not your selfie. Pick a name that represents you — your vibe and your personality come first, before anyone sees a photo.

• Your status. Online, away, busy, back later — a real social signal that tells your buddies where you're at in real time, without a single message.

• Your buddy list. The people you actually want to hear from, organized and present. No algorithm deciding who you see. Your list, your connections.

• Chat rooms. Join rooms for topics, moods, cities — whatever you're into. Find your people before you ever send a DM.

• Direct messages. Real one-to-one conversations with read receipts, photo and voice messages, and reactions.

BUILT FOR FRIENDSHIP

H.I.M. is a friendship-first community — not a dating or hookup app. It's for finding people to talk to when you've moved somewhere new, when you're bored on a Tuesday, or when you just want a social space that feels personal again. Everyone is welcome.

PRIVACY THAT RESPECTS YOU

• Notification privacy controls: choose whether message previews show full text, sender name only, or stay hidden.
• Block and report on every conversation surface.
• One-tap account deletion that permanently erases your data.
• No ads. No advertising IDs. We don't sell your data.

H.I.M. is rated for users 17 and older.

Questions or support: s.haarisshariff@gmail.com
Privacy policy: https://hiitsme.app/privacy
```

> Note: keep the full description under 4000 characters. The block above is ~1,750 characters, leaving room if you want to expand features or add testimonials later.

---

## "What's new" (release notes template)

```
First Google Play release! H.I.M. brings screennames, away statuses, buddy lists, and chat rooms to Android — a friendship-first social app with the spirit of classic instant messaging. Thanks for being early.
```

---

## Graphics checklist (Play Console requirements)

| Asset | Spec | Status / location |
|---|---|---|
| App icon | 512×512 PNG (32-bit, alpha) | Derive from `assets/brand/him-app-icon-hi-1024.png` (resize to 512). |
| Feature graphic | 1024×500 PNG/JPG (required) | Generated → `screenshots/play-store/feature-graphic.png` (`npm run play:feature-graphic`). |
| Phone screenshots | 2–8, PNG/JPG, 16:9 or 9:16, 320–3840px/side, longest:shortest ≤ 2:1 | Generated → `screenshots/play-store/phone/` (`npm run play:screenshots`). |
| 7" tablet screenshots | optional | Generated → `screenshots/play-store/tablet-7/` |
| 10" tablet screenshots | optional | Generated → `screenshots/play-store/tablet-10/` |

> The iOS App Store screenshots (1290×2796) exceed Play's 2:1 aspect-ratio cap and will be rejected — use the Android-sized set in `screenshots/play-store/`.

---

## Content rating (IARC questionnaire notes)

Answer the Play Console rating questionnaire truthfully. H.I.M. is a social/communication app with **unrestricted user-to-user communication and user-generated content**, which places it at the higher maturity tier (typically "Mature 17+" in North America / PEGI 16–18 / IARC equivalent). Key answers:

- **Users can interact / communicate:** Yes (DMs, rooms).
- **User-generated content shared with others:** Yes (messages, photos, voice notes, profile content).
- **Content moderation:** Server-side profanity/harm filter (DB trigger) + block/report on all surfaces.
- **Shares user location:** No precise location collected/shared.
- **Digital purchases:** No.
- **No gambling, no violence, no controlled-substance content features.**

This matches the app's existing 17+ rating on the App Store.

---

## Pre-publish checklist (App content section)

- [ ] Privacy policy URL set: https://hiitsme.app/privacy
- [ ] Data safety form completed (source: `docs/compliance/google-play-data-safety.md`) — **requires legal sign-off**
- [ ] Content rating questionnaire completed (see above)
- [ ] Target audience: 18+ (or 17+ where supported); not directed at children — does **not** follow Families Policy
- [ ] Ads declaration: contains no ads
- [ ] Government app: No
- [ ] Financial features: None
- [ ] Health: None
```
