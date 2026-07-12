# Implementation Plan: Measurement Mapping (paste shop sizes → canonical keys)

**Branch**: `008-try-on` (continues) | **Date**: 2026-06-25 | **Owner design**: Opus; **impl**: Sonnet

## Problem

Different shops list garment measurements with different naming, language, units, and
**convention** (flat/half-width vs full circumference). The user wants to paste a shop's
raw measurement text and have AI map it onto the app's canonical `m_*` keys, used both when
**scanning an item in Try-On** and when **adding an item to the wardrobe**.

## Canonical convention (VERIFIED against production DB, 2026-06-25)

Live `clothing_items` confirm the engine's de-facto convention — values are stored as
**FULL CIRCUMFERENCE** for girths and **single length** for the rest. The fit engine
(`scoring.ts`) compares garment vs body by direct subtraction (`ease = garment - body`),
and body values are full circumference, so garment girths MUST be full circumference too.

| Key | Convention | Live sample |
|-----|-----------|-------------|
| `m_chest` | full chest circumference (cm) | TEE 102, SWEATER 108, JACKET 112–114 |
| `m_waist` | full waist circumference (cm) | JEANS/CHINOS 76–83 |
| `m_hip` | full hip circumference (cm) | 99–107 |
| `m_thigh` | full thigh circumference (cm) | 55–62 |
| `m_shoulder_width` | seam-to-seam, single (cm) | 44–48 |
| `m_sleeves` | sleeve length, single (cm) | 62–66 (short-sleeve 22) |
| `m_body_length` | collar/HPS→hem, single (cm) | 62–73 |
| `m_inseam` | inseam, single (cm) | 71–76 |
| `m_shoe_size` | EU number | — |

**Known pre-existing bug fixed here:** `measureSchema.ts` `GROUP_DEFAULTS.top` had
`m_chest: 54` and `m_waist: 50` — half-width values that break fit scoring for on-device
("Extract by item") additions (ease ≈ 54−95 = −41 → always "tight"). Corrected to full
circumference (`m_chest: 102`, `m_waist: 96`). Bottom defaults were already full-scale.
The `docs/fit-engine.md` "doubled internally" wording is misleading — nothing doubles at
runtime; the stored value IS the full circumference. Doc note corrected.

## Scope (confirmed with user)

- BOTH entry points: wardrobe-add review card AND Try-On result screen.
- AI provider: **Gemini** (reuse the `generate-item-image` text-call pattern).
- MVP: **one size per paste.** If a multi-size table (S/M/L) is detected, do NOT guess —
  tell the user to paste a single size.
- AI maps + **user confirms** (no silent overwrite); unmapped source fields are surfaced.

## Components

### 1. Edge function `supabase/functions/map-measurements/` (Deno, Gemini text)
- `index.ts` — clone auth/CORS/retry/`jsonResponse` from `generate-item-image/index.ts`;
  single Gemini `gemini-2.5-flash` text call (`responseModalities:['TEXT']`, temp 0.1).
- `prompt.ts` — system prompt + a server-side `sanitizeMapResult()` (clamp/range-drop).
- **Input** `{ raw_text: string, garment_type: string }` (Bearer auth).
- Server derives the measure group from `garment_type` (replicate
  `measureGroupForType` sets) and only asks for that group's canonical keys:
  - top: `m_chest, m_waist, m_shoulder_width, m_body_length, m_sleeves`
  - bottom: `m_waist, m_hip, m_inseam, m_thigh`
  - shoe: `m_shoe_size`
  - other (accessories): return empty.
  (Deliberately excludes `m_rise`/`m_skirt_length` — engine doesn't score them.)
- **Output**
  ```
  { mapped: { [mKey]: { value:number, source_label:string,
                        conversion:'none'|'inch_to_cm'|'doubled'|'inch_to_cm+doubled',
                        confidence:number } },
    unmapped: [{ label:string, value:string }],
    multiple_sizes: boolean, detected_size: string|null }
  ```
- **Normalization rules the model is given (the crux):**
  1. inches (`"`, `in`, `inch`) → ×2.54.
  2. Girth keys (chest/waist/hip/thigh): shops often list a FLAT/across (nửa vòng, đo
     ngang, "1/2 ngực", laid-flat pit-to-pit) value → DOUBLE to full circumference.
     Decide by plausibility band: full chest ~80–140 (flat half ~35–70); full waist
     ~60–130 (flat ~30–65); full hip ~80–140 (flat ~40–70); full thigh ~40–80 (flat
     ~20–40). In band → keep; below → double. Mark `conversion`.
  3. Length/shoulder keys are SINGLE — never double.
  4. Multi-size table → `multiple_sizes:true`, `mapped:{}` (don't guess).
  5. Vietnamese + English synonyms: ngực/vòng ngực→chest, eo→waist, mông/hông→hip,
     vai/ngang vai→shoulder, dài áo/dài→body_length, dài tay/tay→sleeves, đùi→thigh,
     ống→inseam, size→shoe_size (footwear). Non-measurements (weight, %cotton) → unmapped.
- **Server re-validation** (`sanitizeMapResult`): clamp 0<v<400, round 0.1, DROP keys
  outside post-normalization sane bands (chest/waistTop/hip 60–160, bottom waist 50–160,
  thigh 35–90, shoulder 30–70, sleeves 15–80, body_length 35–110, inseam 40–100, shoe 30–52).
- **Credit:** text-only & cheap → FREE for MVP (no gate). Revisit if abused.

### 2. Shared types `src/types/measurementMap.ts`
camelCase domain types: `MeasureConversion`, `MappedMeasure{ key:MKey; value; sourceLabel;
conversion; confidence }`, `MeasurementMapResult{ mapped:MappedMeasure[]; unmapped[];
multipleSizes; detectedSize }`.

### 3. Service `src/services/measurementMapService.ts`
`mapMeasurements(rawText, garmentType): Promise<MeasurementMapResult>` — invoke the edge
function (mirror `tryOnService.evaluateItem` invocation), snake→camel, friendly errors.

### 4. Shared component `src/components/measurements/MeasurementAIMap.tsx`
**INLINE** (not a modal — revised per user, 2026-06-25). Lives in shared `src/components/`
(NOT under a feature) so both wardrobe-add and try-on can use it without violating
Constitution VI. Props `{ garmentType, currentMeasurements, onApply(Partial<Record<MKey,
number>>) }`. Placed directly BELOW the per-measurement edit grid: an `AI MAPPING
MEASUREMENT` multiline box → `MAP WITH AI` → **auto-fills** the grid above (calls onApply
immediately) and shows a compact summary (filled rows · conversion note "×2 from flat" /
"in→cm" · low-confidence hint · unmapped leftovers). If `multipleSizes`, it does NOT fill
and shows "paste one size". Returns null for accessory types. Luxury-minimal tokens.
(The earlier modal `PasteMeasurementsSheet` was removed.)

### 5. Wire-in
- **wardrobe-add** `ItemCard.tsx`: `<MeasurementAIMap>` inline under the measurements grid
  → `onEdit({ measurements:{...item.measurements,...mapped} })`. This automatically covers
  the **item-edit** screen (`app/item-edit.tsx`) too, since it renders the same `ItemCard`.
- **try-on** `ResultScreen.tsx`: the estimated-measurements grid is now **editable**
  (`MeasureField` per field; revised per user 2026-06-25) with `<MeasurementAIMap>` inline
  below it. Each field commit and each AI map calls the store action below (re-scores the
  Verdict). `MeasureField` was moved to shared `src/components/measurements/` (with a `value`
  re-sync + optional `unit` prop) so try-on can reuse it without a cross-feature import.
- **tryOnStore** `applyMeasurements(next: Partial<Record<MKey,number>>)`: **replace**
  `scannedItem.metadata.measurements` with `next`, set state, then re-run `evaluate()` so the
  Verdict's Measurement criterion updates. (Full-replace so manual edits can also clear a key;
  callers pass the merged full map.)

### 6. Defaults bug fix
`measureSchema.ts` `GROUP_DEFAULTS.top`: `m_chest 54→102`, `m_waist 50→96`.

## Docs to update (same session)
- `src/design/wardrobe-add/design.md` + `src/design/try-on/design.md` — paste affordance.
- `docs/fit-engine.md` — correct the "doubled internally" wording (values stored full circ).
- this plan.

## Deploy
New edge function `map-measurements` → `npx supabase functions deploy map-measurements`
(production; single env). Client changes ship on next app build.

## Risk notes
- Flat-vs-full doubling is heuristic (plausibility bands) → user confirms in UI; never
  silently overwrites. Server range-drops absurd values.
- No new DB columns/tables. No engine scoring change. Pure ingest-side + a read-only mapper.
