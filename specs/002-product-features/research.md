# Research: MIEN — Product Features Phase

**Branch**: `002-product-features` | **Date**: 2026-06-08

All decisions resolved from `docs/expectation/expectation.md` clarifications (Q1–Q52)
and against the existing Expo managed-workflow tech stack.

---

## Decision 1: Personal Color — Hybrid Camera + Question Detection

**Question**: How do we reliably classify a user's 4-season personal color (Spring / Summer /
Autumn / Winter) without requiring color-theory knowledge from the user?

**Decision**: Hybrid approach. Camera captures skin undertone and hair intensity on-device
(no image ever leaves the device, no API cost). Two plain-language questions cover eye color
and metal preference. Vein color question dropped — it is a proxy for skin undertone,
which camera already detects more reliably.

---

### Signals required

| Signal | Method | Why |
|---|---|---|
| Skin undertone (warm/cool) | Rear camera + rear flash on inner wrist | Most important signal. Camera avoids color-theory terminology. Wrist skin: no makeup, no sun damage, flat surface. |
| Hair intensity + warmth | Rear camera + rear flash on hair roots | Determines light/dark and warm/cool of hair. User points at roots (not ends — ends fade/dye). |
| Eye color | Question — 4 colored circle swatches, user taps | Easy visual match, no terminology needed. |
| Metal preference | Question — Gold / Silver / Both | Experience-based, not physical trait. Best tie-breaker. |
| Vein color | **Dropped** | Proxy for skin undertone. Camera already detects undertone directly. Many users cannot see veins on medium/dark skin. |

---

### On-device camera pipeline

**Hardware**: Rear camera + rear flash (LED). User holds phone over inner wrist or hair roots,
screen faces them so they see the live preview. No selfie — no face capture required.

**Step 1 — Flash white-balance correction** (applied before analysis)

Phone LED flash is cool-white (~5500K). Apply fixed RGB multipliers:
```
R × 1.05  (counteract cool blue cast)
G × 1.00
B × 0.95
```

**Step 2 — Pixel sampling**

Take center 20% crop of captured frame.
```
brightness = 0.299R + 0.587G + 0.114B
discard pixel if brightness > 240  (overexposed flash spot)
discard pixel if brightness < 30   (shadow)
average remaining pixels → single R, G, B value
```

**Step 3 — RGB → LAB color space**

Standard CIELAB conversion (~25 lines, no library):
```
RGB → linearise → XYZ (D65 white point) → LAB

L  = lightness    (0 = black, 100 = white)
a  = green ↔ red/pink
b  = blue  ↔ yellow/orange
```

**Step 4 — Classify from LAB values**

Skin undertone (from wrist capture):
```
b > 20 AND b > a × 1.5  →  warm   (yellow dominant)
a > 15 AND a > b         →  cool   (pink dominant)
else                      →  neutral
```

Hair (from roots capture):
```
L > 65   →  light
L 40–65  →  medium
L < 40   →  dark

b > 10   →  warm hair (golden, auburn, copper)
b < 5    →  cool hair (ash, platinum)
```

---

### Season matrix

Skin undertone + hair intensity together determine the season.
Eye color and metal preference confirm or break ties.

| Skin undertone | Hair intensity | Season |
|---|---|---|
| Warm | Light | Spring |
| Cool | Light | Summer |
| Warm | Dark / Medium | Autumn |
| Cool | Dark | Winter |

---

### Questions (2 only)

| # | Question | Options | Scores |
|---|---|---|---|
| Q1 | Eye color (tap a circle) | Brown | +2 Autumn, +1 Spring |
| | | Blue / Grey | +2 Summer, +1 Winter |
| | | Green | +1 Spring, +1 Autumn |
| | | Dark brown / Black | +2 Winter, +1 Autumn |
| Q2 | Metal preference | Gold looks better | +2 Spring, +2 Autumn |
| | | Silver looks better | +2 Summer, +2 Winter |
| | | Both equal | 0 |

---

### Scoring

```
final_score[season] = camera_score[season] + question_score[season]

camera_score:
  undertone warm  → Spring +3, Autumn +3
  undertone cool  → Summer +3, Winter +3
  hair light      → Spring +2, Summer +2
  hair dark       → Autumn +2, Winter +2
  hair warm       → Spring +1, Autumn +1
  hair cool       → Summer +1, Winter +1

winning season = argmax(final_score)
undertone = warm if season ∈ {Spring, Autumn}, cool if ∈ {Summer, Winter}
```

Camera signals weighted higher than questions (3 vs 2 points max per signal)
because they are objective measurements, not self-reported estimates.

---

### Implementation notes

- **No ML model needed** — pure pixel math after capture. Runs < 50ms on any modern phone.
- **No ML Kit needed** for wrist/hair — no face detection required, just center-crop sampling.
- `react-native-vision-camera` — already in stack for pose estimation. Torch control:
  `device.torch = 'on'` before capture, `'off'` after.
- Color math utility: `src/utils/colorLab.ts` (~50 lines: RGB→LAB, flash correction, classify).
- Camera step is **optional** — user can skip and answer manual questions instead (Q: skin tone
  as 3 simple options, Q: hair shade as 3 simple options). Manual fallback adds 2 questions.
- Images are captured to an in-memory buffer only. Never written to disk, never uploaded.
- User instruction: *"Hold your inner wrist 15–20 cm from the camera, palm facing up."*
  Minimum distance warning prevents overexposure from flash at < 10cm.

---

**Stored**: `color_season TEXT`, `skin_undertone TEXT`, `personal_palette TEXT[]` on `profiles`.
Personal palette = curated list of 8–12 color names per season (static lookup in `src/data/colorSeasons.ts`).

---

## Decision 2: On-Device Pose Estimation

**Question**: What library enables on-device pose estimation in Expo managed workflow
for body measurement auto-detect?

**Decision**: Implement as **Expo Dev Client feature** using `react-native-vision-camera`
with a custom frame processor running TensorFlow.js MoveNet/SinglePose/Lightning model.

- The camera measurement screen requires `expo-dev-client` (adds native module support
  without full ejection). This is an acceptable managed-workflow extension.
- TensorFlow Lite via `@tensorflow/tfjs-react-native` + `@tensorflow-models/pose-detection`
  with MoveNet Lightning model (~3 MB) provides 30+ fps on mid-range devices.
- Output: 17 body keypoints (nose, shoulders, elbows, wrists, hips, knees, ankles).
- Ratio calculation: shoulder-width / total-height, hip-width / shoulder-width, etc.
  Anchored on user-entered height (Q10) to compute absolute cm estimates.
- User can correct all auto-filled values before saving (Q9).

**Rationale**: Q8 specifies on-device (free, private). Expo managed workflow blocks
TFLite native modules — Expo Dev Client is the minimal footprint approach that
preserves managed-workflow benefits while enabling native camera frame processors.

**Alternatives considered**:
- Pure JS TFLite via WebView (rejected: 3–4× slower, complex DOM bridge)
- Eject to bare workflow (rejected: loses Expo managed benefits permanently)
- Defer to v2 (rejected: Q8 explicitly names camera measurement as MVP)

---

## Decision 3: Body Shape Classification

**Question**: How to compute a body shape classification from measurements?

**Decision**: Rule-based classifier from bust (B), waist (W), hip (H), and shoulder
width (S) measurements stored in `body_measurements`. Five shapes:

```
Hourglass:          |B - H| ≤ 5 cm  AND  W ≤ B*0.75
Rectangle:          |B - H| ≤ 5 cm  AND  W > B*0.75
Triangle/Pear:      H > B + 5 cm
InvertedTriangle:   B > H + 5 cm  (or S > H + 5)
Apple/Oval:         W ≥ B*0.85  AND  W ≥ H*0.85
```

Computed server-side on profile save (Edge Function or Supabase trigger); stored as
`body_shape TEXT` on `body_measurements`. User can manually override via a picker in
the measurements-edit screen (Q12).

---

## Decision 4: i18n Library

**Question**: Which internationalization library supports Expo + React Native
for Vietnamese and English?

**Decision**: `i18next` + `react-i18next` + `expo-localization` for locale detection.

- `expo-localization` reads device locale (`Localization.locale`).
- `i18next` with JSON translation files in `src/i18n/locales/en.json` and
  `src/i18n/locales/vi.json`.
- `react-i18next` provides `useTranslation()` hook and `Trans` component for JSX.
- Language switch stored in `appStore.language: 'en' | 'vi'` (persisted, overrides device locale).

**Rationale**: Q51 specifies i18n from the start for Vietnamese + English.
`react-i18next` is the dominant solution in the React Native ecosystem with Expo support.

---

## Decision 5: In-App Purchases / Tier Enforcement

**Question**: Which IAP library works with Expo managed workflow for App Store + Google Play subscriptions?

**Decision**: **RevenueCat** (`react-native-purchases`) with the Expo Plugin.

- RevenueCat handles entitlement validation, receipt verification, and subscription
  management cross-platform without building a custom backend.
- The Expo plugin (`expo-config-plugin`) integrates it into the managed build.
- Entitlement check: `useEntitlements()` hook from a custom `usePremium()` hook in
  `src/features/monetization/usePremium.ts`.
- Tier gates: `PREMIUM` entitlement unlocks unlimited AI scans, full AI chat.
  Free tier: 2 worn-outfit AI scans/month, small AI-chat allowance.

**Alternatives considered**:
- `expo-in-app-purchases` (deprecated, removed from SDK 51; rejected)
- `react-native-iap` (works but requires manual receipt validation server; rejected for complexity)

---

## Decision 6: Server-Side Outfit Persistence

**Question**: How to persist saved / worn / scheduled outfits server-side?

**Decision**: Single `outfit_interactions` table with an `interaction_type` discriminator.

```sql
CREATE TABLE public.outfit_interactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outfit_id     text NOT NULL,          -- generated outfit hash or demo ID
  outfit_data   jsonb NOT NULL,         -- full outfit snapshot (item IDs, tags, etc.)
  type          text NOT NULL,          -- 'saved' | 'worn' | 'scheduled'
  interacted_at timestamptz NOT NULL DEFAULT now(),
  scheduled_for date,                   -- nullable; only used when type = 'scheduled'
  worn_at       date,                   -- nullable; only used when type = 'worn'
  UNIQUE (user_id, outfit_id, type)     -- prevent duplicate interactions
);
```

The outfit snapshot (`outfit_data`) is stored as JSONB so we don't need a separate
server-side outfits table right now. The fit engine generates transient outfit objects;
only interacted outfits need persistence.

**Cooldown logic**: Query `outfit_interactions WHERE type = 'worn' AND worn_at >= NOW() - INTERVAL '7 days'`
to build a server-side exclusion list sent with each outfit generation request.

---

## Decision 7: Feed Pagination + Dedup

**Question**: How to paginate the outfit feed and prevent repeats?

**Decision**: Client holds a `shownOutfitIds: Set<string>` in `fitEngineStore` (persisted
to AsyncStorage). Each `fetchOutfits()` call sends `exclude_ids: string[]` in the Edge
Function request body. Edge Function excludes those IDs from the candidate pool.
When the last batch has < 3 outfits, flush `shownOutfitIds` and request fresh.

Batch size: 10 per request (Q35). Target latency: ~1.5 s per batch (Q36).
Last batch cached in `fitEngineStore.outfits` for instant paint on re-open.

---

## Decision 8: Claude Vision AI Extraction Pipeline

**Question**: How does the worn-outfit AI extraction work (provider, prompt, retry)?

**Decision**: Call `supabase/functions/extract-garments/` Edge Function.

Flow:
1. User uploads photo → uploaded to `wardrobe-photos/{userId}/raw/{uploadId}.jpg` (temporary).
2. Edge Function downloads raw photo, calls `claude-haiku-4-5` (cheapest multimodal) with
   a structured extraction prompt.
3. Returns JSON: `{ items: [{ name, category, primaryColor, additionalColors, material, brand, notes }] }`.
4. Client renders review screen; user corrects and confirms.
5. On confirm: per-item, run on-device background removal (expo-image-manipulator crop +
   a WASM segmentation model), save PNG to Supabase Storage, insert `clothing_items` row.
6. After successful extraction → delete the raw uploaded photo (Q28).
7. On failure / low confidence → show partial results, allow manual fix, allow 1 free retry;
   failure does NOT consume a monthly scan credit (Q27).

Monthly scan credit: `usage_credits` table tracks `{ user_id, credit_type: 'worn_outfit_scan',
used: int, period_start: date }`. Free tier: 2 per calendar month. Checked before invoking Edge Function.

---

## Decision 9: Style Catalog — Server-Driven

**Question**: How to make the style catalog server-driven and expandable without an app release?

**Decision**: `public.styles` Supabase table. App fetches styles on each launch (with
a 24-hour client-side cache). New styles added in Supabase admin console propagate
on next app load.

```sql
CREATE TABLE public.styles (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,           -- e.g. 'minimalist'
  name          text NOT NULL,                  -- e.g. 'Minimalist'
  description   text NOT NULL DEFAULT '',
  related_slugs text[] NOT NULL DEFAULT '{}',   -- suggested related styles
  display_order int NOT NULL DEFAULT 0,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);
```

RLS: SELECT open to all authenticated users (read-only catalog). No user-specific data.

---

## Decision 10: Formula Catalog — Server-Driven

**Decision**: Same pattern as styles. `public.formulas` table. Fetched + cached 24 h.
User's active formula stored as `style_profiles.active_formula_id uuid` (FK → `formulas.id`).
Feed screen allows per-session override stored in `fitEngineStore.sessionFormulaId`.

---

## Decision 11: IntentContext Scaffold

**Decision**: Define `IntentContext` type in `src/types/intent.ts` now.
No chat UI; no LLM calls. The type ships as a scaffold so the fit engine can accept
it in a future fast-follow. The generate-outfits Edge Function accepts an optional
`intentContext?: IntentContext` field in the request body (ignored if null).

```typescript
interface IntentContext {
  rawPrompt: string
  occasion?: string
  mood?: string
  style?: string
  excludeItemIds?: string[]
  swapCategory?: string
  turnCount: number          // multi-turn accumulation
}
```
