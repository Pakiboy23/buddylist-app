<!--
Generated 2026-06-07 by the him-prelaunch-review workflow. Companion: him-prelaunch-review.md.
These are ready-to-paste launch assets. App Store Connect items (listing, age-rating answers, nutrition labels)
must be entered by you in App Store Connect — they are not in the repo.
-->

# H.I.M. — Launch Deliverables

Publisher: **Saman Technologies LLC** · Bundle: `com.hiitsme.app` · Version 2.0 (Build 177)

---

## A. App Store Listing

### App Name (30 char max)
```
H.I.M. — Friends, Not Dates
```
*(27 chars. If you prefer the literal acronym expanded, alt: `H.I.M.: Hi, It's Me` — 19 chars.)*

### Subtitle (30 char max)
```
Gay friendship, retro style
```
*(27 chars. Alternates, all ≤30: `Make gay friends, not matches` (29), `A gay buddy list, reborn` (24).)*

### Promotional Text (170 char max)
```
A friendship-first space for gay men — screennames, away messages, buddy lists, and chat rooms. No swiping. No hookups. Just real conversations with people who get it.
```
*(166 chars. Editable anytime without resubmission — use it to announce seed cohorts or new rooms.)*

### Full Description

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
- A content filter screens objectionable language before it's delivered.
- Notification previews default to sender-only, so a message snippet never lands on your lock screen where someone could read it over your shoulder.
- Face ID / Touch ID app lock keeps your conversations yours.
- Delete your account anytime, in two taps, with everything erased.
- Download a full copy of your data whenever you want.

WHO IT'S FOR
Gay men 17+ looking for friendship and community — new-in-town, starting over, between friend groups, or just tired of every app being about dating. If you've ever wished there were a place to just talk, this is it.

H.I.M. is made by Saman Technologies LLC.

Privacy Policy: https://hiitsme.app/privacy
Terms of Service: https://hiitsme.app/terms
Questions? support@hiitsme.app
```

**Why this passes a skeptical 4.3 reviewer:** "friendship app... not a dating app, and not a hookup app" is the literal first line. The next paragraph explicitly enumerates the *absent* dating mechanics (swipe, match queue, proximity, photo-first) so the reviewer can verify them against the binary. Safety surface and account deletion are spelled out for 1.2 / 5.1.1. No appearance language, no "meet," no "connect with singles." (Note: this requires you to also strip the `flirting` / `hotter` / `emotionally available` room blurbs in `himArtDirection.ts:81,202,214,220` and fix the fake `liveCount` at `himArtDirection.ts:229` — the listing and the binary must agree.)

### Keyword String (≤100 chars, comma-separated)
```
gay,friends,friendship,community,chat,rooms,buddy,lgbtq,queer,messaging,im,away,screenname,platonic
```
*(99 chars.) Deliberately omits `date`, `dating`, `hookup`, `match`, `meet`, `single`, `nearby`, `flirt` — every term that pulls you into the saturated dating category under 4.3. Do not add competitor brand names (Grindr/Scruff/Tinder) — that's a separate 4.3/2.3.10 metadata rejection.*

---

## B. Age Rating

Apple's 2025 questionnaire (granular 4+/9+/13+/16+/18+ scale; the legacy equivalent is **17+**). Answers below assume you keep the in-app gate at "17 or older."

| Questionnaire item | Answer | Rationale |
|---|---|---|
| Cartoon or Fantasy Violence | None | No violence content. |
| Realistic Violence | None | — |
| Sexual Content or Nudity | **None** *(see note)* | The app is friendship-first; no sexual content is a feature. UGC text is screened by the content-moderation trigger. **Do not** answer "Frequent/Intense" here — that would force 18+ and signal a hookup app. Answer None for app-provided content; the UGC reality is captured by the next two items. |
| Profanity or Crude Humor | **Infrequent/Mild** | User-generated chat. A profanity filter exists (`20260515021650_content_moderation.sql`) but cannot guarantee zero leakage; Infrequent/Mild is the honest answer. |
| Mature/Suggestive Themes | **Infrequent/Mild** | The app's identity ("social app for gay men," Art. 9 consent) and open user conversation make mild mature themes possible. This is the honest minimum for an adult social app. |
| Horror/Fear, Medical, Alcohol/Tobacco/Drugs, Gambling, Contests | None | Not present. |
| **Unrestricted Web Access** | **No** | No in-app browser exposing the open web. (Deep links open the system browser; that is not unrestricted in-app web access.) |
| **User-Generated Content** | **Yes** | DMs, room messages, profiles, away messages, photos, voice notes. |
| If UGC = Yes: moderation controls present? | **Yes** | Content filter + Block + Report on every surface + account deletion + a stated zero-tolerance policy (see Section F). State this in App Review notes. |
| Made for Kids | **No** | — |
| Age Assurance / age gate present | **Yes — 17+** | In-app gate at signup (`src/app/page.tsx:510`). |
| Unrestricted access to content (Age Verification) | **No** | — |

**Resulting rating: 17+** (Apple's standard adult-social floor; equivalent to 16+/18+ band under the new scale depending on how Apple maps "Mature/Suggestive — Infrequent" + UGC).

**Justification:** The 17+ rating is driven by **user-generated content + the adult LGBTQ social context + Art. 9 sensitive-data processing**, not by app-provided sexual content (there is none). Critically — **the in-app gate (17) and the store rating (17+) must match.** Submitting a lower rating (4+/9+/12+) on a gay-social UGC app is an automatic Guideline 1.1/1.2 rejection. In App Review notes, write one line: *"17+ reflects open user-generated content in an adult LGBTQ community. Block, Report, a profanity content filter, and account deletion are available on every surface; objectionable content is filtered at the database layer before delivery."*

---

## C. App Privacy Nutrition-Label Mapping

Cross-referenced to actual Supabase tables and the current `PrivacyInfo.xcprivacy`. **Tracking = No for every row** (`NSPrivacyTracking=false`, no ATT, no cross-app linking). No data is used for Third-Party Advertising or Developer Advertising.

| App Store data type | Source (ground truth) | Linked to user? | Tracking? | Purpose | In `PrivacyInfo.xcprivacy`? |
|---|---|---|---|---|---|
| **User ID** | `public.users.id` (UUID) | Yes | No | App Functionality | ✅ Declared, correct |
| **Name** | `public.users.screenname` | Yes | No | App Functionality | ✅ Declared, correct |
| **Email Address** | Synthetic Supabase auth email `screenname@hiitsme.app` (no real email entered) | Yes | No | App Functionality | ✅ Declared — *technically correct; see flag 1* |
| **Device ID** | `public.user_push_tokens.token` (APNs token) | Yes | No | App Functionality | ✅ Declared, correct |
| **Other User Content** | `messages.content`, `room_messages.body`, `saved_messages.content`, `abuse_reports.details` | Yes | No | App Functionality | ✅ Declared (as `OtherUserContent`), correct |
| **Photos or Videos** | Storage `buddy-icons` + `chat-media` buckets | Yes | No | App Functionality | ✅ Declared, correct |
| **Audio Data** | Voice notes via `getUserMedia({audio:true})` → `chat-media` (`ChatWindow.tsx:839`) | Yes | No | App Functionality | ✅ Declared, correct |
| **Product Interaction** | Vercel Analytics page/interaction events (`@vercel/analytics`, `App.tsx:47`) | Yes | No | App Functionality *(see flag 2 — should be Analytics)* | ⚠️ Declared, **wrong purpose** |
| **Sensitive Info** | Sexual orientation, implied by app identity + Art. 9 consent (`art9_consent_at`) | Yes | No | App Functionality | ❌ **Not declared — must add (flag 3)** |
| **Other Diagnostic Data** | `security_events` (auth event_type, outcome, `metadata.screenname`, `user_id`) | Yes | No | App Functionality | ❌ **Not declared (flag 4)** |
| Coarse Location | Derived from IP server-side (if logged) | — | — | — | ❌ Not declared — confirm whether any table persists IP; if not, leave out |

### Mismatches to fix before submission

1. **Email Address (cosmetic, low risk).** The stored email is a *synthetic* identifier (`screenname@hiitsme.app`), not user-entered contact info. Keep it declared (it genuinely exists in `auth.users`), but be ready to tell the reviewer it's a synthetic login identifier, not collected contact email. No file change required.

2. **Product Interaction purpose is wrong, OR remove the SDK.** `<Analytics />` (`src/App.tsx:47`) renders unconditionally — it fires to Vercel from the **native** bundle too. Two valid fixes:
   - **Preferred:** gate it natively — `{!Capacitor.isNativePlatform() && <Analytics />}`. Then it never runs on iOS, and you can leave Product Interaction declared at App Functionality (or drop it). No third-party SDK disclosure needed for the iOS binary.
   - **If you keep it on iOS:** add `NSPrivacyCollectedDataTypePurposeAnalytics` to the Product Interaction `Purposes` array in `PrivacyInfo.xcprivacy`, disclose Vercel as a third-party SDK in App Store Connect, and add an EU analytics consent gate. For an Art. 9 app, **gate it natively** — that's the clean answer.

3. **Sensitive Info is missing (highest risk).** The app self-declares "a social app for gay men" and collects an Art. 9 consent. Add a `NSPrivacyCollectedDataTypeSensitiveInfo` block to `PrivacyInfo.xcprivacy` (Linked=true, Tracking=false, Purpose=AppFunctionality) **and** declare "Sensitive Info" in the App Store Connect privacy questionnaire. Under-declaring sensitive data is a common 5.1.2 rejection.

4. **Diagnostic/security log not declared.** `security_events` is auth-linked diagnostics. Add `NSPrivacyCollectedDataTypeOtherDiagnosticData` (Linked=true, AppFunctionality) — or fold it under an existing app-functionality declaration — and mirror it in App Store Connect.

5. **Required Reason API — verify, don't panic.** `NSPrivacyAccessedAPITypes` is empty (`line 109`). This is **correct for the app target** — your `AppDelegate.swift` uses no Required Reason API. The only `UserDefaults` caller is the `CapawesomeCapacitorBadge` vendor framework, which ships its **own** `PrivacyInfo.xcprivacy` declaring reason `CA92.1`; SPM merges it into the binary's privacy report. After your next archive, open Organizer → Generate Privacy Report and confirm `UserDefaults / CA92.1` appears via the Badge framework. No app-level change required.

6. **Confirm the live policy page matches.** `hiitsme.app/privacy` must enumerate these same categories, name **Saman Technologies LLC** as controller, and disclose the Art. 9 basis. Verify before submitting.

---

## D. Paywall Spec + Copy — "H.I.M. Pro"

> **Sequencing note (do this first):** The unconditional `H.I.M. Pro` badge at `src/app/hi-its-me/page.tsx:6265` ships to every user today with **no product behind it**. For the v2.0 submission, **delete that span** (and the `.ui-profile-pro-badge` CSS). Ship the paywall as a **2.x fast-follow** after the app is approved and the seed cohort gives you a non-empty graph. There is no IAP scaffolding in the repo yet (no RevenueCat, no StoreKit, no `is_pro` column).

### Pricing
Founder pricing is **$4.99/mo · $39.99/yr**. This only earns its keep if Pro includes at least one *utility* lever beyond pure cosmetics. The spec below adds **Profile Spotlight in Browse** and **data/history export depth** to justify $4.99. (If you'd rather keep Pro purely cosmetic, drop to $2.99/mo · $24.99/yr for a higher attach rate — but the deliverable below honors the $4.99/$39.99 plan.) Strongly recommended addition: a **$59.99 one-time "Founding Member" lifetime** SKU — it converts the nostalgia/seed-cohort goodwill into upfront cash and fits the retro brand perfectly.

| SKU | Price | App Store Connect product type |
|---|---|---|
| H.I.M. Pro — Monthly | $4.99 / month | Auto-renewable subscription |
| H.I.M. Pro — Annual *(hero)* | $39.99 / year | Auto-renewable subscription (same group) |
| Founding Member — Lifetime *(optional)* | $59.99 one-time | Non-consumable |

### Placement (never a hard onboarding wall)
- **Contextual soft-walls at point of intent:** tapping a locked theme/wallpaper swatch; trying to save a 21st message; creating a 4th custom away preset; tapping an animated buddy-icon option.
- **One persistent entry point:** an "H.I.M. Pro" row in `/account` Settings.
- **Default the selector to Annual** with a "BEST VALUE — Save 33%" ribbon; monthly is secondary. **No** forced paywall at signup (the cold-start is already fragile).

### Gated vs Free — the hard line

**FREE forever (never gate — gating these risks 1.2 or kills retention):**
- Unlimited DMs, unlimited room messages, unlimited buddies
- Block, Report, Delete, account deletion, data export
- Read receipts, typing indicators, presence/away messages
- 1 default DM theme + default wallpaper
- 3 custom away presets (`FREE_PRESET_CAP = 3`)
- 20 saved messages (`FREE_SAVED_MESSAGES_CAP = 20`)
- Basic disappearing-message timers, static buddy icon

**H.I.M. Pro (gated):**
- Full DM **theme + wallpaper** library (`theme_key` / `wallpaper_key`, migration `20260328000013`)
- **Unlimited** custom away presets (free cap 3 → unlimited)
- **Unlimited** saved messages (free cap 20 → unlimited)
- **Pinned + archived** DM organization (`is_pinned` / `is_archived`)
- **Animated / GIF** buddy icon
- **Profile Spotlight** — appear higher in Browse *(the utility lever that justifies $4.99)*
- The **H.I.M. Pro** profile badge (now backed by a real entitlement)

Implementation: add `is_pro boolean not null default false` to `public.users` via migration, hydrate from a RevenueCat entitlement webhook, and check it server-side (RLS / functions) — never trust the client.

### Paywall Screen Copy (copy-paste ready)

```
HEADLINE:
H.I.M. Pro

SUBHEAD:
Make the place yours.

BULLETS:
• Every chat theme and wallpaper — make your DMs feel like home
• Unlimited away messages and saved messages
• Pin and archive your conversations
• Animated buddy icons
• Profile Spotlight — get noticed in the rooms
• The H.I.M. Pro badge on your profile

PLAN SELECTOR (annual preselected):
[ Annual — $39.99/yr  ·  BEST VALUE, save 33% ]   ← default
[ Monthly — $4.99/mo ]
[ Founding Member — $59.99 once, yours forever ]   ← if shipped

PRIMARY CTA:
Start H.I.M. Pro

DISCLOSURE LINE (required, directly under CTA):
Plans auto-renew until cancelled. Cancel anytime in Settings.
Your subscription renews at the price above unless cancelled at
least 24 hours before the end of the current period.

FOOTER ROW (all required by Apple, must be visible on the paywall):
Restore Purchases   ·   Manage Subscription   ·   Terms   ·   Privacy
```

**Required wiring per Apple Guideline 3.1.2 / 3.1.1:**
- `Restore Purchases` → `Purchases.restorePurchases()` (must be present and functional).
- `Manage Subscription` → opens the App Store subscription management sheet.
- `Terms` → `https://hiitsme.app/terms` · `Privacy` → `https://hiitsme.app/privacy` (both visible on the paywall screen itself).
- Auto-renew disclosure text (above) must appear on the screen, not buried.
- **No** external purchase links, no "subscribe on our website" — StoreKit IAP only, or instant 3.1.1 rejection.

---

## E. Cold-Start / Empty-State Playbook

The hard truth: today a new user lands on their own empty Profile tab, sees 7 rooms showing **fabricated** "live" counts (`himArtDirection.ts:229`), joins one, and reads "No one else here yet." That contradiction is the launch-killer. Fix in this order.

**1. Kill the fake live counts (do this before anything else — it's also a 4.1 risk).**
Delete the hashed `liveCount` (`himArtDirection.ts:229`). On the rooms list, only render the live pill/dot when the **real** membership count > 0, sourced from `room_memberships` where `last_seen_at > now() - interval '5 minutes'` (same window the in-room roster already uses). When count is 0, show nothing or a neutral "Quiet right now" / "New" label. A real "2 here now" beats a fake "23 live" every time — and never gets exposed.

**2. Seed real, small density — humans, not bots.**
Execute the GTM seeding plan operationally *before* submission: founder (`Pakiboy24`) + 25–40 personal-network users active across the regional and vibe rooms so a reviewer (and first users) see genuine, if small, activity. **Never seed fake accounts** — that recreates problem #1.

**3. Seed one welcome message per room so a joined room is never visually empty.**
Author a system/pinned `room_messages` seed (or a client-rendered pinned card) per room:
- NYC: *"Welcome to New York City. Say hi and drop which borough you're repping."*
- Late Night: *"It's late somewhere. What's keeping you up?"*
- Sunday Reset: *"New week incoming. What's one thing you're sorting out today?"*

**4. Land new users on Rooms, not Profile.**
Branch the initial `ShellSection`: if `acceptedBuddies.length === 0`, default to the Rooms tab (where value lives), not `profile`. Auto-suggest the user's likely regional room.

**5. Make "becoming discoverable" a one-tap action.**
Browse hides anyone without an away message (`BrowsePanel.tsx:59-60`), so two fresh users are invisible to each other. After first sign-in, prompt: *"Set a status so others can find you in Browse"* — reuse `DEFAULT_AWAY_PRESETS` (`page.tsx:304-309`) for one-tap selection. Also relax the Browse query to show `discoverable=true` users ordered by `last_active_at` even without a status, rendering a neutral "No status yet" placeholder, so the surface is never empty when real users exist.

**6. Fix the broken buddy-add path (it makes the room → friend loop look dead).**
`can_add_from_room` queries `public.room_participants`, renamed to `_archive_room_participants` in `20260509184623`. Ship a migration rewriting it against `room_memberships` (`rm1.room_id = rm2.room_id`). Until then, the "Join a room with them first" hint is unsatisfiable.

**7. Async-friendly empty-state copy that sets honest expectations.**
- No buddies: *"No buddies yet — H.I.M. is about making real friends, not dates. Join a room to meet people who get it."* (primary CTA "Browse the rooms", secondary "Add buddy").
- Empty room: replace bare "No one else here yet." with *"Quiet in here right now. Drop a message — say where you are or what you're into. People check in throughout the day."* This reframes emptiness as asynchronous, not abandoned.

**8. Make session-one payoff not depend on another human.**
Treat "**posted in a room**" — not "buddy accepted" — as the activation event. A user can post in a (now non-empty, welcome-seeded) room and see it land instantly, with no acceptance round-trip.

**9. Contextual push prompt (so re-engagement actually works).**
Don't prompt on cold launch. Fire `requestAndRegisterPush()` after the first high-intent action (first DM sent, or first buddy request) behind a one-line rationale sheet: *"Get a heads-up when a buddy messages you?"* Keep the Account toggle as fallback.

---

## F. Guideline 1.2 Compliance Copy

### Zero-Tolerance / EULA clause

**On the signup screen** (add a required consent line under the existing age + Art. 9 checkboxes, `src/app/page.tsx`, persist a `terms_accepted_at` timestamp):

```
By creating an account, you agree to our Terms of Service and confirm
you understand that H.I.M. has zero tolerance for objectionable content
or abusive behavior. Harassment, hate speech, threats, and explicit or
abusive content are prohibited and will result in content removal and
account termination. [Terms of Service] · [Privacy Policy]
```
*(Link `[Terms of Service]` → `https://hiitsme.app/terms`, `[Privacy Policy]` → `https://hiitsme.app/privacy`. Both links must be tappable **before** the "Create account" button. The live Terms page must actually contain a zero-tolerance / objectionable-content clause — confirm before submission.)*

**Standalone clause for the Terms of Service page** (`hiitsme.app/terms`):

```
ZERO TOLERANCE FOR OBJECTIONABLE CONTENT AND ABUSIVE USERS

H.I.M. is a friendship community for gay men and maintains a strict,
zero-tolerance policy toward objectionable content and abusive behavior.
You agree not to post, send, or share content that is harassing, hateful,
threatening, sexually exploitative, or otherwise abusive, and not to harass,
threaten, or impersonate other members.

H.I.M. filters content automatically and lets any member block or report
another member or message at any time. We review reports and act on
violations — including removing content and terminating accounts — typically
within 24 hours of a report. Saman Technologies LLC reserves the right to
remove content and suspend or terminate accounts that violate this policy,
at its sole discretion and without notice.

To report a problem, use the Report option available on any profile, message,
or room, or contact us at support@hiitsme.app.
```

### In-app "Report a problem / Contact" string and where it must appear

**String (use verbatim, reuse the existing `abuse_reports` flow):**
```
Report a problem
See something that breaks our zero-tolerance policy? Report it and we'll
review it — usually within 24 hours. You can also reach us at
support@hiitsme.app.
```

**Required placements (1.2 expects report/contact reachable on every UGC surface and a developer contact):**

1. **DM message** — long-press → Report (built: `ChatWindow.tsx:1889`). ✅
2. **Room message** — long-press → Report + Block sender (built: `GroupChatWindow.tsx:1669`). ✅
3. **Buddy profile sheet** — Block + Report (built). ✅
4. **Discovery profile sheet** — Block + Report (built). ✅
5. **Room member roster profile sheet** — ❌ **currently missing Block/Report** (`GroupChatWindow.tsx:1454-1469` shows only "Add to Buddylist"). **Add Block + Report here**, reusing the existing handlers — this is the one inconsistency a careful reviewer can cite under 1.2, and the only path to report a room member who hasn't sent a message yet.
6. **Account / Settings** — "Contact Support" → `mailto:support@hiitsme.app` (built: `account/page.tsx:553`). ✅
7. **Login / signup screen footer** — ❌ **add** Terms, Privacy, and Contact Support links so a locked-out user (and a pre-login reviewer) can reach them (`src/app/page.tsx`).

**Operational backstop for 1.2(e) — the "act within 24h" answer.** Reports land in `abuse_reports` but there's no alert and no admin UI. Before submission, ship two thin pieces so your App Review note isn't "we run a SQL query": (a) a Supabase Database Webhook on `INSERT` into `abuse_reports` → Slack/email, so a human is alerted in minutes; (b) one authenticated admin Edge Function (`admin-moderate`, gated by `assertAdminUser`) that soft-deletes a message (`deleted_at`/`deleted_by` already exist on `messages` and `room_messages`) and suspends a user. Then in App Review notes write: *"New reports trigger an immediate operator alert. We review and act — content removal or account suspension — typically within 24 hours via an authenticated moderation tool."* Note that `messages`/`room_messages` already carry `deleted_at`/`deleted_by` and `abuse_reports` already has a `status` field, so a service-role operator *can* act today via SQL — the webhook + function just make it fast and demonstrable.

---

**Pre-submission blockers these deliverables assume you'll also clear (not copy, but gating):** flip `aps-environment` to `production` in `App.entitlements`; fix the DM-push UUID type break (DM push is 100% dead until fixed — **now applied in code, edge fn needs redeploy**); gate or remove `<Analytics />` on native; delete the unbacked `H.I.M. Pro` badge; strip `flirting`/`hotter`/`emotionally available` room blurbs; replace fake `liveCount` with real presence.
