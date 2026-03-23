# iOS App Store Release

This repo now has a Capacitor iOS project at `ios/App/App.xcodeproj`.

## Current setup

- Bundle/app id: `com.buddylist.app`
- App name: `BuddyList`
- The iOS shell currently loads the production site from `https://buddylist-app.vercel.app`
  via `server.url` in [capacitor.config.ts](./capacitor.config.ts).

That means App Store builds depend on the live hosted web app. If you want a fully bundled/offline
app later, remove `server.url` and ship compiled web assets in `webDir`.

## Prerequisites

- Full Xcode installed
- Apple Developer membership active
- App Store Connect app created for `com.buddylist.app`

## Repo commands

```bash
npm run ios:assets
npm run ios:sync
npm run ios:open
```

`npm run ios:assets` regenerates the branded native app icon and splash art from the repo palette.

## First Xcode pass

1. Open the project:

```bash
npm run ios:assets
npm run ios:sync
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

Because this shell points at the hosted production site, App Review will effectively review a web-powered app.
That can still work, but it is a weaker submission shape than a bundled Capacitor build. If Apple pushes back,
the fix is architectural: ship bundled web assets instead of a remote `server.url` wrapper.

## Native permissions already wired

- `NSPhotoLibraryUsageDescription` for profile photo upload
- `NSCameraUsageDescription` for taking a profile photo from the iOS picker

## Bundled-build prep already in place

- Client recovery/admin calls can target a hosted backend origin from native builds.
- Override the default backend origin with `NEXT_PUBLIC_APP_API_ORIGIN` if you move API traffic off `https://buddylist-app.vercel.app`.
