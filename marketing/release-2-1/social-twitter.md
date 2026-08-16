# H.I.M. 2.1 — X/Twitter Launch Content

**Release:** H.I.M. 2.1 ("Hi, It's Me") · iOS + web · ships late July 2026 (marketing version bumped to 2.1 in `8923dae`)
**Prepared:** 2026-07-23 · **Role:** Twitter Engager (platform-specialist bench)
**Extends (never overrides):** `channels/twitter.md` (the standing X playbook — voice, thread format, reply strategy, link discipline, CTA conventions), `strategy/brand-brief.md` (voice, tagline system, naming, nostalgia policy), `strategy/claims-register.md` (only approved claims ship).

**How this fits the standing plan:** the X account is the **build-in-public founder channel** (`twitter.md` §channel role). This 2.1 content slots into that same account and voice — Haaris posting as himself, replies as the KPI, links in bio + self-reply only, never in the body. The 2.1 launch thread below is a **new pinned candidate** for the release window; when the Aug 3 flight opens it hands the pin back to T1 (the year-one founder-story thread) per `twitter.md` §1.2.

**Copy status:** every post is built from claims-register APPROVED claims plus three features that shipped *after* the register's 2026-07-15 verification and are verified against `HEAD` code this session (see the appendix — **Buddy Circles**, **Knock**, room **"Seen by N"**). Flag: these three need to be added to the claims register before the next full campaign audit; the phrasings below are already scoped to what the code actually does. Posts speak in Haaris's first person — he should retype any of them in his own words as long as the claim content survives the `twitter.md` §9 pre-publish checklist.

**UTM:** same locked template as the flight — `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=<slug>`. 2.1 slugs are prefixed `v21-`. Canonical destination is always hiitsme.app, never a direct App Store URL (`twitter.md` §3.1).

---

## 1. The 2.1 launch thread

**TV1 — 2.1 LAUNCH THREAD (build-in-public) · post when Haaris can hang for an hour · slug `v21-launch-thread` · PINNED for the release window**

Lead the emotional hook with Buddy Circles (organizing your people) + Knock (saying hi with zero pressure). Features come after the feeling.

> **1/** H.I.M. 2.1 is live. This one's built around two small things I've wanted since the first version: a way to keep your people organized, and a way to just say hi. Here's what shipped. 🧵

> **2/** Buddy Circles. You can now sort your buddy list into private circles — the besties, the ones from Late Night, the guy you always end up talking to at 1am. However *you* think of people. That's the whole idea.

> **3/** The important part: circles are yours alone. The buddy you file into one never sees which circle they're in — or that circles exist at all. Nobody gets ranked to their face. Your list is a private thing, so I kept it private.

> **4/** Each circle has its own switches too: mute its alerts, or hide its presence from your list when you want it quieter. All owner-side — flip whatever you want, nobody on the other end feels a thing.

> **5/** And Knock. Sometimes you've got nothing to report, you just want someone to know you're thinking about them. Knock sends a buddy a 👋 and nothing else. No "you up," no essay, no pressure to reply.

> **6/** Knock is buddies-only, and you can only knock the same person once every 10 minutes. I built the limit in on purpose — it's a hello, not a way to blow up someone's phone. Gentle is the feature.

> **7/** Presence is the first thing you see now. Who's signed on, who's around, what their away message says — that's the app, instead of a list you dig through. It should feel like walking into a room where people already are.

> **8/** Two smaller ones: look at a buddy and you'll see what you share — the rooms you're both in, buddies in common. And room messages now show a quiet "Seen by N" so you know it landed, without anyone getting put on the spot.

> **9/** I also went hunting for bugs before you'd have to — found and fixed a real batch this cycle (a send-queue one that could drop a message; a presence one that made multi-device buddies look offline). Building in public means shipping the fixes in public. Ship-log next.

> **10/** On the App Store (iPhone) and at hiitsme.app. 18+. I'm Pakiboy24 in there — add me, then knock. Link in the reply. The light's on.

> **11/ (self-reply)** Link, as promised: `https://hiitsme.app/?utm_source=x&utm_medium=social&utm_campaign=porchlight-q3&utm_content=v21-launch-thread`

*Media: tweet 2 → short screen recording of filing a buddy into a circle (founder's own account / a second test account he owns — never a real member's list without logged S0 consent). Tweet 5 → a Knock landing between his two test accounts. Tweet 7 → the presence-first home. CTA: screenname drop + link in self-reply. Claims: #1 (rooms), #3 (away messages), #21 (App Store + web), #23 (18+), #24 (screenname add) + new: Buddy Circles, Knock, mutual context, "Seen by N" (appendix). "The light's on." is approved Tier 1 (brand-brief §6).*

---

## 2. Standalone launch-week posts

**PV1 — The reliability ship-log (build-in-public trust post) · slug `v21-shiplog-fixes`**

> 2.1 ship-log. Before you'd have to find them, I went looking. Four real bugs, all fixed:

> · a message could get dropped from the send queue
> · a buddy on two devices looked offline if they closed one
> · Buzz had no cooldown (Knock did — now they both do)
> · a room message could double-post on a retry

> Small app, honest work. The light's on.

*This is the trust post — bugs become proof that a real person is minding the store. Engineering facts only, never user counts (`twitter.md` §2 build-in-public numbers rule). CTA: none in body; bio link. Verified against commit `3f493d9` + `8787678`. Every line maps to a shipped fix (appendix).*

---

**PV2 — Buddy Circles (organize your people) · slug `v21-circles`**

> The buddy list finally has circles. File your people however you actually think of them — the besties, the Late Night crowd, the one you've never met but somehow tell everything.

> Private to you. They never know which one they're in. Because your list was always a little bit about how you see people, and that part should stay yours.

*CTA (self-reply): link → `utm_content=v21-circles`. Claims: Buddy Circles (private, owner-only — appendix). Never frame circles as something the buddy sees.*

---

**PV3 — Knock (say hi without pressure) · slug `v21-knock`**

> Knock might be my favorite thing in 2.1.

> It sends a buddy a 👋 and nothing else. No "you up?", no pressure to reply, no paragraph you rehearsed. Just: hey, I'm still here, thinking of you.

> Buddies only. Once every 10 minutes. Sometimes that's the whole message.

*CTA: "Search 'H.I.M. friends not dates' on the App Store." (full distinctive phrase, never bare "H.I.M." — brand-collision rule `twitter.md` §3.2). Claims: Knock (buddies-only, 10-min cooldown, DM surface — appendix). Tone check: warm, never framed as chasing someone who went quiet (`twitter.md` §4 Buzz guidance applies to Knock too).*

---

**PV4 — Presence-first UI · slug `v21-presence`**

> H.I.M. opens on presence now — who's signed on, what their away message says, who's around this second. Less scrolling a list, more walking into a room.

> This is the version of the app I always meant to build. Took me until 2.1 to get there.

*CTA (self-reply): link → `utm_content=v21-presence`. Claims: #3 (away messages / presence). Honest-smallness guardrail: presence is real, never a fabricated "N online" count (DNC #10). Never show a live number.*

---

**PV5 — Community question (drives replies) · slug `v21-circles-q`**

> 2.1 shipped Buddy Circles — private groups for your buddy list, just for you.

> So, genuinely asking: how do you sort your people in your head? Mine are "the besties," "the 1am crowd," and "we've never met but we're close."

> Name your circles. I'll read every one.

*Reply-farm post in the good sense — founder replies to every answer (`twitter.md` §5.1). Never repost a reply as content without the DNC #11 amendment conditions. CTA: none in body; bio link. No product claim beyond Buddy Circles existing.*

---

## 3. Reply & engagement strategy — launch week

Extends `twitter.md` §5 (the standing reply doctrine holds in full: reply to every reply in the first 30–60 min, no snark, nothing horny-coded, never name competitors, never diagnose, never out anyone, DM content never ships). Launch-week specifics on top:

### 3.1 Who to engage this week, in priority order
1. **Everyone replying to TV1 and PV1–PV5.** The launch thread's first-hour reply velocity is the distribution signal. Haaris only posts TV1 when he can sit with it for an hour. Answer every reply — including "what's a Knock?" — warmly and specifically.
2. **The build-in-public / indie-dev circle** (the natural audience for PV1). A solo founder posting a real bug list is *their* kind of content. Engage their ship-logs first with zero pitch; when someone asks how you found the send-queue bug, answer at the mechanism level ("I rebuilt the outbox flush as functional updates on live state — it was clobbering a snapshot"). Real engineering talk earns more trust here than any feature pitch.
3. **Adult-friendship + "how do you make friends after 30" threads.** Knock and Buddy Circles both answer "I want low-stakes ways to stay in touch." Add value first; mention the app only when it directly answers what was asked, and disclose it's yours every time ("I build one, so — biased — but a 👋-and-nothing-else button turned out to be the thing").
4. **Old-internet / away-message nostalgia posters.** Buddy Circles is the AIM-groups feeling (Family / Work / Besties) — but **evoke the era, never say AIM** (brand-brief §7, DNC #9). "Remember sorting your buddy list into groups nobody else could see? That, but it's ours now."
5. **Anyone asking about the bugs.** Treat "you shipped bugs?" as a gift, not an attack. "Yep — four, found and fixed before most people hit them. I'd rather tell you than hide it." That answer *is* the marketing.

### 3.2 Canned honest answers (2.1-specific — extends `twitter.md` §5.5)

| Question | Reply (approved register) |
|---|---|
| "What's a Knock?" | "It sends a buddy a 👋 and nothing else — no text, no pressure to reply. Buddies only, once every 10 min. A hello, not a notification machine." |
| "Can people see what circle I put them in?" | "No — circles are yours alone. The buddy never sees which circle they're in, or that circles exist at all. It only changes *your* view of *your* list." |
| "Is 'Seen by N' creepy? Can they tell it was me?" | "It's just a count — 'Seen by 3,' no names. It comes from who had the room open, which co-members can already see in the roster. Nothing new is exposed, and it's not per-person." |
| "Wait, you shipped bugs?" | "Four, and I fixed them — a dropped-message one, a multi-device presence one, a Buzz-flood one, a room double-post one. Small app, one person. I'd rather ship the fix in public than pretend it never happened." |
| "Is Knock/Buzz in rooms too?" | "Both are DM-only, buddies for Knock. Rooms have reactions, edits, search, presence, and now a 'Seen by N' — but Knock and Buzz stay one-to-one on purpose." |
| "Is this a dating app?" | (unchanged, `twitter.md` §5.5) "Nope — friendship-first on purpose. No swiping, no radar, no grid. Rooms, buddy lists, away messages. 'Not a hookup app' is literally in the site header." |

### 3.3 Launch-week guardrails (on top of the standing §5 rules)
- **Never demo a Knock, Buzz, or circle using a real member.** Signals and DM content ship only between the founder's own test accounts (`twitter.md` §5.3; strategy §5.1). DM content never ships in any form.
- **Buddy Circles is a private feature — protect that in replies.** Never joke about "who'd you put in your bottom circle" in a way that implies buddies can see rankings. They can't; don't let a reply imply they can.
- **No live counts, ever** — presence-first UI will tempt "how many online right now?" replies. The standing answer holds: "Small and early, on purpose — I don't share counts. Come be early." (DNC #10.)
- **The account never fights.** Mute early, block freely, feed nothing (`twitter.md` §5.6).

---

## 4. Do-not list (2.1-specific, claims-register-derived)

On top of the standing `twitter.md` §8 never-post list, this release adds sharp edges:

- **No H.I.M. Pro / subscription language.** A dormant `is_pro` entitlement + a Pro plan-of-record merged in `cb5339a` — but **no IAP is shipped and no paid tier is live.** Say nothing about Pro, pricing, or "upgrade" (brand-brief §9; the unbacked Pro badge is explicitly flagged do-not-claim). The fact that it's in the codebase does not make it a shippable claim.
- **Buddy Circles are private — never frame them as visible to the buddy.** No "let them know they made your inner circle," no ranking-someone-to-their-face framing. The buddy never learns the circle exists (verified: owner-only RLS, migration `20260722130125`).
- **"Seen by N" is an aggregate count from presence — not DM-style read receipts and not per-person.** Don't call it "read receipts" in rooms, don't imply it names who saw a message. (DM read receipts with an off switch = claims #9, a separate feature. Note: this supersedes the old DNC #5 "room read receipts" line for the aggregate case only — the code now ships an aggregate, and the phrasing must stay aggregate.)
- **Knock and Buzz are DM-only; Knock is buddies-only.** Never imply either works in rooms (DNC #5 shape).
- **Don't say "works offline"** — the send-queue fix hardened the offline outbox, but the app still needs network (DNC #12). "Messages queue offline and send when you're back online."
- **Ship-log numbers are engineering facts only.** "4 bugs," "10-minute cooldown," "30-second cooldown" are fine. User counts, signups, "N online," room-activity stats — never (DNC #10; `twitter.md` §2).
- **No AIM/AOL/ICQ marks.** Buddy Circles is AIM-groups-shaped; describe the *feeling* generically, never the trademark (DNC #9; brand-brief §7).
- **No competitor names, no dating vocabulary, no testimonials, no Android, no roadmap promises, no "encrypted."** (Standing DNC #1, #6, #11, #13; brand-brief §5.)
- **No fake UI / no member content without logged consent / no DM content in any form.** Demos use founder-owned accounts only.

---

## Appendix — 2.1 feature verification (checked against HEAD this session)

Every 2.1 claim used above, traced to shipped code. The three starred features post-date the claims register's 2026-07-15 verification and should be added to it.

| Feature | As phrased in this doc | Evidence |
|---|---|---|
| **Buddy Circles** ★ | Private, owner-only groups for your buddy list; a buddy is in at most one circle; the buddy never learns which circle (or that circles exist); per-circle owner-side controls to mute alerts / hide presence; "Ungrouped" for the rest | `src/lib/buddyCircles.ts`; migration `20260722130125_buddy_circles.sql` (owner-only RLS, one-circle-per-buddy PK, `show_presence` + `notify_mode` columns, must-be-accepted-buddy trigger); `src/components/BuddyCircles.tsx` |
| **Knock** ★ | Sends a buddy a 👋 and nothing else; buddies-only; once per pair every 10 minutes | migration `20260722114338_add_buzz_and_knock_message_types.sql` (`enforce_knock_rules`: accepted-buddies-only, 10-min cooldown, content stamped `👋 Knock`); `20260722150347_knock_cooldown_advisory_lock.sql`; DM message surface (`messages.preview_type = 'knock'`) |
| **Presence-first UI** | The app opens on presence — who's signed on, away messages, who's around | commit `097152f` "feat(ui): make presence the primary H.I.M. experience"; claim #3 (away messages / status) |
| **"Seen by N" room receipts** ★ | A quiet aggregate count on room messages; derived from who had the room open; not names, not per-person | `src/lib/roomReadReceipts.ts` (`countSeenByOthers` / `formatSeenByLabel` from `room_memberships.last_seen_at`); commit `4231777` (#80); exposes nothing beyond the roster |
| **Mutual context** | Look at a buddy → shared rooms + buddies in common | `src/lib/mutualContext.ts`, `src/components/MutualContextCard.tsx`, migration `20260722123740_mutual_context_rpc.sql` (`get_mutual_context`) |
| **Reliability fixes (PV1)** | 4 fixed bugs: dropped send-queue message, multi-device false sign-off, un-rate-limited Buzz, room double-post on retry | commit `3f493d9` "harden release" (body enumerates all four with fixes + tests); Buzz cooldown migration `20260723000001`; room `client_msg_id` idempotency migration `20260723000002`; optimistic-cooldown fix `8787678`; also `342209c` (#79 true sign-off time), `85282f9` (#77 presence ring) |
| Buzz | Shakes a buddy's chat window; DM-only; now rate-limited | claims register #7; cooldown added in `3f493d9` / `20260723000001` |
| Rooms · App Store + web · 18+ · screenname add | (unchanged) | claims #1, #21, #23, #24 |

**Do-not-claim reconfirmed for 2.1:** H.I.M. Pro / any subscription (dormant `is_pro` in `cb5339a`, no IAP shipped), "encrypted," "works offline," Android, user counts, competitor names, testimonials, AIM/AOL/ICQ marks.

---

*X/Twitter 2.1 launch content · H.I.M. · Saman Technologies LLC (internal) · extends OPERATION PORCH LIGHT X channel plan*
