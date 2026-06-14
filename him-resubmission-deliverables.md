<!--
Generated 2026-06-08. Companion: him-resubmission-review.md.
[FIX FIRST] items from the original review are now APPLIED in code (Pro badges, 17->18, room blurbs,
friendship line, roster Block/Report). App Store Connect items (review notes, age-rating answers,
nutrition labels) must be entered by you in ASC.
-->

# H.I.M. — App Store Resubmission Deliverables (Build 179)

---

## (A) App Review Notes — paste into App Store Connect → "Notes for Review"

```
H.I.M. ("Hi, It's Me") — Saman Technologies LLC

=== WHAT THIS APP IS ===
H.I.M. is a FRIENDSHIP-FIRST social/messaging app for gay men, built around a
retro AIM/BuddyList aesthetic (buddy list, away messages, topic-based chat rooms,
and DMs). It is NOT a dating app and NOT a hookup app. There is deliberately:
  - NO swipe deck, match/like-pass, or "hot-or-not" mechanic
  - NO geolocation, proximity, "people nearby," or distance display
  - NO random or anonymous pairing / Chatroulette-style stranger matching
The core loop is: join a NAMED, PERSISTENT chat room (7 seeded regional + interest
rooms) -> have a conversation -> build a lasting buddy list. DMs require an accepted
buddy connection. Every user has a stable, persistent screenname; no one is anonymous.

=== DEMO ACCOUNT ===
Screenname:  <REVIEW_USER_A>
Password:    <REVIEW_USER_A_PW>
Second account (pre-connected as a mutual buddy, for testing DMs/rooms):
Screenname:  <REVIEW_USER_B>
Password:    <REVIEW_USER_B_PW>
Note: the two demo accounts are seeded as mutual buddies so you can DM freely without
hitting the new-contact rate limit. Both have already joined several rooms.

=== GUIDELINE 1.2 — UGC TRUST & SAFETY (all four pillars present) ===
(a) FILTER: A server-side BEFORE INSERT + BEFORE UPDATE database trigger screens all
    text in DMs and room messages against a ~700-term profanity list before it is
    stored; flagged content is hidden from recipients at render time and replaced with
    a placeholder. A client-side mirror provides immediate feedback.
(b) REPORT: A Report action is available on every user-content surface — DM messages
    (long-press), room messages (long-press), and every profile sheet (including the
    room member roster). Reports are written to an abuse_reports table with an
    open/actioned workflow status.
(c) BLOCK: A Block action is available on the same surfaces. Blocking is enforced
    bidirectionally at the database (RLS) layer across DMs, buddy lists, and room
    messages — a blocked user's content is not returned to the blocker and vice versa.
(d) CONTACT: Published developer contact is support@hiitsme.app, reachable in-app via
    the Terms and Privacy links and on our public site (hiitsme.app/terms, /privacy).
EULA / COMMUNITY STANDARDS: Our Terms include an explicit ZERO-TOLERANCE policy for
    objectionable content and abusive behavior, naming Saman Technologies LLC as
    operator, presented and accepted at signup before account creation.

=== HOW WE ACT ON REPORTS (within 24 hours) ===
Reports and auto-flagged content land in our moderation queue. Our moderation team
reviews new reports and flagged content and takes action (content removal, warning,
or account termination) with a target response time of 24 hours. Repeat offenders are
removed. Termination appeals can be sent to support@hiitsme.app.

=== ACCOUNT DELETION (5.1.1(v)) ===
Fully in-app and self-service: Settings -> Account -> "Delete account" -> a two-step
confirmation -> server-side erasure of the user's data across all tables, then deletion
of the auth account. A data-export option is also provided.

=== AGE RATING / AGE ASSURANCE ===
H.I.M. is an adults-only (18+) social app. Account creation requires an affirmative
age attestation at signup (18+), and our Terms restrict use to adults 18 and older. We
rely on Apple's account-level Declared Age Range signal for platform-level age
assurance (including Texas SB 2420) rather than collecting government ID or date of
birth, minimizing the personal data we hold.

=== LOGIN REQUIREMENT (5.1.1(v) exception) ===
Login is required because the core functionality IS the social network (a genuine
social graph: buddy list, DMs, persistent rooms). We offer NO third-party social login
(no Sign in with Apple/Google/Facebook), so Guideline 4.8 does not apply.

=== PRIVACY ===
Privacy Policy is reachable in App Store Connect AND in-app at registration and in
Account -> Legal. We use no third-party analytics, crash, or advertising SDKs and do
no tracking. We collect Sensitive Info (membership of an LGBTQ+ community can reveal
sexual orientation) with explicit consent at signup; this is reflected in our nutrition
labels.

Thank you for reviewing. Questions: support@hiitsme.app
```

> The "no random/anonymous chat" and "friendship, not dating" claims are now consistent with the binary — the dating-register room blurbs and the three "Pro" badges were removed on branch `resubmit/appstore-2026-fixes`.

---

## (B) Age-Rating Questionnaire Answers (current granular 4/9/13/16/18+ system)

The honest output for unfiltered adult user-to-user communication on a gay social app is **18+**. In-app + Terms copy is now reconciled to 18.

| Questionnaire dimension | Answer | Why |
|---|---|---|
| Cartoon/Fantasy Violence | None | No game/violence content. |
| Realistic Violence | None | — |
| Sexual Content or Nudity | **Infrequent/Mild** | App prohibits pornographic content + filters text, but unmoderated user media/voice in adult DMs means you cannot answer "None." |
| Profanity or Crude Humor | **Infrequent/Mild** | Server-side filter exists, but UGC can still contain it. |
| Alcohol, Tobacco, Drug Use/References | Infrequent/Mild | Possible in free-text UGC. |
| Mature/Suggestive Themes | **Frequent/Intense** | Adult LGBTQ social context; "vibe" rooms + open DMs. |
| Horror/Fear, Gambling, Contests | None | Not present. |
| Unrestricted Web Access | **No** | Not a web browser. |
| **User-Generated Content / Messaging** | **Yes — unrestricted** | Real-time DMs, rooms, user media, voice notes. The load-bearing answer. |
| Age verification present? | **Declared age only** | Self-attestation at signup + Apple account age signal; no DOB/ID. |

**Resulting rating: 18+.** Justification: "Unrestricted user-to-user messaging and user-uploaded media in an adults-only LGBTQ social context with frequent mature/suggestive themes. Text is filtered server-side; block/report on every surface; the UGC nature and adult positioning warrant 18+."

---

## (C) Privacy Nutrition-Label Mapping (+ PrivacyInfo.xcprivacy reconciliation)

Cross-checked `docs/compliance/apple-app-privacy.md` against `ios/App/App/PrivacyInfo.xcprivacy`. **No data type used for Tracking.** No third-party analytics/crash/ad SDKs.

| ASC Data Type | Collect? | Linked? | Tracking? | Purpose | In manifest? |
|---|---|---|---|---|---|
| Name | Yes | Yes | No | App Functionality | ✅ |
| **Email Address** | **reconcile** | — | — | — | ⚠️ present in manifest; ASC says No → **set both to Yes (optional recovery email)** |
| **Coarse Location** (IP) | **reconcile** | — | — | — | ⚠️ ASC says Yes; manifest omits → recommend **omit from ASC too** (app never reads location; Supabase logs IP at network layer) |
| Sensitive Info → Sexual Orientation | Yes | Yes | No | App Functionality | ASC-only (no xcprivacy enum) ✅ |
| User Content → Text / Photos/Videos / Audio | Yes | Yes | No | App Functionality | ✅ |
| Identifiers → User ID / Device ID (APNs) | Yes | Yes | No | App Functionality | ✅ |
| Usage Data → Product Interaction | Yes | Yes | No | App Functionality / Analytics | web-only (Vercel Analytics gated off native) |
| Everything else (Health/Financial/Precise Loc/Contacts/Browsing/Purchases/Diagnostics) | No | — | — | — | not declared (correct) |

**Three manifest actions:** (1) **Add `PrivacyInfo.xcprivacy` to the App target** so it ships (it's currently not in the Xcode project — `grep -c` = 0). (2) Reconcile **Email = Yes (optional recovery email)** in manifest + ASC. (3) Reconcile **Coarse Location** (recommend omit from both). Manifest and ASC must agree.

---

## (D) Texas SB 2420 Implementation Plan

**Current state:** none of the four Apple APIs wired up (grep = 0). **NOT a review reject** (Apple: "no changes to the App Review process") — it is a **US legal-distribution obligation**.

**Recommended posture (swift launch):** rate **18+** (done), keep the declared-age checkbox (now "18 or older"), and **rely on Apple's account-level Declared Age Range signal** for age assurance — stated explicitly in the review notes (§A). Strip the published LEGAL-REVIEW comment at `terms.html` conceding the gap.

**Fast-follow native build (post-approval), in priority order:**
| Step | API | Action | Effort |
|---|---|---|---|
| 1 | **Declared Age Range API** | Thin Swift bridge (alongside `HiItsMeShellPlugin`) reading Apple's account age band; refuse a declared-under-18 category at signup. Closes SB 2420 + Guideline 1.2.1(a). Persist the band next to `age_confirmed_at`. Needs iOS 26.2+ SDK. | Medium |
| 2 | **StoreKit `AppStore.ageRatingCode`** | Read at runtime (works without IAP). | Low |
| 3 | **PermissionKit `SignificantAppUpdateTopic`** | Only when you ship a "significant change" needing re-consent. | Defer |
| 4 | **App Store Server Notifications** | Endpoint that disables an account on consent withdrawal. Low-volume with an 18+ gate. | Low/Defer |

Consult counsel to confirm SB 2420 obligations + what constitutes a "significant update."

---

## (E) Listing & In-App Copy (friendship, not dating) — in-app side ✅ applied

**App Store Connect metadata (your side):**
- **Primary Category:** Social Networking (NOT Lifestyle, NOT Dating).
- **Name / Subtitle:** lead with friendship — e.g. `H.I.M. — Friends, Not Dates`.
- **Keywords:** the friendship-first string from `him-launch-deliverables.md` (omits date/dating/hookup/match/meet/single/nearby/flirt).
- **Screenshots:** buddy list, away messages, chat rooms — **no** profile grid / card stack / photo-browse.

**In-app copy (applied this branch):**
- ✅ Room blurbs de-romanced in `himArtDirection.ts` (flirting → recipes/debates; "hotter" → "wiser"; "emotionally available" → "always around").
- ✅ "H.I.M. is a friendship app for gay men — not a dating or hookup app" added to the signup consent line (`page.tsx`).
