# Android Play Release

End-to-end guide to ship H.I.M. (`com.hiitsme.app`) to Google Play. The repo can
build a signed Play bundle (`.aab`) with Gradle and serve Android push via FCM.

> **Status:** iOS is live in the App Store. This guide covers bringing the Android
> build to parity and getting it live on Google Play.

---

## 0) One-time account setup

- Google Play Console developer account (one-time $25), with the app created for
  package id `com.hiitsme.app`.
- Firebase project `hiitsmeapp` (already wired — see `android/app/google-services.json`).
- Java 17+ (`java -version`) and Android SDK / Android Studio for local builds.

---

## 1) Backend: enable Android push (FCM) — **required for launch**

Android push is delivered by the `push-dispatch` Supabase Edge Function via Firebase
Cloud Messaging HTTP v1. The client already registers FCM tokens (`platform = 'android'`);
the function sends to them once an FCM service account is configured.

1. Firebase Console → Project settings → **Service accounts** → *Generate new private key*.
   This downloads a service-account JSON with `client_email`, `private_key`, `project_id`.
2. Set it as a secret on the deployed function (single-line JSON):
   ```bash
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON="$(cat ~/Downloads/hiitsmeapp-service-account.json)"
   ```
3. Redeploy: `supabase functions deploy push-dispatch`.

If `FCM_SERVICE_ACCOUNT_JSON` is unset the function skips Android tokens (logging a
warning) and iOS delivery is unaffected — so iOS can never be broken by a missing
Android config, but Android users get **no** notifications until this is set.

---

## 2) Create the upload keystore (one-time)

```bash
keytool -genkey -v \
  -keystore ~/keys/hiitsme-upload.jks \
  -alias upload \
  -keyalg RSA -keysize 2048 -validity 10000
```

Store this file safely (password manager + backup). **If you lose it you cannot push
updates** unless you reset the upload key with Google.

---

## 3) Configure signing (local file, not committed)

```bash
cp android/keystore.properties.example android/keystore.properties
```

Edit `android/keystore.properties`:

```properties
storeFile=/absolute/path/to/hiitsme-upload.jks
storePassword=...
keyAlias=upload
keyPassword=...
```

Alternative (used by CI): set env vars instead of the file —
`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`. A `*release*` Gradle task fails fast if none are present.

---

## 4) App Links / `assetlinks.json` — use the **Play App Signing** fingerprint ⚠️

`public/.well-known/assetlinks.json` declares the SHA-256 cert fingerprint that lets
`https://hiitsme.app/join/<code>` open the app without a chooser. With Play App Signing
(the default), **Google re-signs your app with a different key than your upload key**,
so the fingerprint in `assetlinks.json` must be the *App signing key* fingerprint, not
your upload keystore's.

After the first upload, get it from:

> Play Console → your app → **Setup → App signing** → *App signing key certificate* → SHA-256

Confirm it matches `public/.well-known/assetlinks.json`. To read your **upload** key's
fingerprint locally (for comparison only):

```bash
keytool -list -v -keystore ~/keys/hiitsme-upload.jks -alias upload | grep SHA256
```

If they differ, update `assetlinks.json` with the **App signing** value, rebuild the
web bundle, and redeploy the site (Vercel serves `public/.well-known/assetlinks.json`).

---

## 5) Bump the version for each release

`versionCode` must strictly increase for every Play upload. Use the helper:

```bash
npm run android:version:bump                 # versionCode += 1
npm run android:version:bump -- --code 5     # set versionCode = 5
npm run android:version:bump -- --name 1.1.0 # set versionName
```

This edits the `defaultVersionCode`/`defaultVersionName` in
[android/app/build.gradle](./android/app/build.gradle). Env vars
(`ANDROID_VERSION_CODE` / `ANDROID_VERSION_NAME`) and Gradle properties
(`-PandroidVersionCode` / `-PandroidVersionName`) override the defaults at build time —
CI uses the env vars.

---

## 6) Preflight + build the release bundle

```bash
npm run android:preflight        # lint, unit tests, build, assets, sync + release checks
npm run android:bundle:release   # gradle bundleRelease
```

`android:preflight` mirrors `ios:preflight`: it runs the full build, syncs the bundled
web layer, and asserts the sync stayed bundled (no `server.url`), `google-services.json`
matches `com.hiitsme.app`, the `POST_NOTIFICATIONS` permission is present, and
`assetlinks.json` references the package.

Output bundle:

`android/app/build/outputs/bundle/release/app-release.aab`

### CI alternative

`.github/workflows/android-release.yml` (manual *Run workflow*) builds the signed `.aab`
in GitHub Actions and uploads it as an artifact. It needs these repo secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Generate the
keystore secret with `base64 -w0 ~/keys/hiitsme-upload.jks`.

---

## 7) Play Console: app content & store listing

Complete these in **Play Console → your app**, mostly under *App content* and *Store presence*:

- [ ] **Data safety** — fill from [docs/compliance/google-play-data-safety.md](./docs/compliance/google-play-data-safety.md) (resolve the legal open items first).
- [ ] **Privacy policy** URL (App content → Privacy policy).
- [ ] **App access** — provide test credentials if sign-in is required for review.
- [ ] **Content rating** questionnaire (social/communication app; user-generated content → likely Mature 17+).
- [ ] **Target audience and content** — 18+/adults; not directed at children (matches the Families Policy = No answer in the data-safety doc).
- [ ] **Ads** — declare *No ads*.
- [ ] **Government apps / News / COVID** — No.
- [ ] **Store listing** — app name (H.I.M.), short + full description, app icon (512×512), feature graphic (1024×500), phone screenshots (min 2), category (Communication / Social).

---

## 8) Upload and roll out

- Play Console → **Test and release** → start with **Internal testing**, then promote to
  **Production**.
- Create release → upload `app-release.aab` → add release notes → review → roll out.
- First-time apps go through a review (can take days); subsequent updates are faster.

---

## Pre-submission checklist

- [ ] `FCM_SERVICE_ACCOUNT_JSON` set on `push-dispatch`; redeployed; Android push verified on a device.
- [ ] `npm run android:preflight` passes.
- [ ] `versionCode` exceeds the last Play upload.
- [ ] `assetlinks.json` uses the **Play App Signing** SHA-256 (not the upload key).
- [ ] Signing configured (keystore.properties or `ANDROID_KEYSTORE_*`); keystore backed up.
- [ ] Data safety, content rating, target audience, privacy policy completed in Play Console.
- [ ] Store listing assets uploaded (icon, feature graphic, screenshots).

## Notes

- `npm run android:sync` syncs the bundled `native-web/` frontend by default.
  `npm run android:sync:hosted` only for the old hosted shell (debug).
- Keep `android/keystore.properties` and any `.jks`/`.keystore` out of git.
- `targetSdk`/`compileSdk` are 36 (see `android/variables.gradle`), above Play's current
  API-35 floor for new apps.
