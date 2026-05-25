# Google Play Data Safety — H.I.M. (hiitsme)
**Play Console Data Safety form — copy-paste answer sheet**

**Prepared:** 2026-05-25  
**Sources:** `docs/compliance/data-inventory.md`, `docs/compliance/sub-processors.json`  
**Status:** Draft — requires legal sign-off before submission  
**Play Console path:** App content → Data safety

---

## How to use this document

Work through the Play Console Data Safety form in order. The form asks about each data type in sequence; use the per-category tables below. Three form-level questions apply to the whole app and are answered first in the "Form-level answers" section.

**Google's key definitions:**

- **Collected**: Data transmitted off the device to your company or a third party (regardless of purpose). On-device-only data (localStorage) is NOT collected in Google's sense.
- **Shared**: Data disclosed to third parties (other companies) who may use it for their own purposes. Data processed by your own service providers (Supabase, Vercel) under a Data Processing Agreement is generally **not** "shared" — it is processed on your behalf. Data transmitted to Apple APNs **is** shared because Apple receives it as part of their own infrastructure.
- **Optional**: User can use the app's core functionality without providing this data.
- **Required**: App cannot function without this data.

---

## Form-level answers (apply to entire app)

| Question | Answer | Notes |
|---|---|---|
| Is all data encrypted in transit? | **Yes** | All client↔Supabase, client↔Vercel, and Vercel↔APNs connections use TLS 1.2+. No unencrypted HTTP endpoints. |
| Can users request data deletion? | **Yes** | Users can delete their account at **Settings → Account → Delete Account** (`/account/delete`), which triggers the `delete-account` Supabase Edge Function. This permanently erases messages, media, profile, push tokens, and all associated records across ~14 tables. |
| Does your app follow the Families Policy? | **No** | H.I.M. is rated for users 17 and older. It is not directed at children and does not follow the Families Policy. |

---

## Category-by-category answers

---

### 1. Personal Info

#### Name
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **Yes** — Apple APNs |
| Optional or required? | **Required** |
| Purposes | App functionality, Account management |
| Which third parties? | Apple Inc. (APNs) receives the user's screenname as `senderName` in the push notification payload when a message is sent. Apple processes this to render the notification on the recipient's lock screen. |

**Data stored:** Screenname (`public.users.screenname`) — a user-chosen pseudonym. This is the user's visible identity throughout the app (buddy list, chat headers, room member lists). H.I.M. does not collect legal first or last name.

---

#### Email Address
| Field | Answer |
|---|---|
| Collected? | **No** |

**Rationale:** H.I.M. does not ask users for an email address. A synthetic address (`screenname@hiitsme.app`) is constructed internally as the Supabase Auth primary key. This string is never entered by the user, never displayed, and never used for outbound contact. It is not user-provided email. ⚠️ **Legal review:** Confirm this characterisation is defensible; the synthetic email is stored in `auth.users.email`.

---

#### User IDs
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Required** |
| Purposes | App functionality, Account management, Fraud prevention / security / compliance |

**Data stored:** Supabase Auth UUID (`auth.users.id`) — system-generated persistent identifier. Screenname (`public.users.screenname`) — user-chosen persistent identifier. Both are required for all authenticated operations.

---

#### Address
| Field | Answer |
|---|---|
| Collected? | **No** |

---

#### Phone Number
| Field | Answer |
|---|---|
| Collected? | **No** |

---

#### Race and Ethnicity
| Field | Answer |
|---|---|
| Collected? | **Yes** ⚠️ |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**What we collect and why:** H.I.M. does not have a race/ethnicity profile field. However, free-form user content (direct messages, room messages, profile bios, status messages) may contain references to racial or ethnic identity that users voluntarily share. Google's Data Safety form requires disclosure of data types that "may be" collected, even when collection is user-initiated and incidental. The content is processed solely to deliver the communication feature and for automated content moderation (profanity/harm filtering). See also §4 Messages below.

⚠️ **Legal review:** Confirm with counsel whether incidental appearance in free-form content requires disclosure for this sub-type.

---

#### Political or Religious Beliefs
| Field | Answer |
|---|---|
| Collected? | **Yes** ⚠️ |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Same rationale as Race and Ethnicity above.** Free-form message and profile content may contain political or religious expression.

---

#### Sexual Orientation
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Required** |
| Purposes | App functionality |

**Why Required:** H.I.M. is a messaging app built for the LGBTQ+ community. Being a user of this app implies LGBTQ+ identity for the substantial majority of users. The social graph (who users message privately, which community rooms they join) structurally reveals sexual orientation and/or gender identity by context, without any discrete field storing this value. This inference is an inherent and unavoidable aspect of operating an LGBTQ+-community social app, not an incidental byproduct. Suppressing this disclosure would misrepresent the app's data practices.

**Why App Functionality:** The app does not use orientation data for profiling, advertising, or any purpose other than delivering the core messaging and community features. No orientation value is ever extracted, classified, or transmitted to any third party. See "What to say if Google pushes back" §A below.

---

#### Other Personal Info
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Data stored:** Profile bio (`public.users.profile_bio`), AIM-style away/status message (`public.users.status_msg`), profile avatar image (`buddy-icons` Storage bucket). All user-authored; none required to use core messaging features.

---

### 2. Financial Info

| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. has no in-app purchases, subscriptions, or payment features.

---

### 3. Health & Fitness

| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. does not access health or fitness APIs and has no health-related features.

---

### 4. Messages

#### Emails
| Field | Answer |
|---|---|
| Collected? | **No** |

---

#### SMS or MMS
| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. does not access the device SMS inbox.

---

#### Other In-App Messages
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **Yes** — Apple APNs (preview only) |
| Optional or required? | **Required** |
| Purposes | App functionality |

**Data stored:** Direct message body (`public.messages.content`) and room message body (`public.room_messages.body`). These are the core payload of the app.

**Third-party sharing:** When push notifications are enabled, up to 140 characters of message content may be transmitted to Apple APNs as `messagePreview` in the notification payload. This is gated by the user's **Notification Privacy** setting (full / name only / hidden). Users who set the preference to `name_only` or `hidden` share no message content with APNs. The default is `full`. ⚠️ **Legal review:** Consider changing the default to `name_only` to minimise APNs exposure.

---

### 5. Photos and Videos

#### Photos
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Data stored:** Photo attachments sent in DMs and room messages, stored in the Supabase `chat-media` bucket. Also profile avatar images in the `buddy-icons` bucket. All user-initiated.

---

#### Videos
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Data stored:** Video attachments in the `chat-media` bucket. User-initiated; video is not a required feature.

---

### 6. Audio Files

#### Voice or Sound Recordings
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Data stored:** Voice note attachments stored in the `chat-media` bucket (`preview_type = voice_note` in `public.messages`). User-initiated; microphone permission is not requested on launch.

---

#### Music Files / Other Audio
| Field | Answer |
|---|---|
| Collected? | **No** |

---

### 7. Files and Docs

| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. does not access device storage for generic files or documents. Attachments are handled through media pickers (Photos and Audio sub-types above).

---

### 8. Calendar

| Field | Answer |
|---|---|
| Collected? | **No** |

---

### 9. Contacts

| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. never requests device Contacts access. The buddy list and social graph are built from within-app actions only. No phonebook data is read.

---

### 10. App Activity

#### App Interactions
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **Yes** — Vercel Analytics (web platform only) |
| Optional or required? | **Required** |
| Purposes | App functionality, Analytics |

**Data stored:**
- Presence timestamps: `public.users.idle_since`, `public.users.last_active_at` — powers the online/idle/away indicator visible to buddies.
- Read and delivery receipts: `public.messages.delivered_at`, `public.messages.read_at` — powers the read receipt feature (can be disabled in privacy settings).
- Room last-seen: `public.room_memberships.last_seen_at` — powers unread message count badges.

**Third-party sharing (web only):** Vercel Analytics (`@vercel/analytics`) collects anonymised page-view events on the web platform. Android/iOS apps do not load this SDK. ⚠️ **Legal review:** Confirm Vercel Analytics is anonymised to Google's standard; if it includes a persistent client ID it may need to be disclosed as "Shared."

---

#### In-App Search History
| Field | Answer |
|---|---|
| Collected? | **No** |

User search queries in the discovery/browse feature are not stored. The `public.users.discoverable` flag governs whether a user appears in results, but the query text is ephemeral.

---

#### Installed Apps
| Field | Answer |
|---|---|
| Collected? | **No** |

---

#### Other User-Generated Content
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Data stored:** Emoji reactions (`public.message_reactions`, `public.room_message_reactions`). Saved message bookmarks (`public.saved_messages`). Abuse report details and block reasons (`public.abuse_reports.details`, `public.blocked_users.reason`).

---

#### Other Actions
| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **No** |
| Optional or required? | **Required** |
| Purposes | App functionality, Fraud prevention / security / compliance |

**Data stored:** IP address at authentication time, captured by Supabase Auth infrastructure. Sign-in timestamps (`auth.users.last_sign_in_at`). Used for account security (anomalous sign-in detection). Not surfaced to users.

---

### 11. Web Browsing

| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. does not access device browser history.

---

### 12. App Info and Performance

#### Crash Logs
| Field | Answer |
|---|---|
| Collected? | **No** |

H.I.M. does not integrate Firebase Crashlytics, Sentry, or any crash-reporting SDK.

---

#### Diagnostics
| Field | Answer |
|---|---|
| Collected? | **No** |

---

#### Other App Performance Data
| Field | Answer |
|---|---|
| Collected? | **No** |

---

### 13. Device or Other IDs

| Field | Answer |
|---|---|
| Collected? | **Yes** |
| Shared with third parties? | **Yes** — Apple APNs |
| Optional or required? | **Optional** |
| Purposes | App functionality |

**Data stored:** APNs device push token (`public.user_push_tokens.token`). Registered when the user grants notification permission; stored linked to the user's account; pruned after 90 days of inactivity or on account deletion.

**Third-party sharing:** The push token is transmitted to Apple APNs as the delivery address for each push notification. Apple receives no other user data alongside the token beyond the notification payload (see §4 Messages).

**Why Optional:** Users can use all core messaging features — send and receive DMs, participate in rooms — without enabling push notifications. The token is only registered if the user explicitly grants the Android POST_NOTIFICATIONS permission.

**What we do NOT collect:** Advertising ID (GAID), Android ID, IMEI, or any other device fingerprint beyond the APNs token.

---

## Summary table (Play Console quick-reference)

| Data type | Collected | Shared | Required? | Purposes |
|---|---|---|---|---|
| Personal info → Name (screenname) | Yes | Yes — APNs | Required | App functionality, Account management |
| Personal info → Email address | No | — | — | — |
| Personal info → User IDs | Yes | No | Required | App functionality, Account management, Security |
| Personal info → Address | No | — | — | — |
| Personal info → Phone number | No | — | — | — |
| Personal info → Race & ethnicity | Yes ⚠️ | No | Optional | App functionality |
| Personal info → Political/religious beliefs | Yes ⚠️ | No | Optional | App functionality |
| Personal info → Sexual orientation | Yes | No | Required | App functionality |
| Personal info → Other (bio, avatar, status) | Yes | No | Optional | App functionality |
| Financial info | No | — | — | — |
| Health & fitness | No | — | — | — |
| Messages → Other in-app messages | Yes | Yes — APNs (preview) | Required | App functionality |
| Photos → Photos | Yes | No | Optional | App functionality |
| Photos → Videos | Yes | No | Optional | App functionality |
| Audio → Voice recordings | Yes | No | Optional | App functionality |
| Files and docs | No | — | — | — |
| Calendar | No | — | — | — |
| Contacts | No | — | — | — |
| App activity → App interactions | Yes | Yes — Vercel (web only) | Required | App functionality, Analytics |
| App activity → Search history | No | — | — | — |
| App activity → Other UGC | Yes | No | Optional | App functionality |
| App activity → Other actions (IP/sign-in) | Yes | No | Required | App functionality, Security |
| Web browsing | No | — | — | — |
| App info & performance (crash, diagnostics) | No | — | — | — |
| Device or other IDs (APNs token) | Yes | Yes — APNs | Optional | App functionality |

---

## What to say if Google pushes back

### A. Sexual Orientation — Required, not Optional (expected pushback)

**If Google asks:** "You marked Sexual Orientation as Required. Please justify why users cannot use the app without this data being collected."

> H.I.M. is a messaging and community app built for and by the LGBTQ+ community. We do not store a database field labelled "sexual orientation." The disclosure arises because the fact of creating an account on this platform — combined with the social graph of who a user messages and which community rooms they join — constitutes a structural inference about sexual orientation and gender identity for the vast majority of users. This is not an incidental byproduct; it is the nature of a platform with a known community identity. We cannot operate a social app that connects this community without processing data that reveals membership in it. This data is used solely for App Functionality (delivering messages and community features) and is never used for advertising, profiling, or third-party disclosure. We have implemented consent-at-registration for special-category data processing, recorded in `public.consent_timestamps` (migration `20260525000001_add_consent_timestamps.sql`), in compliance with GDPR Article 9(2)(a). We marked it Required rather than Optional because a user cannot use any feature of the app — not even reading their messages — without this inference arising from their account existence.

---

### B. Messages — Shared with APNs (preview content)

**If Google asks:** "You said messages are shared with Apple APNs. Does this mean message content is shared with third parties?"

> A portion of message content (up to 140 characters) may be transmitted to Apple APNs for display as a push notification preview on the recipient's device. This is controlled by the recipient's Notification Privacy setting: users who set the preference to "Name only" or "Hidden" share zero message content with APNs; only users with the default "Full" setting share a preview. Apple receives this content solely as a notification delivery mechanism — equivalent to a postal carrier seeing the outside of an envelope. Apple does not read, analyse, or retain message content for its own purposes. The transmission is covered by the Apple Developer Program License Agreement. We are considering changing the default to "Name only" to minimise this exposure surface.

---

### C. Race/Ethnicity and Political/Religious Beliefs — incidental in free-form content

**If Google asks:** "You indicated you collect race/ethnicity and political/religious beliefs. Please describe what fields you use."

> We do not have schema fields for race, ethnicity, political affiliation, or religion. These data types may appear incidentally in free-form user-generated content: direct messages, room messages, profile biographies, and status messages. Users voluntarily share this information as part of their social expression. We process this content solely to deliver the communication feature (store, route, and display the message to the intended recipient) and to run automated content moderation (a server-side profanity/harm filter). We do not extract, classify, or separately store any sensitive attribute from this content. We disclosed these types in compliance with Google's guidance that data types which "may be" collected must be declared, even when collection is user-initiated and incidental.

---

### D. Device or Other IDs — Shared but not for advertising

**If Google asks:** "You share a Device ID with Apple APNs. Is this used for advertising or cross-app tracking?"

> The device identifier we share is the APNs push token issued by Apple's own infrastructure. It is transmitted to Apple solely to route push notifications to the correct device. It is not shared with advertising networks, data brokers, analytics firms, or any entity other than Apple. It cannot be used for cross-app tracking because it is scoped to the H.I.M. app bundle and rotates when the user reinstalls or resets permissions. When the user disables notifications or deletes their account, the token is removed from our database within the same session. Google's definition of Advertising ID (GAID) does not apply here.

---

### E. App Interactions — Vercel Analytics on web (shared)

**If Google asks:** "You said App Interactions are shared with Vercel. Is this analytics data linked to users?"

> Vercel Analytics is loaded exclusively on the web platform (`https://hiitsme-app.vercel.app`). The Android APK does not include the `@vercel/analytics` SDK and therefore the Android app does not share any interaction data with Vercel. Vercel Analytics collects anonymised page-view events (page URL, referrer, viewport size, country-level geo derived from IP). It does not set cookies, does not use advertising identifiers, and does not build cross-site profiles. If, upon review, Vercel Analytics is confirmed to use a persistent client ID, we will update this disclosure accordingly. ⚠️ This pushback section must be verified against Vercel's current analytics data practices before submission.

---

## Open items before submission

| # | Item | Owner |
|---|---|---|
| 1 | Confirm synthetic email characterisation as "not collected" is defensible | Legal |
| 2 | Verify Vercel Analytics does not use a persistent client-side ID on Android/web | Engineering |
| 3 | Confirm Race/Ethnicity and Political/Religious Beliefs disclosures are required for incidental UGC content | Legal |
| 4 | Consider changing `notification_preview_mode` default to `name_only` to reduce APNs message-content sharing | Product + Legal |
| 5 | Confirm `consent_timestamps` migration records consent for all new registrations and is auditable | Engineering |
| 6 | Execute Data Safety section review with counsel before Play Store submission | Legal |
| 7 | Note: FCM (Android push) is not yet implemented. When shipped, revisit Device ID → Optional/Required status and re-check sharing with Google (FCM) | Engineering |
