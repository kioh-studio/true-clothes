# Paywall — design spec

`app/paywall.tsx`. Full-height modal presenting RevenueCat offerings. Luxury-minimal:
thin serif headline, off-white/warm-black palette, generous whitespace, hairline
strokes only. No gradients, no shadows, no filled backgrounds.

## Layout (top to bottom)

1. Close button (top-right, hairline `X` icon)
2. Eyebrow — `MIEN PREMIUM`
3. Headline (`h1`, serif)
4. Sub-copy (`body`, secondary color) — the single value statement, see below
5. Divider (hairline)
6. **Offerings area** (see below)
7. **Disclosure block** (see below) — only rendered once a package is selected
8. Feedback message (purchase/restore result, transient)
9. "Already Premium" notice, if applicable
10. Sticky footer: primary CTA button + "Restore purchases" text link

### Value copy (2026-08-08) — one sentence, no quota numbers

The benefit list is gone. Between the headline and the divider there is exactly one
line of sub-copy, `paywall_subtitle`:

> "Tăng giới hạn sử dụng AI để bổ sung trang phục vào tủ đồ và thử đồ trước khi mua."
> / "A higher AI allowance for adding pieces to your wardrobe and trying them on
> before you buy."

Rationale: the previous copy led with raw monthly counts (`{{extraction}}` scans /
`{{tryOn}}` try-ons) plus a three-bullet list. Numbers on the selling screen frame
Premium as a ration rather than a capability, and the bullet rows fought the
whitespace the rest of the screen is built on. One sentence naming *what the user can
do* carries the offer.

**Where the numbers went instead** (shipped in the same change): the paywall used to be
the *only* place the monthly quota appeared anywhere in the app, so dropping it silently
would have left a paying user unable to see their cap until they hit it. The count now
lives at the two points that actually spend it, as a quiet `tertiary` caption above the
action button:

- try-on `ready` / `result` — above WEAR ON and REGENERATE
  (`src/design/try-on/design.md`, "Quota note on the action buttons")
- add-item upload step — above ANALYSE N PHOTOS
  (`src/design/wardrobe-add/design.md`, "Quota note")

Both use `CreditQuotaNote` + `useCreditQuota`. This split is deliberate: the paywall
sells the *capability*, the working screen states the *budget*.

Constraints this replaces the old ones with:

- **No quota claim in paywall copy at all.** `paywall_subtitle` takes no interpolation
  params and `app/paywall.tsx` no longer imports `PREMIUM_LIMITS`. Consequently there
  is nothing here to drift out of sync when the limits change.
- **Still never say "unlimited" / "không giới hạn"** — Premium is capped
  (`PREMIUM_LIMITS` in `src/services/usageCreditService.ts`), so that language is
  factually wrong and an App Store Guideline 3.1.2 risk. "Tăng giới hạn" / "a higher
  allowance" is the honest framing: more than free, not infinite.
- Removed keys: `paywall_benefit1`, `paywall_benefit2`, `paywall_benefit3` (and the
  `benefitList` / `benefitRow` / `benefitDot` / `benefitText` styles). Do not
  reintroduce a bullet list without revisiting this section.

## Offerings area

Renders every package in `offerings.current.availablePackages` — never a hardcoded
index. Three states:

**Loading** — centered `ActivityIndicator`, same as before.

**Exactly one package** — a single non-interactive card (`offeringCard` style):
hairline border (`borderWidth: 0.5`, `hairlineStrong`), serif title, large serif-light
price. No tap affordance, no selection chrome — a one-item list must not be dressed
up as a choice.

**Two or more packages** — a vertical list of tappable cards (`planList` /
`planCard`), one per package, gap `T.s(3)`:
- **Selected card**: `borderWidth: 1`, `borderColor: T.color.primary` (stronger
  hairline, still no fill/shadow).
- **Unselected card**: `borderWidth: 0.5`, `borderColor: T.color.hairlineStrong`
  (same weight as the single-package card).
- Each card shows: plan label (serif, derived from `packageType` via i18n —
  `MONTHLY`/`ANNUAL` map to `paywall_planMonthly`/`paywall_planAnnual`; any other
  type falls back to the raw product title, never a raw enum string), price
  (serif-light, large), and a period sub-line (`paywall_periodMonthly` /
  `paywall_periodAnnual`, caption size, secondary color).
- A savings badge (`SAVE {{percent}}%`, `paywall_savePercent`) renders on the
  ANNUAL card's header row, right-aligned against the plan label, only when both a
  MONTHLY and an ANNUAL package exist and the computed percent is a sane positive
  number. No badge chrome beyond the text itself (no pill background) — keeps to
  hairline-only language.
- **Current-plan badge** (`paywall_currentPlanBadge`, "CURRENT PLAN" / "GÓI HIỆN
  TẠI"): renders in the same header-row slot as the savings badge, same
  `savingsBadge` text style — no new visual language. Shown on the card whose
  `product.identifier` matches the live RevenueCat entitlement
  (`activeProductId` from `usePremium`), only while `isPremium`. If a card would
  otherwise qualify for the savings badge (e.g. the user's current plan happens
  to be ANNUAL), the current-plan badge wins — only one badge ever renders per
  card.

Default selection: ANNUAL package if one exists, else the first package in the
list. Selection never sits at null once packages have loaded. If the user is
already premium and more than one package exists, the default instead prefers
a package that is *not* their current plan (still preferring ANNUAL among the
remaining options) — so the CTA lands in a usable (enabled) state on open
instead of immediately disabled on the current-plan card.

**No offerings** (RevenueCat unavailable — Expo Go, missing API key) — dashed
hairline fallback box, unchanged from before.

## Disclosure block (Apple Guideline 3.1.2)

Sits directly below the offerings area and above the feedback message. Renders
only when a package is selected (i.e. never in the loading/no-offerings states).
Legally required, so it must exist and be readable, but must not visually compete
with the headline or CTA:

- Typography: `type.caption`, `color: T.color.tertiary`, centered.
- Two short paragraphs, `gap: T.s(2)`:
  1. Plan name + billing period + price (`paywall_disclosureTerms`, `{plan}` +
     `{price}` params — uses the SELECTED package, not a static string).
  2. Auto-renewal terms (`paywall_disclosureRenewal`): renews unless cancelled
     ≥24h before the period ends; account is charged for renewal within 24h prior
     to the period end.
- One row of two tappable links, centered, `gap: T.s(5)`: "Terms of Use" and
  "Privacy Policy" (`TextLink`, `color: T.color.tertiary` — same treatment as the
  "Restore purchases" link in the footer, so the disclosure doesn't introduce a new
  visual weight class). Opens `TERMS_URL` / `PRIVACY_URL` from
  `src/config/legal.ts`.

## CTA states (plan switching)

The sticky footer button is no longer blanket-disabled while `isPremium` — that
blocked every plan change, including the highest-value upgrade path
(monthly → annual). It now has four states, driven by comparing the selected
package's `product.identifier` against `activeProductId` (from `usePremium`)
and, when they differ, comparing `packageType` on both sides:

1. **Buy** (not premium) — unchanged from before: enabled, label
   `paywall_upgradeButtonWithPrice` (price of the selected package).
2. **Current plan** (premium, selected package IS the active plan) — disabled,
   label `paywall_currentPlanButton` ("CURRENT PLAN" / "GÓI HIỆN TẠI").
3. **Upgrade** (premium, current MONTHLY → selected ANNUAL) — enabled, label
   `paywall_upgradeToAnnual`. Calls the same `handlePurchase`/
   `purchasePackage` path as a fresh buy; Apple handles proration natively for
   two packages in the same subscription group, so no extra purchase
   parameters are passed on iOS.
4. **Downgrade** (premium, current ANNUAL → selected MONTHLY) — enabled, label
   `paywall_switchToMonthly`. An extra caption line renders directly below the
   button, `paywall_downgradeNotice`, styled like the disclosure text
   (`type.caption`, `T.color.tertiary`, centered): states the change takes
   effect at the end of the current billing period, not immediately — this is
   how Apple actually handles a downgrade and heads off "did I lose money?"
   confusion.

Any other premium cross-plan combination (non-MONTHLY/ANNUAL package types)
falls back to a generic enabled state, label `paywall_switchPlan` with a
`{{plan}}` param.

## Manage subscription

Inside the existing "Already Premium" block (`alreadyPremium`), below the
existing "You already have Premium" text, a `TextLink` (`paywall_manageSubscription`,
same `T.color.tertiary` treatment as the footer's "Restore purchases" link)
opens `itms-apps://apps.apple.com/account/subscriptions` — the iOS system
subscription-management screen — via `Linking.openURL(...).catch()`, so a
failure to open the URL never throws. Apple doesn't require an in-app cancel
path, but not offering one routes frustrated users to 1-star reviews or Apple
refund requests instead of a quiet self-serve cancellation.

## Non-goals / explicitly out of scope here

- No segmented-control or horizontal-tab package switcher — vertical stacked
  cards only, consistent with the rest of the app's list patterns.
- No pill/badge background fill for the savings badge — text-only, per the
  hairline-only accent rule.
