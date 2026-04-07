# Android Play Release

This project can build a signed Play Store bundle (`.aab`) with Gradle.

## 1) Prerequisites

- Java 17+ installed (`java -version`)
- Android SDK / Android Studio installed
- Google Play Console app created for package id `com.hiitsme.app`

## 2) Create upload keystore (one-time)

```bash
keytool -genkey -v \
  -keystore ~/keys/hiitsme-upload.jks \
  -alias upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Store this file safely (password manager + backup). Do not lose it.

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

Alternative: set env vars instead of file:

- `ANDROID_KEYSTORE_PATH`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

## 4) Bump app version for each release

Edit [android/app/build.gradle](./android/app/build.gradle):

- `versionCode` -> increment integer every release
- `versionName` -> user-facing version string

## 5) Build release bundle

```bash
npm run android:sync
npm run android:bundle:release
```

Output bundle:

`android/app/build/outputs/bundle/release/app-release.aab`

## 6) Upload to Play Console

- Play Console -> your app -> `Test and release` -> `Production` (or `Internal testing`)
- Create release -> upload `app-release.aab`
- Complete release notes + rollout

## Notes

- `npm run android:sync` now syncs the bundled `native-web/` frontend by default.
- `npm run android:sync:hosted` is available only when you intentionally want the old hosted shell.
- Release build fails fast if signing config is missing.
- Keep `android/keystore.properties` and `.jks` out of git.
