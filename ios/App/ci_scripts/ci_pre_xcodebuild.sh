#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
DEBUG_XCCONFIG="$REPOSITORY_ROOT/ios/debug.xcconfig"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/public"
VENDOR_ROOT="$IOS_PROJECT_ROOT/CapacitorVendor"
REQUIRED_PACKAGES="
$VENDOR_ROOT/AparajitaCapacitorBiometricAuth
$VENDOR_ROOT/CapacitorHaptics
$VENDOR_ROOT/CapacitorLocalNotifications
$VENDOR_ROOT/CapacitorPushNotifications
$VENDOR_ROOT/CapawesomeCapacitorBadge
"
XCODEBUILD_ACTION="${CI_XCODEBUILD_ACTION:-}"

# Xcode Cloud's test-without-building runners only receive the ci_scripts folder,
# not the full repository checkout. Source validation must therefore be limited
# to build/archive environments that actually have the checked-in assets.
if [ "$XCODEBUILD_ACTION" = "test-without-building" ]; then
    echo "Skipping source validation for Xcode Cloud test-without-building runner"
    exit 0
fi

if [ ! -f "$WEB_BUNDLE_DIR/index.html" ]; then
    echo "error: Xcode Cloud build aborted because ios/App/App/public/index.html is missing."
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
