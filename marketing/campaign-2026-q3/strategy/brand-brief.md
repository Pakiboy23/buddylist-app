# H.I.M. — Q3 2026 Campaign Brand Brief

**Campaign:** Q3 post-launch acquisition + engagement · Flight Mon Aug 3 – Sun Sep 13, 2026 (6 weeks)
**Prepared:** 2026-07-15 · **Role:** Brand Guardian
**Product:** H.I.M. ("Hi, It's Me") · Publisher: Saman Technologies LLC · Domain: hiitsme.app · Bundle: `com.hiitsme.app`
**Status of this doc:** Governing reference for all campaign copy and assets. Where this brief and a draft asset disagree, this brief wins until the founder overrules it in writing.

**Sources read (all statements about existing brand copy cite one of these):**

| ID | File | What it is |
|---|---|---|
| GTM | `/home/user/buddylist-app/him-gtm-kit.md` | April 2026 pre-launch GTM kit (landing copy, App Store listing v1, press pitch, seeding plan) |
| LD | `/home/user/buddylist-app/him-launch-deliverables.md` | June 2026 launch deliverables (final App Store listing, safety copy, cold-start playbook) |
| IDX | `/home/user/buddylist-app/index.html` | Live web app shell: title/meta/OG tags, fonts, boot splash |
| RM | `/home/user/buddylist-app/README.md` | Engineering README (feature ground truth) |
| CSS | `/home/user/buddylist-app/src/app/globals.css` | Tailwind v4 theme — the actual shipped color/type system |
| RW | `/home/user/buddylist-app/src/components/RetroWindow.tsx` + `/home/user/buddylist-app/src/components/HimWordmark.tsx` | Window chrome + wordmark components |
| AD | `/home/user/buddylist-app/src/lib/himArtDirection.ts` | Room blurbs, away-mood presets, tag tones (in-app voice reference) |

---

## 1. Brand essence + one-line positioning

**Essence:** The warmth of early-internet instant messaging — a screenname, an away message, a buddy list, rooms where conversation happens out loud — rebuilt as a friendship-first home for gay men. Not a queue of faces. A place you sign on to.

**One-line positioning (canonical):**

> H.I.M. is a friendship-first social app for gay men — screennames, away messages, buddy lists, and chat rooms. Not a dating app, not a hookup app.

This is a condensation of three approved sources, not a new invention:
- "H.I.M. ('Hi, It's Me') is a friendship app for gay men — not a dating app, and not a hookup app." — first line of the App Store full description (LD §A).
- Live title tag: "H.I.M. — Friendship-first social app"; meta description: "Your screenname, your status, your people. Not a hookup app." (IDX lines 16–17).
- Footer tagline: "**H.I.M.** — Friendship first." (GTM §1).

**The brand promise in one behavior:** you meet people in rooms, get to know them in conversation, and add them to your buddy list when there's a real connection (LD §A, "WHY H.I.M. IS DIFFERENT"). Every campaign asset should be able to trace back to that loop.

---

## 2. Voice & tone

### The voice, defined

Warm, funny, specific, community-first. It sounds like a friend typing, not a platform announcing. Ground truth for the register already ships in the product:

- Away-message examples: "grabbing coffee," "doomscrolling," "finally cleaning my apartment" — "status as self-expression, the way it used to be" (LD §A).
- Room blurbs: "movie opinions without the homework," "career ambition from the sofa," "starting over, wiser and funnier," "lightly unhinged but always around" (AD, `ROOM_META_OVERRIDES` + `buildHeuristicBlurb`).
- Away-mood hints: "keep it honest," "a little unhinged is fine," "soft, homebody, low-stakes" (AD, `AWAY_MOOD_OPTIONS`).
- Empty-state reframe: "Quiet in here right now. Drop a message — say where you are or what you're into. People check in throughout the day." (LD §E.7).

### Rules

1. **Specific beats superlative.** "Doomscrolling" and "finally cleaning my apartment" do more work than "amazing community." Name a Tuesday-night feeling, a city, a small ritual.
2. **Honest smallness.** The community is early and seeded (GTM §5 targeted 25–40 seed users). Never inflate: no fake counts, no "thousands of members," no manufactured FOMO. This is codified in product — `himArtDirection.ts` hard-codes `liveCount = 0` with the comment "Presence must be REAL — never fabricate a 'live' count" (AD), and LD §E.1 calls fake counts "the launch-killer." Copy follows the same law. Frame quiet as asynchronous, not dead (LD §E.7).
3. **No dating-app vocabulary.** Banned in public copy: match, matches, swipe, singles, nearby, flirt, hot/hotter, hookup-as-offer, "meet guys." The App Store keyword string deliberately omits every one of these (LD §A keyword note), and LD flags "flirting / hotter / emotionally available" room blurbs for removal so listing and binary agree (LD §A note). Campaign copy holds the same line. ("Hookup" may appear only in the negation: "not a hookup app.")
4. **Community-first pronouns.** Talk to "you" and about "your people." Never talk about users in third person as inventory ("guys in your area").
5. **Funny is welcome; snark at people is not.** Self-deprecating, lightly unhinged humor (the AD blurbs are the ceiling) — never jokes at the expense of users of other apps, and nothing horny-coded.
6. **Never outing-adjacent.** No copy or mechanic that pressures anyone to reveal face, legal name, location, or that they're on a gay app. The product leads with screennames precisely so people are found "for who you are, not what you look like" (GTM §1). Notification previews default to sender-only for shoulder-surfing safety (LD §A) — the brand's privacy posture is a feature, treat it like one.
7. **Warm, not saccharine; retro, not cosplay.** Evoke the feeling ("when online social felt personal" — GTM §2) without doing a full 2003 bit in every line.

### Three do/don't rewrite examples

**Example 1 — Honest smallness (rule 2)**

| Don't | Do |
|---|---|
| "Thousands of gay men are already chatting on H.I.M. — don't miss out!" | "The rooms are small and real. Drop in, say which city you're repping, and see who checks in tonight." |

Why: the "don't" fabricates scale (violates rule 2 and the never-fabricate hard rule). The "do" borrows the seeded room-welcome register ("say hi and drop which borough you're repping" — LD §E.3) and sells intimacy as the feature.

**Example 2 — Nostalgia without trademarks (rule 7 + §7 policy)**

| Don't | Do |
|---|---|
| "It's AIM for gay men. Your AOL buddy list is back, baby." | "Remember when going online felt like arriving somewhere? A screenname that's yours, an away message that says what you're up to, a buddy list of people you actually know. It's back — and this time it's ours." |

Why: the "don't" uses AOL/AIM trademarks and implies affiliation. The "do" is built from approved description language — "the things that made the early internet feel like home: a screenname that's yours, an away message that says what you're up to, a buddy list of people you actually know" (LD §A).

**Example 3 — No dating vocabulary (rule 3)**

| Don't | Do |
|---|---|
| "Meet hot gay singles near you — your next connection is one tap away." | "Make gay friends, not matches. No swiping, no 'people nearby' — just rooms where the conversation is already going." |

Why: the "don't" is category-default hookup copy (hot, singles, nearby, "connection"). The "do" leads with an approved alternate subtitle ("Make gay friends, not matches" — LD §A) and the approved absence-of-mechanics enumeration ("No swiping. No match queue. No 'people nearby.'" — LD §A).

---

## 3. Visual identity notes (what actually ships)

Describe the app the way it really looks — do not invent a Windows-95 pastiche. The shipped aesthetic is **retro structure, modern glass finish**: instant-messenger furniture (titlebar windows, wordmark, online pip, status dots) rendered in frosted "liquid glass" panels, warm cream light mode, and a midnight-indigo-and-amber dark mode.

### Color — the locked "Midnight" brand system (CSS `@theme` + `:root`, `globals.css`)

The brand tokens carry Urdu/Hindi names in the shipped CSS — a quiet signature of the founder's desi identity; keep the names in internal design docs.

| Token | Hex | Role (as commented in CSS) |
|---|---|---|
| `--chiraag` | `#E8A23A` | Amber — **primary brand color** (wordmark pip, boot splash, accents, focus rings) |
| `--chiraag-strong` | `#C8861F` | Amber, pressed/strong states |
| `--chiraag-glow` | `#F5C56A` | Amber glow (dark-mode pip, default chat bubble accent) |
| `--anaar` | `#9C2E2E` | Pomegranate red — **accent only** |
| `--akhrot` | `#734123` | Walnut brown — borders/dividers |
| `--indigo-deep` / `--bg` | `#0F1424` | Dark-mode base surface ("midnight indigo") |
| `--indigo-night` / `--bg2` | `#1A1F3A` | Dark-mode raised surface; also the PWA `theme-color` (IDX line 11) |
| `--text` (dark) | `#F2E6D0` | "Banaras cream" text on midnight |
| `--color-stone-50/100/200` | `#F5F1E8` / `#EDE7D9` / `#D9D0BC` | Light-mode warm stone surfaces; body sits on a radial cream gradient (CSS `body`) |

Secondary in-app tag tones: rose / gold / lavender / green / ghost (AD, `HimRoomTone`) — supporting chips only, never the hero.

**Campaign guidance:** the hero look is **midnight indigo + amber** — it's the theme color, the boot splash (pulsing amber rounded square + letterspaced monospace "H.I.M." on near-black, IDX `#boot-splash`), and the dark default (`<html class="dark">`, IDX line 2). Light-mode cream/stone is the approved secondary palette. Anaar red is a garnish, never a background.

### Type

- **Screennames + wordmark:** IBM Plex Mono (weights 400–600) — `--font-screenname` (IDX lines 29–35, 55–57). The wordmark is "H.I.M." in monospace, weight 600, letterspacing 0.16em, often with a pulsing amber "online pip" beside it (`HimWordmark.tsx`; CSS `.ui-wordmark`, `.ui-online-pip`).
- **UI:** Nunito (300–800) is loaded as `--font-ui` (IDX); the app body falls back through the SF Pro / system stack (CSS `body`). For campaign assets: monospace for screennames/wordmark/anything "typed," a warm rounded sans (Nunito) for everything else.

### Window chrome

`RetroWindow.tsx` is the signature surface: a full-height mobile "window" with a **glossy floating titlebar** — rounded 1.4rem card, frosted glass (`backdrop-filter: blur(40px) saturate(1.6)`), hairline white border, soft layered shadow (CSS `.ui-window-header`), amber "sparkle" badge chip (`.ui-brand-sparkle`), centered or leading wordmark, compact Back/`←` controls, and squircle radii throughout (`--radius-squircle-lg: 1.55rem`). Variants `default` / `glass_shell` / `xp_shell` all keep the same glass language (RW). In dark mode the titlebar goes translucent midnight (`rgba(15, 23, 42, 0.55)`).

**Campaign guidance:** screenshots and social frames should lean on real UI — the titlebar window, buddy-list rows, away-message chips, timestamped dense chat rows (RM, "dense AIM-style timestamped message rows" — internal description; do not use "AIM" in public captions). Never mock up fake UI showing member counts or activity that doesn't exist (LD §E.1).

---

## 4. Naming rules

1. **The name is always "H.I.M."** — capital letters, periods after each. Never "HIM," "Him," "him app," or "H I M." In running copy it takes no article ("on H.I.M.," not "on the H.I.M.").
2. **Expansion:** "Hi, It's Me" — exactly this punctuation, introduced as `H.I.M. ("Hi, It's Me")` on first mention in long-form copy (LD §A full description, line 1). The approved short pairing is `H.I.M.: Hi, It's Me` (LD §A app-name alternate).
3. **Domain:** hiitsme.app — always lowercase, no "www." Support: support@hiitsme.app. Policy links: hiitsme.app/privacy, hiitsme.app/terms (LD §A).
4. **Publisher:** Saman Technologies LLC — full legal name in press boilerplate, footers, and anywhere a company is named (LD header; GTM footer says "Saman Technologies").
5. **Founder:** Haaris Shariff, solo founder, Florida; in-app screenname Pakiboy24 (GTM §4–5). Founder story is on the record in the press pitch (GTM §4) and may be used in earned-media contexts.
6. **Never use legacy internal names in public:** "BuddyList" / buddylist.com is legacy auth infrastructure only (RM, Auth Model). The repo/app internal names are not brand names.
7. **Current App Store identity (June 2026, supersedes April):** name "H.I.M. — Friends, Not Dates", subtitle "Gay friendship, retro style" (LD §A). The April listing name "H.I.M. — Gay Social & Friends" / subtitle "Friendship, not hookups." (GTM §2) is superseded for store metadata but the phrases remain approved brand language elsewhere.
8. **Generic IM vocabulary is brand vocabulary:** screenname, away message, buddy list, chat rooms, sign on. Use them lowercase, unapologetically — they are descriptive terms, not third-party trademarks.

---

## 5. Positioning vs anti-positioning

### What we are

Friendship-first. The positive claim always leads: rooms, conversation, buddy list, status. "It's not about who you're attracted to. It's about who you want in your life." (GTM §1 — approved line, use it.)

### How we say what we're not

The approved pattern is **enumerating absent mechanics, not naming competitors**:

> "No swiping. No match queue. No 'people nearby.' No photo-first browsing." (LD §A)
> "There is no swipe mechanic, no proximity radar, and no algorithm pushing you toward romance." (LD §A)
> "No swipe mechanics, no hookup pressure." (GTM §1)

This is verifiable, respectful, and reviewer-safe. It is the only anti-positioning device allowed in ads, App Store copy, landing pages, and social posts.

### Competitor references — rules

- **Public campaign copy (ads, store, landing, organic social): never name competitors.** Not even favorably. In App Store metadata specifically, competitor names are a Guideline 4.3/2.3.10 rejection risk (LD §A keyword note: "Do not add competitor brand names (Grindr/Scruff/Tinder)").
- **Press conversations and internal strategy docs: factual, respectful, mechanism-level.** The approved register is the GTM press pitch: "Grindr is proximity-based hookup infrastructure. Scruff is a variation on the same mechanic. Lex is brilliant but it's not designed for ongoing platonic connection." (GTM §4). Note it critiques what products are *built for* and even compliments Lex. Copy that pattern: describe the mechanic, never disparage the people who use those apps, never make safety/quality claims about competitors.
- **Never punch at users.** "Done with the alternatives" (GTM §1) is as sharp as public copy gets about the category.
- The "anti-Grindr" framing exists only as a press subject-line option (GTM §4) — journalists may use it; we don't put it in owned public copy.

---

## 6. Tagline system (approved lines + provenance)

Tier 1 — canonical, use anywhere:

| Line | Source |
|---|---|
| "Friendship first." (footer form: "**H.I.M.** — Friendship first.") | GTM §1 footer tagline |
| "Your screenname, your status, your people." | IDX meta description (line 17); OG description (line 22); GTM §1 subhead ("Your screenname. Your status. Your people.") |
| "Not a hookup app." | IDX meta description (line 17) |
| "Friends, Not Dates" | LD §A App Name |
| "Gay friendship, retro style" | LD §A Subtitle |
| "The light's on." | Q3 campaign line (strategy §1.1) — founder sign-off 2026-07-15 |

Tier 2 — approved supporting lines:

| Line | Source |
|---|---|
| "A social app for gay men built for friendship." | GTM §1 hero headline |
| "Make gay friends, not matches" | LD §A subtitle alternate |
| "A gay buddy list, reborn" | LD §A subtitle alternate |
| "Friendship, not hookups." | GTM §2 subtitle (April) |
| "Built different by design." | GTM §1 section header |
| "It's not about who you're attracted to. It's about who you want in your life." | GTM §1 |
| Promotional text: "A friendship-first space for gay men — screennames, away messages, buddy lists, and chat rooms. No swiping. No hookups. Just real conversations with people who get it." | LD §A Promotional Text |

Tier 3 — screenshot/overlay captions (GTM §3, all approved):
"Your people, right there." · "Pick a name that's actually you." · "Your status says more than you think." · "Find your people before you even DM." · "First impression isn't your face. It's your vibe."

**Rule:** new taglines for this campaign must be built from Tier 1–2 vocabulary and pass the voice rules in §2. Any brand-new tagline needs founder sign-off before public use.

---

## 7. Nostalgia-references policy (binding)

1. **Public-facing campaign copy must never use the AOL, AIM, or ICQ trademarks**, and must never imply affiliation, endorsement, or continuity with them. This includes ad copy, App Store metadata, landing pages, social posts, screenshot captions, and influencer briefs we control.
2. **Evoke the era, not the brand.** Approved public phrasings already exist: "the things that made the early internet feel like home" (LD §A), "Anyone who misses when online social felt personal" (GTM §2), "status as self-expression, the way it used to be" (LD §A), "A gay buddy list, reborn" (LD §A). Generic-era vocabulary — screenname, away message, buddy list, chat room, sign on, "going online" — is free to use.
3. **Internal strategy docs may name AIM/AOL/ICQ as reference points** (CLAUDE.md and README do; this doc does).
4. **Flag on reuse:** the April press pitch contains "It's closer to AOL Instant Messenger in spirit than it is to any current gay app" (GTM §4). If that pitch is re-sent during this campaign, rewrite the sentence to era-generic language (e.g., "closer in spirit to the instant messengers of the early 2000s than to any current gay app") before it goes out.
5. No retro visual asset may imitate another company's logo, running-man mascot, door-slam/buddy-in sounds, or trade dress. Our retro is our own: monospace wordmark, amber pip, glass titlebar (§3).

---

## 8. Audience portrait

Gay men, 18+ (in-app age gate at signup says "I am 18 or older." — src/app/page.tsx:510; App Store age rating 18+ — MEMORY.md Session 9, PR #57). Note: LD §B's 17+ guidance is stale and superseded by claims-register Approved #23 — do not use 17+ anywhere in audience copy or ad-platform age targeting. The four approved "for" statements (GTM §2):

- "Gay men who just moved somewhere new"
- "Gay men who want friends, not just contacts"
- "Gay men who are over apps that only work one way"
- "Anyone who misses when online social felt personal"

Refined at launch (LD §A, "WHO IT'S FOR"): "new-in-town, starting over, between friend groups, or just tired of every app being about dating. If you've ever wished there were a place to just talk, this is it."

**Texture from the product itself:** he sets an away message like "doomscrolling" or "finally cleaning my apartment" (LD §A); he's in "Late Night" at 1am or "Sunday Reset" planning his week (LD §A room names); he might be in his 30s, maybe divorced, maybe cooking for one — the seeded room concepts ("30s club no explaining required," "Divorced and thriving theoretically," "People who actually cook" — AD) sketch him precisely. Geography: NYC, LA, Chicago, Atlanta, and pointedly "Everywhere Else" (LD §A) — plus a real Central Florida seed base (GTM §5, Tier 2).

**What he's protected from:** being outed, being browsed by face, being turned into inventory. Screenname-first identity (GTM §1), sender-only notification previews, Face ID/Touch ID app lock (LD §A). Campaign creative must never depict or require the opposite.

**Stage honesty:** early post-launch, seeded community of dozens not thousands (GTM §5). Copy promises presence and warmth, never scale: "People check in throughout the day" (LD §E.7), not "everyone's already here."

---

## 9. Feature-claims guardrails for this campaign

Public copy may only claim shipped features. Safe to claim (verified in RM / LD §A): screennames with synthetic-email auth (no real email required), away messages/status with mood presets, buddy lists, 7 launch chat rooms (regional: New York City, Los Angeles, Chicago, Atlanta, Everywhere Else; vibe: Late Night, Sunday Reset), DMs with text, photos, and voice notes, emoji reactions, soft edit/delete, inline message search, offline outbox with retry, push notifications, Face ID/Touch ID app lock, Block + Report on every surface, server-side content filter, self-serve account deletion, in-app room invites for accepted buddies (no shareable links — see claims register Approved #17 / DNC #7), dark/light themes.

Do **not** claim in campaign copy:
- **H.I.M. Pro / any subscription** — spec exists (LD §D) but no IAP is shipped; the unbacked Pro badge was flagged for deletion (LD §D sequencing note).
- **"Download a full copy of your data"** — appears in the LD §A store description, but verify it against the claims register / shipped build before repeating it in campaign assets.
- **Any live/member counts** — real presence only, per LD §E.1 and the `himArtDirection.ts` "Presence must be REAL" rule.
- **Android availability** — confirm live Play Store status in `ANDROID_PLAY_RELEASE.md` before any "on Android" line ships.

---

*Brand Guardian brief · H.I.M. Q3 2026 campaign · Saman Technologies LLC (internal)*
