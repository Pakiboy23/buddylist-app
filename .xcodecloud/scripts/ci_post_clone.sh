#!/bin/sh

set -eu

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/App/public"
ENTRYPOINT_FILE="$WEB_BUNDLE_DIR/index.html"
PACKAGE_JSON="$REPOSITORY_ROOT/package.json"
PACKAGE_LOCK="$REPOSITORY_ROOT/package-lock.json"

echo "Validating Xcode Cloud checkout for BuddyList"

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

if [ ! -f "$PACKAGE_JSON" ] || [ ! -f "$PACKAGE_LOCK" ]; then
    echo "error: Expected package.json and package-lock.json at the repository root."
    exit 1
fi

echo "Installing JavaScript dependencies with npm ci"
cd "$REPOSITORY_ROOT"
npm ci

echo "Found checked-in web bundle at $WEB_BUNDLE_DIR"
