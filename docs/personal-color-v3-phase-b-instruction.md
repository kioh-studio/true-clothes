# Personal Colour v3 — Phase B implementation instruction

Authored by Fable (design lead) 2026-08-04, for Sonnet execution. Builds ON
TOP of the uncommitted Phase A changes in the working tree (do not revert
anything). Context: `docs/personal-color-v3-research.md` §2 (professional
draping methodology) and §4 Phase B; Phase A contract in
`docs/personal-color-v3-phase-a-instruction.md`.

Same hard constraints as Phase A: on-device only, strict TS, logic out of
JSX, no DB schema / savePersonalColor changes, manual quiz path untouched,
no commits. Selfie privacy rules of DrapeSession stay exactly as documented
in `src/design/personal-color/design.md` §5 (local state only, deleted on
close/done/unmount).

## B1. Drape rounds — professional comparative pairs

Replace the 3 generic rounds in `DrapeSession` with 5 rounds modeled on the
professional sequence. New pure module `drapeRounds.ts` (Jest-covered)
exporting the round list; DrapeSession consumes it instead of its inline
table:

| # | Axis | Left card (+1) | Right card (−1) | Judge prompt (en) |
|---|------|----------------|-----------------|-------------------|
| 1 | warmth | tomato red `#D9472B` | cherry red `#B01B45` | "Which softens the shadows under your eyes?" |
| 2 | warmth | mustard `#D6A319` | lemon `#EDE43B` | "Which makes your jawline look more defined?" |
| 3 | value | light ivory `#E8DCC8` | deep charcoal `#2E2A3A` | "Which brightens your whole face — without washing it out?" |
| 4 | chroma | clear bright `#C2185B` | soft mauve `#A89AA4` | "Which makes your eyes look brighter?" |
| 5 | metal | gold lamé `#D4AF37` | silver lamé `#C6C9D2` | "Which makes your skin glow, not grey?" |

- All hexes CALIBRATION-PENDING (colourist review later) — say so in the
  module header like tone12.ts does.
- Rounds 1–4 call `applyDrape(axis, direction)` as today (two warmth rounds
  accumulate through the existing `applyDrapePick` damping — read it first
  and keep its semantics).
- Round 5 (metal): gold pick → `applyDrape('warmth', +1)` AND `setMetal(
  'gold')` IF `metalKey` is still null (never clobber an existing answer);
  silver → warmth −1 + `setMetal('silver')` under the same guard. This may
  need a new optional `onMetal` callback prop on DrapeSession — wire it from
  both screens.
- Keep the "CAN'T TELL — SKIP" link per round. Round counter becomes
  "DRAPE N OF 5". Educational sub-caption under the prompt (smaller, one
  line): "Look at your face, not the colours." (en) — the analyst's rule.
- vi translations for every prompt/caption in both locale files.

## B2. 12-tone grid compare ("SEE ALL 12")

New phase 3 inside DrapeSession, entered from a text link on the final drape
round's screen ("SEE ALL 12 TONES") and ALSO directly from the result
screen's refine section (new secondary button `SEE ALL 12 TONES` beneath
`REFINE WITH DRAPING`; entering this way runs phase-1 selfie capture first,
then jumps straight to the grid, skipping rounds).

- Add `TONE12_DRAPE_HEX: Record<ColorTone12, string>` to tone12.ts — the
  single most-signature drape colour per tone; pick `core[2]` of each
  tone's board by default but hand-check each visually against TONE12_BOARDS
  and choose a better index where core[2] is dull (document choices inline).
  CALIBRATION-PENDING.
- Grid: 3 columns × 4 rows, each cell = the selfie (cover, ~92px tall)
  inside a backing panel of that tone's drape hex (same visual language as
  the existing drape cards: 2px `rgba(255,255,255,0.9)` hairline border),
  tone's short EN label beneath in the existing tiny-label style. The
  currently-classified tone's cell gets a subtle marker (a small `●` or ring
  in white — no new colours, luxury-minimal).
- Tap a cell → full-width compare view: current tone's card vs tapped
  tone's card side by side (same layout as a drape round), prompt "Which
  looks more alive?" Buttons: pick current (dismiss back to grid) or pick
  the challenger → `nudgeTowardTone` (B3) then back to the grid with the
  marker moved if the classification changed (result recomputes live via the
  existing derived-result memo).
- X closes the whole session with the usual cleanup.

## B3. nudgeTowardTone — pure axes math (tone12.ts, Jest-covered)

`nudgeTowardTone(current: Partial<ToneAxes>, from: ColorTone12, to:
ColorTone12): Partial<ToneAxes>` — for each axis where the axis-signature of
`to` differs in sign from `from` (derive signatures from a new internal
`TONE12_AXIS_SIGNATURE` table: each tone's canonical warmth/value/chroma
signs, e.g. true_autumn = {warmth:+1, value:−0.3, chroma:−0.5} — build it
from the season definitions in the research doc §2 table, document inline,
CALIBRATION-PENDING), apply ONE `applyDrapePick` step in that direction.
This makes a grid pick exactly as strong as one drape-round pick — a user
tapping through the grid can shift their result but not teleport it in one
tap. Reuse, don't reimplement, `applyDrapePick`.

## B4. Screens, docs, tests

- Both screens (`app/(onboarding)/personal-color.tsx`,
  `app/personal-color-edit.tsx`) stay in lockstep as always.
- design.md: update §5 (5 rounds + prompts + metal round), new §5a (grid
  compare), note the result-screen entry points.
- plan.md changelog entry; backlog.md: tick/annotate the Phase B queue item.
- Jest: drapeRounds data sanity (5 rounds, axes valid, hexes parse),
  nudgeTowardTone (no-op when tones share all signs; single-step nudge
  otherwise; never exceeds clamp), TONE12_DRAPE_HEX completeness (12 keys,
  valid hex). Run personal-color suite + `npx tsc --noEmit` until green.
