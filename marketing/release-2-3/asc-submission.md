# H.I.M. v2.3 — App Store Connect submission

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version:** 2.3 (`MARKETING_VERSION = 2.3`, already set in `ios/App/App.xcodeproj/project.pbxproj`) · no IAP
**Prepared:** 2026-08-23 · **Governed by:** `campaign-2026-q3/strategy/claims-register.md` (STRICT), `strategy/brand-brief.md`

2.3 is the release that makes push actually reach a device. Live 2.2 (build 314, released 4 Aug) predates every push change, which is why iOS push opt-in has read 0% for all three flight cohorts. Nothing downstream of arrival improves until this binary ships.

---

## 0. Build readiness — verified on `main` @ `51bf7e5`, 2026-08-23

| Gate | Result |
|---|---|
| `tsc --noEmit` | PASS |
| Unit tests | PASS, 188/188 across 34 files |
| `pushColdLaunchGuard.test.ts` | PASS, 5/5 (Guideline 2.5.13 contract holds) |
| `vite build` | PASS, compiles clean |
| Single module entry point | PASS in `dist/`, `ios/App/App/public/` (1 each, 31 chunks — not the 57 of the #119 double-boot) |
| Placeholder backend (#93 regression) | CLEAN, real project ref baked in, no `placeholder.supabase.co` |
| `dist/` ↔ `ios/App/App/public/` | IDENTICAL for every file; only Capacitor runtime (`cordova.js`, `cordova_plugins.js`) is iOS-only |
| Contextual push present in the shipped iOS bundle | CONFIRMED in `assets/page-YgW8gzNP.js`: `him.pushPrompt.askedAt`, `buddy_accepted`, `first_dm_sent`, `Push prompt skipped` |

The build was verified into a scratch output directory so tracked `dist/` was never rewritten. Working tree is clean.

**`CURRENT_PROJECT_VERSION` is 288 and that is fine.** Xcode Cloud assigns build numbers, so the pbxproj value has lagged what is live since 2.1. Do not bump it by hand.

---

## 1. "What's New in This Version" (paste-ready)

Field limit 4,000 chars. Draft below is ~880. **Every line traces to an already-approved claim — no register addendum and no new sign-off gate for this release.**

```
Notifications, finally.

H.I.M. can now tell you when a buddy accepts you or a message lands, without ever nagging you for permission the second you open the app.

New in this version:

• Notifications that ask at the right moment. H.I.M. asks about notifications once, right after a buddy accepts you or you send your first message, when it's obvious why you'd want them. Never on launch. Never again after you've decided.

• Previews that stay private. A notification tells you who messaged you, not what they said. Message text never reaches your lock screen unless you turn it on yourself.

• A steadier buddy list. Add, Knock, and Accept no longer fail in the moment right after you open the app or come back to it.

• A smaller download.

No swiping. No radar. No grid. Just your people, right there.
```

### Claims trace

| Line | Traces to | Evidence |
|---|---|---|
| "asks once, right after a buddy accepts you or you send your first message" | Code | `src/lib/pushPromptMoments.ts` moments `buddy_accepted` / `first_dm_sent`; callers `buddyRequest.ts:67`, `messageIdempotency.ts:137` |
| "Never on launch" | Approved claim #11 (bonus honest claim) | `src/lib/pushColdLaunchGuard.test.ts`, MEMORY decision 2026-05-17 |
| "Never again after you've decided" | Code | `markAsked()` fires before the prompt; `him.pushPrompt.askedAt`, at most once per install, and only while system state is `prompt` |
| "tells you who messaged you, not what they said" | Approved claim #12 | `push-dispatch/index.ts` `notification_preview_mode` fallback `name_only`; `src/lib/pushPreview.ts` |
| "when a buddy accepts you or a message lands" | Code | `push-dispatch` dispatches kinds `dm`, `room`, `buddy_request`, `buddy_accept` |
| "Add, Knock, and Accept no longer fail" | Code (#98) | `AppDelegate.swift` — `sendBuddyRequest` / `sendKnock` / `respondToBuddyRequest` poll for the web bridge up to 4s instead of failing instantly |
| "A smaller download" | Code (#116) | splash assets −354KB |
| "No swiping. No radar. No grid." | Approved claim #22 (absence enumeration) | register backbone |

**Style note:** no em dashes in the paste-ready block (house rule for app-facing copy). No AOL/AIM/ICQ reference, per brand brief §7 and issue #108. No user counts, per the 2026-08-10 decision.

**Safe fallback** if the bridge fix needs to drop for any reason: delete that one bullet. The rest stands on its own.

---

## 2. Listing changes

**None.** 2.3 is push plumbing plus a native reliability fix. Screenshots, description, keywords, subtitle, and promotional text all carry forward from 2.2 unchanged. Age rating stays 18+. Encryption answer, privacy answers, and the `appreviewer2026` demo account are unchanged.

Do not attach H.I.M. Pro. The `is_pro` entitlement is still deliberately dormant and the DRAFT subscription products stay attached to no build.

---

## 3. Upload runbook

### 3.1 Quota

Builds 368, 369 and 370 hit **ITMS-90382** (daily upload cap) on Sat 22 Aug after Xcode Cloud archived markdown-only PRs. The 24h window opened at 07:37 GMT Sat and **cleared at 07:37 GMT Sun 23 Aug**.

`ci_scripts/ci_pre_xcodebuild.sh` now refuses an archive whose diff vs `origin/main` is only markdown, skills, marketing or docs, so this cannot recur from that cause. An archive of `main` itself has an empty diff against `origin/main`, which `docs_only_change` correctly treats as *not* docs-only, so archiving `main` still works.

**Still outstanding:** set the Files-and-Folders start condition on the Archive workflow in App Store Connect. The script is the backstop; the start condition is the thing that stops the run from being spent at all. Include `src/`, `ios/`, `android/`, `supabase/`, `api/`, `public/`, `capacitor.config.ts`, `package.json`, `native-web/`, `dist/`. Exclude `*.md`, `.agents/`, `.claude/`, `marketing/`, `docs/`, `MEMORY.md`.

### 3.2 Trigger the archive

Requires ASC credentials, which are **not** available in a Claude Code container — run these from the founder machine.

```sh
export ASC_KEY_ID=9R3T4646YP
export ASC_ISSUER_ID=<issuer uuid>
export ASC_KEY_PATH=fastlane/.keys/AuthKey_9R3T4646YP.p8

# 1. Confirm the cap actually cleared and see where 368-370 landed.
node scripts/asc/asc.mjs GET \
  '/v1/builds?filter[app]=6761863631&limit=10&fields[builds]=version,processingState,uploadedDate'

# 2. Resolve the Xcode Cloud product and its Archive workflow.
node scripts/asc/asc.mjs GET '/v1/ciProducts?limit=10'
node scripts/asc/asc.mjs GET '/v1/ciProducts/<PRODUCT_ID>/workflows?limit=20'

# 3. Resolve the git reference for main.
node scripts/asc/asc.mjs GET '/v1/scmRepositories/<REPO_ID>/gitReferences?limit=50'

# 4. Start one archive from main.
cat > /tmp/ciBuildRun.json <<'JSON'
{ "data": { "type": "ciBuildRuns", "attributes": {},
  "relationships": {
    "workflow":         { "data": { "type": "ciWorkflows",     "id": "<ARCHIVE_WORKFLOW_ID>" } },
    "sourceBranchOrTag":{ "data": { "type": "scmGitReferences","id": "<MAIN_REF_ID>" } } } } }
JSON
node scripts/asc/asc.mjs POST /v1/ciBuildRuns /tmp/ciBuildRun.json
```

**One archive.** If it fails, read the failure before starting another; each attempt spends cap.

Xcode fallback if Xcode Cloud is uncooperative: `npm run ios:preflight`, then Product > Archive on the `HIM` scheme, then Distribute to App Store Connect.

### 3.3 After the build processes

1. Attach the build to the 2.3 version record in ASC.
2. Paste §1 into "What's New in This Version."
3. Confirm 18+ age rating, export-compliance answer, and that no IAP is attached.
4. Submit. Phased release ON.
5. Watch iOS push opt-in, which has been 0% for all three cohorts. It is the single metric this release exists to move.

---

## 4. Blockers and open items

| # | Item | State |
|---|---|---|
| B1 | ASC credentials unavailable in-container | Archive must be triggered from the founder machine. Not fixable here. |
| B2 | Files-and-Folders start condition on the Archive workflow | **Not set.** Manual, ASC console only. The CI script is a backstop, not a substitute. |
| B3 | ASC key `XV95PUP6YN` revocation | Leaked at `00b2839`, unverified since June, not checkable via API. Console check required. |
| B4 | 2.3 contextual push is unexercised in production | It has never run on a real device against live APNs. Verify on the founder device before phased release widens. |
