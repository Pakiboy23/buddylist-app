# iOS App Store Release

This repo now has a Capacitor iOS project at `ios/App/App.xcodeproj`.

## Current setup

- Bundle/app id: `com.buddylist.app`
- App name: `BuddyList`
- The iOS shell now defaults to bundled native assets from `native-web/`.
- Hosted mode still exists, but only as an explicit opt-in debug path via `npm run ios:sync:hosted`.
- The native export intentionally excludes `src/app/api` and continues to use the hosted backend for recovery/admin requests via `NEXT_PUBLIC_APP_API_ORIGIN`.
- The committed Xcode project is currently narrowed to iPhone portrait to reduce App Review surface area.

Hosted mode still depends on the live web app. Bundled mode ships the UI locally, but it is not offline-first:
Supabase auth/data and the recovery/admin backend still require network access.

## Prerequisites

- Full Xcode installed
- Apple Developer membership active
- App Store Connect app created for `com.buddylist.app`

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

2. In Xcode, select target `App`.
3. Set `Signing & Capabilities`:
   - Team: your Apple Developer team
   - Bundle Identifier: keep `com.buddylist.app` unless you intentionally change it everywhere
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

## Native permissions already wired

- `NSPhotoLibraryUsageDescription` for profile photo upload
- `NSCameraUsageDescription` for taking a profile photo from the iOS picker

## Bundled-build prep already in place

- Client recovery/admin calls can target a hosted backend origin from native builds.
- Override the default backend origin with `NEXT_PUBLIC_APP_API_ORIGIN` if you move API traffic off `https://buddylist-app.vercel.app`.
- The native bundle is generated in an isolated export workspace so App Router pages can statically export without shipping the web-only `src/app/api` routes into Capacitor.
