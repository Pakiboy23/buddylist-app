# Xcode Cloud

This repository is set up for Xcode Cloud builds of the `App` scheme.

## What the scripts do

- `ci_post_clone.sh` fails early if the checked-in web bundle or committed vendored Swift packages are missing.
- `ci_pre_xcodebuild.sh` repeats that validation immediately before the Xcode build starts and disables Debug code signing for Xcode Cloud's unsigned generic-device build step.

These scripts live in `ios/App/ci_scripts/` — Xcode Cloud discovers them automatically next to the `.xcodeproj`.

## Vendored Swift packages

The `CapApp-SPM` package now points at committed Swift package copies under `ios/App/CapacitorVendor/` instead of `node_modules/`.

Refresh those vendored packages whenever Capacitor iOS plugins change:

```sh
npm run ios:sync
```

That sync command now runs `scripts/prepare-ios-swift-packages.mjs` automatically after `npx cap sync ios`.

## Recommended workflows

Create these workflows in Xcode or App Store Connect after enabling Xcode Cloud for the project:

1. `CI`
   - Scheme: `App`
   - Start conditions: pull requests and changes to your main branch
   - Action: `Build`
2. `Beta`
   - Scheme: `App`
   - Start condition: manual, then optionally tags or release branches
   - Action: `Archive`
   - Distribution: `TestFlight`

## Important constraint

If you later move back to rebuilding the web app in CI, update these scripts to install dependencies and generate fresh output before the Xcode build. Until then, keep `App/App/public` committed and in sync with the web app.
