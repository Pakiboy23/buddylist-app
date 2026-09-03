# iOS App Store Release

This repo has a Capacitor iOS project at `ios/App/App.xcodeproj`.

## Current setup

- Bundle/app id: `com.hiitsme.app`
- App name: `H.I.M.`
- **React owns every pixel.** There is no SwiftUI buddy list or native chrome. `AppDelegate` + `HiItsMeShellViewController` embed the Capacitor WKWebView edge-to-edge. `HiItsMeShell.isAvailable` is `false` on purpose so the web app renders its own chrome.
- The iOS shell defaults to bundled native assets from `native-web/` (copied into `ios/App/App/public`).
- Hosted mode still exists, but only as an explicit opt-in debug path via `npm run ios:sync:hosted`.
- The native export intentionally excludes `src/app/api` and continues to use the hosted backend for recovery/admin requests via `NEXT_PUBLIC_APP_API_ORIGIN`.
- The committed Xcode project is currently narrowed to iPhone portrait to reduce App Review surface area.

A web UI change reaches iOS only after `npm run build && npm run ios:sync` and a commit of `dist/` + `ios/App/App/public`. What the phone shows is the same entry chunk as `hiitsme.app`.

Hosted mode still depends on the live web app. Bundled mode ships the UI locally, but it is not offline-first:
Supabase auth/data and the recovery/admin backend still require network access.

### Stale WKWebView after a reinstall

WKWebView site data (HTTP disk cache and any service-worker Cache Storage) survives an in-place Xcode Run and an App Store update. A previously registered service worker will keep serving the old bundle.

`AppDelegate.clearWebViewCacheIfBuildChanged()` wipes `WKWebsiteDataStore` once per new `CFBundleVersion` (`UserDefaults` key `lastLaunchedCFBundleVersion`). If you are debugging a "I rebuilt but the phone still looks old" report, confirm the build number actually changed. Same-number reinstalls will not clear the cache.

## Prerequisites

- Full Xcode installed
- Apple Developer membership active
- App Store Connect app created for `com.hiitsme.app`

## Repo commands

```bash
npm run ios:assets
npm run ios:sync
npm run ios:sync:bundled
npm run ios:sync:hosted
npm run ios:preflight
npm run ios:open
```

`npm run ios:assets` regenerates the branded native app icon and splash art from the repo palette.
`npm run ios:sync` is the release-safe default: it builds a local `native-web/` export and syncs iOS without using `server.url`.
`npm run ios:sync:hosted` keeps the old hosted shell available when you intentionally need it.
`npm run ios:preflight` runs lint, unit tests, web build, asset generation, iOS sync, and then verifies the generated iOS project stayed bundled and iPhone-only.

## First Xcode pass

1. Open the project:

```bash
npm run ios:preflight
npm run ios:open
```

2. In Xcode, select target `HIM`.
3. Set `Signing & Capabilities`:
   - Team: your Apple Developer team
   - Bundle Identifier: keep `com.hiitsme.app` unless you intentionally change it everywhere
   - Turn on `Automatically manage signing`
4. Update `Version` and `Build` before each submission.
5. Choose a real iPhone device or `Any iOS Device (arm64)` and build once.

## TestFlight / App Store

1. In Xcode: `Product` -> `Archive`
2. When Organizer opens, choose `Distribute App`
3. Upload to App Store Connect
4. In App Store Connect:
   - complete app metadata
   - add screenshots
   - create a TestFlight build first
   - promote to production after review

## Important review note

Hosted mode still exists, but it is now an explicit debug-only escape hatch. The App Review/TestFlight path should stay on the default bundled `npm run ios:sync` flow so the UI is local in the app shell while recovery/admin requests still hit the hosted backend.

Never run `npx cap copy ios` — it regenerates `capacitor.config.json` and drops `HiItsMeShellPlugin`. Always `npm run ios:sync` / `pnpm run ios:sync`.

Push permission is never requested on cold launch. See [docs/push-dispatch.md](./docs/push-dispatch.md). Xcode Cloud archive rules: [ci_scripts/README.md](./ci_scripts/README.md).

## Native permissions already wired

- `NSPhotoLibraryUsageDescription` for profile photo upload
- `NSCameraUsageDescription` for taking a profile photo from the iOS picker

## Bundled-build prep already in place

- Client recovery/admin calls can target a hosted backend origin from native builds.
- Override the default backend origin with `NEXT_PUBLIC_APP_API_ORIGIN` if you move API traffic off `https://hiitsme-app.vercel.app`.
- The native bundle is generated in an isolated export workspace so App Router pages can statically export without shipping the web-only `src/app/api` routes into Capacitor.
