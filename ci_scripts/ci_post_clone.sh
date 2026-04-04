#!/bin/sh

set -eu

PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/local/sbin:$PATH"
export PATH

REPOSITORY_ROOT="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
IOS_PROJECT_ROOT="$REPOSITORY_ROOT/ios/App"
WEB_BUNDLE_DIR="$IOS_PROJECT_ROOT/App/public"
ENTRYPOINT_FILE="$WEB_BUNDLE_DIR/index.html"
PACKAGE_JSON="$REPOSITORY_ROOT/package.json"
PACKAGE_LOCK="$REPOSITORY_ROOT/package-lock.json"

echo "Validating Xcode Cloud checkout for BuddyList"

ensure_node_toolchain() {
    if command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1; then
        return
    fi

    echo "Node.js/npm not found on PATH. Attempting Homebrew bootstrap."

    if ! command -v brew >/dev/null 2>&1; then
        echo "error: Neither npm nor Homebrew is available on this Xcode Cloud runner."
        exit 127
    fi

    export HOMEBREW_NO_AUTO_UPDATE=1

    if ! brew list node@20 >/dev/null 2>&1; then
        brew install node@20
    fi

    BREW_NODE_PREFIX="$(brew --prefix node@20)"
    PATH="$BREW_NODE_PREFIX/bin:$PATH"
    export PATH

    if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
        echo "error: Node.js/npm is still unavailable after Homebrew bootstrap."
        exit 127
    fi
}

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

ensure_node_toolchain

echo "Using node $(node -v)"
echo "Using npm $(npm -v)"

echo "Installing JavaScript dependencies with npm ci"
cd "$REPOSITORY_ROOT"
npm ci

echo "Found checked-in web bundle at $WEB_BUNDLE_DIR"
