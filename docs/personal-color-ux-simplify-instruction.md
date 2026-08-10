# Personal Colour — UX Simplification Instruction

Date: 2026-08-06. Status: APPROVED by anh Khôi (full restructure; wrist scan stays
mandatory; axis meters live in the result hero). Executor: Sonnet 5.

## Goal

The colour-season feature is functionally complete (v3) but reads as a black box
full of colourist jargon. Rebuild the **UX shell only** — guided step-by-step flow,
visual explanation of the result, explicit failure states. **Do NOT change any
classification math** (`tone12.ts`, `colorMath.ts`, `analyzePhoto.ts` logic stay
untouched except where explicitly listed).

Hard constraints: luxury-minimal design language (hairline strokes, no shadows,
slow transitions, generous spacing — see `CLAUDE.md` + `src/design/personal-color/design.md`);
TypeScript strict, no `any`; screens thin, logic in hooks; all i18n strings added
to BOTH `en.json` and `vi.json`; everything on-device.

## Files in scope

- `app/(onboarding)/personal-color.tsx` — main flow screen
- `app/personal-color-edit.tsx` — edit mirror (will shrink after extraction)
- `app/(onboarding)/colors.tsx` — entry CTA copy fix
- `src/features/personal-color/usePersonalColorDetection.ts` — add `prepare` step, expose axes, surface save error
- `src/features/personal-color/components/DrapeSession.tsx` — localise tone labels
- NEW `src/features/personal-color/components/AxisMeters.tsx`
- NEW `src/features/personal-color/components/ResultView.tsx` (shared result UI)
- NEW `src/features/personal-color/components/PrepareStep.tsx` (or inline in screen if repo convention prefers)
- `src/features/personal-color/tone12.ts` — ONLY to re-export/return axes if not already reachable from the hook, and to add per-tone description keys mapping (no math changes)
- `src/i18n/locales/en.json`, `vi.json`
- `src/design/personal-color/design.md` — document the new flow (same session)
- `backlog.md` — deferred items

## Changes

### 1. Entry CTA copy fix (colors.tsx)

`onboardingColors_detectCaption` is stale ("4 questions · under a minute" — flow is
camera-first now). Change to:
- en: `Two photos · under a minute`
- vi: `2 tấm ảnh · chưa đến 1 phút`

### 2. Intro rewrite (jargon-free)

Rewrite these keys (keep key names):
- `onboardingPersonalColor_introCaption`
  - en: `Two photos — your face and your wrist. Your best-colour palette appears instantly, processed right on this phone.`
  - vi: `Chụp 2 tấm — gương mặt và cổ tay. Bảng màu hợp với bạn hiện ra ngay, xử lý ngay trên máy.`
- `onboardingPersonalColor_introCaption2`
  - en: `The same method professional colour analysts use.`
  - vi: `Cùng phương pháp các chuyên gia phân tích màu cá nhân sử dụng.`
- `personalColor_scanButton`: en `FIND MY COLOURS` / vi giữ ALL-CAPS tương đương (`TÌM MÀU CỦA TÔI`).
- Keep the privacy note as-is (it is good).

### 3. NEW step: Prepare (camera path only)

State machine (`usePersonalColorDetection.ts`): camera path becomes
`intro → prepare → face-scan → wrist-scan → result`. `handleCameraStart` (after
permission granted) goes to `prepare`; a single CTA on the prepare screen advances
to `face-scan`. Manual path is unchanged (no prepare, keeps its progress dots).

Prepare screen content (one screen, one tap):
- H1: en `Three things\nbefore we shoot.` / vi `Ba điều\ntrước khi chụp.`
- 3 checklist rows, hairline icon + short text (follow the repo's existing icon
  convention — hairline strokes only):
  1. en `Bare face — no makeup` / vi `Mặt mộc — chưa trang điểm`
  2. en `Glasses off, hair back` / vi `Bỏ kính, vén tóc khỏi mặt`
  3. en `Stand near a window — daylight` / vi `Đứng gần cửa sổ — ánh sáng tự nhiên`
- Caption: en `Good light is the whole secret. Everything stays on your phone.` /
  vi `Ánh sáng tốt là bí quyết chính xác. Mọi thứ ở lại trên máy của bạn.`
- Primary button: en `I'M READY` / vi `SẴN SÀNG`.

### 4. Step progress on camera screens

On face-scan and wrist-scan, add a small overline label above the title:
`personalColor_stepLabel` = en `STEP {{current}} OF {{total}}` / vi `BƯỚC {{current}}/{{total}}`
→ face = 1/2, wrist = 2/2. (Prepare screen shows no counter.)

### 5. Explicit failure states (kill the silent fails)

1. **Permission denied, onboarding screen** (`personal-color.tsx` `handleCameraStart`
   currently returns silently): on denial with `canAskAgain`, render an inline
   caption under the scan button —
   en `Camera permission needed — allow it in Settings, or answer questions instead.` /
   vi `Cần quyền camera — bật trong Cài đặt, hoặc trả lời câu hỏi thay thế.`
   Keep the existing `canAskAgain === false` manual-only fallback, adding the same
   caption above the START button so the user knows why.
2. **Photo-read fallback screens** (skin/hair questions after a failed face read):
   add a reason line above the question —
   `_photoFallbackReason`: en `We couldn't read that clearly — answer this one quick question instead.` /
   vi `Ảnh chưa đọc được rõ — trả lời nhanh câu này thay thế.`
3. **Save error**: `state.error` is set in the hook but never rendered. Render a
   small caption near the save button on BOTH screens —
   en `Couldn't save — tap to try again.` / vi `Chưa lưu được — bấm lưu lại lần nữa.`

### 6. NEW: AxisMeters component (the de-black-boxing element)

`src/features/personal-color/components/AxisMeters.tsx`. Props: `axes: ToneAxes`,
plus lang-resolved labels via i18n. Three rows, each:
- end labels (small caps, muted): negative end left, positive end right
  - warmth: en COOL ←→ WARM / vi LẠNH ←→ ẤM
  - value: en DEEP ←→ LIGHT / vi SÂU ←→ SÁNG
  - chroma: en SOFT ←→ CLEAR / vi DỊU ←→ TƯƠI
- 1px hairline track full-width between the labels; a small filled dot
  (~7px, warm black / theme ink) at `left = (axis + 1) / 2 * 100%`.
- No animation needed beyond mount; no gradients, no shadows.
- Caption under the three rows: en `These three axes decide your tone.` /
  vi `Ba trục này quyết định tone của bạn.`

Data: `computeAxes` already returns `ToneAxes` in [-1,1] (`tone12.ts:238`). Surface
the axes in the result object the screens' `useMemo` builds (extend the
classification return or call `computeAxes` with the same inputs inside the hook —
whichever touches less; NO math changes). Add/extend a unit test asserting axes
flow through to the result object.

### 7. Result restructure + shared ResultView

Extract the duplicated result UI (`ResultStep` in `personal-color.tsx:568` and its
mirror in `personal-color-edit.tsx:268`) into ONE shared
`src/features/personal-color/components/ResultView.tsx`, parameterised for the
differences (current-season badge, save/continue button labels, discard link).
Both screens must render pixel-equivalent output to their current versions except
for the ordering/labels below.

New order inside ResultView:
1. **Hero**: 12-tone label (existing big treatment) + `LEANING {{tone}}` when
   present + a NEW per-tone one-liner (see §8). Drop the 4-season `SEASON_DESC`
   prose from the hero (it's redundant once the per-tone line exists; keep the
   constant in code untouched if other call-sites use it — check first).
2. **AxisMeters** (§6).
3. **`WEAR THESE`** — the CORE 12 swatches, renamed:
   en `WEAR THESE` / vi `MẶC LÀ HỢP`.
4. **`BETTER TO SKIP`** — the avoid list, moved up right after core.
   vi label: `NÊN TRÁNH`.
5. Collapsible **`FULL PALETTE`** / vi `BẢNG MÀU ĐẦY ĐỦ`:
   - neutrals row with caption en `Base colours — jeans, blazers, coats` /
     vi `Màu nền — jeans, blazer, áo khoác`
   - accents row with caption en `Accents — scarves, bags, small pieces` /
     vi `Điểm nhấn — khăn, túi, phụ kiện`
   - the existing `THIS SEASON'S EDIT` block moves inside here.
6. Collapsible **`BEYOND THE WARDROBE`** / vi `NGOÀI TỦ ĐỒ` — the existing
   `BeyondTheWardrobeSection` unchanged inside.
7. Collapsible **`ADJUST THE RESULT`** / vi `ĐIỀU CHỈNH KẾT QUẢ` — the detected
   chips (skin/hair with AUTO tag) + refine chips (eye/metal). Live recompute
   behaviour must keep working exactly as today.
8. Buttons:
   - Rename drape CTA: en `TRY COLOURS ON YOUR FACE — 30S` /
     vi `ƯỚM MÀU LÊN MẶT BẠN — 30 GIÂY` (replaces `REFINE WITH DRAPING`).
   - `SEE ALL 12 TONES` → vi `XEM CẢ 12 TONE`.
   - Save / continue buttons unchanged.

Collapsible sections: hairline top-border header rows, small `+`/`−` (or hairline
chevron) at the right, `LayoutAnimation` ease-in-ease-out — slow and quiet, no
bounce. Default state: all three collapsed.

### 8. Per-tone one-liners (12 × en + vi)

New i18n keys `tone12Desc_<tone>` for all 12 tones — one plain-language sentence
each, no jargon, format like: en `Light Spring — light, warm and fresh. Soft golden
colours light you up.` / vi `Light Spring — sáng, ấm và trong trẻo. Những màu vàng
nhẹ làm bạn bừng sáng.` Write all 24 strings in the same voice; base the content
on each tone's axis position and its palette in `tone12.ts` boards.

### 9. DrapeSession localisation

The 12-tone grid renders `TONE12_LABELS[tone].en` hard-coded (`DrapeSession.tsx:213`).
Use the active language with en fallback. No other drape changes (round copy is
already good).

### 10. Docs, tests, backlog

- Update `src/design/personal-color/design.md`: new flow diagram (intro → prepare
  → face 1/2 → wrist 2/2 → result), result-screen section order, AxisMeters spec,
  failure-state copy. Same session as code.
- Run `npx tsc --noEmit` and the jest suites under `src/features/personal-color/__tests__`
  — all must pass. Do NOT run expo/eas builds.
- `backlog.md`: mark the colour-season-UX item in progress/done; ADD deferred
  items: (a) highlight the lowest-margin axis dot on AxisMeters (ring) when
  confidence is low, (b) device-test the new flow (v3 device test still pending
  anyway).

## Acceptance checklist

- [ ] Camera happy path: intro → prepare (1 tap) → face 1/2 → wrist 2/2 → result; 5 taps total.
- [ ] Zero untranslated/jargon labels: no "draping", no bare "NEUTRALS/CORE/ACCENTS", tone grid localised.
- [ ] Permission denial and photo-read failure both show a visible explanation.
- [ ] Result hero = tone + one-liner + 3 axis meters; wear/avoid lists above the fold; details collapsed.
- [ ] `personal-color-edit.tsx` and onboarding screen share ResultView (no duplicated result JSX).
- [ ] tsc + jest green; both locales updated; design.md updated.
