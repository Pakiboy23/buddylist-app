# H.I.M. Pro — Monetization Plan of Record (v2.1)

**Prepared:** 2026-07-21 · **Decision owner:** Saman Technologies LLC
**Source analysis:** App Store Optimizer review + `him-launch-deliverables.md` §D
**Status:** ASC products created (draft); code integration pending 2.1

---

## Decision

**Do NOT couple monetization to the 2.0.2 / July submission. Ship 2.0.2 clean; ship Pro as the 2.1 release in early October**, scoped by what the Sep 13 campaign-wrap retention data shows.

Rationale (full memo reasoning): the ~10-day timeline to the Jul 31 submit target cannot absorb a first StoreKit integration; a first IAP is submitted *with* a binary, so any Guideline 3.1.1/3.1.2 miss risks the **Aug 3 campaign live date**; revenue at base-case signups (~$10–15/mo) is a rounding error while a paywall feeds the #1 documented campaign risk (dead-room first impression); and the app's prior 5.1.1(v) / 2.1(a) review history argues for the lowest-risk possible July submission.

## What already exists (App Store Connect, created 2026-07-21)

All in **draft (`MISSING_METADATA`)**, attached to **no build** — the 2.0.2 review is unaffected. US localizations added.

| Product | Product ID | Type | Price (USD) |
|---|---|---|---|
| H.I.M. Pro | — | Subscription group `22254438` | — |
| H.I.M. Pro Monthly | `com.hiitsme.app.pro.monthly` | Auto-renewable | $2.99/mo |
| H.I.M. Pro Annual | `com.hiitsme.app.pro.annual` | Auto-renewable | $24.99/yr |
| H.I.M. Founding Member | `com.hiitsme.app.pro.founding` | Non-consumable | $49.99 once |

**Pricing note:** these are the *cosmetic-tier* prices ($2.99/$24.99), lower than §D's $4.99/$39.99. The reduction is deliberate and tied to the model change below — cosmetic-only Pro should price for attach rate, not ARPU.

## Model: sell customization + convenience, never access or visibility

**FREE forever — never gate (gating risks Guideline 1.2 and kills retention):**
unlimited DMs / room messages / buddies · block · report · delete · account deletion · data export · read receipts · typing · presence & away messages · 1 default theme + wallpaper · 3 away presets (`FREE_PRESET_CAP`) · 20 saved messages (`FREE_SAVED_MESSAGES_CAP`) · static buddy icon.

**H.I.M. Pro — gated:**
full theme + wallpaper library (`theme_key`/`wallpaper_key`) · unlimited away presets · unlimited saved messages · pin + archive DMs (`is_pinned`/`is_archived`) · animated buddy icon · the H.I.M. Pro badge (now backed by a real entitlement).

**Deliberate change from §D — drop "Profile Spotlight."** Pay-to-be-seen ranks members like inventory (brand-brief voice rule 4) and distorts discovery in a community of dozens where room aliveness is existential. Visibility is infrastructure, not a perk. Removing it makes Pro purely cosmetic, which is why the price drops to $2.99/$24.99. **Lead with the $49.99 Founding Member lifetime SKU** — a one-time "yours forever" purchase converts seed-cohort goodwill without renewal pressure and fits "honest smallness."

## Entitlement architecture

- **DB:** migration `20260722160000_pro_entitlement.sql` (in repo, **not yet applied**) adds `users.is_pro` (default false), `pro_source` (`monthly|annual|founding`), `pro_since`, a partial index, and **revokes client `UPDATE` on those columns** so no member can self-promote.
- **Write path:** service-role only, from a 2.1 receipt-validation edge function (RevenueCat webhook or StoreKit 2 + own `push-dispatch`-style function). Never trust the client; check server-side in RLS/functions.
- **Client:** read `is_pro` to unlock cosmetic gates; soft-walls at point of intent (locked swatch, 21st saved message, 4th away preset, animated-icon option) + one persistent "H.I.M. Pro" row in `/account`.

## Paywall compliance (Guideline 3.1.1 / 3.1.2) — must all be on-screen

Restore Purchases (functional) · Manage Subscription (opens App Store sheet) · visible Terms (`/terms`) + Privacy (`/privacy`) · auto-renew disclosure text un-buried · StoreKit IAP only, no external purchase links. Copy is paste-ready in `him-launch-deliverables.md` §D.

## Timeline

| When | Work |
|---|---|
| This week | ASC back-office: **sign Paid Apps Agreement + banking/tax** (dashboard-only, Account Holder; the slow dependency — products cannot go live without it). Apply the `is_pro` migration when convenient. |
| Aug 3 – Sep 13 | Campaign flight. No store-conversion changes mid-measurement. Background decisions only (RevenueCat vs StoreKit 2, final SKU set). |
| Sep 15 – Oct 3 | Build: entitlement backend → paywall UI + gating + restore → sandbox testing, `ios:preflight`, paywall review screenshots. |
| ~Oct 6 | Submit 2.1 with IAPs attached (budget one rejection round). |
| Mid-Oct | Live, informed by the Sep 13 wrap's retention data. |

**Compression option:** a Founding-Member-only 2.1 (single non-consumable, no subscription group) is ~half the build and could submit ~Sep 26.

## Bottom line

The option to monetize now exists — products are created and priced in ASC, attached to nothing, invisible to the 2.0.2 review. The only remaining back-office dependency is the Paid Apps Agreement + banking (dashboard-only). Ship 2.0.2, run the flight clean, and build Pro as a cosmetic tier + Founding Member lifetime SKU for an early-October 2.1, priced by who actually stayed.
