#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/public"
ENTRYPOINT_FILE="$WEB_BUNDLE_DIR/index.html"
VENDOR_ROOT="$IOS_PROJECT_ROOT/CapacitorVendor"
REQUIRED_VENDOR_PACKAGES="
$VENDOR_ROOT/AparajitaCapacitorBiometricAuth
$VENDOR_ROOT/CapacitorHaptics
$VENDOR_ROOT/CapacitorLocalNotifications
$VENDOR_ROOT/CapacitorPushNotifications
$VENDOR_ROOT/CapawesomeCapacitorBadge
"

echo "Validating Xcode Cloud checkout for H.I.M."

if [ ! -d "$WEB_BUNDLE_DIR" ]; then
    echo "error: Expected web bundle directory at $WEB_BUNDLE_DIR"
    echo "error: This project currently relies on checked-in static web assets for Xcode Cloud builds."
    exit 1
fi

if [ ! -f "$ENTRYPOINT_FILE" ]; then
    echo "error: Missing web bundle entrypoint at $ENTRYPOINT_FILE"
    echo "error: Regenerate and commit the static web assets before running this workflow."
    exit 1
fi

for package_dir in $REQUIRED_VENDOR_PACKAGES; do
    if [ ! -d "$package_dir" ]; then
        echo "error: Missing committed Swift package directory: $package_dir"
        echo "error: Run npm run ios:sync locally so CapacitorVendor stays in sync with iOS plugins."
        exit 1
    fi
done

echo "Found checked-in web bundle at $WEB_BUNDLE_DIR"
echo "Found committed Swift packages at $VENDOR_ROOT"
