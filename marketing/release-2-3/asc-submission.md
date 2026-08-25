# H.I.M. v2.3 — App Store Connect submission

**App:** H.I.M. ("Hi, It's Me") · App ID `6761863631` · Bundle `com.hiitsme.app` · Publisher Saman Technologies LLC
**Version:** 2.3 (`MARKETING_VERSION = 2.3`, already set in `ios/App/App.xcodeproj/project.pbxproj`) · no IAP
**Prepared:** 2026-08-23 · **Governed by:** `campaign-2026-q3/strategy/claims-register.md` (STRICT), `strategy/brand-brief.md`

2.3 is the release that makes push actually reach a device. Live 2.2 (build 314, released 4 Aug) predates every push change, which is why iOS push opt-in has read 0% for all three flight cohorts. Nothing downstream of arrival improves until this binary ships.

> **Status 2026-08-24: build 375 is uploaded and Ready to Submit.** No further archive is needed. Skip to §3.3.

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

| Uploaded to App Store Connect | **CONFIRMED** — TestFlight Build Uploads: 2.3 (375) Complete, 2026-08-23 08:49 UTC; 2.3 (374) Complete, 08:32 UTC. Both Ready to Submit. |

The build was verified into a scratch output directory so tracked `dist/` was never rewritten. Working tree is clean.

**Build 375 is shippable as 2.3.** It was cut from `claude/goose-dating-app-pyhsx3`, which differs from `main` only in `MEMORY.md`, `marketing/` and `ci_scripts/` — none of which reach the binary. `dist/` and `ios/App/App/public/` are byte-identical to `main`.

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

**ITMS-90382 is a rolling count, not a daily window.** Observed 22–23 Aug:

| Build | UTC | Upload |
|---|---|---|
| 368 | Sat 07:33 | failed |
| 370 | Sat 07:41 | failed |
| 371 | Sun 05:43 | **Complete** |
| 372 | Sun 05:45 | failed |
| 373 | Sun 05:46 | failed |
| 374 | Sun 08:32 | **Complete** |
| 375 | Sun 08:49 | **Complete** |

371 uploaded cleanly two minutes before 372 and 373 were rejected. It took the last available slot; the others went over. Do not reason about this as "the cap clears at HH:MM".

**The #122 guard never worked.** `docs_only_change` conflated *"no diff"* with *"could not compute a diff"* — both produced an empty string and both fell through to "not docs-only". That fallthrough exists so archiving `main` (legitimately empty diff) still works, but Xcode Cloud checks out shallow and cannot reliably fetch `origin/main`, so the diff came back empty for the opposite reason. Build **374** was two docs files and it uploaded anyway. Rewritten so `unknown` is a distinct verdict and the gate fails **closed** on an unclassifiable pull-request build.

**The real fix is not the script.** The Xcode Cloud console shows "Untitled Workflow" archiving `main`, `claude/*`, `docs/*` and `fix/*`, and TestFlight lists at least ten 2.3 builds already Ready to Submit. Every push, on any branch, uploads. Unhook Archive from the PR and branch triggers — `ci_scripts/README.md` already prescribes `CI` = Build on PRs, `Beta` = Archive on manual/tags. The Files-and-Folders start condition (include `src/`, `ios/`, `android/`, `supabase/`, `api/`, `public/`, `capacitor.config.ts`, `package.json`, `native-web/`, `dist/`; exclude `*.md`, `.agents/`, `.claude/`, `marketing/`, `docs/`, `MEMORY.md`) only narrows the blast radius.

### 3.2 Trigger an archive — NOT NEEDED for 2.3

Build 375 is already uploaded. Keep this for future releases. Requires ASC credentials, which are **not** available in a Claude Code container — run from the founder machine.

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

### 3.3 Submit 2.3 — THIS IS THE ONLY REMAINING STEP

1. Attach **build 375** to the 2.3 version record in ASC (Distribution).
2. Paste §1 into "What's New in This Version."
3. Confirm 18+ age rating, export-compliance answer, and that no IAP is attached.
4. Submit. Phased release ON.
5. Watch iOS push opt-in, which has been 0% for all three cohorts. It is the single metric this release exists to move.

---

## 4. Blockers and open items

| # | Item | State |
|---|---|---|
| B1 | ASC credentials unavailable in-container | Anything touching App Store Connect is founder-machine only. Not fixable here. |
| B2 | Archive workflow fires on every branch and PR | **Unchanged.** Manual, ASC console only. Unhook Archive from PR/branch triggers; the Files-and-Folders start condition is the weaker half-measure. This is the single highest-value fix in this document. |
| B3 | ASC key `XV95PUP6YN` revocation | Leaked at `00b2839`, unverified since June, not checkable via API. Console check required. |
| B4 | 2.3 contextual push is unexercised in production | Every 2.3 build shows 3 TestFlight invites and **0 installs, 0 sessions**. The prompt has never run against live APNs. Verify on the founder device before phased release widens. |
| B5 | The rewritten guard's docs-only path is unproven in Xcode Cloud | Build 375 was a `ci_scripts` change, correctly classified as code, so it tested nothing. Read the `Archive gate:` line in the build log to confirm the gate evaluates at all. |
