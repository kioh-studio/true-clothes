# Wardrobe Report — Visual Spec (feature 010-wardrobe-critic)

Per Constitution I (Luxury Minimalist Design): near-monochrome canvas, hairline
dividers only, serif headlines, no gradients/shadows, slow/no bounce motion.
All colors/type via `T.*` / `type.*` tokens (`src/design/tokens.ts`) — nothing
hardcoded outside this doc's rationale.

## 1. Screen: `app/wardrobe-report.tsx`

- **Header**: 56px nav row, hairline bottom border, matches `settings.tsx` /
  `history.tsx` header pattern — back chevron (`IconChevronLeft`, 20px,
  stroke 1.4) left, centered serif title `WARDROBE REPORT` / `BÁO CÁO TỦ ĐỒ`
  (11–15px, letter-spacing 1), empty 44×44 spacer right for symmetry.
- **Body**: single `ScrollView`, 24px horizontal padding, pull-to-refresh
  (`RefreshControl`, tint `T.color.primary`) calling `fetchReport(true)`.
- **Context line** (mode `gaps`/`starter`): `CormorantGaramond 300`, 20px,
  lineHeight 27 — an editorial sentence, not a stat block. States the number
  of looks the wardrobe composes today (gaps) or that a foundation is needed
  first (starter).

### Mode: `gaps`

- Stack of `GapCard`s, 20px gap, no card background/shadow — a 0.5px hairline
  border is the only separator (`T.color.hairline`).
- Free tier: recommendation #1 renders in full; #2/#3 render as the same
  `GapCard` with `locked`. Real content stays in the tree (spec's "teaser by
  real value") but is dimmed to 25% opacity under a translucent scrim
  (`T.color.overlay`) with a centered uppercase `PREMIUM` / `CAO CẤP`
  micro-label (`type.micro`, letter-spacing 3) — no lock icon asset; the
  dimming IS the lock.
- **Redundancy** section sits below the card stack past a hairline top
  border. Premium: type/color-family cluster + count + the stylist's note
  (serifLight italic, matches the fit-note voice in Try-On's `VerdictPanel`).
  Free: a locked hint row (label only, no real numbers exposed) — the
  redundancy content itself is gated server-value-blind on the client, unlike
  the gap teaser, because it's a "you're overbuying" observation with no
  standalone value at a glance.
- Zero visible recommendations (all dismissed) → falls through to the same
  calm "complete" empty state rather than an empty screen.

### Mode: `starter`

- Context line explains the capsule-first framing.
- Checklist: hairline-bordered rows, 56px tall, serif label (secondary color
  when not owned, primary when owned) + `IconCheck` (16px, `T.color.success`)
  on owned rows or a plain hairline-bordered dot placeholder when not owned.
- Empty wardrobe (checklist itself empty): redirect state — serif h2 "Your
  wardrobe is empty." + caption + a single text CTA to `/add-item`, per the
  spec's edge case ("tủ đồ trống → dẫn về luồng thêm item đầu tiên").

### Mode: `complete`

- Centered, generous vertical padding (72px), `CormorantGaramond 300` h1
  "Your wardrobe is complete." + a caption line. No fabricated recommendation
  is ever rendered here (spec US1-AC3) — this is a deliberate dead end, not a
  loading/error state.

### Error / rate-limit states

- Loading (first fetch, no cached report): centered spinner + caption.
- 429 (`error === 'rate_limited'`): gentle "That's enough for today." copy —
  never a technical error string.
- Other errors: short title + a `RETRY` text action (same visual language as
  the home feed's error banner retry).
- Pull-to-refresh reuses the identical loading treatment via `RefreshControl`.

## 2. `GapCard` (`src/features/wardrobe-critic/components/GapCard.tsx`)

Single hairline-bordered block, 20px internal padding (`T.s(5)`):

1. Micro-label proof point: `UNLOCKS N LOOKS` / `MỞ KHÓA N LOOK`
   (`type.ui`, 9px, tertiary, letterSpacing 1.5) — the number IS the pitch,
   shown before the archetype name so the value lands first.
2. Archetype label — serif 22px, primary color. Never a product/brand name
   (FR-002).
3. Stylist note — `serifLight` italic, 14px, secondary color. Same voice
   register as the outfit feed's `stylistNote` and Try-On's fit note.
4. Sample-outfit thumbnail row (≤5 real item ids, de-duplicated across the
   report's `sampleOutfits`), reusing `OutfitItemThumb` from
   `components/outfit/Collage.tsx` — identical 44×56 hairline-bordered box
   used in the feed's meta strip, so a gap card visually matches an outfit
   card.
5. Actions row, hairline top border: two text-only actions, no buttons —
   `TRY WHEN SHOPPING →` (primary color, left) and `DISMISS` (tertiary,
   right). Matches the app-wide convention of text CTAs for secondary
   actions (e.g. `passLabel` in Try-On's `ResultScreen`).

## 3. End-of-feed card (`app/(tabs)/index.tsx`)

Chosen implementation: a `ListFooterComponent` row appended after the last
outfit page in the existing `FlatList`, NOT a new swipeable full-height page
— the feed's paging math (`getItemLayout`, `snapToInterval=CARD_H`) is tightly
coupled to a homogeneous `Outfit[]` dataset; injecting a second item shape
would require touching pagination/typing across the whole screen for a
single, occasional row. The footer is the documented "least change"
alternative (tasks.md T030).

- 32px vertical padding, hairline top border, centered.
- Micro-label `THE STYLIST'S NOTE` / `GHI CHÚ CỦA STYLIST`.
- One `serifLight` 18px line: "Your wardrobe report is ready." / vi
  equivalent.
- `VIEW REPORT →` text CTA.
- Visible only when `wardrobeCriticStore.visibleRecommendations().length > 0`
  (FR-009: "card chỉ hiện khi báo cáo có ít nhất một gợi ý đang mở").

## 4. Try-On bridge line (`ResultScreen.tsx`)

A single hairline-bordered, `T.color.elevated` background line, inserted
above the Verdict panel when `wardrobeCriticStore.pendingGapArchetypeId` is
set: "Fills your gap: {label}" / "Lấp khoảng trống: {label}" in
`serifLight` italic caption — same register as the gap-fill note, kept
purely presentational (no re-scoring). Cleared when the Try-On flow is
discarded or left (screen unmount).

## Color/type token usage summary

| Element | Token |
|---|---|
| Card border | `T.color.hairline` |
| Locked scrim | `T.color.overlay` |
| Owned checkmark | `T.color.success` |
| Archetype label | `T.font.serif` |
| Stylist note / fit-fill line | `T.font.serifLight` italic |
| Micro-labels / CTAs | `type.ui` / `type.micro` |
