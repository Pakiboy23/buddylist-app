# H.I.M. Q3 2026 Campaign — Growth Plan & Experiment Tracker Source of Truth

**Role:** Growth Hacker
**Prepared:** 2026-07-15 · Verified against repo `buddylist-app` @ main (`35f76e2`). Evidence paths are repo-relative.
**Campaign flight:** Mon Aug 3 – Sun Sep 13, 2026 (6 weeks) · Solo founder · Budget $0–500/mo · iOS live, web live, Android NOT live (claims register DNC #6).
**Companions (this doc extends, does not repeat):** `strategy/claims-register.md` (what we may say — it wins on any conflict), `strategy/baseline-audit.md` (what we can measure), `strategy/brand-brief.md` (voice), `strategy/trend-research.md` (channel mechanics), `/home/user/buddylist-app/him-gtm-kit.md` §5–6 (seeding + launch sequence).

**Ground rules inherited and binding here:**
- Every mechanic in this plan matches shipped code. Where a mechanic needs a change, it is marked **PRODUCT-DEPENDENT** with a rough size (XS/S/M/L).
- There are **no shareable invite links** — `supabase/functions/rooms-invite/index.ts` takes `roomId + buddyIds`, verifies `buddies.status='accepted'`, room `is_active`, and caller membership, then upserts `room_memberships` directly. `/join/:inviteCode` discards the code (`src/app/join/[inviteCode]/page.tsx`). No loop or copy below assumes links exist (claims register DNC #7).
- No fabricated stats, no fake counts, no manufactured FOMO (brand brief §2 rule 2). Targets below are provisional hypotheses, reset against the Jul 27 baseline snapshot — never published externally.
- Nothing outing-adjacent: no mechanic may pressure anyone to reveal face, legal name, location, or that they're on a gay app (brand brief §2 rule 6). Screenshot-sharing norms are spelled out in Loop 1.

---

## 1. Activation funnel

### 1.1 Definition

| # | Step | Definition (event that counts) | Source of truth | Honest caveat |
|---|------|-------------------------------|-----------------|---------------|
| 0 | **Install** | First-time App Store download (iOS) / first web session | App Store Connect (downloads, first-time vs redownload); Vercel Web Analytics (web sessions) | **Not in Supabase.** No install attribution exists (baseline audit gap #1). Installs and signups come from different systems; the install→signup ratio is directional only. |
| 1 | **Screenname created** | Row appears in `public.users` (signup writes it; synthetic email auth) | `users.created_at`; corroborate `security_events` `event_type='auth.signup.success'` (`src/app/page.tsx:209`) | `security_events` prunes at 90 days (`20260525000005_security_events.sql`) — snapshot before it rolls. |
| 2 | **First room joined** | First `room_memberships` row for the user — via the room preview join flow (`join_room_by_id` RPC) or a buddy's invite (`rooms-invite` upsert) | `min(room_memberships.joined_at)` per user, floored with `min(room_messages.created_at)` | `leave_room_by_id` **deletes** the membership row (`20260510050322_add_join_leave_room_rpcs.sql`), so a leave+rejoin resets `joined_at`. A room post is durable proof of having joined; the SQL below takes the earlier of the two. Invite-joins vs self-joins are indistinguishable in the schema today (see GH-14). |
| 3 | **First buddy accepted** | First `buddies` relationship reaching `status='accepted'` in either direction | `buddies.updated_at` on accepted rows (accept flips status; `set_updated_at` trigger stamps it — `20260320000001_gtm_plan.sql`; accept writes **both** direction rows: `src/lib/buddyRequest.ts:52-61`) | `updated_at` is "accept time" only if the row isn't touched afterward — acceptable at current scale. If GH-01 (founder buddies every new user) runs, report this step **with and without** the founder's account to avoid self-inflation. |
| 4 | **First DM sent** | First `public.messages` row with the user as sender | `min(messages.created_at)` where `sender_id = user` | **Corrected 2026-07-15:** sending does NOT require an accepted buddy — `enforce_dm_nonbuddy_rate` (`supabase/migrations/20260607000001_moderation_blocks_and_rate_limits.sql`) permits cold DMs to non-buddies, rate-limited to N distinct new recipients/hour ("Add them as a buddy or try again later"); buddy acceptance removes the limit. So step 4 is NOT a subset of step 3 — a user can DM before any buddy accept. Interpretation: a big step-3→4 gap still suggests conversations aren't starting, but read it alongside how many step-4 users skipped step 3 (cold DMs) before concluding anything about the buddy path. Claims register #4 carries the matching precision edit. |
| 5 | **D7 return** | User is active on or after day 7 post-signup | `users.last_active_at >= users.created_at + interval '7 days'` (indexed: `users_last_active_at_idx`) | This is **"ever returned on/after day 7"**, not classic day-7 retention — `last_active_at` is a single rolling column, so intermediate days are invisible. `security_events` sign-ins undercount (sessions persist; no event on resume). Fix: **GH-17** daily snapshot (ops-only) reconstructs true daily actives from Aug 3 onward. |

Also tracked alongside (not a funnel gate): **first room post** — `min(room_messages.created_at)` per user. `him-launch-deliverables.md` §E.8 defines activation as "posted in a room"; we keep that as the *engagement-quality* line while the funnel above measures the *social-graph* path.

### 1.2 SQL sketch — cohort funnel (service role, pattern per `supabase/queries/`)

```sql
-- H.I.M. activation funnel, one signup cohort.
-- Replace :cohort_start / :cohort_end (e.g. week boundaries) and :founder_id
-- (the founder's public.users.id, to de-inflate step 3/4 while GH-01 runs).

with cohort as (
  select id, created_at, last_active_at
  from public.users
  where created_at >= :cohort_start
    and created_at <  :cohort_end
),

-- Step 2: first room joined. leave_room_by_id deletes membership rows,
-- so take the earlier of surviving joined_at and first durable room post.
first_room as (
  select user_id, min(at) as at
  from (
    select user_id, joined_at as at from public.room_memberships
    union all
    select user_id, created_at from public.room_messages
  ) j
  group by user_id
),

-- Step 3: first accepted buddy. Accept writes both direction rows with
-- status='accepted'; updated_at is the accept-time proxy.
first_buddy as (
  select uid, min(at) as at
  from (
    select user_id  as uid, updated_at as at, buddy_id as other
    from public.buddies where status = 'accepted'
    union all
    select buddy_id as uid, updated_at as at, user_id  as other
    from public.buddies where status = 'accepted'
  ) b
  where other is distinct from :founder_id   -- drop this line for the raw number
  group by uid
),

-- Step 4: first DM sent.
first_dm as (
  select sender_id as user_id, min(created_at) as at
  from public.messages
  group by sender_id
),

-- Engagement-quality line (LD §E.8 activation): first room post.
first_post as (
  select user_id, min(created_at) as at
  from public.room_messages
  group by user_id
)

select
  count(*)                                                        as signed_up,
  count(*) filter (where fr.at is not null)                       as joined_room,
  count(*) filter (where fb.at is not null)                       as buddy_accepted,
  count(*) filter (where fd.at is not null)                       as dm_sent,
  count(*) filter (where fp.at is not null)                       as posted_in_room,
  -- D7: only count users old enough to have had a day 7.
  count(*) filter (where c.created_at + interval '7 days' <= now()) as d7_eligible,
  count(*) filter (where c.created_at + interval '7 days' <= now()
               and c.last_active_at >= c.created_at + interval '7 days')
                                                                  as d7_returned,
  -- Time-to-step medians (hours from signup), for onboarding friction.
  percentile_cont(0.5) within group
    (order by extract(epoch from fr.at - c.created_at) / 3600.0)  as median_hrs_to_room,
  percentile_cont(0.5) within group
    (order by extract(epoch from fb.at - c.created_at) / 3600.0)  as median_hrs_to_buddy,
  percentile_cont(0.5) within group
    (order by extract(epoch from fd.at - c.created_at) / 3600.0)  as median_hrs_to_dm
from cohort c
left join first_room  fr on fr.user_id = c.id
left join first_buddy fb on fb.uid     = c.id
left join first_dm    fd on fd.user_id = c.id
left join first_post  fp on fp.user_id = c.id;
```

### 1.3 SQL sketch — weekly readout (run every Monday of the flight)

```sql
-- Weekly funnel by signup cohort, flight-to-date. Paste output into the tracker.
with weeks as (
  select generate_series(
    date '2026-08-03', date '2026-09-07', interval '7 days'
  ) as week_start
)
select
  w.week_start,
  count(u.id)                                                     as signups,
  count(u.id) filter (where fr.at <= u.created_at + interval '48 hours') as room_join_48h,
  count(u.id) filter (where fb.at <= u.created_at + interval '7 days')   as buddy_7d,
  count(u.id) filter (where fd.at <= u.created_at + interval '7 days')   as dm_7d,
  count(u.id) filter (where u.created_at + interval '7 days' <= now()
                  and u.last_active_at >= u.created_at + interval '7 days') as d7_returned
from weeks w
left join public.users u
  on u.created_at >= w.week_start
 and u.created_at <  w.week_start + interval '7 days'
left join lateral (
  select min(at) as at from (
    select joined_at as at from public.room_memberships where user_id = u.id
    union all
    select created_at from public.room_messages where user_id = u.id
  ) x
) fr on true
left join lateral (
  select min(updated_at) as at from public.buddies
  where status = 'accepted' and (user_id = u.id or buddy_id = u.id)
) fb on true
left join lateral (
  select min(created_at) as at from public.messages where sender_id = u.id
) fd on true
group by w.week_start
order by w.week_start;
```

Supporting weekly queries (report next to the funnel; all columns verified in `supabase/migrations/`):

```sql
-- Room heat: messages + distinct posters per room per week.
select r.name, date_trunc('week', m.created_at) as week,
       count(*) as msgs, count(distinct m.user_id) as posters
from public.room_messages m join public.rooms r on r.id = m.room_id
group by 1, 2 order by 2 desc, 3 desc;

-- Away-message adoption (fuel gauge for Loop 1).
select count(*) filter (where away_message is not null
                          and length(trim(away_message)) > 0) as with_away_msg,
       count(*) as total_users
from public.users;

-- Safety load (report every week of the flight; see brand guardrails).
select
  (select count(*) from public.abuse_reports)  as reports_total,
  (select count(*) from public.blocked_users)  as blocks_total,
  (select count(*) from public.messages      where flagged_at is not null) as dm_flags,
  (select count(*) from public.room_messages where flagged_at is not null) as room_flags;

-- Churn during flight.
select count(*) from public.account_deletion_log
where deleted_at >= date '2026-08-03';  -- confirm column name in 20260525000004 before first run
```

### 1.4 Provisional targets (reset against the Jul 27 baseline snapshot; internal only, never published)

**AUTHORITATIVE for flight targets (reconciled 2026-07-15, Gate 2 repair):** this table is the base case of record for the flight. `campaign-strategy.md` §3 objectives O1/O2/O3/O6 are derived from these numbers with stated conversion/retention assumptions; any figure there above this base case is explicitly labeled a stretch ceiling. The Jul 27 baseline snapshot re-anchors BOTH documents — record any revision in the snapshot file and update both tables the same day.

Stage honesty: the seeded community was targeted at 25–40 users (`him-gtm-kit.md` §5) and there is no paid engine. These are hypotheses to calibrate, not commitments:

| Metric | Provisional flight target |
|---|---|
| New signups | 10–20/week by weeks 5–6 (≈60–100 total for the flight) |
| Signup → room join ≤48h | ≥ 50% |
| Signup → buddy accepted ≤7d | ≥ 35% (excluding founder-buddy) |
| Signup → first DM ≤7d | ≥ 25% |
| D7+ return | ≥ 25% of eligible cohort |
| Safety | Report/block volume reviewed weekly; any spike pauses acquisition pushes until reviewed |

---

## 2. Growth loops (ranked)

Ranking logic: at ~dozens of users with zero attribution infrastructure, the winning loops are the ones where **the product's own artifacts travel** and where a solo founder's personal effort compounds. Acquisition loops first, then activation/retention loops.

### Loop 1 — The away-message screenshot loop (acquisition · zero product change)

**Surface:** away messages + status + mood presets (`users.away_message`, `users.status_msg`; presets in `src/lib/himArtDirection.ts` `AWAY_MOOD_OPTIONS` — "keep it honest," "a little unhinged is fine").

**The loop:** user sets a funny, specific away message ("finally cleaning my apartment") → screenshots **their own** profile/buddy-list screen → posts it to IG story / sends to the group chat → friends ask "what app is that?" → install → set their own away message → repeat.

**Why it's #1:** trend research §(a) shows away-message content already circulates as a meme genre, and IG's 2026 algorithm rewards DM-forwards — exactly what a screenshot-able artifact produces. The artifact is outing-safe by design: it shows a screenname and a joke, not a face, a location, or a grid. This is the only loop where the *content IS the product*.

**Fuel:** weekly themed prompts (GH-02) — "your away message for a Sunday you refuse to leave the house" — posted on socials as comment-bait and seeded in-room. Prompt replies are user-generated copy we can never write ourselves.

**Guardrails (binding):** prompts always say *share your own screen*. Never encourage posting rooms or DMs (other people's screennames are pseudonymous but not ours to broadcast); if someone shares a room screenshot, the norm we model is cropping others' screennames. No prompt may ask where anyone lives or what they look like.

**Measurement (honest ceiling):** away-message adoption % (SQL §1.3), signups in the 72h window after each prompt post, and manual counts of story reshares/comment replies. No per-screenshot attribution exists and none is claimable. **PRODUCT-DEPENDENT upgrade (M):** an in-app "share my profile card" image export (client-side render of screenname + away message on the midnight/amber card) would make the artifact one tap instead of a screenshot — see GH-16.

### Loop 2 — The screenname-drop loop (acquisition · zero product change)

**Surface:** screenname-first identity (claims register #2) + in-app Browse/Search discovery (`users.discoverable` flag, `20260509221609_add_discoverable_flag.sql`; `src/components/DiscoveryProfileSheet.tsx`) + buddy requests (`src/lib/buddyRequest.ts`). **Claims cover (added 2026-07-15):** the findability claim implicit in "add me: [screenname]" public copy is now APPROVED as claims register #24 (find by screenname via in-app Browse/Search; `discoverable` toggle opts you out) — Loop 2 and GH-04 copy must follow #24's phrasing guidance and stay clear of DNC #8 ("anonymous").

**The loop:** a member (starting with the founder, screenname Pakiboy24) drops their screenname in a TikTok caption, Reddit comment, or group chat — "I'm on H.I.M., add me: [screenname]" → curious person installs → searches the screenname → sends a buddy request → gets a warm hello back → they drop *their* screenname somewhere → repeat.

**Why it's #2:** it converts the app's core identity primitive into a portable, link-free handle — which matters doubly because (a) we have no working share links to drop anyway, and (b) X and other platforms penalize link posts (trend research §(d)). "Add me: my screenname" is also period-accurate to the early-internet register without touching any trademark.

**Fuel:** founder puts his screenname in every bio and caption; seeded members are invited (never pressured) to do the same. The four "who it's for" statements (brand brief §8) give the caption framing.

**Guardrails:** screenname-dropping is opt-in per member, always. Nobody is ever asked to drop theirs — posting your handle on a gay app is an identity disclosure some members won't want; the founder models it, members choose it. Users can also flip `discoverable` off and stay unfindable.

**Measurement:** buddy requests received by the dropping account within 72h of each drop (SQL: `buddies` rows where `buddy_id = :dropper` and `created_at` in window); new-signup deltas in the same window.

### Loop 3 — The buddy-pull loop (activation + engagement · the shipped invite mechanic)

**Surface:** `supabase/functions/rooms-invite/index.ts` — POST `{roomId, buddyIds}`; server verifies `buddies.status='accepted'` (both directions checked), room `is_active`, caller's own `room_memberships` row, then upserts memberships for the invited buddies (`ignoreDuplicates: true`, so existing memberships keep their original `joined_at`). Invite sheet UI in `src/components/GroupChatWindow.tsx`.

**The loop:** you meet someone in a room → buddy request → accept → one of you pulls the other into another room you're in ("come to Late Night") → they meet more people there → more buddy accepts → more pulls. Each cycle densifies the graph and multiplies the surfaces where a user has a reason to return.

**The acquisition variant** (word-of-mouth, off-platform first hop): member tells a friend "get H.I.M., add me: [screenname]" → friend signs up → buddy accept → member immediately pulls them into their best room. The friend's first session lands **inside a live conversation** instead of an empty lobby — this is the single best activation weapon we have, and it's entirely shipped.

**Why it's #3:** it can't start cold (both parties need accounts + an accepted buddy relationship), so it's an activation/retention loop, not a standalone acquisition loop. But it's the loop that makes Loops 1–2 stick: campaign copy "invite your buddies into a room" is approved phrasing (claims register #17).

**Measurement gap:** invite-joins and self-joins write identical `room_memberships` rows — the loop is invisible in SQL today. **PRODUCT-DEPENDENT (S):** add nullable `room_memberships.invited_by uuid`, stamped only by the `rooms-invite` Edge Function (one migration + ~3 lines in the function; no client change, no App Store release). See GH-14. Until then, proxy: count new users whose first room join lands within 10 minutes of a buddy accept.

### Loop 4 — The founder build-in-public loop (acquisition + trust · zero product change)

**Surface:** the founder himself, plus real product UI (brand brief §3: glass titlebar windows, amber pip, monospace wordmark — screen-record the actual app, never mock fake activity).

**The loop:** founder posts honest build-in-public content (X threads, TikTok screen recordings: signing on, setting an away message, a Buzz shaking the window) → the "solo gay founder, still here in August after the corporate Pride retreat" story earns attention (trend research §0.2, §(e)) → installs and press interest → new members produce moments and feedback → more material to post → repeat.

**Why it's #4:** highest variance, lowest cost. It's also the only loop that produces earned media (extends the GTM kit §4 press pitch with the July 2026 third-places news peg). Rule from trend research: X is for text + replies with links in bio/replies; TikTok captions optimized for search queries ("gay friendship app," "apps that aren't dating apps").

**Guardrails:** honest numbers only — if the founder shares metrics publicly they must be real (never fabricated stats; hard rule). No AOL/AIM/ICQ marks in any public post, including screen-recording captions.

**Measurement:** signup deltas in 72h windows after posts; ASC App Referrer / Web Referrer source buckets; buddy requests to Pakiboy24 (Loop 2 overlap).

### Loop 5 — The room-ritual loop (retention → ambient acquisition · zero product change)

**Surface:** the seeded vibe rooms — **Sunday Reset** and **Late Night** (claims register #1; quotable seeded descriptions).

**The loop:** a fixed weekly ritual (founder-hosted Sunday Reset hour; Late Night presence at actual late night) → members build an appointment habit → the ritual becomes a thing members mention off-platform ("we do Sunday Reset in there") → friends come for the ritual → the ritual is livelier → repeat.

**Why it's #5:** slowest loop, but it compounds and it maps 1:1 to real usage rhythms worth programming content around (trend research flight-timing notes). Rituals also solve the empty-room problem for new users: publishing *when* the room is alive means first sessions can be aimed at live hours.

**Measurement:** `room_messages` count + distinct posters in the ritual room during the ritual window, week over week (SQL §1.3 room-heat query filtered by `rooms.slug` and hour).

---

## 3. Experiment backlog (ICE-scored)

Scoring: **I**mpact, **C**onfidence, **E**ase, each 1–10 honestly assessed for THIS stage (dozens of users, solo operator). ICE = mean, one decimal. Judgment windows are 2 weeks minimum (TikTok US algorithm retraining makes single-post reads unreliable — trend research §(e)). Every experiment pre-registers exactly one primary metric before it starts; results and decisions land in the §6 tracker.

### 3.1 Zero-product-change experiments (all 12 runnable during the flight as-is)

| ID | Experiment | Hypothesis | Primary metric | Channel | Effort | I | C | E | ICE |
|----|-----------|------------|----------------|---------|--------|---|---|---|-----|
| GH-01 | **Concierge onboarding** — founder sends every new signup a personal DM + buddy request within 24h (after they buddy him back), and offers to pull them into the right room (Loop 3) | New users who get a human hello within 24h reach first-DM-sent and D7 at materially higher rates than the pre-flight cohort | First-DM-sent-≤7d rate, GH-01 cohort vs July cohort (report step 3/4 excl. founder per §1.2) | In-app | ~20 min/day | 8 | 8 | 9 | 8.3 |
| GH-03 | **Sunday Reset live hour** — founder hosts a fixed weekly hour (e.g. Sun 7–8pm ET), announced in-room and on socials all week | An appointment ritual lifts weekly return and gives new users a guaranteed-alive first session | Distinct posters in Sunday Reset during the hour, WoW | In-app + social | 1 hr/wk + promo | 7 | 7 | 8 | 7.3 |
| GH-09 | **UTM discipline** — every campaign link carries `utm_source/medium/campaign`; weekly Vercel aggregate readout | Channel-level web-traffic mix is recoverable with zero code even though signups can't be attributed (baseline audit §3.1) | Weekly hiitsme.app pageviews by utm_source | All link posts | Near zero | 4 | 8 | 10 | 7.3 |
| GH-02 | **Away Message of the Week** — weekly themed prompt posted as comment-bait on TikTok/IG and seeded in-room; best replies may become next week's post ONLY under claims register DNC #11 as amended 2026-07-15: explicit member permission for the specific repost, permission logged in the tracker, words verbatim (no paraphrase), framed as a prompt reply — never as a review, testimonial, or endorsement | Prompt-style away-message content draws replies and screenshot shares that convert curiosity to installs (Loop 1) | Signups in the 72h post-prompt window vs non-prompt 72h windows | TikTok + IG + in-app | 1–2 hr/wk | 7 | 6 | 8 | 7.0 |
| GH-07 | **Welcome wagon** — seeded members (volunteers) greet every new room joiner by screenname within ~15 min during agreed coverage hours; manual log of greeted users | A greeting within 15 minutes of first join lifts first-room-post rate vs un-greeted new joiners | First-room-post rate, greeted vs not (manual log × `room_messages`) | In-app | Coordination | 7 | 7 | 7 | 7.0 |
| GH-04 | **Screenname-drop CTA** — founder's screenname in every bio/caption; standing "add me: [screenname]" close on video content (Loop 2) | A link-free, period-accurate CTA converts better than "link in bio" for this audience and dodges link-penalty algorithms | Buddy requests to founder account per 72h window | TikTok + X + Reddit | Near zero | 6 | 6 | 9 | 7.0 |
| GH-12 | **Win-back DMs** — weekly SQL pull of users with `last_active_at` 7–13 days stale; founder sends a personal, specific note (references their room/away message), never a template blast | A human nudge in the window before habits die recovers a meaningful share of quiet users | % of DM'd users with `last_active_at` refreshed within 72h | In-app | ~30 min/wk | 6 | 7 | 8 | 7.0 |
| GH-05 | **Reddit disclosed-founder post** — weeks 1–2 pure participation in target subreddits (90/10 rule), then one disclosed story post week 3: "I built a friendship app for gay men because I was tired of the grid" | One honest disclosed post outperforms sustained stealth and has an AI-answer long tail (trend research §(d)) | Signups in 72h post-post window (+ thread upvote/comment quality) | Reddit | 2–3 wks part-time | 8 | 6 | 6 | 6.7 |
| GH-06 | **"Bring your third" week** — week 4: personally ask each active member to bring exactly one friend ("tell him your screenname"), member pulls them into a room on arrival (Loop 3 acquisition variant) | A specific, bounded ask ("one person") converts better than a generic "invite friends" plea | Inferred referrals that week (§5 SQL) vs weeks 1–3 average | In-app + word of mouth | 1-on-1 asks | 7 | 5 | 7 | 6.3 |
| GH-11 | **X build-in-public cadence** — 3 founder posts/wk (ship-logs, real UI clips, honest observations); links only in replies/bio; optional X Premium ≤$8/mo | Consistent founder presence compounds into referral traffic and press discovery even at small follower counts | ASC Web/App Referrer installs + profile-click trend | X | 2 hr/wk | 5 | 6 | 8 | 6.3 |
| GH-08 | **iOS promotional-text rotation** — the one ASO lever editable without a build (baseline audit §1); rotate 2 variants in 2-week windows (current LD text vs an away-message-led variant built from Tier 1–2 lines) | Leading with the away-message hook lifts store conversion vs the current feature-list text | ASC page-view → download conversion per window | App Store | Minutes | 4 | 5 | 9 | 6.0 |
| GH-10 | **Micro-creator gifted access** — 3–5 small queer creators (10K–100K) get founder walkthrough + early access; no scripts, no payment beyond ≤$100 total thank-yous; FTC disclosure if anything of value changes hands | Native content from small creators outperforms anything the brand account posts (trend research §(d)) | Signups in 72h window after each creator post | TikTok/IG | Outreach-heavy | 7 | 4 | 5 | 5.3 |

Run order across the flight: GH-09 + GH-01 + GH-04 from day 1 (always-on); GH-02, GH-03, GH-07, GH-11 from week 1 (cadence); GH-08 windows weeks 1–2 vs 3–4; GH-05 fires week 3; GH-06 fires week 4; GH-10 and GH-12 continuous from week 2.

### 3.2 PRODUCT-DEPENDENT experiments (sized; each also closes a baseline-audit gap)

| ID | Experiment | Hypothesis | Primary metric | Size | Notes | I | C | E | ICE |
|----|-----------|------------|----------------|------|-------|---|---|---|-----|
| GH-13 | **Acquisition-source capture** — nullable `users.acquisition_source` written once at web signup from a client-captured first-touch UTM | Web signups become attributable by channel, and cohort quality becomes comparable by source | Signups by source; funnel §1.2 split by source | **S** (1 migration + client capture; first-party, consistent with Tracking=No posture per baseline audit §3.3) | Closes baseline gap #2; recommended pre-flight if any code is budgeted | 8 | 8 | 7 | 7.7 |
| GH-14 | **Invite-attribution stamp** — nullable `room_memberships.invited_by`, set only by `rooms-invite` Edge Function | The buddy-pull loop (Loop 3) becomes measurable; invited joiners retain better than self-joiners | D7+ return, invited vs self-joined | **S** (1 migration + ~3 lines in `supabase/functions/rooms-invite/index.ts`; no app release) | Makes GH-06 readable at the mechanism level | 6 | 9 | 8 | 7.7 |
| GH-17 | **Daily metrics snapshot** — scheduled job (pg_cron or founder-run query) copying daily counts + `last_active_at` distribution into a `marketing_snapshots` table | True daily-active and real D7 (not D7+) become reconstructible from Aug 3 onward | Snapshot completeness (days captured / days elapsed) | **XS–S** (ops/DB only; no app change) | Closes baseline gap #5; do before Aug 3 alongside the Jul 27 manual snapshot | 7 | 9 | 8 | 8.0 |
| GH-16 | **Shareable profile card** — in-app "share my card" export: screenname + away message + status on the midnight/amber card, client-rendered image | A one-tap artifact multiplies Loop 1 output vs manual screenshots | Away-message adoption + prompt-window signups (proxy; export counting would need an event) | **M** (client feature + design + App Store release) | Do NOT market until shipped; artifact must never include other users' content | 8 | 5 | 5 | 6.0 |
| GH-15 | **Real invite links** — token table + redemption at `/join/:inviteCode` + attribution; universal-link plumbing already wired (`public/.well-known/` per baseline audit §3.3) | A working personal invite link unlocks a measurable referral loop and K-factor | Invite → signup conversion; K-factor | **M** (route exists but discards codes today; needs token issue/redeem, expiry, and safety review) | Claims register DNC #7 stands until this ships and is verified; then flip the claim via the register process. Safety note: current no-links state means strangers can't cold-link into rooms — preserve that (links should gate to buddy-request or lobby, never straight into a room) | 9 | 6 | 4 | 6.3 |

---

## 4. Retention hooks

Ordered by leverage; every hook maps to a shipped surface. PRODUCT-DEPENDENT items marked.

1. **The away message itself** — the reason to open the app when you have nothing to say. Weekly prompt themes (GH-02) keep it fresh; adoption is the §1.3 fuel gauge.
2. **Appointment rituals** — Sunday Reset hour (GH-03) and a Late Night window. Publish the times everywhere; a small community that is *reliably alive twice a week* beats one that is thinly alive always (brand brief: frame quiet as asynchronous, not dead).
3. **Concierge + welcome wagon** (GH-01, GH-07) — a human greeting inside the first session is the strongest D7 lever a solo founder has, and it costs only time.
4. **Buddy-accept → room-pull norm** — make "when your buddy request is accepted, pull them into your best room" the community's taught behavior (it's the shipped `rooms-invite` mechanic, Loop 3). Seeded members model it.
5. **Buzz culture** — Buzz is shipped, DM-only, and fun (claims register #7). Content can celebrate it playfully ("buzz a buddy who owes you a reply"). Never frame it as pressure to respond, and never as a way to chase someone who went quiet by choice — playful, not naggy.
6. **Every push is a person** — pushes fire per-message from real humans (`supabase/functions/push-dispatch/index.ts`); there is no marketing push and the app never asks for push permission on cold launch (claims register #11). This restraint IS the retention hook for a privacy-forward audience: notifications from H.I.M. are never noise. Protect it — do not build broadcast pushes for campaigns.
7. **Win-back window** (GH-12) — the 7–13-day-stale SQL pull + a personal note. At current scale, retention is a relationship, not a lifecycle-email problem.
8. **PRODUCT-DEPENDENT (S–M):** surface the Away Message of the Week prompt inside the app (a line on the buddy-list screen). Until then the prompt lives in-room and on socials.

---

## 5. Referral concept — "Founding Buddies"

**Constraint recap:** no invite links exist and none may be claimed (claims register DNC #7). The referral concept therefore runs on the two primitives that DO ship: screennames (portable, link-free handles) and buddy relationships (verifiable in SQL).

### v1 — flight-ready, zero product change

**Mechanic:** "Bring a buddy. Tell him your screenname." A member tells a friend to install and add them; the moment the buddy request is accepted, the member pulls the friend into their best room (Loop 3). No codes, no links, no forms — the buddy graph *is* the referral record.

**Recognition, not rewards:** the founder watches the inferred-referral query (below) weekly; both sides get a personal founder DM and — with their consent — a "Founding Buddies" shout-out in the Everywhere Else room. If budget allows, stickers by mail (opt-in address collection handled privately, never required — outing-safety rule). No cash incentives, no leaderboards, no public counts: paid-referral energy is off-brand and fabricates enthusiasm we'd rather earn.

**Inferred-referral SQL (the measurement):**

```sql
-- New users whose first accepted buddy is a tenured member (>=14 days old)
-- within 48h of signup — the honest proxy for "brought by that member."
with firsts as (
  select n.id as new_user, n.created_at as signed_up,
         b.other as referrer, b.at as accepted_at,
         row_number() over (partition by n.id order by b.at) as rn
  from public.users n
  join lateral (
    select case when user_id = n.id then buddy_id else user_id end as other,
           updated_at as at
    from public.buddies
    where status = 'accepted' and (user_id = n.id or buddy_id = n.id)
  ) b on true
  where n.created_at >= date '2026-08-03'
)
select f.new_user, f.referrer, f.signed_up, f.accepted_at
from firsts f
join public.users r on r.id = f.referrer
where f.rn = 1
  and f.accepted_at <= f.signed_up + interval '48 hours'
  and r.created_at  <= f.signed_up - interval '14 days'
  and f.referrer is distinct from :founder_id;  -- concierge accepts aren't referrals
```

Known limits, stated plainly: this infers, it doesn't prove — two strangers who met in a room within 48h of one's signup can look like a referral. At dozens of users the founder can eyeball every row; the query becomes unreliable exactly when GH-15 becomes worth building. That trade is fine.

### v2 — PRODUCT-DEPENDENT (M): real invite links (GH-15)

Token issuance + redemption at `/join/:inviteCode` (route and universal-link plumbing already exist; redemption doesn't), with attribution columns for true K-factor. Safety requirement carried from the current design: today's no-links state means strangers can't cold-link into rooms — v2 links should land on a signup/buddy-request surface, never drop an unknown straight into a room. Only after this ships and is verified does "share an invite link" copy become claimable, via the claims-register update process.

---

## 6. Experiment log — tracker template (source of truth)

Rules of the log:
1. **Pre-register before start:** id, hypothesis, channel, dates, and the single primary metric are written down BEFORE the experiment begins. No post-hoc metric shopping.
2. **Snapshot at start and end:** run the §1.3 weekly readout + supporting queries on the start and end dates; paste both into the result cell or link the dated snapshot file.
3. **2-week minimum judgment windows** for anything touching TikTok/IG reach (platform volatility, trend research §(e)).
4. **Decision vocabulary:** `scale` (keep + increase), `iterate` (keep + change one variable), `kill` (stop), `rerun` (inconclusive — rerun with stated fix). Every closed experiment gets exactly one.
5. Result and Decision cells stay `—` until the experiment closes; they are the only cells that may be empty.

| id | hypothesis | channel | start | end | metric | result | decision |
|----|-----------|---------|-------|-----|--------|--------|----------|
| GH-09 | UTM-tagged links recover channel-level web traffic mix with zero code | all link posts | 2026-08-03 | 2026-09-13 | weekly hiitsme.app pageviews by utm_source (Vercel) | — | — |
| GH-01 | a founder DM + buddy request within 24h lifts first-DM-≤7d vs July cohort | in-app | 2026-08-03 | 2026-09-13 | first-DM-sent-≤7d rate (cohort vs baseline, excl. founder edges) | — | — |
| GH-04 | "add me: [screenname]" converts better than link CTAs for this audience | TikTok / X / Reddit | 2026-08-03 | 2026-09-13 | buddy requests to founder acct per 72h window | — | — |
| GH-02 | weekly away-message prompts drive replies, shares, and signup bumps | TikTok + IG + in-app | 2026-08-04 | 2026-09-08 | signups in 72h post-prompt windows vs quiet windows | — | — |
| GH-03 | a fixed Sunday Reset hour builds appointment attendance WoW | in-app + social | 2026-08-09 | 2026-09-13 | distinct posters in Sunday Reset during the hour | — | — |
| GH-07 | a greeting ≤15 min after first join lifts first-room-post rate | in-app | 2026-08-03 | 2026-09-13 | first-room-post rate, greeted vs not (manual log) | — | — |
| GH-08 | away-message-led promo text beats feature-list promo text on conversion | App Store | 2026-08-03 | 2026-08-30 | ASC page-view → download conversion per 2-wk window | — | — |
| GH-11 | 3 founder posts/wk compound into referrer installs | X | 2026-08-03 | 2026-09-13 | ASC Web/App Referrer installs trend | — | — |
| GH-10 | gifted access to 3–5 small queer creators outperforms brand-account posts | TikTok / IG | 2026-08-10 | 2026-09-13 | signups in 72h windows after creator posts | — | — |
| GH-12 | a personal note at day 7–13 of silence revives a meaningful share of quiet users | in-app | 2026-08-10 | 2026-09-13 | % of DM'd users active again within 72h | — | — |
| GH-05 | one disclosed founder story post outperforms weeks of stealth presence | Reddit | 2026-08-17 | 2026-08-24 | signups in 72h post-post window | — | — |
| GH-06 | a bounded "bring one person" ask beats a generic invite plea | word of mouth | 2026-08-24 | 2026-08-31 | inferred referrals (§5 SQL) vs weeks 1–3 avg | — | — |
| GH-13 | PRODUCT-DEPENDENT (S): acquisition_source column makes web signups attributable | web signup | pre-flight if built | — | signups by source | — | — |
| GH-14 | PRODUCT-DEPENDENT (S): invited_by stamp makes Loop 3 measurable | rooms-invite | pre-flight if built | — | D7+ return, invited vs self-joined | — | — |
| GH-17 | PRODUCT-DEPENDENT (XS, ops-only): daily snapshot makes true D7 reconstructible | DB job | 2026-07-27 target | 2026-09-13 | snapshot days captured / days elapsed | — | — |
| GH-16 | PRODUCT-DEPENDENT (M): one-tap profile-card export multiplies Loop 1 | in-app share | post-flight unless prioritized | — | prompt-window signups (proxy) | — | — |
| GH-15 | PRODUCT-DEPENDENT (M): real invite links unlock measurable referral + K-factor | invite links | post-flight unless prioritized | — | invite → signup conversion | — | — |

**Pre-flight checklist (week of Jul 27):** run and save the full §1.2 funnel + §1.3 supporting queries as the dated baseline snapshot (baseline audit §4 mitigation a); capture ASC metrics the same day; decide go/no-go on GH-13/GH-14/GH-17 (all S or smaller; GH-17 needs no app release at all); reset §1.4 targets against the real numbers.

---

*Growth plan · H.I.M. Q3 2026 campaign · internal — not campaign copy. Claims in any public asset derived from this plan must clear `claims-register.md` first.*
