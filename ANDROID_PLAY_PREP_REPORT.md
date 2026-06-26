# Android / Google Play Prep — Report

**Date:** 2026-06-26
**Branch:** `claude/android-play-prep` (committed, **not pushed**)
**App:** H.I.M. — `com.hiitsme.app` (already live on the Apple App Store)

---

## TL;DR

The core Android backend + release tooling was already merged in **PR #67** (`feat(android): wire up FCM push and Play Store release tooling`). This session **verified** that work end-to-end and added the missing **store assets** (listing copy, feature graphic, Android screenshots). The repo can now produce a signed, uploadable `.aab`. What remains is account-level and cannot be automated (real keystore, Play Console, secrets, legal sign-off).

---

## ✅ Done & verified

### Verified from PR #67 (already on `main`)
- **FCM Android push** in `supabase/functions/push-dispatch/index.ts` — FCM HTTP v1 alongside APNs, gated on `FCM_SERVICE_ACCOUNT_JSON` (iOS unaffected if unset). 49 FCM/Firebase references in the file.
- **`POST_NOTIFICATIONS`** present in `android/app/src/main/AndroidManifest.xml`.
- **Release tooling**: `npm run android:preflight`, `npm run android:version:bump`, env-driven `versionCode`/`versionName`, `.github/workflows/android-release.yml`.
- **`.gitignore`** covers `*.p8` / `AuthKey_*.p8` — the loose APNs keys in the repo root are no longer tracked/exposed.
- **targetSdk/compileSdk 36** (above Play's API-35 floor).

### Repo preflight — PASS
`npm run android:preflight` → exit 0. Ran lint, unit tests, web build, asset generation, Capacitor sync, and asserted: bundled `webDir=dist` (no `server.url`), `applicationId=com.hiitsme.app`, `google-services.json` has the Android client, `POST_NOTIFICATIONS` present, `assetlinks.json` references the package.

### Signed release bundle — BUILT
- `npm run android:bundle:release` → **BUILD SUCCESSFUL in 29s**, `:app:signReleaseBundle` ran.
- Artifact: `android/app/build/outputs/bundle/release/app-release.aab` — **6.78 MB**.
- `jarsigner -verify` → **"jar verified."**
- JDK used: Android Studio JBR (OpenJDK 21). The default macOS `java` is not on PATH — set `JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"` (or `brew`'s `openjdk@21`) before building.
- Signed with a **throwaway** keystore (`/tmp/him-throwaway-upload.jks`, *not* committed, *not* your real key) purely to prove the pipeline. **You must build the real release with your own upload keystore.**

### Store assets — generated this session (committed)
- **Listing copy:** `docs/play-store/listing.md` — app name, short/full description, "what's new", content-rating notes, graphics checklist, App-content checklist. Uses the current "friendship-first" framing (per commit #60); the internal GTM "for gay men" positioning is intentionally not used in public copy — override if you want it.
- **Feature graphic:** `screenshots/play-store/feature-graphic.png` — exactly **1024×500**, Midnight-amber brand, uses the real app-icon art. Regenerate: `npm run play:feature-graphic`.
- **Screenshots:** `screenshots/play-store/{phone,tablet-7,tablet-10}/` — **18 PNGs** (6 screens × 3 sizes). Phone = **1080×1920** (1.78:1, within Play's 2:1 cap). Unauthenticated screens (sign-in/up, forgot-password) are live captures; authenticated screens (buddy list, DM, rooms) use faithful mockups. Regenerate: `npm run play:screenshots`.
- New scripts: `scripts/generate-play-screenshots.mjs`, `scripts/generate-play-feature-graphic.mjs`. The App Store screenshot script (`take-app-store-screenshots.mjs`) was refactored to **export** its mockup renderers (and guard `main()`) so the Play script reuses them — single source of truth, iOS flow unchanged.

---

## 🚫 Blocked on you (cannot be automated)

1. **Real upload keystore** — create it and **back it up** (losing it blocks all future updates):
   ```bash
   keytool -genkey -v -keystore ~/keys/hiitsme-upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
   ```
   Then provide signing via `android/keystore.properties` (uncommitted) or `ANDROID_KEYSTORE_*` env vars, and rebuild: `npm run android:bundle:release`.
2. **FCM secret** — Android push stays silent until you set it:
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/hiitsmeapp-service-account.json)"
   supabase functions deploy push-dispatch
   ```
   (Firebase Console → Project settings → Service accounts → Generate new private key.)
3. **App Links fingerprint** — `public/.well-known/assetlinks.json` currently lists
   `44:41:FE:FC:…:88`. **Confirm this equals the Play App Signing cert SHA-256** (Play Console → Setup → App signing) after first upload, since Google re-signs with a key different from your upload key. Your upload key's fingerprint, for comparison:
   ```bash
   keytool -list -v -keystore ~/keys/hiitsme-upload.jks -alias upload | grep SHA256
   ```
   This file is served by the `hiitsme.app` domain (the landing repo), so update + redeploy there if it differs.
4. **Play Console** — create the app for `com.hiitsme.app`, upload the `.aab`, complete Data safety, content rating, target audience, and the store listing (paste from `docs/play-store/listing.md`).
5. **Legal sign-off** — the Data Safety answers in `docs/compliance/google-play-data-safety.md` still need counsel review (open items listed in that doc).

---

## Commits on `claude/android-play-prep`

(See `git log main..claude/android-play-prep`.) Nothing was pushed; review and merge when ready.
