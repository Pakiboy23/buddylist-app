#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
DEBUG_XCCONFIG="$REPOSITORY_ROOT/ios/debug.xcconfig"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/public"
VENDOR_ROOT="$IOS_PROJECT_ROOT/CapacitorVendor"
REQUIRED_PACKAGES="
$VENDOR_ROOT/AparajitaCapacitorBiometricAuth
$VENDOR_ROOT/CapacitorApp
$VENDOR_ROOT/CapacitorHaptics
$VENDOR_ROOT/CapacitorLocalNotifications
$VENDOR_ROOT/CapacitorPushNotifications
$VENDOR_ROOT/CapawesomeCapacitorBadge
"
XCODEBUILD_ACTION="${CI_XCODEBUILD_ACTION:-}"

# shellcheck disable=SC1091
. "$REPOSITORY_ROOT/ci_scripts/docs-only.sh"

# Xcode Cloud's test-without-building runners only receive the ci_scripts folder,
# not the full repository checkout. Source validation must therefore be limited
# to build/archive environments that actually have the checked-in assets.
if [ "$XCODEBUILD_ACTION" = "test-without-building" ]; then
    echo "Skipping source validation for Xcode Cloud test-without-building runner"
    exit 0
fi

# ITMS-90382: App Store rejects further uploads once the daily cap is hit.
# Markdown-only PRs (MEMORY.md, skills, scorecards) were archiving and burning
# that cap on 22 Aug 2026 (2.3 builds 368, 369, 370).
#
# Always print what the gate saw. The 23 Aug failure (PR #124 archived despite
# being two docs files) was undiagnosable from the Xcode Cloud log because this
# script decided silently.
echo "Archive gate: action=${XCODEBUILD_ACTION:-unset}" \
     "pr=${CI_PULL_REQUEST_NUMBER:-none}" \
     "branch=${CI_BRANCH:-none}" \
     "tag=${CI_TAG:-none}"

if [ "$XCODEBUILD_ACTION" = "archive" ]; then
    # No pull-request build can ever ship: releases archive from main or a tag.
    # A PR archive can therefore only spend ITMS-90382 upload quota. Classifying
    # the diff was never the right question — PR #129 (29 Aug 2026) was a genuine
    # code change, classified 'code', archived, and died at "Preparing build for
    # App Store Connect", burning an upload attempt to recolour a splash screen.
    #
    # This subsumes the old 'unknown'-on-a-PR rule: is_pull_request_build needs no
    # git history, so it still holds on the shallow checkouts where classify_change
    # cannot resolve origin/main. Compilation is unaffected — the Build actions run
    # on PRs and are what actually catch breakage.
    if is_pull_request_build; then
        echo "error: pull-request build; refusing Xcode Cloud archive to preserve ITMS-90382 quota."
        echo "error: PR compilation is covered by the Build actions; releases archive from main or a tag."
        echo "error: Set a Files-and-Folders start condition on the Archive workflow in App Store"
        echo "error: Connect so these stop starting at all — this gate only refuses them after the fact."
        exit 1
    fi

    CHANGE_CLASS=$(classify_change)
    echo "Archive gate: change=$CHANGE_CLASS"

    if [ "$CHANGE_CLASS" = "docs-only" ]; then
        echo "error: docs-only change; refusing Xcode Cloud archive to preserve ITMS-90382 quota."
        echo "error: Set a Files-and-Folders start condition on the Archive workflow in App Store Connect."
        exit 1
    fi
fi

if [ ! -f "$WEB_BUNDLE_DIR/index.html" ]; then
    echo "error: Xcode Cloud build aborted because App/App/public/index.html is missing."
    exit 1
fi

for package_dir in $REQUIRED_PACKAGES; do
    if [ ! -d "$package_dir" ]; then
        echo "error: Missing required vendored Swift package directory: $package_dir"
        echo "error: Run npm run ios:sync locally so CapacitorVendor stays in sync with iOS plugins."
        exit 1
    fi
done

if [ ! -f "$DEBUG_XCCONFIG" ]; then
    echo "error: Missing expected debug xcconfig file: $DEBUG_XCCONFIG"
    exit 1
fi

if ! grep -q '^CODE_SIGNING_ALLOWED = NO$' "$DEBUG_XCCONFIG"; then
    cat <<'EOF' >> "$DEBUG_XCCONFIG"

// Xcode Cloud runs an unsigned generic iOS Debug build before archive.
CODE_SIGNING_ALLOWED = NO
EOF
fi

echo "Xcode Cloud pre-build validation passed"
