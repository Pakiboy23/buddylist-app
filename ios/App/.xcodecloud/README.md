# Xcode Cloud

This repository is set up for Xcode Cloud builds of the `App` scheme.

## What the scripts do

- `scripts/ci_post_clone.sh` fails early if the checked-in web bundle is missing.
- `scripts/ci_pre_xcodebuild.sh` repeats that validation immediately before the Xcode build starts.

These checks are intentional. The current iOS project builds successfully from the committed assets in `App/App/public`, and there is no Node lockfile or web build pipeline in this directory for Xcode Cloud to run.

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
