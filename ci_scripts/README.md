# Xcode Cloud

This repository is set up for Xcode Cloud builds of the `HIM` scheme.

## What the scripts do

- `ci_scripts/ci_post_clone.sh` fails early if the checked-in web bundle or committed vendored Swift packages are missing.
- `ci_scripts/ci_pre_xcodebuild.sh` repeats that validation immediately before build and archive actions, disables Debug code signing for Xcode Cloud's unsigned generic-device build step, and skips source checks in `test-without-building` runners where Xcode Cloud only provides the `ci_scripts` folder.

These checks are intentional. The current iOS project builds successfully from the committed assets in `App/App/public`, and there is no Node lockfile or web build pipeline in this directory for Xcode Cloud to run.

## Vendored Swift packages

The `CapApp-SPM` package now points at committed Swift package copies under `ios/App/CapacitorVendor/` instead of `node_modules/`.

Refresh those vendored packages whenever Capacitor iOS plugins change:

```sh
npm run ios:sync
```

That sync command now runs `scripts/prepare-ios-swift-packages.mjs` automatically after `npx cap sync ios`.

## Archive quota (ITMS-90382)

Every archive Xcode Cloud runs also **uploads** to App Store Connect, and
ITMS-90382 is a rolling count of upload slots — not a time window. So any
archive outside a release spends a slot a real release needs. Xcode Cloud
archived markdown-only PRs on 22 Aug 2026 and App Store Connect returned
ITMS-90382 on 2.3 builds 368, 369 and 370; builds 374/375 later reached ASC
from a docs PR the same way.

`ci_pre_xcodebuild.sh` now refuses an archive unless it is **main or a tag**:

| Trigger | Archive |
| --- | --- |
| Pull request | refused |
| Branch other than `main` | refused |
| `main` | allowed |
| Tag | allowed |

It refuses *before* `xcodebuild` runs, so no archive is produced and no slot is
spent. Non-archive actions (Build, test-without-building) still run on every PR,
so pull requests keep full compile coverage. The docs-only and unclassifiable-PR
gates remain underneath for `main` builds.

Note this is the repo-side half. The complete fix is still to unhook Archive
from the PR and branch start conditions in App Store Connect — console-only, and
not something the repo can enforce.

Also set this on the Archive workflow in App Store Connect (Start Condition, Files and Folders), include:

- `src/`, `ios/`, `android/`, `supabase/`, `api/`, `public/`
- `capacitor.config.ts`, `package.json`, `native-web/`, `dist/`

Exclude `*.md`, `.agents/`, `.claude/`, `marketing/`, `docs/`, `MEMORY.md`. Build (non-archive) can still run on every PR.

## Recommended workflows

Create these workflows in Xcode or App Store Connect after enabling Xcode Cloud for the project:

1. `CI`
   - Scheme: `HIM`
   - Start conditions: pull requests and changes to your main branch
   - Action: `Build`
2. `Beta`
   - Scheme: `HIM`
   - Start condition: manual, then optionally tags or release branches
   - Action: `Archive`
   - Distribution: `TestFlight`

## Important constraint

If you later move back to rebuilding the web app in CI, update these scripts to install dependencies and generate fresh output before the Xcode build. Until then, keep `App/App/public` committed and in sync with the web app.
