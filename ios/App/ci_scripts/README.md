# Xcode Cloud

This repository is set up for Xcode Cloud builds of the `App` scheme.

## What the scripts do

- `ci_post_clone.sh` validates the checked-in web bundle exists and runs `npm ci`.
- `ci_pre_xcodebuild.sh` verifies required Capacitor native packages were installed before the Xcode build starts.

These scripts live in `ios/App/ci_scripts/` — Xcode Cloud discovers them automatically next to the `.xcodeproj`.

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
