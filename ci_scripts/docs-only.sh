#!/bin/sh
# Classifies HEAD vs origin/main so ci_pre_xcodebuild.sh can refuse archives
# that would burn App Store upload quota (ITMS-90382; 2.3 builds 368-370).
#
# classify_change() echoes exactly one of:
#   docs-only  diff touches only docs / skills / marketing
#   code       diff touches build-affecting files, or this is main itself
#   unknown    the diff could not be computed at all
#
# WHY 'unknown' EXISTS: the first version of this file conflated "no diff"
# with "could not compute a diff". Both produced an empty `git diff`, and
# both fell through to "not docs-only", so the archive proceeded. Xcode
# Cloud checks out shallow and its script environment cannot always fetch
# origin/main, so the fetch failed, the diff came back empty, and PR #124
# archived on 23 Aug 2026 despite being a two-file docs change. The guard
# failed OPEN on precisely the case it existed to catch.
#
# Callers must treat 'unknown' as its own state, never as 'code'.

# Xcode Cloud sets these only on pull-request-triggered builds. They need no
# git history, so they are reliable where a diff is not.
is_pull_request_build() {
    [ -n "${CI_PULL_REQUEST_NUMBER:-}" ] || \
    [ -n "${CI_PULL_REQUEST_SOURCE_BRANCH:-}" ] || \
    [ -n "${CI_PULL_REQUEST_TARGET_BRANCH:-}" ]
}

classify_change() {
    repo_root="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
    cd "$repo_root" 2>/dev/null || { echo unknown; return 0; }

    # Best effort. Deliberately not fatal: the rev-parse below is the real test.
    git fetch --no-tags --depth=200 origin main >/dev/null 2>&1 || true

    # If origin/main does not resolve we cannot classify anything. Say so
    # rather than silently reporting an empty diff.
    if ! git rev-parse --verify --quiet origin/main >/dev/null 2>&1; then
        echo unknown; return 0
    fi

    base=$(git merge-base HEAD origin/main 2>/dev/null) || base=''
    [ -n "$base" ] || base=origin/main

    changed=$(git diff --name-only "$base" HEAD 2>/dev/null) || { echo unknown; return 0; }

    # Empty here is trustworthy because origin/main resolved: HEAD is main, so
    # there is nothing to classify and the archive is the one we actually want.
    if [ -z "$changed" ]; then
        echo code; return 0
    fi

    non_docs=$(printf '%s\n' "$changed" | grep -Ev \
        '(\.md$|\.mdx$|^MEMORY|\.agents/|\.claude/|^marketing/|^docs/|^him-.*\.(md|svg|html)$|^ci_scripts/README\.md$)' \
        || true)

    if [ -n "$non_docs" ]; then echo code; else echo docs-only; fi
}
