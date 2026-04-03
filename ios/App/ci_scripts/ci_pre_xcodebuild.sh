#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/public"
REQUIRED_PACKAGES="
$REPOSITORY_ROOT/node_modules/@aparajita/capacitor-biometric-auth
$REPOSITORY_ROOT/node_modules/@capacitor/haptics
$REPOSITORY_ROOT/node_modules/@capacitor/local-notifications
$REPOSITORY_ROOT/node_modules/@capacitor/push-notifications
$REPOSITORY_ROOT/node_modules/@capawesome/capacitor-badge
"

if [ ! -f "$WEB_BUNDLE_DIR/index.html" ]; then
    echo "error: Xcode Cloud build aborted because App/App/public/index.html is missing."
    exit 1
fi

for package_dir in $REQUIRED_PACKAGES; do
    if [ ! -d "$package_dir" ]; then
        echo "error: Missing required Capacitor package directory: $package_dir"
        echo "error: npm ci did not complete successfully before xcodebuild."
        exit 1
    fi
done

echo "Xcode Cloud pre-build validation passed"
