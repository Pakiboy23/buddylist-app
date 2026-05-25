# Apple App Privacy — H.I.M. (hiitsme)
**App Store Connect questionnaire — copy-paste answer sheet**

**Prepared:** 2026-05-25  
**Sources:** `docs/compliance/data-inventory.md`, `docs/compliance/sub-processors.json`  
**Status:** Draft — requires legal sign-off before submission  
**App Store Connect path:** My Apps → H.I.M. → App Privacy

---

## How to use this document

Work through App Store Connect's data-type checklist from top to bottom. For each category, check "Yes — We collect this data" or "No — We do not collect this data" as indicated below, then copy the linked/tracking/purpose answers directly into the form. Where a cell says **⚠️ legal review**, confirm with counsel before submitting.

Apple defines **Tracking** strictly: linking user/device data with third-party app or website data for targeted advertising or sharing with data brokers. H.I.M. does none of this, so every category answers **No** to "Used for tracking."

Apple defines **Linked to user**: stored in a way that is associated with a user's account or persistent identifier. The **Not Linked** answer is only appropriate for data that is anonymised or stripped of identity before collection.

---

## Category-by-category answers

---

### 1. Contact Info

#### Name
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Sub-type | Name |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** Screenname (user-chosen display identity, e.g. `coolguy84`). Stored in `public.users.screenname`. Also appears in APNs push payloads as `senderName`.

**What we do NOT collect:** Legal first/last name, real name, or government ID.

---

#### Email Address
| Field | Answer |
|---|---|
| Collect? | **No** |

**Rationale:** H.I.M. does not collect an email address from users. The system constructs a synthetic email (`screenname@hiitsme.app`) as a Supabase Auth internal key. This string is never shown to the user, never used to contact the user, and is not a real email address. It functions as a primary key, not contact information. ⚠️ Legal review: confirm Apple accepts this characterisation.

---

#### Phone Number, Physical Address, Other Contact Info
| Field | Answer |
|---|---|
| Collect? | **No** |

---

### 2. Health & Fitness

| Field | Answer |
|---|---|
| Collect? | **No** |

H.I.M. does not request HealthKit access, does not collect fitness data, and has no health-related features.

---

### 3. Financial Info

| Field | Answer |
|---|---|
| Collect? | **No** |

H.I.M. has no in-app purchases, payment flows, or financial features.

---

### 4. Location

#### Precise Location
| Field | Answer |
|---|---|
| Collect? | **No** |

H.I.M. never requests `CoreLocation` permission and has no location features.

---

#### Coarse Location
| Field | Answer |
|---|---|
| Collect? | **Yes** ⚠️ legal review |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** IP address at sign-in time, captured by Supabase Auth infrastructure. Supabase logs the source IP for each authentication event. The app transmits this passively as a byproduct of the HTTPS connection; no location permission is requested and no explicit location feature exists.

**Why App Functionality:** IP-based coarse location is used solely for fraud detection and account security (e.g. detecting anomalous sign-in geography). It is not surfaced to users or used for any product feature.

⚠️ **Legal review:** Some apps omit infrastructure-level IP collection from this disclosure. Confirm with counsel whether passive Supabase Auth IP logging meets Apple's threshold of "data your app collects and sends off the device." If counsel advises omission, remove this entry and document the rationale.

---

### 5. Sensitive Info

| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect and why this category applies:**

H.I.M. is a social messaging app with an explicitly LGBTQ+ user community. Apple's Sensitive Info category covers data about racial or ethnic origin, religious or philosophical beliefs, sexual orientation, and similar characteristics. H.I.M. collects sensitive information through two distinct mechanisms:

1. **Sexual orientation — by structural inference.** Membership of an LGBTQ+-identified platform, combined with the social graph (who a user messages, which rooms they join), reveals sexual orientation and/or gender identity at a population level. No discrete field stores "orientation = X." The inference arises from context, not a schema column. Apple's guidelines require disclosure of data that reveals sensitive characteristics regardless of whether that inference requires a joining step. See "What to say if Apple pushes back" §A below.

2. **Free-form user content.** Messages, profile bios, status messages, and room messages are free-form text. Users may and do share data about religion, ethnicity, health conditions, political views, or other sensitive characteristics voluntarily in this text. H.I.M. processes this content for communication delivery and content moderation. It cannot be filtered out without breaking the app's core function.

**What we do NOT collect:** We do not have explicit schema fields for race, religion, political affiliation, or orientation. We do not conduct inference on message content to extract or classify sensitive attributes.

---

### 6. Contacts

| Field | Answer |
|---|---|
| Collect? | **No** |

H.I.M. never requests device Contacts access. The in-app buddy list and social graph are built from within-app actions only (follow requests, room membership). No phonebook or device contact is read.

---

### 7. User Content

#### Emails or Text Messages (→ use "Other User Content" in form if text messages sub-type isn't shown separately)
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** Direct message body (`public.messages.content`) and room message body (`public.room_messages.body`). These are the core communication payload of the app and cannot be anonymised without destroying the product.

---

#### Photos or Videos
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** User-uploaded media attachments in DMs and rooms, stored in the `chat-media` Supabase Storage bucket at path `{userId}/{year}/{month}/{day}/{uuid}-{filename}`. Metadata (mime type, dimensions, file size, original filename) stored in `public.message_attachments`.

---

#### Audio Data
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** Voice note attachments sent in messages (`preview_type = voice_note` in `public.messages`). Stored in the `chat-media` bucket alongside other media.

---

#### Gameplay Content
| Field | Answer |
|---|---|
| Collect? | **No** |

---

#### Customer Support
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** Abuse report details entered by the reporting user (`public.abuse_reports.details`, max 1,200 chars; `public.abuse_reports.category`). Block reasons entered optionally when blocking a user (`public.blocked_users.reason`, max 240 chars). These are trust-and-safety submissions from users, analogous to customer support tickets.

---

#### Other User Content
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** Profile bio (`public.users.profile_bio`), AIM-style status/away message (`public.users.status_msg`), emoji reactions to messages (`public.message_reactions`, `public.room_message_reactions`). These are user-authored content not covered by the text-messages or media sub-types above.

---

### 8. Browsing History

| Field | Answer |
|---|---|
| Collect? | **No** |

Apple defines Browsing History as "Information about content the user has viewed that is not part of the app, such as websites." H.I.M. does not access the device's browser history and does not embed a web browser.

---

### 9. Search History

| Field | Answer |
|---|---|
| Collect? | **No** |

H.I.M. has an in-app user discovery/search feature, but search queries are ephemeral and are not stored in any database table. The `public.users.discoverable` flag controls whether a user appears in results; the query text itself is not persisted.

---

### 10. Identifiers

#### User ID
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** Supabase Auth UUID (`auth.users.id`) — a persistent, app-scoped identifier generated at registration. Screenname (`public.users.screenname`) — a user-chosen persistent identifier. Both are stored server-side and used to link all app data to an account.

---

#### Device ID
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality |

**What we collect:** APNs device push token (`public.user_push_tokens.token`). This is a device-scoped identifier assigned by Apple for push notification delivery. It is stored server-side linked to the user's account and pruned after 90 days of inactivity.

**What we do NOT collect:** IDFA (Advertising Identifier), IDFV (Vendor Identifier), or any other device fingerprint. The `@capacitor/push-notifications` plugin does not grant or read IDFA.

---

### 11. Purchases

| Field | Answer |
|---|---|
| Collect? | **No** |

---

### 12. Usage Data

#### Product Interaction
| Field | Answer |
|---|---|
| Collect? | **Yes** |
| Linked to user? | **Yes** |
| Used for tracking? | **No** |
| Purposes | App Functionality, Analytics |

**What we collect:**
- Presence timestamps: `public.users.idle_since`, `public.users.last_active_at` — used to display online/idle/away status to buddies.
- Message delivery and read receipts: `public.messages.delivered_at`, `public.messages.read_at` — used to show delivery/read status to sender (can be disabled in privacy settings).
- Room last-seen: `public.room_memberships.last_seen_at` — used to compute unread message counts.
- Vercel Analytics page-view events (web platform only): anonymised page-view telemetry via `@vercel/analytics`. ⚠️ Legal review: confirm whether Vercel Analytics meets Apple's definition of "analytics" in this context and whether a consent gate is required for EU users.

**App Functionality** covers presence and read receipts. **Analytics** covers Vercel Analytics page-view data.

---

#### Advertising Data
| Field | Answer |
|---|---|
| Collect? | **No** |

---

#### Other Usage Data
| Field | Answer |
|---|---|
| Collect? | **No** |

---

### 13. Diagnostics

| Field | Answer |
|---|---|
| Collect? | **No** |

H.I.M. does not integrate Crashlytics, Sentry, Datadog, Firebase Crashlytics, or any crash/performance monitoring SDK. No diagnostic data is collected by the app.

---

### 14. Other Data

| Field | Answer |
|---|---|
| Collect? | **No** |

All data collected by H.I.M. is covered by the categories above.

---

## Summary table (App Store Connect quick-reference)

| Apple Data Type | Collect? | Linked? | Tracking? | Purposes |
|---|---|---|---|---|
| Contact Info → Name | Yes | Yes | No | App Functionality |
| Contact Info → Email Address | No | — | — | — |
| Contact Info → Phone, Address, Other | No | — | — | — |
| Health & Fitness | No | — | — | — |
| Financial Info | No | — | — | — |
| Location → Precise | No | — | — | — |
| Location → Coarse | Yes ⚠️ | Yes | No | App Functionality |
| Sensitive Info | Yes | Yes | No | App Functionality |
| Contacts | No | — | — | — |
| User Content → Text Messages | Yes | Yes | No | App Functionality |
| User Content → Photos/Videos | Yes | Yes | No | App Functionality |
| User Content → Audio | Yes | Yes | No | App Functionality |
| User Content → Customer Support | Yes | Yes | No | App Functionality |
| User Content → Other | Yes | Yes | No | App Functionality |
| Browsing History | No | — | — | — |
| Search History | No | — | — | — |
| Identifiers → User ID | Yes | Yes | No | App Functionality |
| Identifiers → Device ID | Yes | Yes | No | App Functionality |
| Purchases | No | — | — | — |
| Usage Data → Product Interaction | Yes | Yes | No | App Functionality, Analytics |
| Usage Data → Advertising/Other | No | — | — | — |
| Diagnostics | No | — | — | — |
| Other Data | No | — | — | — |

---

## What to say if Apple pushes back

### A. Sensitive Info → Sexual Orientation (expected pushback)

**If Apple asks:** "You indicated you collect Sensitive Information. Please describe what sensitive data you collect and why."

> H.I.M. is a private messaging app built for the LGBTQ+ community. We do not store a discrete "sexual orientation" field in any database table. However, Apple's App Store guidelines require disclosure of data that can reveal sensitive characteristics — not only data stored in labelled fields. The act of creating an account on H.I.M. implies LGBTQ+ identity by context for the substantial majority of our user base. The social graph (who a user messages privately and which community rooms they join) further reinforces that inference. Processing this data is strictly necessary to deliver the app's core messaging and community features; there is no less-privacy-invasive alternative that would still operate a social messaging service. We have implemented consent-at-registration for special-category data processing (recorded in the `public.consent_timestamps` table, migration `20260525000001_add_consent_timestamps.sql`), in line with GDPR Article 9(2)(a) requirements. This data is used solely for App Functionality — enabling communication between users — and is never used for profiling, advertising, or third-party sharing.

---

### B. Location → Coarse Location via IP (possible pushback)

**If Apple asks:** "You indicated you collect Coarse Location. Please describe your use case."

> H.I.M. does not have any location-based features, does not request CoreLocation permission, and does not show users a map or proximity indicator. Coarse location is collected as a passive byproduct of authentication: when a user signs in, Supabase Auth (our authentication infrastructure) logs the source IP address of the authentication request at the network layer. This IP is used solely for account security purposes — detecting anomalous sign-in geography that may indicate account compromise. The IP is not surfaced within the app, not shared with third parties, and is not used for any user-facing feature. We retain it per Supabase's standard infrastructure log retention and do not build user profiles from it.

---

### C. User Content → Text Messages (linked to user)

**If Apple asks:** "Text messages are linked to the user — can you explain why this is necessary?"

> H.I.M. is a persistent messaging app, not an ephemeral chat. Users expect their message history to persist across sessions and devices, which requires storing messages server-side linked to sender and receiver accounts. Storing messages without a user identity link would make message delivery, read receipts, history retrieval, and account portability impossible. The app provides a "disappearing messages" feature for users who prefer ephemeral messaging, and a full account-deletion flow that permanently erases all messages. Message content is transmitted to sub-processors (Supabase for storage, Apple APNs for push previews) under Standard Contractual Clauses (Supabase) and the Apple Developer Program License Agreement (APNs) respectively.

---

### D. Device ID → APNs Token (not used for tracking)

**If Apple asks:** "You collect a Device ID but say it is not used for tracking. Please explain."

> The device identifier we collect is the APNs push token issued by Apple. It is stored in our database linked to the user's account solely to route push notifications to the correct device. It is never shared with advertising networks, data brokers, or any entity other than Apple APNs (for the purpose of delivering the notification). When the user disables notifications, uninstalls the app, or deletes their account, the token is removed. Apple's own definition of Tracking — linking data with third-party app/website data for advertising — does not apply to APNs tokens, which exist exclusively within Apple's own notification infrastructure.

---

### E. Usage Data → Product Interaction (read receipts)

**If Apple asks:** "Product Interaction is linked to the user — is this used for profiling?"

> Product interaction data consists of read receipts (`read_at` timestamps on messages) and presence indicators (`last_active_at`, `idle_since`). These are social features that users have explicit control over: read receipts can be disabled in Settings → Privacy → Share Read Receipts, and presence display is part of the core AIM-style social experience. They are not used for advertising, profiling, or any purpose beyond the in-app features visible to the user's conversation partners. Vercel Analytics on the web platform collects anonymised page-view data with no cross-site linking; no user identifier is sent to Vercel Analytics.

---

## Open items before submission

| # | Item | Owner |
|---|---|---|
| 1 | Confirm synthetic email exclusion from Contact Info → Email Address | Legal |
| 2 | Confirm Coarse Location inclusion or document rationale for exclusion | Legal |
| 3 | Confirm Art. 9(2) basis for Sensitive Info (explicit consent at registration vs. manifestly public) | Legal |
| 4 | Confirm Vercel Analytics does not use cookies/fingerprinting that would require consent gate | Engineering + Legal |
| 5 | Confirm `consent_timestamps` migration is live and recording consent for all new registrations | Engineering |
| 6 | Execute Privacy Nutrition Label review with counsel before App Store submission | Legal |
