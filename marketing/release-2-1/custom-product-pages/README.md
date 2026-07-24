# H.I.M. v2.1 — Custom Product Pages (CPP) Package

**Assembled:** 2026-07-23 · App: H.I.M. (`com.hiitsme.app`, App ID 6761863631)

Five marketing specialists produced this package; this README is the index and
the reconciled portfolio of record. Custom Product Pages are alternate faces of
the same App Store listing, each reachable only by a unique `?ppid=` URL, each
customizing **three** things — screenshots, app preview, and one 170-char
promotional text (name/subtitle/keywords/description are inherited from the
default page). **CPPs are not indexed for App Store Search**, so unlike the
default listing (index freeze, features held out of keywords) they lean fully
into the 2.1 features per channel with no 4.3/indexing risk.

## Deliverables

| File | Role | What it is |
|---|---|---|
| `cpp-strategy.md` | App Store Optimizer (lead) | Master portfolio, promo text, screenshot direction, ASC steps, measurement |
| `cpp-channel-map.md` | Social Media Strategist | Channel→page map, message-match rules, launch sequencing, per-ppid measurement |
| `cpp-tiktok.md` | TikTok Strategist | TikTok-targeted creative (maps to CPP-1/3/4) |
| `cpp-instagram.md` | Instagram Curator | IG-targeted creative (maps to CPP-1/2) |
| `cpp-twitter.md` | Twitter Engager | X-targeted creative (maps to CPP-3) |

## Reconciled portfolio — 4 pages

The ASO master and channel map converged on four pages; the channel specialists'
variants map onto them (no proliferation). Internal names are private in ASC.

| # | Internal name | Angle | Primary channel | Promo (chars) | Preview video |
|---|---|---|---|---|---|
| **CPP-1** | Sorted | Buddy Circles hero | TikTok | 153/170 | Yes (reuse TikTok C7 circle-creation cut) |
| **CPP-2** | New City | Rooms / relocation (cold-acq safe) | Instagram | 158/170 | No |
| **CPP-3** | Quiet Hello | Knock + presence privacy | X | 159/170 | No |
| **CPP-4** | Buddy List, Reborn | Full 2.1 loop, evergreen | Cross-channel | 161/170 | Optional (reuse only) |

**Promotional text (paste-ready, claims-passed against shipped code):**

- **CPP-1 (Sorted):** Your buddy list, made yours. Sort your people into private circles only you see. Mute one, hide another. No swiping. No radar. No grid. Friendship first.
- **CPP-2 (New City):** Just moved? Say hi in the New York City, Los Angeles, Chicago, or Atlanta rooms — or Everywhere Else. You pick your room; no location radar. Friendship first.
- **CPP-3 (Quiet Hello):** A quieter way to keep up with your people. Knock to say a low-key hello, set an away message, keep previews sender-only. No swiping. No grid. Friendship first.
- **CPP-4 (Buddy List, Reborn):** H.I.M. opens on your people — who's online, who's away, what they're up to. Sort them into private circles, knock to say hi, reply to a status. Friendship first.

Screenshot direction (ordered real-UI frames + captions) per page is in
`cpp-strategy.md` §2. `utm_content` tags for the four ppids: `circles`,
`rooms`, `knock`, `buddylist`.

## Channel deployment (recommended)

Keep the Tier-1 **bio** links (TikTok, X) on `hiitsme.app` to protect the
web-funnel objective (O8); deploy CPP `?ppid=` URLs on **per-creative surfaces** —
IG link stickers + secondary bio slot, X feature-post / reply links, Apple Search
Ads, and the waitlist/seed drops. Reddit gets **no** CPP links (deliberate). An
optional bounded bio-swap A/B test can compare store-conversion vs. web pageviews
if desired. Full map in `cpp-channel-map.md`.

## How to create the 4 CPPs

**ASC UI (reliable, ~2 min/page):** App Store Connect → H.I.M. → (left sidebar)
**Custom Product Pages** → **(+)** → name it (e.g. "Sorted") → add the **en-US**
localization → paste that page's **promotional text** (above) → add the ordered
**screenshots** (real 2.1 UI per §2; a CPP needs its own screenshots) → optional
**app preview** for CPP-1 → **Submit the CPP for review**. Once approved, copy its
`?ppid=` URL from the detail page and hand it to the owning channel with the UTM
appended.

**Note on API automation:** the ASC REST `appCustomProductPages` create endpoint
requires a version linkage at create-time (a circular-dependency quirk); creation
was left to the UI rather than trial-writing against the production account. Promo
text edits on an approved CPP publish without re-review; screenshot/preview
changes require re-submitting the CPP for review.

## Dependencies & gating

- **Screenshots** are the one blocker for all four pages — same on-device,
  consented-seed capture as the default listing (a CPP can reuse the default
  listing's captured frames). CPP-1/CPP-3/CPP-4 screenshots that show Knock/
  Circles are gated on the 2.1 iOS build being approved (frames must reflect the
  binary); until then, publish promo text and route to the web build.
- **Caption sign-off:** a few net-new on-image captions ("Seven rooms. Your city
  or your hour.", "Previews stay sender-only until you say otherwise.", "Reply
  straight to what they're up to.") need brand-brief §6 sign-off; each has a
  Tier-3 fallback so every page ships on approved-only captions if sign-off slips.
- **Excluded everywhere:** **Follow** (`user_connections`, not cleared this
  session) and the room **"Seen by N"** receipt (kept out of visual metadata;
  aggregate-count phrasing only, never "read receipts").

## Measurement

ASC surfaces per-`ppid` impressions, product-page views, conversion rate, and
downloads alongside the default page — native, zero plumbing. Add one row per
ppid to the Monday scorecard; at the Aug 31 gate and wrap, double the winning
page(s), kill/re-cut laggards. CPP-1 (Circles) is the pre-registered favorite.
