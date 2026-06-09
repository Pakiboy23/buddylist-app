<!--
Generated 2026-06-08 by the him-resubmission-review workflow (15 agents, adversarially verified),
reviewed against the 2026-06-08 (WWDC26) re-released App Review Guidelines + Texas SB 2420.
Companion: him-resubmission-deliverables.md.
P0 code/copy fixes APPLIED on branch resubmit/appstore-2026-fixes (2026-06-08):
  - all 3 "Pro" badges + their CSS removed (Blocker 1)
  - 17 -> 18 across signupConsent.ts, page.tsx, terms.html, privacy.html (Blocker 2, code side)
  - dating-register room blurbs rewritten (S1); in-app friendship line added (S2); roster Block/Report wired (S3)
  - rebuilt: dist/ + native-web/ + ios public resynced
Still ON YOU (ASC + native, can't be done from the repo): see Sections 5-6 + the deliverables.
-->

# H.I.M. — App Store Resubmission-Readiness Report

**App:** H.I.M. ("Hi, It's Me") · Publisher: Saman Technologies LLC · iOS build 179 · Resubmission
**Reviewed against:** 2026-06-08 (WWDC26) re-released App Review Guidelines + Texas SB 2420 (eff. 2026-06-04)
**Date:** 2026-06-08

---

## 1. Go / No-Go verdict

**No-Go as originally staged → the two blockers are now fixed in code; remaining gating items are ASC-side.** The app's trust-and-safety architecture is genuinely strong for a UGC resubmission — server-side profanity filtering, block enforcement on reads, report sheets on the primary surfaces, account deletion, data export, an exemplary cold-launch push flow, and clean non-dating architecture (no swipe/match/geolocation). Two confirmed defects would have drawn a rejection: (1) **three "Pro" / "H.I.M. Pro" badges** advertising a premium tier with **zero IAP** — a textbook 2.3.1 / 3.1.1 reject visible on the profile screen and app-wide window chrome; and (2) the in-app and Terms age copy said **"17+"** for an explicitly adult LGBTQ unmoderated-UGC chat app, which the 2026 granular age-rating questionnaire will not produce, creating a 2.3.6 honesty mismatch and a 1.2.1(a) gap. **Both code/copy sides are now fixed** (badges deleted, copy moved to 18). What remains is your ASC work: set the age rating to **18+** via the new questionnaire, re-accept the agreement re-released today, and the metadata/privacy-label items in Section 6.

---

## 2. 🚫 Resubmission blockers (both now code-fixed)

### Blocker 1 — "Pro" / "H.I.M. Pro" badges advertise a premium tier with no IAP behind them ✅ FIXED
**Guideline:** 2.3.1 (hidden/undocumented features) + 3.1.1 (IAP) · *not* NEW-2026
Three live badges existed — `RetroWindow.tsx:74` (xp_shell header, app-wide), `RetroWindow.tsx:141` (default header — login/Account/Account-delete screens), `hi-its-me/page.tsx:6288` (profile hero) — with **no** product/paywall/restore/entitlement anywhere (repo-wide grep for `revenuecat|storekit|is_pro|productId` = nothing). The earlier launch doc only named the profile one and **missed both RetroWindow header instances** (the two most visible).
**Applied fix:** deleted all three spans + both CSS rules (`globals.css` `.aim-pro-badge`, `.ui-profile-pro-badge`); rebuilt so the iOS bundle is clean (verified: 0 `pro-badge` references in `dist/` + `ios/App/App/public`). Ship the real paywall as a post-approval fast-follow with StoreKit/RevenueCat + Restore Purchases.

### Blocker 2 — Age rating must be 18+; "17" copy won't agree with the ASC questionnaire ✅ FIXED (code) / ⏳ (ASC)
**Guideline:** 2.3.6 (honest age rating) + 1.2.1(a) (age-restriction mechanism) · **NEW-2026** (granular 4+/9+/13+/16+/18+ system)
H.I.M. is an explicitly adult LGBTQ social network with unmoderated real-time DMs, voice notes, **user-uploaded media that is NOT content-filtered** (the trigger scans text only), and open "vibe" rooms, processing Art. 9 sexual-orientation data. Under the 2026 questionnaire (frequent/intense mature themes + unrestricted UGC), the honest output is **18+**, not 17+. A 17+ self-claim that contradicts the questionnaire is a classic fast-reject, and a single self-attestation checkbox is effectively no 1.2.1(a) mechanism.
**Applied fix (code):** standardized **18** everywhere — `page.tsx:510`, `signupConsent.ts:9`, `terms.html` (×4), `privacy.html` (×4). **Your ASC action:** answer the new age-rating questionnaire honestly → **18+** (see deliverables §B). 17+ is not defensible for this content profile.

---

## 3. ⚠️ Should-fix before resubmit

| # | Finding | Guideline | Status |
|---|---------|-----------|--------|
| S1 | Dating-register room blurbs ("flirting"×2, "hotter," "emotionally available") rendered live under room cards | 4.3(b) | ✅ **FIXED** — rewritten to friendship register in `himArtDirection.ts` |
| S2 | No in-app "friendship, not dating" statement (it lived only in an unshipped doc) | 4.3(b) | ✅ **FIXED** — added to the signup consent line in `page.tsx` |
| S3 | Room member-roster sheet had no Block/Report (only "Add to Buddylist") | 1.2(b)(c) | ✅ **FIXED** — wired existing `onReportRoomMessage`/`onBlockRoomUser` into the roster sheet (`GroupChatWindow.tsx`) |
| S4 | No operator alerting for 24h report response; the only ops review query joins the renamed `chat_rooms` (now `_archive_chat_rooms`) | 1.2(b) | ⏳ TODO — fix `moderation_review_queue.sql:36` (`chat_rooms`→`rooms`), add an open-reports query + an insert alert (pg_net/edge fn or daily digest), describe the 24h workflow in review notes. Internal ops; not reviewer-visible, but increasingly probed. |
| S5 | `PrivacyInfo.xcprivacy` not a member of the App target (`grep -c` in `project.pbxproj` = 0) → won't ship in the binary | 5.1.2 | ⏳ TODO (Xcode) — add it to the App target / Copy Bundle Resources. Demoted from blocker (Apple's automated check targets third-party-SDK manifests; the bundled Capacitor plugins already ship theirs). |
| S6 | Manifest declares EmailAddress; ASC sheet says email not collected (users *can* add a recovery email) | 5.1.2 | ⏳ TODO — reconcile to **Email = Yes (optional recovery email)** in both manifest + ASC. |
| S7 | Manifest omits Coarse Location; ASC sheet declares it (IP) | 5.1.2 | ⏳ TODO — pick one story (recommend: omit from ASC too) and make manifest + ASC agree. |
| S8 | Filter narrower than the EULA promises — text only; bio/away/screenname/media unmoderated, yet Terms says "Every message is screened." Room reports drop the message link (`sourceMessageId:null`). | 1.2(a) | ⏳ TODO — apply moderation to profile text via a `public.users` trigger; soften Terms to "Text messages are screened" or add media takedown; plumb the room message id into `abuse_reports`. |
| S9 | Cold-DM rate limit (5/hr non-buddy) can hard-fail a reviewer DMing seeded demo accounts (PT429 on the 6th) | 2.1 | ⏳ TODO — raise cap to 15–20, **or** seed demo accounts as mutual buddies + note in review (deliverables §A does the latter). |
| S10 | Raw `RATE_LIMIT_DM_NONBUDDY:` token leaks into the chat UI | 4.0 | ⏳ TODO — catch PT429, map to a clean string, strip the prefix (`ChatWindow.tsx:2034`, `page.tsx:2283`, `buddyRequest.ts:75`). |
| S11 | Account deletion runs ~16 non-transactional deletes; an un-swallowed throw 500s before `auth.admin.deleteUser` | 5.1.1(v) | ⏳ TODO — wrap in a transaction or reorder so `auth.admin.deleteUser` always runs; try/catch the `security_events` insert so audit logging never blocks erasure. |
| S12 | MARKETING_VERSION frozen at 2.0 across builds 167–179 | 2.3.1 | ⏳ TODO (ASC) — if 2.0 was ever released, bump to 2.0.1/2.1 + release notes (ASC blocks same-version resubmission). |
| S13 | Startup chrome fallback → chrome-less first paint up to 3s | 2.1 | ⏳ TODO — paint a branded loading state in `index.html`; shorten the fallback to ~1.5s. |
| S14 | CI ships the hand-synced bundle without rebuilding (only checks for `index.html`) | 2.1 | ⏳ TODO — add a pre-archive guard that fails if `git diff` over `dist/`+`ios/.../public` is non-empty; run `ios:preflight` before archiving. |

---

## 4. Nice-to-have / post-approval

- **Texas SB 2420 native APIs not implemented** (Declared Age Range, PermissionKit, `AppStore.ageRatingCode`, App Store Server Notifications). **Legal-distribution obligation, NOT a review reject** (Apple: "no changes to the App Review process"). See §5. (needs iOS 26.2+ SDK)
- Report-SLA placeholder + LEGAL-REVIEW HTML comments still ship publicly in `terms.html`/`privacy.html` — strip before publishing.
- ASC pushback script cites a non-existent `consent_timestamps` table — consent is actually in `public.users.age_confirmed_at`/`art9_consent_at` (migration `20260525000001`); fix the citation.
- Retention table vague ("per provider standard policies"); disappearing-message purge admitted "planned" — fill windows or soften the in-app label.
- Make the build+unit CI check **Required** so a future cold-launch `requestPermissions` can't ship.

---

## 5. The 2026 / today-specific exposure

| Item | Applies? | Call |
|------|----------|------|
| **Re-accept Guidelines + PLA (re-released 2026-06-08)** | Yes — every account. | **Do first.** Re-released today at WWDC26; submission is silently blocked until accepted in ASC. Step 0. |
| **Granular age rating → 18+** | Yes. | **Done in code; set 18+ in ASC.** Was Blocker 2. Non-negotiable for swift approval. |
| **Texas SB 2420 age assurance (eff. 2026-06-04)** | Yes (US/Texas). None wired up. | **Legal, not review.** Mitigate now: rate 18+ (doing), rely on Apple's account-level Declared Age Range signal, and **state this in review notes**. Full native bridge (Declared Age Range read + PermissionKit + `ageRatingCode` + consent-withdrawal notifications) is a fast-follow, not a launch blocker. Excluding Texas is the only full deferral and is not recommended. Consult counsel. |
| **"Random/anonymous chat + objectification" removal clause** | Adjacent; **does not bite.** | No random/anonymous pairing exists; rooms are 7 named, persistent channels with stable screennames; DMs require an accepted buddy. **Mitigate with one review-note line** (deliverables §A). S1/S2/S3 fixes remove the only ambiguity. |
| **iOS 27 Time Allowances (Social Media category)** | Indirect. | **No dev action.** Set Primary Category = **Social Networking** (not Lifestyle/Dating). |

---

## 6. Submission checklist (ordered)

**Phase A — Agreements & metadata (App Store Connect)**
1. **Re-accept** the re-released App Review Guidelines + Apple Developer Program License Agreement (released 2026-06-08). Submission is blocked until done.
2. Primary Category = **Social Networking**.
3. Age-rating questionnaire → **18+** (answer honestly for unrestricted UGC + frequent/intense mature themes; deliverables §B).
4. **Keywords / name / description:** use the friendship-first set from `him-launch-deliverables.md` (omits date/dating/hookup/match/meet/single/nearby/flirt). App name "H.I.M. — Friends, Not Dates."
5. **Screenshots:** buddy list, away messages, chat rooms — **no** profile grid / card stack / photo-browse.
6. If 2.0 was ever released, bump **MARKETING_VERSION** (S12).

**Phase B — Code (✅ done this branch, then archive)**
7. ✅ All 3 Pro badges + CSS removed. [Blocker 1]
8. ✅ 17 → 18 across app + Terms + Privacy. [Blocker 2]
9. ✅ Dating-register room blurbs rewritten. [S1]
10. ✅ In-app "friendship, not dating" line. [S2]
11. ✅ Block/Report in the room roster sheet. [S3]
12. ✅ Rebuilt — `dist/`, `native-web/`, `ios/App/App/public` resynced. Remaining code TODOs: S9/S10 (rate-limit cap + PT429 copy), S11 (deletion robustness), S13/S14.

**Phase C — Privacy labels & legal (ASC + Xcode)**
13. Add `PrivacyInfo.xcprivacy` to the App target (S5); reconcile Email (S6) + Coarse Location (S7) between manifest and ASC.
14. Set nutrition labels to match (Sensitive Info: sexual orientation; User Content; identifiers; Email per §S6). Confirm privacy link in ASC + in-app.
15. Strip LEGAL-REVIEW HTML comments + the SLA placeholder; insert a concrete 24h report-response line. Fix `moderation_review_queue.sql` + stand up a minimal report-alert path (S4).

**Phase D — Review notes (pre-empt the reviewer)** — see deliverables §A; include the friendship positioning, the 1.2 safety surface, the named-rooms/no-random-pairing line, the 18+/age-assurance posture, and pre-friended demo accounts.

**Bottom line:** Both blockers are fixed in code. The gating items left are ASC-side — re-accept the agreement, rate 18+, fix the metadata/privacy labels — plus the should-fix code TODOs. With the strong T&S surface and the differentiation handed to the reviewer up front, this should carry to a swift approval.
