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
    # Release trains only.
    #
    # Every archive Xcode Cloud runs also UPLOADS to App Store Connect, and
    # ITMS-90382 is a rolling count of upload slots, not a time window. So a
    # pull-request or feature-branch archive silently spends a slot that a real
    # release needs — builds 374/375 reached App Store Connect from a docs PR
    # this way on 24 Aug, and the 22 Aug exhaustion was the same shape.
    #
    # The docs-only and unknown gates below only catch changes with no code in
    # them. A PR that touches src/ classifies as "code", archives, and uploads —
    # which is precisely what happened on every PR merged on 29 Aug.
    #
    # The complete fix is to unhook Archive from the PR and branch start
    # conditions in App Store Connect (see ci_scripts/README.md); that is
    # console-only and cannot be done from the repo. This gate is the repo-side
    # half, and it is the effective one: it refuses BEFORE xcodebuild runs, so
    # no archive is produced and no upload slot is spent. main and tag builds
    # are untouched, so releasing is unaffected.
    if is_pull_request_build; then
        echo "error: pull-request build (pr=${CI_PULL_REQUEST_NUMBER:-?}); refusing Xcode Cloud archive."
        echo "error: every archive uploads, and ITMS-90382 counts slots, not time."
        echo "error: archive from main or from a tag. Build (non-archive) actions still run on PRs."
        exit 1
    fi

    if [ -z "${CI_TAG:-}" ] && [ "${CI_BRANCH:-}" != "main" ]; then
        echo "error: branch '${CI_BRANCH:-unknown}' is not main and no tag is set; refusing Xcode Cloud archive."
        echo "error: every archive uploads, and ITMS-90382 counts slots, not time."
        echo "error: archive from main or from a tag."
        exit 1
    fi

    CHANGE_CLASS=$(classify_change)
    echo "Archive gate: change=$CHANGE_CLASS"

    if [ "$CHANGE_CLASS" = "docs-only" ]; then
        echo "error: docs-only change; refusing Xcode Cloud archive to preserve ITMS-90382 quota."
        echo "error: Set a Files-and-Folders start condition on the Archive workflow in App Store Connect."
        exit 1
    fi

    # Fail CLOSED on a pull request we cannot classify. Xcode Cloud checks out
    # shallow and cannot always reach origin/main, and an unclassified PR is
    # exactly the case that burned quota on 23 Aug. Branch and tag builds still
    # archive normally, so releasing from main is unaffected.
    if [ "$CHANGE_CLASS" = "unknown" ] && is_pull_request_build; then
        echo "error: cannot classify this pull-request diff (origin/main did not resolve in the CI checkout)."
        echo "error: refusing archive rather than spending ITMS-90382 quota on an unclassified PR build."
        echo "error: archive from main, or set a Files-and-Folders start condition on the Archive workflow."
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
