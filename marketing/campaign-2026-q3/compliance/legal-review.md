# H.I.M. Q3 2026 Campaign — Legal & Compliance Review

**Reviewed:** 2026-07-15 · **Scope:** every file under `marketing/campaign-2026-q3/`
**Method note:** the runbook's dedicated Legal Compliance Checker and Brand Guardian sweep agents were interrupted by an account spend limit after the content phase completed. This review was performed inline by the campaign coordinator instead: a banned-pattern search battery across all channel/content files (every DNC term from `strategy/claims-register.md`), independent code spot-checks of load-bearing claims, and a structural read of each file's binding-rules and claims-used sections. It is a real review with a narrower net than the planned agent sweep — treat the residual-risk notes below accordingly.

## Overall risk summary

**No HIGH-severity findings.** The channel plans were written with the claims register and brand rules embedded as binding sections, and the pattern battery found zero violations — every occurrence of a banned term in the deliverables is the file *enforcing* the ban (compliance notes, canned-reply registers, do-not lists), not committing it. Competitor names appear nowhere in any deliverable, including ASO keyword fields. The residual items below are process obligations and sign-off gates, not defects in the copy.

## Findings

| # | Severity | File(s) | Finding | Required action |
|---|---|---|---|---|
| 1 | Medium | `him-launch-deliverables.md` (repo root — outside this campaign dir) | The **live App Store listing source doc** still contains two claims the register bans: "Download a **full** copy of your data **whenever you want**" (DNC #2) and "Gay men **17+**" (stale — ASC rating is 18+, claims #23). Until the corrected metadata ships, the live listing may carry an overclaim. | Corrections are already drafted and mandated in `channels/app-store-optimization.md` §1.4. **Update 2026-07-15:** the July build is confirmed (founder sign-off) — corrections ship with it, live ~Aug 3. Until then, no campaign asset may quote the stale lines. |
| 2 | Medium | `channels/reddit.md` §1 | Subreddit self-promotion rules were verified via **secondary sources only** (reddit.com was not directly fetchable from the research environment). Posting on stale rules is the channel's biggest ban risk. | The file already gates every sub on a mandatory live rules audit pre-flight — this is binding. No Reddit post ships without the founder re-reading that sub's current rules and, for Post 1, the mod-permission decision tree in §5.1. |
| 3 | Medium | `content/copy-library.md` §6 | Waitlist email drops: CAN-SPAM requires a functioning unsubscribe mechanism and a valid physical postal address in every commercial email, and the drafted snippets are body copy only. | Before Drop #1 (Aug 6): confirm the sending setup appends an unsubscribe link + Saman Technologies LLC postal address footer to every drop. If sending is manual (small list), the footer must be added manually. |
| 4 | Low | `channels/tiktok.md` §0 | Cadence divergence from strategy of record (2–3/wk vs §5.1's 4–6/wk), correctly self-flagged for campaign-lead sign-off. Consistency/process issue, not legal. | **CLOSED 2026-07-15:** founder signed off 2–3/wk; strategy §5.1, tiktok.md §0, and the calendar were updated the same day. |
| 5 | Low | `strategy/campaign-strategy.md` §1.1, `channels/twitter.md` | Candidate tagline **"The light's on."** is used nowhere in shipped copy (verified — twitter.md explicitly withholds it) but remains a live temptation. | **CLOSED 2026-07-15:** approved by founder; added to brand-brief §6 Tier 1 and unlocked in the channel files. Assets drafted pre-sign-off ship as written. |
| 6 | Low | `strategy/campaign-strategy.md` §8, `channels/app-store-optimization.md` §3 H3 | If the optional Apple Search Ads probe runs: exact-match only, zero dating keywords, and **no geo-targeted or interest-based audience pools that could out users** — the strategy already binds this. H3's city-term extension is a scope addition needing the flagged Aug 17 sign-off. | Reaffirmed as binding. Pre-submit ASA creative early; product-UI screenshots + neutral copy only. |
| 7 | Low | `channels/instagram.md` §8, `strategy/campaign-strategy.md` §5.8 | FTC endorsement compliance for creator work is correctly specified (material connection → disclosure; Paid Partnership label + first-line disclosure; no scripted reads; walk away if a creator won't disclose). Gifted access **is** a material connection even with $0 paid. | No action — compliant as written. Log every gifted-access grant in the tracker so disclosure obligations are traceable. |
| 8 | Info | all channel files | Trademark posture verified: no AOL/AIM/ICQ marks in any public-facing copy (pattern search clean); reddit.md §5.4 provides the approved no-marks reply for when commenters raise the comparison; Apple marks used per Apple style ("Face ID," "Touch ID") without implied endorsement; "Buzz" is described without referencing other platforms' trademarked mechanic names. | None. |
| 9 | Info | all channel files | Member-privacy guardrail verified present and binding in every channel that captures UI: consent required (and logged) for any member's screenname/message in brand-published media, crop/blur otherwise, **DM content never published**, no mechanic pressures identity or location disclosure. This is the campaign's most important safety property given the audience. | None — enforce via the per-post pre-publish checklists already in the channel files. |
| 10 | Info | all public-facing copy | Age positioning consistent: 18+ carried in TikTok caption rules, ASO corrections, Reddit account posture; no tactic targets minors. Honest-marketing posture verified: no fabricated testimonials, stats, user counts, or press anywhere (DNC #10/#11 clean; reddit.md's "dozens, not thousands" is honest smallness, not a stat claim). | None. |

## Verification evidence (spot-checks against code, 2026-07-15, HEAD `35f76e2`)

| Claim spot-checked | Evidence | Result |
|---|---|---|
| Room names + quotable blurbs verbatim | `supabase/migrations/20260509184623_rooms_v2_launch_schema.sql` lines 159–166 | ✅ exact match, all 7 rooms (e.g. "For the night owls. No judgment.") |
| Data export exists (claims #19 vs DNC #2 phrasing) | `supabase/functions/export-account/index.ts` present | ✅ feature real; capped phrasing correctly enforced everywhere |
| "liveCount = 0" honest-presence anecdote (Reddit Post 2) | `src/lib/himArtDirection.ts` (comment: "Presence must be REAL — never fabricate") | ✅ true as told |
| Disappearing-message timer enumeration (5m/1h/24h/7d) | `src/lib/trustSafety.ts:24` `DISAPPEARING_TIMER_OPTIONS` | ✅ matches |
| Banned-pattern battery (encryption, "anonymous", invite links, "full copy", Android availability, "works offline", user counts, SLA/team language, "lonely", legacy-IM marks, competitor names, "17+") | grep sweep across `channels/` + `content/` | ✅ zero violations; all hits are rule-enforcement text |

## Standing obligations during the flight

1. Every public asset passes its channel file's pre-publish checklist (each channel carries one).
2. Any NEW product claim — anything not in the APPROVED table — goes through the register process before use (verify in code, add with evidence, then ship).
3. Gate days (Aug 17, Aug 31): re-check this findings table; close items 1–5 as they resolve and log closure dates here.
4. If Android goes live on Play mid-flight: DNC #6 flips **only** via a register update with a repo artifact as evidence — not on a verbal "it's live."
