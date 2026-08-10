# Personal Colour v3 — Phase C implementation instruction

Authored by Fable (design lead) 2026-08-04, for Sonnet execution. Builds on
the uncommitted Phase A+B work. Scope approved by anh Khôi: **full beauty**
deliverables. Context: `docs/personal-color-v3-research.md` §2 (pro
deliverables) and §4 Phase C.

SCOPE CUT (decided by Fable, do not implement): NO outfit-engine/metal
scoring wiring in this phase — item metadata has no gold/silver distinction
(only 'metallic') and `supabase/functions` carries unrelated uncommitted
work in a single-production-env project; engine wiring goes to backlog.
Phase C is **client-only**: no supabase/functions changes, no deploys, no DB
schema changes, no savePersonalColor payload changes.

Same standing constraints: strict TS, logic in pure modules, screens in
lockstep, manual quiz path untouched, en+vi i18n for every string, no
commits.

## C1. tone12Beauty.ts — NEW pure data module (Jest-covered)

```ts
export interface Tone12Beauty {
  /** 4 hero "wow" colours — hand-picked subset of the tone's 6 accents. */
  wow: string[];
  metal: 'gold' | 'silver' | 'both';
  /** 2–3 swatch hexes + a short descriptor key per family. */
  makeup: { lips: string[]; cheeks: string[]; eyes: string[] };
  /** i18n key suffixes, resolved via locale files. */
  hairKey: string;     // e.g. 'warmGolden' → personalColor_hair_warmGolden
  glassesKey: string;  // e.g. 'tortoiseGold'
}
export const TONE12_BEAUTY: Record<ColorTone12, Tone12Beauty>;
```

Content rules (derive all 12 from these anchors; all hexes
CALIBRATION-PENDING, colourist review later — say so in the header):
- `wow`: pick 4 of the tone's `accents` (TONE12_BOARDS) by visual judgment —
  favour the most recognisably on-season, drop the two that read closest to
  another tone. Document each pick's reasoning in a short inline comment.
- `metal`: springs + autumns → 'gold'; summers + winters → 'silver';
  EXCEPT soft_summer and soft_autumn → 'both' (lowest-chroma bridge tones,
  muted metals work both ways — research §2 "neutral undertone → both").
- `makeup` families follow the season-family anchors from research §2, then
  shift per tone modifier (light→paler, bright→more saturated, soft→dustier,
  deep→darker):
  - Spring: coral lips, peachy cheeks, golden/warm eyes.
  - Summer: mauve/rose lips, dusty-pink cheeks, cool taupe/lavender eyes.
  - Autumn: brick/terracotta lips, cinnamon cheeks, bronze/olive eyes.
  - Winter: berry/blue-red lips, cool-pink cheeks, charcoal/jewel eyes.
  2–3 hexes per family, picked to harmonise with the tone's board (sample
  the board for guidance but makeup hexes are their own values — lipstick
  red ≠ wardrobe red).
- `hairKey`/`glassesKey`: one short directional phrase per tone, en + vi,
  in the locale files (12 hair + 12 glasses entries, reuse across tones
  where the direction genuinely repeats — e.g. all three autumns can share
  'glasses_warmTortoise' if apt). Anchors: warm seasons → golden/copper/
  chestnut hair, tortoise/gold frames; cool seasons → ash/cool-brown/black
  hair, black/silver/crystal frames (research §2 tables).

Tests: 12 keys complete; wow ⊆ that tone's accents and length 4; every hex
parses via hexToRgb; metal values match the rule above; hairKey/glassesKey
resolve to existing entries in BOTH locale files (load the JSONs in the
test).

## C2. Result screens — "BEYOND THE WARDROBE" section

Both screens, after "BETTER TO SKIP", before the refine section. Luxury
minimal, all existing styles/token patterns — no new visual language:
- `WOW COLOURS` (paletteSectionLabel) — the 4 wow swatches at 44×44
  (seasonEditSwatch size); caption: "Small doses. Maximum effect — a scarf,
  a lip, a bag." (en; +vi).
- `METALS` — text-only line (skipListText style): "Gold · Bronze" /
  "Silver · Platinum" / "Gold or Silver — both sit well on you."
- `MAKEUP` — three rows, each: tiny sublabel (LIPS / CHEEKS / EYES) + the
  family's 2–3 swatches at 28×28 (paletteSwatchSmall).
- `HAIR` + `GLASSES` — one text line each (skipListText), from the i18n
  keys.
Screens stay thin — a small presentational component per screen file is
fine, but ALL data selection comes from `TONE12_BEAUTY[result.tone12]`.

## C3. Docs, backlog, tests

- design.md: new section for C2 (exact labels, sizes, order).
- plan.md changelog: Phase C entry, including the SCOPE CUT rationale
  (engine metal wiring deferred: no gold/silver item metadata + dirty
  supabase/functions tree + single prod env).
- backlog.md: tick Phase C queue item; ADD new deferred item "Engine metal
  wiring — needs item-metadata metal vocabulary (gold/silver) + backfill +
  clean functions tree before deploy" (section A or B as fits).
- `npx jest src/features/personal-color` and full `npx jest src` +
  `npx tsc --noEmit` green before reporting.
