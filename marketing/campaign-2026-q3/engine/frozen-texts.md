# In-app engine — frozen texts

Every message the engine sends on the founder's account. These are **founder-approved
and frozen**: the sweeps post them verbatim and never freeform. This file is the
canonical record — the live copies are embedded in the scheduled triggers, which are
not version-controlled, so any change here and there must be made together.

Standing rules across all three routines:

- Never auto-accept a buddy relationship, and never write the reciprocal row. Pending only.
- Never DM anyone twice. Each routine's dedup guard is load-bearing; do not bypass it.
- Rate limits: 5 distinct cold-DM recipients/hr, 20 buddy requests/hr. 4 per sweep is safe.

---

## 1. Welcome DM

Trigger: `In-app engine — welcome DM sweep` · every 3h · new members ≤48h with no prior
DM from the founder.

**Current (from 2026-08-21):**

> hey! it's Haaris — I made H.I.M. welcome in 🙂 I sent you a buddy request too, accept if you want me in your list. set an away message (it's the whole vibe), and if anyone in Suggested Buddies looks familiar, add em. the rooms are open too — Everywhere Else is the easiest place to say a first hi. I'm here for real, say hi anytime.

**Previous (2026-08-16 → 2026-08-21):** identical without the second sentence
("I sent you a buddy request too, accept if you want me in your list.").

Amended because the same sweep began sending a founder buddy request on 2026-08-20
(GH-01), so members were receiving a request from a stranger with nothing explaining it.
The dedup is any-message-from-founder, not content-match, so the amendment cannot
double-DM anyone; members welcomed before Aug 21 keep the older text and are not re-sent.

## 2. Buddy-request nudge DM

Trigger: `In-app engine — buddy-request nudge sweep` · daily · members holding a pending
incoming request older than 48h **from someone other than the founder**, max one nudge
per person per 14 days (content-match dedup).

> you've got buddy requests waiting on your Buddy List 👀 somebody wants in — two taps to accept.

The non-founder condition was added 2026-08-20 alongside GH-01: without it the founder
nudges people to accept the founder, and "somebody wants in" becomes self-referential.

## 3. Weekday room prompts

Trigger: `In-app engine — weekday room prompt` · 16:00 UTC Mon–Fri · one post per firing,
skipped if the founder already posted in that room that day.

| Day | Room | Current text (from 2026-08-21) |
|---|---|---|
| Mon | New York City `804e33f1` | nyc roll call — just drop your neighborhood. one word is a complete answer. |
| Tue | Los Angeles `8e906805` | LA: eastside or westside? one word, no essay. |
| Wed | Chicago `ba6d1c44` | chicago: lake or river? pick one. |
| Thu | Atlanta `35471b2d` | atl: coffee shop, gym, or bar — where's your third place? one word works. |
| Fri | Everywhere Else `012c20d2` | roll call: where are you signing on from tonight? city name is enough — someone here might be closer than you think. |

**Previous (2026-08-16 → 2026-08-21):**

| Day | Text |
|---|---|
| Mon | new york check-in: what neighborhood are you in, and the one spot there you'd actually take a friend? |
| Tue | LA — best thing you've done in this city solo that would've been better with company? |
| Wed | chicago: the lake or the river? defend your answer. |
| Thu | ATL — where's your third place? the spot that isn't home and isn't work. |
| Fri | roll call: where are you signing on from tonight? someone here might be closer than you think. |

Rewritten after the first five days produced **0 organic room replies** (Aug 17–21,
verified against production). The old prompts were not bad questions — they asked
someone who had never posted in a room to compose a sentence in front of strangers.
The rewrite changes the size of the ask, not the subject.

**This is a measurement, not just a copy change:** it isolates ask-size as the variable.
The week-4 scorecard (Mon Aug 31) reads organic room replies for Aug 24–30 against the
Aug 17–21 zero baseline. If entry stays at zero under a one-word ask, the gate is the
room surface itself — discovery or entry — and no prompt rewrite will move it.
