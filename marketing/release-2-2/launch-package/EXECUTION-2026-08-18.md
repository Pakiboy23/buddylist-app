# H.I.M. 2.2 launch package — execution adaptation (run of Aug 18–25)

The package in this directory was prepared for a **Tuesday Aug 4** Day-0 that never ran.
This note re-dates it, records what its release gate already resolved, and maps each
step to automation vs founder action. The package files themselves are committed
verbatim — this note is the delta.

## Gate status (already satisfied — do not re-block on it)

- The package gates launch on the PR #98 bridge fix passing on the public build.
  **Resolved Aug 5–16:** the live App Store 2.2 (build 314) IS the PR #98 fix;
  the founder smoke-tested Add/Knock/accept on the store build Aug 5 (all passed),
  and PR #98 merged to main Aug 5. No 2.2.1 needed.
- Baseline metrics: superseded by `campaign-2026-q3/reporting/weekly-scorecard.md`
  (weeks 1–2 already recorded). Use the week-2 scorecard line as the pre-push baseline.

## Re-dated calendar (Day 5 must land on a Sunday)

| Package day | New date | Content |
|---|---|---|
| Day 0 launch sequence | **Tue Aug 18** | Substack → IG carousel + Threads → X thread → LinkedIn → Stories → 30s Reel |
| Day 1 one home base | Wed Aug 19 | per 03_Teaser_and_Rollout_Plan.md |
| Day 2 discovery | Thu Aug 20 | " |
| Day 3 Knock | Fri Aug 21 | " |
| Day 4 Circles | Sat Aug 22 | " |
| Day 5 Sunday Reset | **Sun Aug 23** | ritual format, not release copy |
| Day 6 build-in-public | Mon Aug 24 | uses REAL verified numbers only — source them from the week-2/3 scorecards |
| Day 7 recap | Tue Aug 25 | " |

## Honesty fixes required before posting (stale "today" lines)

2.2 went live **Aug 4**; posting "approved today" copy on Aug 18 would violate the
package's own guardrails. Replace in every variant:

- "Apple approved H.I.M. 2.2 today, and it is already live." → "H.I.M. 2.2 is live on the App Store."
- Dry founder X variant "Apple approved H.I.M. 2.2 today, which is…" → retire, or rewrite in past tense ("Apple approved H.I.M. 2.2 this month…").
- LinkedIn "Today, Apple approved…" → "Earlier this month, Apple approved H.I.M. 2.2. It's live on the App Store, and this post is the launch I owed it."
- Email subject/body: still valid (no "today" claim in subject; body line "Apple approved H.I.M. 2.2 today" → "H.I.M. 2.2 is live on the App Store").

The candor angle is an asset, not a liability: "shipped two weeks ago, launch post
today — solo founder math" is on-brand build-in-public voice.

## Automation map (state as of Aug 16)

| Step | Automated? | Mechanism |
|---|---|---|
| Daily post pack delivery | **YES** | 12:45 UTC email to founder's inbox each run day: that day's exact copy (stale lines pre-fixed), asset filename, checklist items (alt text, UTMs, pinning) |
| App Store promo text | YES (pre-existing) | v2 rotation fires Aug 17 13:00 UTC, v3 Aug 31 |
| Review watch / scorecards | YES (pre-existing) | daily 14:00 UTC / Mondays |
| X, Instagram, Threads, LinkedIn, Substack, TikTok posting | **NO — founder posts** (no APIs/connectors) | copy arrives pre-fixed in the daily email; X becomes automatable if founder connects X to IFTTT |
| Reddit | Deliberately NOT a launch blast (package guardrail + channels/reddit.md gates) | contextual only; Post 1 still gated on mod pre-clearance |
| Email to early members | **Mostly N/A** | member auth emails are synthetic (@hiitsme.app); no real-address list exists. Send manually only to known testers with real addresses |
| In-app engine (welcome DM / nudge / room prompts) | Built, pending founder line-review of drafts (chat, Aug 16) | separate from this package; complements Day 5 ritual |

## UTM note

`him_v2_2` campaign UTMs from the package are compatible with the O8 scorecard read
(Vercel dashboard, manual). Bio-link UTM update is in the Day-0 email checklist.
