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
# that cap on 22 Aug 2026 (2.3 builds 368, 369, 370). Refuse archive here.
# Also set a Files-and-Folders start condition on the Archive workflow in
# App Store Connect: src/, ios/, android/, supabase/, api/, public/,
# capacitor.config.ts, package.json, native-web/, dist/.
if [ "$XCODEBUILD_ACTION" = "archive" ] && docs_only_change; then
    echo "error: docs-only change; refusing Xcode Cloud archive to preserve ITMS-90382 quota."
    echo "error: Set a Files-and-Folders start condition on the Archive workflow in App Store Connect."
    exit 1
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
