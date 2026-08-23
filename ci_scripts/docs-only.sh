#!/bin/sh
# Returns 0 when HEAD vs origin/main only touches docs/skills/marketing.
# Used to refuse Xcode Cloud *archive* on markdown-only PRs so they cannot
# burn the App Store ITMS-90382 daily upload quota (2.3 builds 368-370).

docs_only_change() {
    repo_root="${CI_PRIMARY_REPOSITORY_PATH:-$PWD}"
    cd "$repo_root" || return 1

    git fetch origin main --depth=80 >/dev/null 2>&1 || true
    base=$(git merge-base HEAD origin/main 2>/dev/null || echo origin/main)
    changed=$(git diff --name-only "$base" HEAD)
    if [ -z "$changed" ]; then
        return 1
    fi

    non_docs=$(printf '%s\n' "$changed" | grep -Ev \
        '(\.md$|\.mdx$|^MEMORY|\.agents/|\.claude/|^marketing/|^docs/|^him-.*\.(md|svg|html)$|^ci_scripts/README\.md$)' \
        || true)
    if [ -n "$non_docs" ]; then
        return 1
    fi
    return 0
}
