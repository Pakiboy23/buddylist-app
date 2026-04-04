#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/public"
VENDOR_ROOT="$IOS_PROJECT_ROOT/CapacitorVendor"
REQUIRED_PACKAGES="
$VENDOR_ROOT/AparajitaCapacitorBiometricAuth
$VENDOR_ROOT/CapacitorHaptics
$VENDOR_ROOT/CapacitorLocalNotifications
$VENDOR_ROOT/CapacitorPushNotifications
$VENDOR_ROOT/CapawesomeCapacitorBadge
"

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

echo "Xcode Cloud pre-build validation passed"
