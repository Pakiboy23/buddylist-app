# 2.1 App Store screenshot capture — Claude Code prompt (run on the Mac)

This capture must run on a machine with Xcode + the iOS Simulator (i.e. the Mac),
because the marquee screens are native Swift and the app's Supabase auth needs
normal network — neither works in the headless cloud container.

**Prerequisites before running:**
- A seed/test account for the primary login, and a second consenting seed account
  online for the Knock/DM frame.
- The primary account already has **real Buddy Circles** set up (real names, no
  fabricated presence).
- The mobile-viewport fix is in `scripts/take-app-store-screenshots.mjs` (branch
  `claude/release-2-1-gtm`, commit `ef328f2`). If your working copy is on `main`
  and `DEVICES` still uses raw 1320-wide `@1x` viewports, cherry-pick that commit
  or apply the same change (CSS points × `deviceScaleFactor: 3`, `isMobile: true`,
  `hasTouch: true`) first.

## Paste this into Claude Code on the Mac (fill in the two logins)

> Goal: produce App Store Connect screenshots for H.I.M. v2.1 at 6.9"
> (1320×2868 px, portrait iPhone), for the main listing and 4 Custom Product
> Pages. You're on macOS with Xcode + the iOS Simulator.
>
> Seed logins (consented test accounts): USER 1 = `<screenname>` / `<password>` ·
> USER 2 (consenting second member) = `<screenname>` / `<password>`.
>
> Two capture surfaces — do both:
>
> 1) WEB SCREENS (rooms, chat room, DM, away-message composer, profile w/ mutual
>    context, screenname setup) — automate with the repo script:
>      PLAYWRIGHT_USER_A_SCREENNAME=<user1> PLAYWRIGHT_USER_A_PASSWORD=<pw1> \
>        node scripts/take-app-store-screenshots.mjs
>    Output: screenshots/app-store/iphone-6.9/. Verify each PNG is 1320×2868 and
>    shows the FULL-SCREEN mobile layout (not a floating card). Run ONLY with
>    credentials — never let the script's HTML-mockup fallback produce anything
>    that gets uploaded.
>
> 2) NATIVE SCREENS that only exist in the Swift shell — presence-first BuddyList
>    hero, Buddy Circles, Knock — capture from the Simulator:
>      - Boot "iPhone 16 Pro Max", build+run the app from current main.
>      - Sign in as USER 1 (has real Circles); have USER 2 online.
>      - Navigate to each screen and run:
>          xcrun simctl io booted screenshot <name>.png
>        (native output is already 1320×2868).
>
> Shot list (capture all; captions are for ASC, not burned in): 1 BuddyList
> presence hero — "Your people, right there." · 2 Buddy Circles (real circles +
> Ungrouped, consented names, NO counts) — "Your buddies, in circles only you
> see." · 3 Knock (staged with USER 2) — "Knock. A quieter way to say hi." ·
> 4 Chat room (Late Night) — "Find your people before you even DM." · 5 Away-
> message composer — "Your status says more than you think." · 6 Profile sheet
> w/ mutual context — "See what you already share."
>
> HARD RULES: real UI only — never fabricate presence, counts, or activity. Any
> other member's screenname/message needs consent; crop/blur non-consenting
> people. Portrait iPhone only. Keep "Seen by N" and Follow OUT of every frame.
> Never let an internal "aim-*" asset filename appear on screen.
>
> When done: list every PNG with its dimensions and which of the 6 came out
> clean vs. need a retake. Do NOT upload to App Store Connect — I'll review first.

## Where the frames go

One capture set covers everything: the main 2.1 listing and all four Custom
Product Pages (`Sorted`, `New City`, `Quiet Hello`, `Buddy List, Reborn` — already
created in ASC with promo text staged) reuse the same frames; each CPP takes its
relevant subset (see `custom-product-pages/cpp-strategy.md` §2 for the per-page
ordering). Add the screenshots in ASC, then Submit each page/version for review.
