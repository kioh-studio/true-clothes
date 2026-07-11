# Onboarding Logic Plan

## Profile: wire Subscription + Notifications rows (2026-07-07)

Two Profile rows ("Subscription", "Notifications") rendered with no `route`, so
`SECTIONS.map` in `app/(tabs)/profile.tsx` skipped their `onPress` navigation
entirely — tapping them did nothing.

- **Subscription** now routes to the existing `/paywall` screen (already used
  by `UploadStep.tsx` and `ScanScreen.tsx` for premium gating) — no new screen
  needed.
- **Notifications** gets a new screen, `app/notifications.tsx`, registered in
  `app/_layout.tsx`. It is local-only: four toggles (daily outfit, weather,
  wardrobe reminders, marketing) persist to a new `notificationPrefs` field in
  `appStore` (`src/stores/appStore.ts`), following the exact persisted-preference
  pattern already used for `genderAwareStyling`/`bodyNeutralMode` (same
  `Persisted` interface field, same `save()`/`hydrate()` wiring, kept across
  sign-out like unit/language). There is **no push-delivery infrastructure**
  (no `expo-notifications`) — this screen only records user intent locally;
  see `backlog.md` for the follow-up.
- New i18n keys (`notifications_*`, en/vi key-synced) added next to the
  `settings_*` block.
- Visual spec: `src/design/notifications/design.md`.

Verify: `npx tsc --noEmit` clean (see command output in this session).

## Full i18n consistency sweep — every screen translatable + language switch (2026-07-06)

The app already had i18next wired up (`src/i18n`, `en.json`/`vi.json`) and a persisted
language switch in Settings (`appStore`, AsyncStorage) — but ~38 screens still had
hardcoded English strings baked directly into JSX, so a Vietnamese-language session
showed a mix of Vietnamese chrome and English copy. Five batches externalized
onboarding, tabs, item/build, edits, and try-on + shared feature components
(~700 new keys, en/vi kept in sync throughout), plus `appStore`'s first-run default
now reads the device locale instead of always defaulting to English. This session
closed out the sweep:

- **`app/outfit/[id].tsx`**: converted the remaining stray hardcoded strings —
  "ITEMS IN THIS OUTFIT (n)", "GENERATE ON YOU" + its hint, "WEAR TODAY"/"✓ WORN
  TODAY", "ADD TO COLLECTION"/"ADDED TO COLLECTION ✓", "SCHEDULE FOR ANOTHER DAY",
  the not-found state, the "Save to collection" sheet copy, the "Owned · Added
  {date}" row, and the `'Item'` fallback name. Also replaced the hand-rolled
  English month-abbreviation formatter (`formatAdded`) with the same
  `date.toLocaleDateString(locale, …)` pattern already used in `item/[id].tsx`,
  `schedule.tsx`, and `history.tsx` — it was rendering "Jan 2024" even in
  Vietnamese. New keys under `outfitDetail_*`, reusing `outfit_howToWear` and
  `collections_itemCountLabel` where the English already matched.
- **Store/service-level error strings (the deeper find this session)**: a full
  sweep turned up hardcoded English (and in one place, hardcoded *Vietnamese*)
  error copy living in Zustand stores and service functions, several levels away
  from any screen — invisible to a per-screen JSX grep but directly rendered via
  `{error}`/`{wardrobeError}`/`{collectionsError}` banners, because every call
  site does `err.message ?? t('some_fallback_key')` and an Error's `.message`
  wins whenever it's set. Fixed in `appStore.ts` (wardrobe/collections mutation
  errors), `authStore.ts` (OTP/sign-in/profile guard messages — `res.message`
  is shown verbatim by every onboarding screen), `tryOnStore.ts` and
  `fitEngineStore.ts` (scan/evaluate/mix-match failures), `tryOnService.ts` and
  `imageGenerationService.ts` and `measurementMapService.ts` (malformed-response
  guards that leak past the caller's localized fallback), `usageCreditService.ts`,
  `useAddWizard.ts` (the AI-extraction wizard had six separate un-translated
  error paths — credits exhausted, no items detected, extraction failed, missing
  type, partial/total save failure), `useProfileEdit.ts` (save/avatar-upload
  errors), and `useWearOnYou.ts` (photo-validation and generation failures were
  hardcoded *Vietnamese* text shown to English users too — now `wearOnYou_*`
  keys with the Vietnamese values preserved verbatim so vi-locale UX doesn't
  shift). All of these import the `i18n` singleton directly (`i18n.t(...)`)
  rather than the `useTranslation()` hook, matching the pattern already
  established in `appStore.ts` for non-component code.
- **`app/_layout.tsx`**: the `settings`/`help` route `title:` options (used for
  the Android task-switcher / web tab title even though the in-app header is
  custom-rendered) were hardcoded — now `t('settings_title')`/`t('help_title')`.
- Net: **44 new keys** this session (15 `outfitDetail_*` + 13 store/service
  error keys + others), bringing the total to **980 keys**, en/vi verified in
  sync. `npx tsc --noEmit` clean; `npx jest` 22/22 suites, 216/216 tests green
  (one test's mock updated for the now-localized error message).

Conventions established across the sweep: screen-prefixed keys
(`outfitDetail_*`, `extraction_*`, …), `common_*` for shared strings,
`_LABEL_KEYS` maps for stable-id → display-label lookups (e.g. `PreferredFit`),
`useLang()` local hook for bilingual option-data, and — new this session — the
`i18n` singleton imported directly in stores/services that need a translated
string outside a component's render (`i18n.t(key)`), since Zustand stores and
plain service functions can't call `useTranslation()`.

**Known remaining gaps (deferred, not fixed this session):**
- **Data-catalog content is not UI chrome.** `src/data/index.ts`'s demo
  style/color/occasion names (`'OLD MONEY'`, `'CASUAL FRIDAY'`, etc.), the
  synthetic `style`/`context` values `build.tsx` fabricates for user-composed
  outfits (`'CUSTOM'`, `'CASUAL'`), and the server-side `FormulaCatalogItem`
  `name`/`description` (which already has an unused `nameVi` field reserved for
  this — nothing reads it yet) are all content, not interface strings — they'd
  need a bilingual data layer/migration, not a client-side key swap. Still
  English-only regardless of app language.
- **`Photo.tsx`** (`src/components/ui/Photo.tsx`) default `label = 'IMAGE'`,
  and the two onboarding callers that override it (`label="DETAIL"`,
  `label="EDITORIAL"`) — this text only renders in the rare fallback tile shown
  when an image fails to load, not the normal path. Left as-is; flagged if it
  ever needs full coverage.
- **Server-prompt-context strings are intentionally English.** `MixMatchFeed`'s
  synthetic `context: 'FROM CLOSET' | 'CONSIDERING'` (and `style: 'MIX & MATCH'`)
  double as both a UI label (`outfit.style · outfit.context` on the outfit
  detail screen) and the `occasion` input fed to the AI outfit-description edge
  function — translating them risks changing the prompt's meaning to the model,
  so left as English on purpose.
- Upstream/server error text (e.g. a raw Supabase Edge Function `error.message`)
  is passed through as-is when caught (`err instanceof Error ? err.message : …`)
  — that's server response content outside the client's i18n control, same
  category as the data-catalog gap above.

## Personal-data privacy copy on estimate/camera screens (2026-07-06)

On-device-only reassurance added to measurement scan intro + permission gate +
personal-color camera intro.

## Measurement accuracy/calibration harness (2026-07-06)

Offline tooling to calibrate `keypointsToMeasurements` against real tape
measurements WITHOUT re-scanning a subject each time. Pure tooling — zero
production behaviour change (see verify below).

**Injectable tunables** (`landmarksToMeasurements.ts`): `K` is now `export`ed
(read-only intent) and `MeasurementTunables = Partial<typeof K>` is a new
exported type. `EstimateInputs` gained an optional `tunables?: MeasurementTunables`
field. Inside `keypointsToMeasurements`, `const KC = { ...K, ...(inputs.tunables
?? {}) }` is built once and every `K.<field>` read in the function body (and
in `tunablesFor`, which now takes `KC` instead of closing over the module `K`
directly, so the sex-specific deltas layer on top of any override too) now
reads `KC.<field>` instead. When `tunables` is omitted — the entire production
call path — `KC` is byte-identical to `K`, so behaviour is unchanged; the
existing 53 landmark tests pass unmodified, proving it. Not everything is
calibratable this way: silhouette BAND placement (`S` in `silhouetteMath.ts`,
which places the shoulder/chest/waist/hip scan rows on the raw segmentation
mask) can't be re-tuned offline, since the harness replays precomputed
`SilhouetteWidths`, not the raw mask. Only the landmark-space constants
consumed after widths are known are calibratable: `contourShoulderInset`,
`torsoFromShoulderHip`, the three depth ratios, `hipWidthCorrection`,
`chestFromShoulder`, the waist blend/scale trio, `inseamProjectionFactor`,
`noseAnkleHeightFraction`.

**Pure eval logic** (`src/features/measurements/accuracyEval.ts`, jest-tested,
no fs/native): `evaluateFixture(fixture, tunables?)` replays one captured scan
(raw keypoints + silhouette widths + the inputs given at scan time) through
`keypointsToMeasurements` and diffs every present `groundTruth` field against
the prediction (`FieldError[]`), plus classifies body shape both ways via
`computeBodyShape` and flags whether they agree (only counted when both sides
have a full bust/waist/hip truth). `aggregate(results)` rolls per-subject
results into per-field `{n, bias, mae, rmse, suggestMultiplier, suggestOffset}`
(the multiplier/offset are the linear correction that would zero the mean
bias for that field alone) plus overall body-shape accuracy.
`suggestCalibration(fixtures, keys, opts?)` is a deterministic coordinate-
descent search: for each requested tunable key, a 1D grid of multiplicative
factors (default ×[0.7..1.3], 13 steps) around its ORIGINAL default from `K`
is tried, keeping whichever minimizes the weighted MAE of the field(s) that
key drives (`TUNABLE_FIELD_MAP`), for 3 passes so keys can react to each
other. `CALIBRATABLE_KEYS` exports the standard list matching the
CALIBRATION-PENDING constants above.

**Runner** (`scripts/measure-eval/run.ts`, Deno — same mechanism as
`scripts/eval-feed/run.ts`, but invoked with `--sloppy-imports` in addition to
`--allow-read` since the target module is RN-style TS with extensionless
imports): reads `fixtures/*.json` (skipping any `subjectId` starting with
`"example"` — how it skips its own `fixtures/example.json` template), prints
the per-field table + body-shape accuracy, and with `--calibrate` also runs
`suggestCalibration` over `CALIBRATABLE_KEYS` and prints the before/after MAE
+ a paste-ready `tunables` block. Zero fixtures → a one-line "no fixtures yet"
message. New npm script: `npm run measure-eval` (`-- --calibrate` to add the
search). `tsconfig.json` excludes `scripts/measure-eval` (Deno globals),
matching the existing `scripts/eval-feed` exclusion.

**Device capture** (`app/measurements-scan.tsx`, `__DEV__`-only, additive):
on a successful `finish()`, the captured keypoints + silhouette widths +
inputs are handed to the new `exportScanFixture()` helper
(`src/features/measurements/scanExport.ts`), which writes a numbered
`measure-eval-<n>.json` to the document directory AND logs the full payload
as a single `[MEASURE_EVAL_JSON]{...}` line (the reliable retrieval path —
Metro console is always reachable even when pulling a file off a physical
device is not). `groundTruth` is left empty for the user to fill in from a
real tape measurement before dropping the file into
`scripts/measure-eval/fixtures/`. Guarded entirely behind `__DEV__`, so
production never writes or logs anything; no new dependency (reuses
`expo-file-system/legacy`, already a transitive import elsewhere in the repo).

See `scripts/measure-eval/fixtures/README.md` for the fixture schema and the
full capture → measure → drop-in workflow.

Verify: `npx tsc --noEmit` clean; `npx jest` 203/203 (21 suites — the 49
existing landmark/silhouette/pose-quality tests in this feature pass
byte-for-byte unchanged, plus 5 new `accuracyEval` tests); `npm run
measure-eval` prints the "no fixtures yet" message cleanly with zero real
fixtures present.

## Personal color — stylist-grade boards 26 màu/tone + avoid lists (2026-07-06)

Nâng cấp 12-tone palette từ 8 màu draft lên **board 26 màu** (8 neutrals + 12
core + 6 accents, `Tone12Board` mới trong `tone12.ts`), curated bởi design
lead. `TONE12_PALETTES` giờ là **derived** — flatten `[...neutrals, ...core,
...accents]` từ `TONE12_BOARDS` tại module init, không còn hardcode riêng —
mọi consumer cũ (`result.palette`, `savePersonalColor` → `personal_palette`,
`seasonalEdit`) tự động nhận board giàu hơn mà không cần đổi call site nào.

`PersonalColorResult` (colorSeasonData.ts) thêm 2 field: `board: Tone12Board`
(để UI group theo NEUTRALS/CORE/ACCENTS) và `avoidColors: string[]` (tên màu
nên tránh, từ `TONE12_AVOID`). `palette` vẫn là mảng phẳng 26 màu như cũ.

**`TONE12_AVOID`** — danh sách tên màu (lowercase, engine vocabulary) nên
tránh cho từng tone, cũng do design lead curate. Client (`tone12.ts`) filter
runtime qua `ENGINE_PRIMARY_COLORS` (bản copy tên của `PrimaryColor` union) —
tên nào máy chấm điểm không có khái niệm (rust/mustard/fuchsia/grey — không
khớp `PrimaryColor` union, kể cả "grey" vì union chỉ có "gray") bị **âm thầm
loại bỏ**. Server (`generate-outfits/engine/scoring.ts`) giữ bản đã lọc sẵn,
typed thẳng `PrimaryColor[]` — sai tên là lỗi compile ngay, không cần filter
runtime. Hai bản **cố ý trùng lặp** giữa 2 runtime (client không import được
file Deno-only, ngược lại) — phải tự tay đồng bộ khi sửa.

Tên bị drop khỏi bản gốc design lead đưa: **rust** (light_summer, true_summer,
soft_summer), **mustard** (light_summer, true_summer, bright_winter,
true_winter, deep_winter), **fuchsia** (soft_summer, soft_autumn, true_autumn,
deep_autumn), **grey** (deep_autumn — union chỉ có "gray"). Sau khi lọc,
`soft_summer` và `deep_autumn` chỉ còn 2 tên (spec draft ban đầu đòi ≥3/tone —
xem `tone12.test.ts`, đã hạ ngưỡng test xuống ≥2 kèm comment giải thích).

**Engine penalty** (`generate-outfits/engine/scoring.ts`, trong
`scoreColorHarmony`): `tone12AvoidPenalty` phạt thêm khi item's `primaryColor`
nằm trong `TONE12_AVOID[tone12]` **NHƯNG KHÔNG** đã nằm trong
`SEASON_FLATTERING[parentSeason].avoid` (dedupe — tránh phạt 2 lần cùng 1
màu). Parent season suy ra từ suffix sau `_` của tone12 (`'deep_autumn'` →
`'autumn'`), độc lập với việc `colorSeason` có được truyền hay không.
`-(dedupedAvoidCount / totalItems) * TONE12_AVOID_MAX` với `TONE12_AVOID_MAX =
0.06` (CALIBRATION-PENDING) — cố tình thấp hơn parent-season penalty (0.10).
Nhiều tone (vd. `light_spring`, `deep_autumn`, `deep_winter`) có
`TONE12_AVOID` là tập con hoàn toàn của parent avoid → penalty này luôn = 0
cho chúng, hành vi đúng theo thiết kế (dedupe).

`evaluate-item/scoring.ts` — `colorExplanation` nối thêm câu note khi item bị
tone12-avoid: `" Note: {primaryColor} is on the skip-list for your {tone12
đổi '_' → ' '} palette."`; import/reuse `TONE12_AVOID` từ engine's scoring.ts
(export mới) để không lặp dữ liệu lần 3.

UI (`app/(onboarding)/personal-color.tsx`, `app/personal-color-edit.tsx`):
"YOUR PALETTE" đổi thành 3 hàng nhóm NEUTRALS/CORE/ACCENTS (swatch 28px,
`paletteSwatchSmall`), giữ nguyên "THIS SEASON'S EDIT" (vẫn đọc
`result.palette` — giờ giàu hơn). Thêm hàng "BETTER TO SKIP" bên dưới — chỉ
text (không swatch), nối tên `avoidColors` (viết hoa chữ đầu) bằng ` · `.

Data 26-màu + avoid list là **draft-curated bởi design lead**, chưa qua design
review trên máy thật (xem backlog.md §B, nối vào entry personal-color
device-verify hiện có).

Verify: `deno test supabase/functions/generate-outfits/` 126/126 (122 cũ + 4
mới); `deno test supabase/functions/evaluate-item/` 21/21; `deno test
supabase/functions/wardrobe-critic/` 9/9; `npx tsc --noEmit` sạch; `npx jest`
193/193 (19 suites). Deploy cả 3 function qua `npx supabase functions deploy
<name>`, không `--no-verify-jwt`.

## Personal color v2 — UI: draping refine, seasonal edit, dual-flash wrist (2026-07-06)

UI layer for the 12-tone upgrade (core logic landed earlier this session, see
below). Both result screens (`app/(onboarding)/personal-color.tsx`,
`app/personal-color-edit.tsx`, kept in lockstep) now show the 12-tone label
(`result.label.en`) above "Your season.", plus a new "THIS SEASON'S EDIT ·
{WEATHER}" row (`seasonalEdit(result.palette, weatherSeasonNow(countryCode))`,
44px swatches). `countryCode` comes from the new
`authStore.locationCountryCode`: `profiles.location_country_code` is now read
back on hydrate (added to the select + `ProfileRow` in both
`profileService.fetchMyProfile` and the store's own hydrate query), mirrored
into local state by `setProfile`/`updateProfile` when a patch carries
`locationCountryCode` (the location screen's save path, with the same
uppercase normalization as the write path), and cleared in every
sign-out/delete reset block. Null (GPS skipped/overridden) falls back to the
northern-hemisphere calendar inside `weatherSeasonNow`. See
`src/design/personal-color/design.md` for the full visual spec.

Added `src/features/personal-color/components/DrapeSession.tsx`: a
full-screen selfie + 3-round colour-drape flow (warmth/value/chroma), calling
the hook's `applyDrape`/`resetDrape`. Selfie never persists — deleted via
`FileSystem.deleteAsync` on done/close/unmount. Wired into both result
screens behind a local `draping` boolean, replacing the step's `ScrollView`
the same way the existing wrist/hair camera steps already do.

Wrist capture is now dual-flash: `WristScanStep` takes a flash-on shot, flips
`enableTorch` off, waits ~350ms, takes a flash-off (ambient) shot, and passes
both to `setCameraPhoto('wrist', flashUri, ambientUri)`. The hook analyses
both and reconciles: agreement → confident regardless of either read's own
margin; disagreement → keeps the flash read but marks it low-confidence
(surfaces the existing double-check hint); flash failure → falls back to the
ambient read. Single-URI calls are unchanged.

Verify: `tsc --noEmit` clean; `jest` 19/19 suites, 188/188 tests green.

## Personal color v2 — 12-tone classifier + seasonal lens (core) (2026-07-06)

Core (logic/data/persistence) for upgrading personal-colour detection from 4
seasons to the standard 12-tone system. No screens touched this session — a
follow-up task wires the UI.

**Axes model** (`src/features/personal-color/tone12.ts`, pure): 3 continuous
axes in [-1, 1] — `warmth` (+ warm/− cool), `value` (+ light/− deep), `chroma`
(+ bright-clear/− soft-muted). `computeAxes` derives them from quiz answers
(undertone, hair/eye/metal keys) plus optional photo metrics (skin/hair LAB,
wrist hue angle — chroma comes from skin↔hair L* contrast, the standard
"clear vs blended" proxy) plus accumulated colour-drape picks. Every weighting
constant is marked CALIBRATION-PENDING — first-cut guesses to tune against
real photos/feedback later, not tuned values. `classifyTone12` picks the
dominant axis (largest |value|, tie-break value > chroma > warmth) and maps
its sign onto one of the 12 tones (light/true/bright spring, light/true/soft
summer, soft/true/deep autumn, bright/true/deep winter); all-zero axes fall
back to soft_summer. When warmth dominates, the "true" pair is split by the
classic secondary pairings (spring = warm·clear·light, autumn = warm·muted·
deep, summer = cool·muted·light, winter = cool·clear·deep): warm side uses
springness = value + chroma (≥0 → true_spring, else true_autumn), cool side
uses winterness = chroma − value (≥0 → true_winter, else true_summer). An
initial chroma-only split was corrected same-day after design review — it let
warm undertone + deep colouring land on Spring instead of the textbook Autumn. `TONE12_PALETTES` gives each tone a draft-curated 8-hex
palette (design-reviewable later); `TONE12_LABELS` gives EN/VI display names.

**Seasonal lens** (also pure, display-level only): `seasonalEdit(palette,
weather)` reorders a tone's palette by season (summer→lightest first,
winter→deepest, spring→most chromatic, autumn→warmest) and returns a 4-swatch
"this season's edit". `weatherSeasonNow(countryCode?, date?)` is a rough
month→season lookup (shifted 6 months for southern-hemisphere country codes)
for display copy only — the wardrobe-critic engine still computes its own
weather season server-side from live weather data.

**Wiring**: `analyzePhoto.ts`'s `analyzeWristUndertone`/`analyzeHairColor` now
also return the raw LAB average (skinLab/hairLab) and wrist hue angle used
for the on-device classification, so the camera path feeds continuous signal
into the axes model, not just the discrete quiz-option key.
`colorSeasonData.ts` adds `scorePersonalColorDetailed(inputs: Tone12Inputs)` —
computes axes → tone12 → season/palette/label, while still computing the
legacy 4-season point scores (unchanged logic) for continuity. `scorePersonalColor`
(legacy signature) is now a thin wrapper over it with no photo metrics/drape.
`usePersonalColorDetection` carries `skinLab`/`hairLab`/`wristHueDeg` state
through both the wrist-scan `.then` fill and the wrist+hair `Promise.all`
merge, adds `drape` state + `applyDrape(axis, direction)` /
`resetDrape()` (via `applyDrapePick`, `DRAPE_STEP = 0.4` per pick), and its
derived `result` now calls `scorePersonalColorDetailed` with the full
`Tone12Inputs`. `save()` now also passes `tone12` to `savePersonalColor`.

**Persistence**: new nullable, check-constrained `profiles.color_tone12`
column (migration `20260706000001_add_color_tone12.sql`, already applied to
the live DB directly; file is for repo history). `profileService.ts`
(`ProfileRow`/`ProfilePatch`/fetch/update) and `authStore.ts`
(`colorTone12` state field, hydrate mapping, `updateProfile` mirror,
`savePersonalColor` persist, and all three logout/deleteAccount/auth-change
reset blocks) mirror the existing `colorSeason`/`personalPalette` wiring.

**Test note**: with the corrected warmth-dominant split, "warm +
dark_brown_warm" resolves to `autumn`/`true_autumn` (warmth 0.75 dominates,
springness = value −0.6 + chroma 0 < 0), matching both the legacy scorer and
colour-theory expectations. Regression tests pin warm·deep → true_autumn and
cool·light·soft → true_summer in `tone12.test.ts`.

tsc clean; jest personal-color suites green (34 tests incl. 2 new
regressions), 188/188 full suite.


## Documentation Policy
- UI/visual/interaction requirement changes must be recorded in the relevant `app/design/**/design.md` file(s).
- Non-UI logic changes must be recorded in this `plan.md`, including:
  - data storage and persistence behavior
  - backend/business logic behavior and flow changes
  - domain/model/repository contract changes
  - validation logic rules that affect application behavior
- Update documentation in the same working session as the implementation change.

## Changelog — 2026-07-03 · Wear-on-you: fix lệch chiều cao/tỉ lệ ảnh gen

Anh Khôi (test trên máy): ảnh gen "lệch chiều cao". Xác nhận plumbing đã đủ từ trước — client gửi gender/age/height/weight/body_shape/preferred_fit + 13 số đo, server nhét hết vào PERSON PROFILE. Hai gốc thật của lệch tỉ lệ và fix:
1. **Copy hướng dẫn ảnh khuyên chụp "thấy phần thân trên"** → ảnh nửa người buộc model tự bịa phần chân theo tỉ lệ người mẫu trung bình. Copy đổi thành khuyên ĐỦ CẢ NGƯỜI từ đầu đến chân (`app/try-on/wear.tsx`).
2. **Prompt (`tryon-generate`)**: (a) profileLines thêm descriptor phái sinh — Overall build từ BMI (slim/lean/average/solid/full) + Leg proportion từ inseam/height (long/balanced/shorter) — vì cm thô là tín hiệu yếu với image model; (b) strict requirement mới: STATURE AND PROPORTIONS phải theo PERSON PROFILE, phần cơ thể KHÔNG thấy trong ảnh nguồn phải extrapolate theo height/inseam đã khai, cấm mặc định tỉ lệ người mẫu. Đã deploy (lưu ý: tree của fn này còn WIP credit-gating của phiên khác — có type error compile-time nhưng chính là code prod v4 đang chạy; deploy bundle qua esbuild không bị chặn).

## Changelog — 2026-07-03 · Wear-on-you phủ nốt các luồng build (đợt 2)

Tiếp yêu cầu anh Khôi: mọi chỗ "build outfit quanh một item" đều phải thử được lên người. Hai việc:
1. **Build-around-owned-item** (item detail → pinWardrobeItem → Mix & Match) vốn đã hưởng nút SEE IT ON YOU từ đợt 1, nhưng món pin bị gửi dạng text dù có ảnh thật trong tủ. Fix: `ScannedItem.sourceItemId` (id thật, set trong pinWardrobeItem); `MixMatchFeed.onWear` phân nhánh — pin từ tủ → id thật vào itemIds (ảnh thật, context FROM CLOSET), scan transient → `extra` text như cũ (context CONSIDERING).
2. **Build an Outfit (canvas thủ công, app/build.tsx)**: thêm SecondaryButton SEE IT ON YOU trên nút SAVE khi đã chọn ≥2 món — mở `/try-on/wear` với selectedIds (toàn id thật, độ trung thực ảnh đầy đủ).
tsc + jest 142/142.

## Changelog — 2026-07-03 · Mix & Match → "See it on you" bridge

Anh Khôi (đang smoke-test trên máy) phát hiện Mix & Match không có đường sang AI try-on ("Wear on you" chỉ nối từ outfit detail). Fixed: mỗi `MatchFeedCard` giờ có action SEE IT ON YOU → mở `/try-on/wear` với itemIds là các món TỦ THẬT của outfit + param `extra` mới mang món scan (type/color/material/fit). Vì món scan chưa có ảnh cloud, `wear.tsx` đưa nó vào danh sách garment dạng mô tả text (unshift lên đầu — nó dẫn look; server `tryon-generate` vốn hỗ trợ garment không ảnh), các món tủ vẫn đi kèm signed URL; ITEMS stat đếm cả nó. `pieceIds` export từ MatchFeedCard để MixMatchFeed tái dùng. tsc + jest 142/142. Giới hạn ghi nhận: độ trung thực hình ảnh của chính món scan phụ thuộc mô tả text — nếu muốn ảnh thật, cần upload cut-out tạm lên storage (SSRF allowlist của tryon-generate chỉ nhận own-storage) — để backlog nếu thấy cần sau khi dùng thử.

## Changelog — 2026-07-03 · "Implement hết": tuning + security fixes, multimodal curator, Wardrobe Critic ships end-to-end

Anh Khôi: "implement hết đi". Final state: deno 123/123 (114 engine + 9 critic), tsc clean, jest 142/142; `generate-outfits`, `backfill-item-metadata`, `wardrobe-critic` all deployed.

**A — Tuning + security (deployed):**
- Pattern-mix ×0.85 no longer STACKS with the flat-look multiplier (one offence, one penalty — streetwear fixture finding); regression test added.
- SSRF fixed in `backfill-item-metadata`: `isAllowedImageUrl` (own Supabase Storage host + optional `BACKFILL_IMAGE_HOSTS` env), absolute `photo_url` outside the allowlist now throws, fetch uses `redirect:'error'`.
- Gemini curation in `generate-outfits` now rate-limited (`consume_rate_limit` bucket `curate_feed`, 30/h; over budget → silent fallback to rule order; RPC failure fails open).
- RLS on `clothing_items` VERIFIED on live DB: all four policies join through `wardrobes.user_id = auth.uid()` (migration files are just drift). Quirk noted: SELECT allows `wardrobe_id IS NULL` rows — currently 0 such rows, harmless.

**B — Multimodal curator (paid, deployed):** the curation call now attaches up to 20 item photos (own-bucket signed URLs only, 1.5MB/img cap, 2.5s/img fetch budget, base64 inline parts each bound to its item label). `curator.ts` accepts `images`, extends the timeout to 20s when present, and instructs the judge to weigh colour/texture/drape from the ACTUAL garments. Kill switch: `CURATOR_MULTIMODAL=off`. Any failure degrades to text-only, then to rule order — the feed never breaks. **Perf-tuned same day**: first prod runs hit 11–15s on the paid feed (20 × ≤1.5MB payload); caps reduced to 12 × ≤800KB + image-fetch duration/size logging added, redeployed.

**C — Wardrobe Critic (010) shipped end-to-end** via the full spec-kit chain (plan → tasks → implement; artifacts in `specs/010-wardrobe-critic/`): new edge fn `wardrobe-critic` (archetypes.ts — 16-archetype catalog with MIEN-voice vi/en note templates; analyze.ts — pure, deterministic feed-pipeline simulation: baseline → per-archetype hypothetical injection → unlock = qualified outfits CONTAINING the piece → top-3 ≥ threshold, redundancy clustering, sparse/starter + complete modes; index.ts — JWT + rate limit 10/h + contract response + optional `candidate_item` re-scoring). 9 contract-invariant tests. **E2E proven on prod demo wardrobe**: mode=gaps, baseline 24 looks, white_shirt unlocks 8 / dark_loafers 5 / black_boots 4 (SC-001 pass); SC-002 live-verified by inserting a real white shirt → archetype correctly left the report as owned, recs re-ranked (test row cleaned up). Spec SC-002/US1-AC2 wording amended to match research.md D2 (unlock = qualified looks USING the piece; total-count delta is structurally capped by the ranker's TOP_N). Client (service/store/GapCard/wardrobe-report screen/menu entry/feed footer/Try-On bridge line) documented in the client changelog entry below. Open: T032 optional candidate re-scoring + on-device smoke test (backlog).

## Changelog — 2026-07-03 · Visual enrichment đợt 2 + S5 Wardrobe Critic spec

Anh Khôi greenlit two of the three remaining big backlog items (multimodal curator stays deferred).

**Visual enrichment đợt 2** (suite 113/113; generate-outfits + backfill-item-metadata deployed): three image-only attributes now flow ingest → engine. Migration added `print_scale` ('micro'|'medium'|'large'), `drape` ('structured'|'regular'|'fluid'), `visual_interest` (0..1) to `clothing_items` (all NULL-able, CHECK-constrained). Extraction contract (`generate-item-image/prompt.ts`): field specs + snap helpers (`snapPrintScale`/`snapDrape`/`snapVisualInterest`); `backfill-item-metadata` fills NULLs for all three (its select/filter updated; it imports the shared prompt.ts so the new contract is live via its own deploy). Engine consumption — each field has a consuming rule per the "no dead columns" discipline: print_scale reshapes statementStrength (micro −0.5 / large +0.5), visual_interest nudges statementStrength (±0.3 centered on 0.5) AND heroScore (±0.4), drape=structured on ≥2 pieces earns the house-POV precision credit. Absent fields → byte-identical behaviour (verified by test + harness). ACTION còn lại: re-run backfill on prod (needs BACKFILL_ADMIN_SECRET).

**S5 Wardrobe Critic — spec created** via /speckit-specify: branch `010-wardrobe-critic`, `specs/010-wardrobe-critic/spec.md` + requirements checklist (all pass). 3 user stories (gap report P1 / Try-On bridge P2 / redundancy P3), 11 FRs, 5 SCs; unlock-count must be truthful against the daily feed's own quality bar (SC-002). Anh Khôi resolved the two open points: surface = Menu "Wardrobe Report" + end-of-feed card; gating = free sees recommendation #1, paid unlocks all 3 + redundancy. Next: /speckit-plan in its own session.

## Changelog — 2026-07-03 · Backlog sweep: 8 open items implemented in one batch

Anh Khôi: "cái nào trong backlog đã implement thì remove, và implement những item còn nằm trong backlog". Engine suite 109/109; `generate-outfits` + `backfill-item-metadata` redeployed. NOTE: `generate-item-image` was NOT deployed — its working tree carries another session's in-progress credit-gating work with type errors; the `can_layer` prompt change ships whenever that work deploys.

1. **Outerwear as pool anchor** (S2 follow-up): `generateFromPool` anchors now include `pool.outwear`; a statement coat is FIXED into the outwear slot and the whole core (top → bottom → shoes) is composed under it via pairAffinity. Core dedup key now includes the outwear id. Harness: navy blazer now leads 4 of the top-10 looks.
2. **canLayer tầng 2 — AI extraction path**: `clothing_items.can_layer boolean NULL` migration applied; `can_layer` added to the Gemini extraction contract (`generate-item-image/prompt.ts` — GarmentMetadata, snapGarment, EXTRACTION_SYSTEM field spec: true only when clearly wearable open/over, null when unsure), to `backfill-item-metadata` (row/select/patch/filter — re-runnable to backfill), and threaded through `generate-outfits` (select, ClothingItemRow.canLayer, pin passthrough). `enrichment.toFitItem`: stored can_layer wins over the rule derivation (`item.canLayer ?? deriveCanLayer(...)`).
3. **Styling tips — Way to Wear Phase B** (`engine/styling-tips.ts`, new): deterministic rule-derived tips (max 2, en+vi inline) from the outfit's actual items — layer-open (leads when a dual-role top occupies the outwear slot), tuck, half-tuck, sleeve-roll, jeans-cuff, monochrome texture voice, one-statement, belt-shoe tone. Attached per final outfit in `index.ts` as `ScoredOutfit.stylingTips`.
4. **Real warmth band replaces the hardcoded '22°C'**: `ScoredOutfit.weatherBand` ('<15°C' | '15–22°C' | '22–28°C' | '28°C+') derived from the outfit's fabric seasons + outer layer presence, computed in `index.ts`.
5. **Favourite item as hero** (L2 follow-up c): `generateHeroCandidates` takes `favouriteIds` (items appearing in the user's saved/worn outfits, +0.4 heroScore) — a proven piece beats an equally loud stranger.
6. **Demo saved/worn seeded** (L2 follow-up a): 3 interactions inserted for demo@mien.app (2 saved + 1 worn, quiet-neutral looks) so the taste vector is demonstrable on the demo account.
7. **Streetwear harness fixture**: `scripts/eval-feed/fixture.ts` refactored to `PROFILES = { smartcasual, streetwear }` (backward-compatible aliases kept), `run.ts --profile <name>`. Streetwear run: 25/25 items pass the style filter, 24-outfit feed, HOODIE path exercised (ranks 2 & 7). Finding: 2-bold-pattern candidates ARE generated (79/500) and pass hard constraints, but the ×0.85 pattern-mix multiplier STACKS with the ×0.85 flat-look multiplier on all-dark looks (0.7225 combined) → best 2-pattern combo scores 0.865 vs top-24 cutoff ~0.872. Working as designed ("single-pattern slightly ahead") but the stacking is a live tuning question (backlog).
8. **Client — canLayer toggle, tip line, weather band** (tsc clean, jest 130/130): AUTO/YES/NO "WEAR AS A LAYER" FieldRow in the shared `ItemCard` (add + edit), gated to top types, wired through `useAddWizard`/`item-edit`/`wardrobeService` (`can_layer` on add + update, AUTO persists as NULL); feed hook resolves `weatherBand ?? '22°C'` into `Outfit.weather` + first tag and locale-picks `stylingTips[0]` (vi/en) onto `Outfit.stylingTip`; `Collage.tsx` renders the tip as a third hairline line (11px, lowercase, ellipsized) with conditional +16px title block height. Documented in `src/design/feed/design.md`.

## Changelog — 2026-07-03 · Layering package: layerRole by type, canLayer, dual-role top→outwear

Anh Khôi's constraint: layering is ONE option among many — non-layered outfits must generate exactly as before. Landed as optional variants only. Engine suite 103/103, `generate-outfits` redeployed.

**layerRole derived by TYPE** (`enrichment.ts` `LAYER_ROLE_BY_TYPE`): the old category-level map collapsed layering to a binary (every top 'base', outerwear 'outer') so **'mid' was dead vocabulary** — a sweater carried the same label as a tee. Now: base = TEE/CAMISOLE/HENLEY/BLOUSE/POLO/BODYSUIT/CROP/TUNIC/CORSET/SHIRT; mid = SWEATER/KNIT/CARDIGAN/VEST/HOODIE/KIMONO; outer = JACKET/BLAZER/COAT/PARKA/OVERCOAT/CAPE. `poolLayeringStack` widened to base|mid tops (tee+coat and sweater+coat are both canonical stacks; under the old derivation the base filter was a no-op anyway).

**`canLayer` rule-derived at enrichment** (tầng 1 of the 3-tier design in backlog — no migration, retroactive for the whole wardrobe): CARDIGAN/VEST always; SHIRT/HENLEY when overshirt-read (flannel/denim/corduroy/wool/tweed, heavy, or relaxed/oversized fit); SWEATER/KNIT unless slim; everything else false. Optional field on FitItem (undefined = false) so hand-built fixtures stay valid. AI-extracted `can_layer` + user toggle remain backlog tầng 2–3.

**Dual-role variant in composition** (`generation.ts`): `variantsFor` may emit ONE extra variant putting a canLayer top from the pool into the outwear slot OVER the core's top — only when the base is a true 'base' layer and the physics hold (layer ≥ fabricWeight, ≥ fit volume, not itself). Bare cores are always emitted first; hero/pinned/fallback paths untouched. Harness proof: cashmere sweater over oxford shirt appeared at rank 5 — a canonical look that was structurally impossible before (sweater is category 'top', could never reach the outwear slot).

## Changelog — 2026-07-03 · Stylist-parity round (S1–S4): the engine composes instead of enumerating

Diagnosis (anh Khôi: "engine chưa match cách stylist hoạt động"): the engine was a bottom-up VALIDATOR (enumerate → score with one formula-blind averaged rubric → cut) while a stylist is a top-down COMPOSER (brief → concept → anchor → conditional picks). All four levers greenlit and landed. Deno suite 94/94, jest 130/130, tsc clean, `generate-outfits` redeployed.

**S1 — Formula-aware scoring contracts** (`scoring.ts`, `ranking.ts`): each look is now judged against the concept that generated it. `scoreColorHarmony`/`scoreTextureHarmony` take the candidate's formula: monochrome may trade lightness contrast for texture variety (0.85 instead of the flat 0.5 penalty); texture_stack's full light→heavy stack scores as deliberate depth, not inconsistency. The flat-look veto now applies the all-black rule formula-independently: all-dark-muted with ≥2 distinct textures gets ×0.85 instead of ×0.6 (a tactile all-black minimalist look — MIEN's own register — was being punished twice).

**S2 — Anchor-first composition** (`generation.ts`): `generateFromPool` no longer enumerates cores round-robin. New `pairAffinity(a, b, formula)` scores how two SPECIFIC pieces sit together (hue distance, lightness interplay, register proximity — inverted for high_low, volume proportion, undertone); composition picks the loudest pool pieces as anchors (ANCHOR_CAP 8), then the best-matching counterpart FOR each anchor (BRANCH 2), then the best shoes FOR each pair. Anchor-major interleave keeps the feed front diverse. Fully deterministic (affinity sort, id tie-breaks; rand only feeds optional-slot variants). Harness A/B vs the round-2 engine: distinct top+bottom pairs in top-10 went 6 → 7, two previously never-surfaced items (navy oxford, navy blazer) entered the feed, scores 0.856–0.958.

**S3 — Story briefs** (`index.ts`, `engine/types.ts`, client `useFitFeed.ts` + `src/types/fitEngine.ts`, new `src/design/feed/design.md`): the final feed is grouped into stories by outfit register — REFINED (avg formality ≥3.2) / EVERYDAY / OFF DUTY (≤2.4) — with the leading story rotating daily and rank order PRESERVED inside each story (stable sort; the story is the narrative, the order is the stylist's ranking). `ScoredOutfit.story` rides the response; the card kicker reads "story · style" and the story replaces DAILY in context/tags. Older responses without story fall back cleanly.

**S4 — House POV** (`scoring.ts` `housePOVDelta`, `curator.ts` prompt): MIEN's aesthetic became a named, capped (±0.05) tie-breaker — rewards palette restraint, all-natural fabrics (only when fabric is actually known — no reward for defaulted metadata), controlled silhouettes; penalizes loud graphics and multi-vivid. Halves itself when the user's selected styles oppose the house voice (streetwear/y2k). Curator SYSTEM_PROMPT now opens with the MIEN house-stylist identity with an explicit "user's taste wins" guard.

**Incidental fix:** `tryOnStore.decide.test.ts` was missing the i18n stub its sibling has — pre-existing uncommitted describe-outfit work pulls `i18n → expo-localization` (ESM) into the store chain and broke the suite; stubbed identically to `tryOnStore.test.ts`. Also excluded `scripts/eval-feed` (Deno) from the RN tsconfig.

## Changelog — 2026-07-02 · Engine quality round 2: eval harness, contradiction fixes, affinity tables, exposure-lift taste

Four levers landed in one session (anh Khôi greenlit all four after the engine audit). Engine suite 80/80 green, `generate-outfits` redeployed via CLI (verify_jwt preserved).

**#0 Eval harness (`scripts/eval-feed/`)** — offline, deterministic measurement of feed quality so tuning stops being vibes. `fixture.ts` (30-item fixed wardrobe + smartcasual/minimalist profile), `run.ts --engine <dir> --out <json>` (replicates the index.ts rule pipeline, fixed seed, NO shuffle/LLM → snapshot of top-10), `judge.ts A.json B.json` (blind 3-trial A/B via Gemini when GOOGLE_API_KEY is set; otherwise emits the blind prompt for manual judging). Verified byte-identical across runs. Baseline-vs-candidate A/B for this round: candidate feed won ~8/10 vs ~7/10 (better variety — 6 distinct cores vs 5 — and a high_low look correctly promoted to rank 1). Known gap: the fixture profile can't exercise pattern-mixing/hoodie paths — needs a second streetwear fixture (backlog).

**#1 Engine contradiction fixes** (`ranking.ts`, `scoring.ts`):
- `passesHardConstraints` now takes the candidate's formula; `high_low` candidates get formality-gap headroom 3.5 (others stay 2.5) — the old global cap rejected exactly the contrast that formula generates.
- `scoreFormalityConsistency(items, formula)`: for `high_low`, a deliberate 1.5–3.0 gap scores 1.0 (was 0.55/0.3) — register contrast is the point, not a flaw.
- Pattern-on-pattern: hard ban (max 1 bold pattern) relaxes to 2 for pattern-friendly styles (`streetwear`, `y2k`, `bohemian`), with a mild ×0.85 taste multiplier instead. Other styles unchanged.
- Softened three conservative vetoes: HOODIE+TROUSERS and PARKA+TROUSERS 0.7/0.75→0.85 (athflow / city-winter are real looks), LOAFERS+SHORTS 0.7→0.9 (preppy summer classic).

**#2 Affinity tables extracted + expanded** (`engine/taste-data.ts`, new): CLASSIC_TRIPLES 27→~150, CLASHING_PAIRS 7→21. Discovered and fixed a latent bug: `HOODIE+JEANS+SNEAKERS` was DEAD DATA since birth — HOODIE is category `outwear`, but the triple lookup only read the `top` slot. `scoreTasteAdjustment` now also looks up an outerwear-led triple (hoodie/blazer/jacket/coat/parka + bottom + shoes) and takes the stronger of the two. Structural tests validate every key against the slot vocabularies and cross-check that no classic triple contains a strong clashing pair.

**#3 Taste vector → exposure lift** (`taste.ts`, `types.ts`, `index.ts`): anh Khôi chose implicit lift (option A) over an explicit dismiss button. The client already logs one `impression` row per outfit shown (Q18); the engine now loads the 300 most recent impressions and builds an exposure baseline (`TasteVector.exposure`). With ≥10 impressions, the taste bonus becomes `clamp01((affinity(saves) − affinity(shown feed)) / 0.25)` — saves indistinguishable from the feed carry no signal (kills the self-reinforcing "feed likes itself" loop); saves that deviate from the feed reveal the real preference direction. Below 10 impressions it falls back to the original positive-only behaviour, byte-for-byte. Still purely positive, still capped at +0.06, still confidence-scaled on saves.

## Changelog — 2026-06-29 · Home feed weather FILTER removed (scoring kept)

**What:** Removed the HOT/WARM/COOL/COLD weather filter pill bar and the live-band
default gating from the home feed (`app/(tabs)/index.tsx`). The filter matched each
outfit's `weather` string, but generated outfits all carry a hardcoded `'22°C'`
(`useFitFeed.scoredToOutfit`), so the live-weather default band emptied the feed on
hot/cold days ("No outfits for this weather") for no real benefit.

**Kept (NOT disabled):** live weather is still fetched (`weatherContext`) and still
drives the engine's seasonal scoring via `fitEngineStore.weatherIntent()`
(`temperatureBand` → `seasonOverride` → seasonMatch fabric + seasonal-colour bias).
The °C label in the feed header stays. **Personal colour (`colorSeason`) is unrelated
to weather** (from skin/hair photo analysis) and untouched.

**Scope:** UI-only removal in the feed screen; no engine/scoring change. Empty-state
copy updated to be weather-agnostic. See backlog for the underlying tech debt
(hardcoded per-outfit `'22°C'`; no real per-outfit weather/warmth).

## Changelog — 2026-06-29 · Way to Wear (Phase A) — styling tips on outfit detail

**What:** The `describe-outfit` edge function now returns `wayToWear: string[]` in
addition to `description: string`, produced in a single Gemini call via **structured
JSON output** (`responseSchema`, mirroring `generate-outfits/engine/curator.ts`).
`wayToWear` is 3–5 short imperative styling tips (full/French/untucked tuck, roll
sleeves, cuff hem, layering order, leave outerwear open, pop collar, belt) constrained
in the prompt to only techniques valid for the garments actually present (no tucking
cropped/oversized tops, no rolling short sleeves, layering only when there is real
outerwear, belt only when an accessory belt is present). Tips are localized (vi/en) and
weather-aware via a new optional `weather` request field.

**Where:** Generated lazily on the outfit detail screen (`app/outfit/[id].tsx`) for
GENERATED outfits only (`gen_…` ids) — same gate/cache as the description. Mock outfits
get no tips. Shown under a "HOW TO WEAR" / "CÁCH MẶC" heading (`outfit_howToWear`).

**Backward-compatible:** the old function simply omits `wayToWear`; the service/hook
default it to `[]`, and the detail section renders only when non-empty. Edge function
still NEVER 500s on AI failure — returns `{ description: '', wayToWear: [] }` (status
200) on no key / !res.ok / parse error / timeout. `maxOutputTokens` bumped to 768.

## Changelog — 2026-06-27 · AI body-measurement scan (on-device pose estimation)

**What:** Wires the previously-dead "Re-estimate with AI photo capture" link in
`measurements-edit.tsx` and `onboarding/measurements.tsx`. User takes ONE front-facing
full-body photo; on-device MoveNet runs inference; keypoints are converted to estimated
circumferences (bust, waist, hip, inseam); the form is pre-filled for user review.

**Model:** MoveNet SinglePose Lightning INT8 TFLite from TFHub
(`https://tfhub.dev/google/lite-model/movenet/singlepose/lightning/tflite/int8/4`),
bundled at `assets/models/movenet-lightning.tflite` (~2.9 MB). Loaded via
`react-native-fast-tflite` v1.6.1 (JSI, no bridge). Requires a dev build — Expo Go
does NOT support this native module.

**Privacy / no-upload guarantee:**
- The captured photo URI is deleted via `FileSystem.deleteAsync(uri, {idempotent:true})`
  immediately after inference, whether inference succeeded or failed.
- No network request is made. No photo is persisted beyond the temp FS lifecycle.
- The model runs fully on-device (JSI synchronous inference).

**Estimation math (`src/features/measurements/landmarksToMeasurements.ts`):**
1. Scale reference: nose→ankle span (normalised units) covers ~88% of standing height
   (`K.noseAnkleHeightFraction = 0.88`). Since the model input is square (192×192),
   x and y share the same scale → `cmPerUnit = heightCm / personUnitH`.
2. Visible widths in cm: `shoulderWidth = dist(lShoulder, rShoulder) × cmPerUnit`,
   `hipWidth = dist(lHip, rHip) × cmPerUnit`.
3. Chest width ≈ `shoulderWidth × 0.92` (K.chestFromShoulder).
4. Waist width ≈ `(0.40×shoulder + 0.60×hip) × 0.72` (K.waistBlend*, K.waistScale).
5. Circumferences: Ramanujan ellipse perimeter with region-specific depth ratios
   (chest 0.72, waist 0.78, hip 0.70 of visible width — K.chestDepthRatio etc.).
6. Inseam: `|avgHipY − avgAnkleY| × cmPerUnit × 0.95` (K.inseamProjectionFactor).
7. Sane-range clamping: bust [60,160], waist [50,150], hip [60,170], inseam [60,100].
   Fields outside range are omitted (undefined) — form leaves them blank.
8. Minimum keypoint score threshold: 0.3 (K.minScore).

**Accuracy caveat:** ±5–10 cm. Single front photo; cannot see depth; anthropometric
constants are population averages (ANSUR II). Never auto-saved — always user-review.

**pendingEstimate store field (ephemeral):**
- `fitEngineStore.pendingEstimate: EstimatedMeasurements | null`
- Set by `measurements-scan.tsx` before `router.back()` on success.
- Consumed and cleared by `measurements-edit.tsx` and `onboarding/measurements.tsx`
  via `useEffect(() => { if (pendingEstimate) { … setPendingEstimate(null); } }, [pendingEstimate])`.
- Wiped on sign-out via `reset()`. NOT persisted (no AsyncStorage).

**Native dependency notes:**
- `react-native-fast-tflite@1.6.1` — peer deps: react, react-native only (no nitro-modules).
- Expo config plugin: `"react-native-fast-tflite"` added to `app.json` plugins.
- Metro: `metro.config.js` created at project root; adds `tflite` to `assetExts`.
- **Must run `npx expo prebuild` and a dev build** (EAS or local). Expo Go will crash
  because it cannot load the native TFLite JSI binding.

---

## Changelog — 2026-06-27 · Wardrobe-fit signal on the Try-On Result screen

**What:** A client-side "wardrobe fit" signal appears on the Scan Result screen, answering
whether the scanned item pairs well with the user's existing wardrobe. It is NOT folded into
the server's /100 verdict score — it is a purely additive client signal.

**Logic (`src/features/try-on/wardrobeFit.ts`):** Call the existing `fetchMixMatchOutfits`
(pinned item → `generate-outfits`, `curate:false`, no AI credit consumed). Count outfits
with `totalScore >= 0.70` ("high matches"). Thresholds: `HIGH_MATCH_SCORE = 0.70`,
`TARGET_HIGH_MATCHES = 3`. Band: `great` (≥3 high), `ok` (≥1 high), `weak` (total>0 but
none high), `none` (empty). `barPct = min(1, highCount/3) × 100`.

**Store (`tryOnStore.prefetchMixMatch`):** New action fires on Result screen mount,
populates `mixMatchOutfits` in the background WITHOUT changing `status` (so the screen
stays in `result`). Best-effort: failures are swallowed and leave outfits empty (band falls
to `weak`/`none`; no error surfaced). Makes the Mix & Match feed instant when the user taps.

**UI surface:** (a) `WardrobeFitRow` in `VerdictPanel` under a "STYLES WITH YOUR CLOSET"
sub-label + divider (only rendered when the prefetch has fired); (b) the "Mix & match with
closet" CTA subtitle updates to show `"X strong matches · Y outfits from your closet"` once
results are in, or `"Finding outfits from your closet…"` while loading.

## Changelog — 2026-06-26 · Verdict AI fit note (under the measurement bars)

**What:** The Try-On Verdict now shows a short, AI-written note under the 5 score bars
(`VerdictPanel`) — a plain-language conclusion + "Fits / Watch out" points — so the user
has a buy/skip rationale, not just numbers.

**Where:** Generated INSIDE `evaluate-item` (merged into the existing call, per product
decision — bars + note arrive together). After `computeVerdict`, the fn re-runs
`scoreItemFit` for per-measurement ease, builds a compact GROUNDED context
(`evaluate-item/note.ts` → `buildNoteContext`), and calls **Gemini `gemini-2.5-flash-lite`**
(`generateFitNote`, mirrors `describe-outfit`: `thinkingBudget:0`, 8s timeout). Localised
EN/VI (client now passes `locale` from `i18n.language`). Response gains `fit_note`.

**Grounding/safety:** the model is told to use ONLY the provided scored data and NEVER
invent numbers; when `fit_measured` is false it must say fit can't be assessed and to add
body measurements + the garment size chart (it does not guess). This is why the note is
honest about anh Khôi's empty-profile case rather than fabricating a fit verdict.

**No cache (Plan A):** the scan flow calls `evaluate-item` once per item and `tryOnStore`
is transient, so a content-hash cache would almost never hit — not worth a table. Cost is
bounded by flash-lite + a `consume_rate_limit` bucket (`verdict_note`, 30/min/user) instead.
Best-effort: missing `GOOGLE_API_KEY` / rate-limit / LLM error → `fit_note:null`, scores
still render. Client: `Verdict.fitNote`, `tryOnService` maps `fit_note`.

## Changelog — 2026-06-26 · Fix: magenta chroma residue in enclosed interior gaps

**Bug:** AI-generated item images (`generate-item-image`, feature 008) still showed
magenta (`#FF00FF` chroma) plates in the MIDDLE of garments — gaps the garment fully
encloses (bag-handle loops, the space between an arm and the torso, a buckle hole).

**Root cause:** `chromaKeyBitmap` removed the background with a single flood-fill seeded
from the image borders. The flood stops at the first garment pixel, so any background
pool the garment encloses is never reached → it stays opaque and keeps its chroma colour.
The compose step then forced every non-border-connected pixel to `alpha=255` ("interior
garment"), regardless of colour.

**Fix:** after the border flood, a second pass re-seeds the flood from any pixel that
STRICTLY matches the bg colour (`dist ≤ TOL_CORE=60`) but wasn't reached, then grows it
with the same loose `TOL=110`. `pickChromaBg` guarantees the garment colour always
contrasts with the chroma colour, so a strict-core match is always real background — the
pass can't punch holes in the garment. The existing edge-BAND step then feathers + despills
the rim of each interior hole exactly like the outer cut. Sanity check (`frac` 0.05–0.97)
unaffected. Server-side fix → covers both iOS and Android; the on-device native cutout
(`expo-item-extract`) produces alpha PNGs and was never the source of the magenta.

## Changelog — 2026-06-26 · Fix: style/colour preferences not re-hydrated after login

**Bug:** Opening Style Preferences or Colour Palette showed no existing selections.
Root cause was load-side, not save-side: `fitEngineStore.hydrate()` runs once at app
start (`app/_layout.tsx`) and registered **no `onAuthStateChange` listener** — unlike
`authStore` and `appStore`, which both re-hydrate when auth becomes available. So on the
cold-start race (hydrate fires before the persisted session is restored) and on the first
OTP login (hydrate already ran with no session), `styleProfile` / `colorPreferences` stayed
empty for the whole session. The edit screens read those store fields, so they showed
nothing selected even when `style_profiles` had data on the server. Sign-out already wiped
fitEngine state (via authStore's listener); only the sign-in re-hydrate was missing.

**Fix:** `fitEngineStore.hydrate()` now self-registers a deduped `onAuthStateChange`
listener (mirrors `appStore`): on a new authed uid it re-runs `hydrate()`; on sign-out it
`reset()`s. Save path was already correct (verified: `clothing_items` writes land for all
users; the `style_profiles` upsert succeeds under RLS) — the empty `style_profiles` /
`body_measurements` tables are explained by the demo account skipping onboarding and the
data simply never being re-loaded after restart, both now resolved.

Note (not changed): `styles-edit.tsx` / `colors-edit.tsx` snapshot the store via
`useState(() => …)` at mount, so they assume the store is hydrated before navigation — true
in the normal flow once the listener above lands the data before the user reaches Settings.

## Changelog — 2026-06-21 · Smarter on-device cutout fallback (background-model segmentation)

**Why.** The on-device extractor's tier-2 fallback (corner chroma-key) only worked
on a perfectly uniform background. Real onboarding photos (flat-lay on a wood/linen
floor or bed) defeated it: ML SubjectSegmenter (tier 1) fails on flat-lays (no
salient "subject"), and the corner-key left all the wood grain/seam pixels →
"couldn't isolate cleanly". Goal is to keep extraction **on-device/free** (the
AI path costs per use) so users build a wardrobe fast during onboarding.

**Decision.** Pure-native algorithm (no OpenCV / no new deps — keeps the app light,
which matters for the install/onboarding funnel). GrabCut was rejected: it adds
~30–40 MB (iOS framework) and, being colour-model based, would NOT solve the one
case pure-native also can't (item colour ≈ background colour).

**Algorithm (validated in Python on real photos before porting; replaces tier-2 in
both `ExpoItemExtractModule.kt` and `.swift`):**
1. Work at ~512 px. sRGB→LAB.
2. Sample a 6%-wide border frame; k-means (k=6) → background colour model.
3. **Keep only clusters with ≥10% border share** — drops foreground that intrudes
   into the border (e.g. a dress touching the edge). *Critical*: without this, an
   edge-touching item poisons the bg model and the whole item gets erased.
4. Per-pixel bg-candidate if min LAB distance to a kept cluster < 14.
5. Flood from the borders (4-conn components) → keep only border-connected bg;
   foreground = the rest. Handles multi-tone backgrounds (grain, seams) that a
   single-colour key can't.
6. Fill holes → 3×3 opening → drop fg components < 1% area.
7. **Degenerate guard:** fg < 3% or > 97% → return null → tier 3 (original +
   `usedFallback`). This is what stops a low-contrast white-on-white photo from
   being output as a blank/erased image; the UI then shows the "plainer background"
   hint.
8. Feather (small box-blur ≈ gaussian) + soft threshold; upscale mask to full res.

**Validated results (Python reference, exact params): black dress on wood floor
ΔE≈75 → clean cut-out (44% fg); navy dress on grey studio ΔE≈56 → clean cut-out
(17% fg); white dress on grey ΔE≈1.8 → 0% → guard rejects (correct — no colour
signal; that clean studio shot is ML tier-1's job, and no colour method incl.
GrabCut could separate it). Rule of thumb: works whenever item vs background ΔE
≳ 12–15.**

**Emulator/perf hardening (2026-06-21, after on-device testing).** Testing surfaced
that **ML Kit Subject Segmentation's model is downloaded on demand via Play
Services** and cannot be provisioned on the test emulator (logcat: `dl-Mlkit
SubjectSegmentation…has no usable artifacts` looping). The segmenter then stalled
the full 10 s timeout per item, and GMS's endless retry churn overloaded the
emulator → System-UI ANR. Fixes (all in `ExpoItemExtractModule.kt`):
- **Skip ML tier-1 on emulators** (`Build.FINGERPRINT/HARDWARE/MODEL` detection) →
  app goes straight to the on-device fallback and never triggers the GMS download.
- **3 s fail-fast + per-process skip flag**: on a real device, if the model isn't
  ready (first-run download / offline) the first call caps at 3 s and every later
  extraction skips ML for the rest of the session (no repeated stalls when adding
  several items). Labels/OCR awaits 10 s → 5 s.
- **Bulk pixel I/O** in the ML mask application (`getPixels`/`setPixels` instead of
  per-pixel `getPixel`/`setPixel`, which is pathologically slow on multi-MP images).
- Operationally cleared GMS (`pm clear com.google.android.gms`) to stop the
  already-pending download churn on the test emulator.
Root cause was the environment (emulator can't provision the unbundled ML model),
not the fallback or app logic; real devices download the model once and work.

**Tiers now:** ML SubjectSegmenter (skipped on emulator) → background-model fallback → original+nudge.
Android dev client rebuilt & installed (`BUILD SUCCESSFUL`). iOS port mirrors the
Kotlin (only buildable/verifiable on an iOS build). On-device confirmation of the
Kotlin port against the validated result is the remaining check.

## Changelog — 2026-06-21 · Enable extract-by-item on emulator (first native dev build)

**Why.** "Extract by item" was disabled on the emulator. Root cause: the emulator
ran **Expo Go** (`host.exp.exponent`), which cannot include custom local native
modules, so `requireOptionalNativeModule('ExpoItemExtract')` → null →
`isAvailable=false` (expected, documented). Fix = build a **dev client** that
compiles `modules/expo-item-extract`. This was its **first ever Android build**, so
several latent module bugs surfaced (all build-time, none caught before because the
module had only ever been referenced, never compiled):

1. **`app.json` had no `android.package`** → `expo prebuild` can't generate the
   Android project. Added `"package": "com.briank.mien"` (mirrors the iOS
   `bundleIdentifier`). Prebuild now generates `android/` (CNG; treat as ephemeral).
2. **`modules/expo-item-extract/android/build.gradle`** referenced
   `$kotlin_version` (undefined ext property) on an explicit `kotlin-stdlib-jdk8`
   dep → project evaluation failed. Removed the line; the `kotlin-android` plugin
   adds stdlib automatically.
3. **Wrong ML Kit Subject Segmentation Gradle coordinate.** `com.google.mlkit:
   subject-segmentation:1.0.0-beta1` does not exist on Google Maven. Subject
   Segmentation ships **only via Play Services**: changed to
   `com.google.android.gms:play-services-mlkit-subject-segmentation:16.0.0-beta1`
   (verified the version against Google Maven metadata). The Kotlin imports
   (`com.google.mlkit.vision.segmentation.subject.*`) are unchanged.
4. **Wrong Subject Segmentation API call** in `ExpoItemExtractModule.kt`: the
   factory is `SubjectSegmentation.getClient(options)`, not
   `SubjectSegmenter.getClient(...)`. Fixed the call + added the `SubjectSegmentation`
   import; the other 4 Kotlin errors (`foregroundConfidenceMask`, type inference,
   `* 255`) were all cascades that cleared once `getClient` resolved.

**Result.** `BUILD SUCCESSFUL`; `app-debug.apk` installed as `com.briank.mien`;
dev client launched against Metro (8081). `isAvailable` is now true on the emulator
→ extract-by-item is enabled. iOS Vision path is untouched (these were Android-only
build issues). Test image (`black dress on wood-plank floor`) was pushed to the
emulator gallery for the patterned-background case.

## Changelog — 2026-06-21 · describe-outfit: per-locale prompts (EN/VI)

**Goal.** `describe-outfit` should return an **English** description when called with
`locale: 'en'` and a **Vietnamese** one with `locale: 'vi'`.

**Edge function (`supabase/functions/describe-outfit/index.ts`, redeployed).**
- Replaced the single English `SYSTEM_PROMPT` (which carried a "write in {lang}"
  rider) with **two fully-localised system prompts** — `SYSTEM_PROMPT.en` and
  `SYSTEM_PROMPT.vi` — plus localised user-turn labels (`LABELS.{en,vi}`:
  styles / occasion / "Outfit:" / "write the description in …"). The whole prompt
  is now in the target language so the copy reads natively, rather than asking an
  English prompt to switch languages.
- `resolveLocale(body.locale)` → `'en'` only when explicitly `'en'`, else `'vi'`
  (Vietnamese stays the default for any missing/unknown value). Item lines stay
  language-neutral (they're DB attribute data the model weaves in).
- Verified on the deployed function with a real demo JWT: identical outfit payload
  → fluent English for `en`, fluent Vietnamese for `vi`.

**Client — locale was hardcoded, now follows the app language.**
- `useOutfitDescription` passed `locale: 'vi'` literally, so an English UI still
  got Vietnamese. It now reads the live language via `useTranslation()` →
  `i18n.language.startsWith('vi') ? 'vi' : 'en'`, and re-runs when the language
  changes (added `locale` to the effect deps).
- `outfitDescriptionService.describeOutfit` cache was keyed by `outfitId` only, so
  switching language would return the stale other-language text. Key is now
  `${outfitId}::${locale}` so EN and VI are cached independently.
- Server change is live (no rebuild). Client change ships with the next app reload.

## Changelog — 2026-06-20 · Demo account → fixed user with pre-seeded cloud wardrobe

**Problem.** The demo path used `signInAnonymously()`, but anonymous sign-in is disabled on the live project (0 anon users ever) and ephemeral anyway (fresh uid/login) — so the demo never got a session, let alone a persistent wardrobe. RLS on `clothing_items`/`wardrobes` (role `authenticated`, `auth.uid() = wardrobes.user_id`) and on `storage.objects` (`auth.uid() = (storage.foldername(name))[1]`) means the demo needs a stable authed uid owning its own data + images.

**Approach (A + I1).** Fixed demo user via email+password (no anonymous auth, no security-setting changes), with images duplicated into the demo's own storage folder (existing RLS unchanged).

**DB / storage ops (live project, idempotent):**
- Created permanent auth user `demo@mien.app` (email-confirmed, bcrypt password, email identity) → stable uid `D = 19595dec-bad6-48e7-a859-fbabee490b7d`. Verified password sign-in via GoTrue REST.
- Profile `D`: `account_type='demo'`, `onboarding_complete=true`, demo profile fields.
- Copied Khoi's 32 `clothing_items` (wardrobe `2857ddef…`) into the demo wardrobe (`b9651128…`) with new ids, `photo_storage='cloud'`, `photo_url = D/<source_basename>` (basename preserved so the copy is a folder-prefix swap).
- Copied the 32 storage objects `d90a166b…/<name>` → `D/<name>` via the Storage API as the demo user, gated by a **temporary, tightly-scoped** SELECT policy (`demo_seed_read_owner`: only uid D, only Khoi's folder) that was **dropped immediately after** — storage policy set is back to the original 6.

**Code:**
- `src/config/demo.ts`: `DEMO_EMAIL = "demo@mien.app"`; added `DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD`.
- `src/services/authService.ts`: added `signInWithPassword(email, password)`.
- `src/stores/authStore.ts`: demo `verifyOtp` branch now calls `signInWithPassword(DEMO_EMAIL, DEMO_PASSWORD)` instead of `signInAnonymously()` (keeps the `000000` OTP UX + onboarding pre-seed). Phone and email demo entry both converge on this one user.
- `.env` + `eas.json` (all 3 profiles): added `EXPO_PUBLIC_DEMO_PASSWORD`.

**Security note.** `EXPO_PUBLIC_DEMO_PASSWORD` is a **baked-in shared demo credential** (committed in `eas.json`, shipped in the binary) — same backdoor class as the `000000` OTP, but scoped to a throwaway demo account holding only demo data (not Khoi's account). Khoi's real folder stays private (verified: demo signing a `d90a166b…` path → 400).

**Verification.** Demo wardrobe returns 32 cloud items; 32 objects under `D/`; demo signs + GETs its own image (HTTP 200, real bytes) under normal RLS; cross-folder read denied (400). `tsc` clean; full suite 81/81. **A new EAS build is required** for the app-side changes (new demo email + `signInWithPassword` + demo password env) to reach TestFlight.

## Changelog — 2026-06-20 · Clean build archive + dev/prod (emulator vs standalone) parity

**Part A — clean build, no leftovers.**
- Added `.easignore` (self-contained superset of `.gitignore`'s heavy excludes) so the EAS build archive ships only what the app needs. Excludes: `node_modules/`, `.expo/`, `dist/`, `.env*`, OS/IDE cruft, scratch artifacts (`*.zip`, `*.log`, `*.orig`, `*.stackdump`, `screens/` design exports), dev helper `scripts/`, `specs/` docs, tests/mocks (`**/__tests__/`, `**/*.test.*`, `jest.config.js`), and the dev-only seeder pair (`app/dev-seed.tsx`, `**/*.dev.ts(x)`).
- Removed tracked crash dumps `bash.exe.stackdump` + `screens/bash.exe.stackdump` (they were committed and shipping in the archive). Added `*.stackdump` and `screens/*-temp/` to `.gitignore`.
- `screens/*-temp/` and `scripts/eas-submit-driver.sh` are untracked scratch; they were also entering the archive (untracked-but-unignored files are uploaded) and are now excluded via `.easignore`. The two `try-on` components reference `screens/...` only in comments, so nothing in `app/`/`src/` imports `screens/`.

**Part B — emulator/standalone parity.**
- Env vars the app reads at runtime: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (`src/services/supabase.ts`), `EXPO_PUBLIC_REVENUECAT_API_KEY` (`app/_layout.tsx`). Local `.env` contains only the two Supabase keys — both already present in eas.json `production.env` with identical values → **same Supabase project + same cloud item images** in standalone as on the emulator. No `Constants.expoConfig.extra` / app.config indirection exists.
- `EXPO_PUBLIC_REVENUECAT_API_KEY` is absent from BOTH `.env` and eas.json, and `_layout.tsx` guards it (`if (!apiKey) return`). So RevenueCat is consistently **disabled in both dev and prod** — not a parity gap, not a crash. Its real value is unknown; not added (would diverge from the emulator). Enable later by adding it to eas.json `env` once a value is provided.
- `app/dev-seed.tsx` ran `seedLocalPhotos()` on mount (flipping items to `photo_storage='local'`, reverting the cloud migration) with **no `__DEV__` guard** — reachable in production via `mien://dev-seed`. Fixed: added an early `if (!__DEV__) return <disabled>` guard (hooks moved into an inner component to keep hook rules valid) AND excluded the file + seeder from the build archive via `.easignore`. Now inert/absent in standalone.

## Changelog — 2026-06-20 · Fix TestFlight standalone launch crash (missing build-time env)

**Symptom.** Production build (v1.0.0 build 2, `4edb1321-…`) crashed immediately on launch via TestFlight on a physical iPhone, while headless checks (tsc, `expo export`, dev bundle) were all green — i.e. a standalone-build-only crash.

**Root cause (confirmed).** `src/services/supabase.ts` reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from `process.env` at **module load** and `throw`s if either is missing (it's imported during auth-store hydration, so it runs at launch). Those vars only existed in the local `.env`, which is **gitignored** → not uploaded to the EAS build server. `eas.json` had **no** `build.production.env` block, and `eas env:list --environment production` returned *"No variables found"*. So at build time Metro inlined `undefined` for both → the throw fired on first launch → instant crash. (Dev/Expo Go works because Metro loads `.env` from the local machine.)

**Fix.** Added an `env` block with the (publishable) Supabase URL + anon key to the `development`, `preview`, and `production` profiles in `eas.json`, so they are baked into every standalone build. No secrets added beyond the already-publishable anon key; no source hardcoding. The existing throw in `supabase.ts` is retained as the loud-failure guard.

**Follow-up required (NOT done here).** A new build is needed for TestFlight to pick this up: `eas build -p ios --profile production`, then resubmit. `EXPO_PUBLIC_REVENUECAT_API_KEY` is still unset everywhere, but `app/_layout.tsx` guards it (`if (!apiKey) return`) so it degrades gracefully and is not a crash cause.

## Changelog — 2026-06-14 · Feature 003-upload-image (tiered item-photo storage)
- **Storage routing**: `wardrobeService.addItem(input, tier)` now decides storage by tier.
  Free → on-device only (relative path `wardrobe-photos/{itemId}.jpg` in `documentDirectory`,
  persisted in `clothing_items.photo_url`, `photo_storage='local'`). Premium → optimized file
  uploaded to the **private** `wardrobe-photos` bucket at `{userId}/{itemId}.jpg`
  (`photo_storage='cloud'`), with the device copy retained as an offline cache.
- **Schema**: added `clothing_items.photo_storage` (`none|local|cloud`) — migration
  `20260614000001_clothing_items_photo_storage.sql` (+ backfill existing photos to `cloud`).
  Apply before release.
- **Privacy**: cloud photos are served via short-lived `createSignedUrl` (FR-016); the prior
  `getPublicUrl` call (broken on a private bucket) was removed.
- **Optimization**: images resized to ≤1600 px long edge, JPEG ~0.7, before storage (`itemPhotoService.optimizeImage`).
- **Local-first / no-rollback**: premium adds write device copy + row first, upload async; failures
  leave the item `photo_storage='local'`. `appStore.syncPendingPhotos()` promotes pending locals to
  cloud — triggered on hydrate, on reconnect, and on free→premium upgrade (`fitEngineStore.setPremium`),
  serving as both the upload-retry queue and the US3 upgrade migration.
- **Cleanup**: delete/replace removes the device file and/or cloud object (no orphans).
- **Offline add**: the previous hard offline guard in `addWardrobeItem` was removed — adding now
  works offline for both tiers.
- **Photo reference kinds in `photo_url`** (resolved by `useItemPhoto`, in precedence order):
  bundled `png` (demo) → `asset:<key>` (in-app catalog image via `wardrobe-photos/assetMap.ts`) →
  `http(s)://…` direct remote URL (rendered as-is, never signed) → relative device path (local) →
  Storage path (cloud, signed). The `http`/`asset` passthroughs fix seeded items whose `photo_url`
  holds a retailer URL (mislabeled `cloud` by the backfill) or a bundled-asset ref.
- **Seed**: the user's 18 image-less items were pointed at matching bundled assets
  (`photo_storage='local'`, `photo_url='asset:<key>'`); 14 retailer-URL items render via the http passthrough.
- **SDK 19**: `expo-file-system` legacy file API now imported from `expo-file-system/legacy`
  (`wardrobeService` via `itemPhotoService`, and `profileService`), fixing the `EncodingType` type error.

## Plan
- Implement onboarding as required first-run flow with persisted progress and completion gating.
- Keep the existing Compose UI screens and move flow logic to a centralized ViewModel.
- Persist onboarding state locally on mobile (current phase), with a clear boundary for future backend sync.
- Separate shareable profile data from private body-measurement data in the domain model for future sync policy.

## Decisions
- Storage (current): local mobile persistence only.
- Persistence mechanism in current implementation: SQLite (`SQLiteOpenHelper`) repository abstraction.
- Future migration direction: dynamic sync policy for non-sensitive fields, keep private measurement fields restricted.
- Scope: MVP completion flow only (no real wardrobe upload pipeline, no AI measurement estimation).

## Progress
- Added onboarding domain contract (`OnboardingRepository`) and aggregate state model (`OnboardingSnapshot`, `OnboardingStep`, privacy metadata).
- Added local persistence data source and repository implementation for onboarding snapshots.
- Added onboarding presentation layer with centralized validation and `OnboardingViewModel`.
- Refactored app flow entry to use ViewModel state, resume step, and gate app entry by completion flag.
- Enabled final onboarding step to complete flow (`AddingWardrobe` next action now callable).
- Added required dependencies for lifecycle ViewModel and DataStore in Gradle catalogs/build file.
- Switched persistence to SQLite entities + helper + repository to align with mobile SQLite decision.

## Changelog
### 2026-03-19
- Created onboarding domain models and repository interface:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/domain/OnboardingModels.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/domain/OnboardingRepository.kt`
- Implemented local persistence layer:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/OnboardingLocalDataSource.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/DataStoreOnboardingRepository.kt`
- Added presentation logic for validation and flow orchestration:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingValidation.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingViewModel.kt`
- Rewired app onboarding entry/gating:
  - `app/src/main/java/com/brian_bui/true_clothes/MainActivity.kt`
- Updated onboarding last-step action behavior:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/AddingWardrobeOnboardingScreen.kt`
- Added dependencies:
  - `gradle/libs.versions.toml`
  - `app/build.gradle.kts`
- Implemented SQLite entity/storage layer and wired ViewModel repository:
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/OnboardingProfileEntity.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/PrivateMeasurementsEntity.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/OnboardingSQLiteHelper.kt`
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/data/local/RoomOnboardingRepository.kt` (contains `SQLiteOnboardingRepository`)
  - `app/src/main/java/com/brian_bui/true_clothes/onboarding/presentation/OnboardingViewModel.kt`
- Implemented real location detection on country onboarding:
  - Added runtime location permissions in `app/src/main/AndroidManifest.xml`
  - Added permission request flow, device location lookup, reverse geocoding, and country auto-selection in `app/src/main/java/com/brian_bui/true_clothes/onboarding/CountryOnboardingScreen.kt`
- Switched country detection to Fused Location Provider API:
  - Added Play Services location dependency in `gradle/libs.versions.toml` and `app/build.gradle.kts`
  - Replaced `LocationManager` usage with `FusedLocationProviderClient` (`lastLocation` + `getCurrentLocation`) in `app/src/main/java/com/brian_bui/true_clothes/onboarding/CountryOnboardingScreen.kt`
- Updated country auto-detection display/value mapping:
  - Keep persisted selection as country option for flow validation/state.
  - When location permission is granted and geocoder resolves address, show country input text as `city, country`.
  - Clear detected location display when user manually chooses a country from the list.

### 2026-05-26 — Fit Engine: Style Coherence Improvements
- **`styleCoherence.ts`**: Fixed style preference matching to better differentiate outfits:
  - `itemAttributes()` now uses only top 2 style tags (was all 4-5), primary weighted 3× (was 2×). Secondary tag's set attributes filtered to only overlapping values. Prevents attribute bloat where every item matches every user preference.
  - `scoreStyleCoherence()` now blends 70% attribute similarity + 30% direct primary-tag match against user's selected styles. Items whose primary style tag matches a user-selected style get a measurable boost.
  - `computeUserAttributes()` threshold lowered from 0.3 to 0.15 so earlier-selected styles aren't dropped when 3+ styles are selected.
  - `attributeSimilarity()` reweighted: formality 25% (was 20%), mood 25% (was 25%), silhouette 20% (was 15%), palette 15% (was 20%), texture 10%, pattern 5% (was 10%). Prioritizes the most style-distinctive dimensions.
- **`outfitRanker.ts`**: Increased style+color weights to 25% each (was 20%), reduced fit+proportion to 10% each (was 15%). User preferences now contribute 50% of total score vs. 40% before.
- **Two-tier ranking**: Added `classifyTier()` — Tier 1 if both top AND bottom have a top-2 style tag matching user's selected styles; Tier 2 otherwise. Outfits sorted tier-first, then by totalScore within each tier. User-style-matching outfits always appear before flex/discovery outfits.
- **`shuffler.ts`**: Rewritten to respect style tiers. Shuffles within quality thirds inside each tier, never mixes Tier 1 and Tier 2 outfits.
- **`ScoredOutfit` type**: Added `tier: 1 | 2` field. Propagated to `Outfit` type for downstream use.

### 2026-05-29 — Intent Engine: Chat AI → Suggest Engine Bridge
- **`IntentContext` type** (`src/types/fitEngine.ts`): New type for chat-driven outfit intent. Fields: `styles`, `mood`, `colorScheme`, `bodyGoal`, `proportionRule`, `occasion`, `formalityRange`, `seasonOverride`, `maxColors`, `requireOuterwear`, `requireAccessory`, `weightOverrides`, `rawInput`. All optional — only set fields override the user's baseline profile.
- **Supporting types**: `ColorScheme` (monochrome | analogous | complementary | neutral_accent | tonal), `BodyGoal` (elongation | broaden_shoulders | define_waist | balanced), `OccasionTag` (daily | date_night | business | weekend | event | travel), `ScoringWeights`.
- **`intentResolver.ts`** (`src/services/fitEngine/intentResolver.ts`): Resolves `IntentContext` into concrete engine parameters — formula preferences, scoring weight adjustments, style overrides, and hard constraints. Maps colorScheme → formula IDs, bodyGoal → formula + weight boosts, occasion → formality range defaults.
- **`EngineContext` updated**: Added optional `intent` and `scoringWeights` fields. When `intent` is present, `generateOutfits()` calls `resolveIntent()` and `applyIntent()` to merge overrides into the context before running the pipeline.
- **`outfitRanker.ts` updated**: Now reads `ctx.scoringWeights` when present, falling back to default weights. No behavior change when intent is absent.
- **Design principle**: The intent layer is an override, not a replacement. User's baseline profile (styles, colors, body) remains the default. Intent acts as a temporary filter/boost for a single generation request.
- **Not yet implemented**: seasonOverride in scorer, chat AI prompt template, chat UI screen.

### 2026-05-29 — Engine Redesign: StyleConfig + Anchor Clarity + HSL Colors

**Phase 1: StyleConfig system with hard constraints**
- **`StyleConfig` type** (`src/types/fitEngine.ts`): New prescriptive style config with three parts: (1) hard constraints — palette with graded matching (perfect/allowed/accent/banned), fabricsAllowed/fabricsBanned, allowedFits, formalityRange, bannedFeatures; (2) override power — which user preferences the style clobbers; (3) per-style scoring weights.
- **`styleConfigs.ts`** (`src/services/fitEngine/styleConfigs.ts`): All 8 style configs authored (oldmoney, minimalist, streetwear, smartcasual, preppy, athleisure, y2k, bohemian). Each with unique palette restrictions, fabric rules, fit constraints, and tuned scoring weights.
- **`styleFilter.ts`** (`src/services/fitEngine/styleFilter.ts`): `filterByStyle()` applies hard constraints to DELETE non-matching items before candidate generation. Returns `FilterResult` with passed items and rejected items + reasons (for UI explanation layer). Safety valve: if all items in a required category are filtered out, the least-violating items are restored.
- **Pipeline wired**: `generateOutfits()` now applies `filterByStyle()` using the primary style config before candidate generation. Per-style weights applied to ranker. Override cascade: intent weights > style weights > defaults.

**Phase 2: Stored item attributes + anchor clarity scorer**
- **`FitItem` extended** with stored fields: `fit` (slim/regular/relaxed/wide/oversized), `warmth` (1–5), `formality` (1–5), `statementStrength` (0–5), `fabricName`. All derived at classification time in `itemClassifier.ts`, not at scoring time.
- **`itemClassifier.ts`**: Added `deriveFit()` (from item.fit field or name keywords, with per-type defaults), `deriveWarmth()` (from material), `deriveFormality()` (from type + color + material), `deriveStatementStrength()` (from pattern + graphics + saturation + subtype drama), `deriveFabricName()` (normalized material name).
- **`anchorClarity.ts`** (`src/services/fitEngine/anchorClarity.ts`): New scorer implementing the "One Hero Piece" principle. Uses stored `statementStrength` to score: 1 clear hero with quiet support = 1.0, no hero = 0.5, multiple competing loud items = 0.2. Fills the 0.05 reserved weight slot.
- **`proportionBalance.ts`** rewritten to use stored `fit` field (VOLUME map: slim=1, regular=2, relaxed=3, wide=4, oversized=5) instead of deriving volume from style tag silhouettes.
- **`formalityConsistency.ts`** simplified to use stored `formality` field directly instead of deriving from style tag lookups.

**Phase 2c: Improved diversification**
- **`outfitRanker.ts`**: Replaced binary exact-match dedup with graded overlap penalty. Outfits sharing 2+ items with already-selected higher-ranked outfits receive a score penalty (0.05 per overlapping item beyond 1). Prevents "5 outfits with the same navy pants" while allowing partial overlap. Re-sorts within tiers after penalty application.

**Phase 2 (ranker): New hard constraints**
- `passesHardConstraints()` now also rejects: both top AND bottom oversized (proportion cardinal sin), formality gap > 2.5 between any items, intent formalityRange violation, missing required outerwear/accessory slots.
- Accepts `ctx.intent?.maxColors` to tighten the default 4-color limit.

**Phase 3: HSL color migration**
- **`ColorProfile` extended** with: `hue` (0–360, undefined for achromatic), `sat` (0–100), `lum` (0–100), `undertone` (warm/cool/neutral).
- **`itemClassifier.ts`**: `COLOR_MAP` now stores HSL values for all 35 named colors with correct hue angles, saturation, lightness, and undertone classification.
- **`colorHarmony.ts` rewritten**: Uses continuous HSL math instead of discrete lookup tables. New dimensions: (1) color relationship scoring via hue angle difference (analogous ≤30°, complementary 150–180°, clashing 60–120°); (2) undertone consistency (warm/cool mixing penalty); (3) lightness contrast via continuous lum values; (4) saturation consistency via sat percentages. Weights: 0.20 alignment + 0.20 relationship + 0.15 undertone + 0.15 contrast + 0.10 saturation + 0.10 colorCount + 0.10 graphic.

### 2026-05-30 — Supabase auth + profile integration

**Auth model**
- Phone OTP via Supabase Auth is the primary path. Email is collected during account onboarding but is **not** an auth method — it is stored on `public.profiles.email` for recovery/communication only.
- Social (Apple/Google) buttons are temporarily stubbed (Alert: "Coming soon"). Wiring requires native config + a deep-link redirect handler; deferred.

**Service layer (`src/services/`)**
- `supabase.ts`: Supabase client with `AsyncStorage` session adapter, `detectSessionInUrl: false`. Reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` at module load; throws if missing.
- `authService.ts`: `toE164`, `sendPhoneOtp`, `verifyPhoneOtp`, `getCurrentUserId`, `signOut`. The only module that touches `sb.auth.*`.
- `profileService.ts`: `fetchMyProfile`, `updateMyProfile`, `markOnboardingComplete`. Maps app-shaped data to DB columns at this boundary only — `dob` (`DD/MM/YYYY` ↔ ISO), `location` (`"City, Country"` ↔ `location_city` + `location_country`).

**`authStore.ts` refactor**
- Replaced `login(phone,email)` with two-step `sendOtp(phone,email)` → `verifyOtp(code)`. On successful verify, the store writes phone (+ email if provided) to `public.profiles` and hydrates the rest from the DB.
- `setProfile`, `completeOnboarding`, `logout` now go through `profileService` / `authService` instead of `AsyncStorage`. Local state still mirrors fields for fast UI.
- `hydrate()` reads the session, populates state from `public.profiles`, and subscribes to `sb.auth.onAuthStateChange` so token refresh / external sign-out keep state consistent.

**Screen wiring**
- `app/(onboarding)/account.tsx`: `handleContinue` now calls `sendOtp` and routes to `/(onboarding)/otp` (no longer skips OTP). Inline send/verify errors, loading state on the CTA.
- `app/(onboarding)/otp.tsx`: shows the resolved E.164 `pendingPhone`, calls `verifyOtp`, supports real resend. If a user lands here without a `pendingPhone` (deep link, refresh), it bounces back to `account`.
- Downstream onboarding screens (`basics`, `location`, `complete`, `wardrobe-intro`) and `(tabs)/menu` continue to use `setProfile` / `completeOnboarding` / `logout` — same surface, now backed by Supabase.

**Config**
- `package.json`: added `@supabase/supabase-js`. Run `npm install` after pulling.
- `.env.example` added with `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`. `.env` added to `.gitignore`.

**Not deployed / NOT in this change**
- No schema migrations applied or pushed — `public.profiles` is consumed as documented in `docs/server-database-definition.md`, assumed already deployed.
- `public.clothing_items` still NOT implemented (per the DB doc), so the wardrobe is still local.
- OAuth providers (Apple/Google) deferred.

### 2026-05-31 — Engine migration to Supabase Edge Function

**What moved**
- All 15 engine modules (itemClassifier, styleCatalog, styleConfigs, formulaCatalog, outfitCompositor, styleFilter, intentResolver, colorHarmony, styleCoherence, fitMatcher, proportionBalance, formalityConsistency, seasonMatch, textureHarmony, anchorClarity, outfitRanker, shuffler) consolidated into 7 backend files under `supabase/functions/generate-outfits/engine/`.
- Entry point: `supabase/functions/generate-outfits/index.ts` — HTTP handler with auth, DB loading, pipeline orchestration.

**Backend structure (7 files, ~2,100 lines)**
| File | Content |
|---|---|
| `engine/types.ts` | All engine-internal types (FitItem, StyleConfig, FormulaPool, etc.) |
| `engine/enrichment.ts` | toFitItem() with category/color/fabric/style classification maps |
| `engine/filtering.ts` | Style hard constraint filtering + STYLE_CONFIGS data |
| `engine/generation.ts` | Formula catalog + 10 pool functions + candidate compositor |
| `engine/scoring.ts` | 7 scorers merged + anchor clarity + style catalog data |
| `engine/ranking.ts` | Intent resolver + ranker (hard constraints + soft scoring + diversification) + daily shuffler |
| `index.ts` | HTTP handler, auth check, DB loading, pipeline orchestration |

**API**
```
POST /functions/v1/generate-outfits
Auth: Bearer <Supabase JWT>
Body: { "intent"?: IntentContext }
Response: { "outfits": ScoredOutfit[] }
```

**Client changes**
- `fitEngineStore.ts`: Removed `computeOutfits()` (local engine call). Added `fetchOutfits(intent?)` which calls `sb.functions.invoke('generate-outfits')`. Removed `formulaPreferences` state and `setFormulaPreferences` (now server-side).
- `useFitFeed.ts`: Rewritten from synchronous `useMemo` to async `useEffect` + `useState`. Calls `fetchOutfits()`, converts `ScoredOutfit[]` to `Outfit[]` for the feed. Added `loading` and `refresh` to the return value.
- `types/fitEngine.ts`: Trimmed to client-only types — `BodyMeasurements`, `UserStyleProfile`, `ScoredOutfit`, `IntentContext`, `OutfitSlots`, `ScoringWeights`. Removed engine-internal types (`FitItem`, `StyleConfig`, `FormulaPool`, `EngineContext`, etc.).

**Data note**
- Style catalog, style configs, formula catalog, and classification maps are kept hardcoded in the edge function for now. They will move to DB config tables (styles, style_configs, formulas, colors, garment_types, fabric_types, color_style_boosts, engine_config) in a future migration.
- The edge function reads user data from: `profiles`, `body_measurements`, `style_profiles`, `clothing_items`.

**Not changed**
- The 15 original engine files in `src/services/fitEngine/` are still present. They can be removed once the edge function is deployed and verified. `src/data/measurements.ts` can also be removed (garment measurements now come from `clothing_items.measurements` column).

## Next
- Deploy the edge function: `supabase functions deploy generate-outfits`.
- Create DB config tables (styles, style_configs, formulas, etc.) and migrate hardcoded data out of the edge function.
- Remove the 15 original engine files from `src/services/fitEngine/` after verifying the edge function works.
- Wire `public.clothing_items` once schema is defined.
- Add Apple/Google sign-in (native config + redirect handling).

---

## 2026-06-10 — Engine P0 fixes + LLM curator layer

**Engine fixes (`supabase/functions/generate-outfits/`)**
- **Personal color wired into scoring** (Q16): `index.ts` now reads `profiles.color_season` + `personal_palette`; `personal_palette` merges into `colorPreferences`, `color_season` flows into `ctx.colorSeason` so `seasonCompatibilityBonus` in `scoring.ts` is live (was dead code — `profileRes` fetched but never used).
- **Color lookup case-insensitive** (`enrichment.ts`): `COLOR_MAP`/`COLOR_STYLE_BOOSTS` keyed exact Title Case; lowercase values from future AI extraction silently fell through to the default 'natural' profile. Material lookups normalized via `primaryMaterial()` for the same reason.
- **Exclude by core triple**: paging exclusion used the top-slot id as pseudo-id, so excluding one outfit killed every outfit sharing that top. Server + client (`fitEngineStore.ts`) now key on `top|bottom|shoes`; legacy bare-top ids still honored until shown-ID caches cycle.
- **`seasonOverride` now scored**: `scoreSeasonMatch(items, targetSeason?)` blends 0.6×target-match + 0.4×internal consistency when intent carries a season; previously resolved but unused.
- **`poolHighLow` uses real formality**: replaced the category-level `estimateFormality` (top max ≈3.5 → formal-top pools nearly unreachable) with enrichment's `item.formality`.
- **Candidate generation de-biased** (`generation.ts`): the cap was consumed by outerwear/accessory variants of the first core triple; now all distinct top×bottom×shoes triples are generated first, variants layered round-robin after. Shuffle is seeded per user+day (mulberry32) so paging/exclusion are coherent within a day.

**New: LLM curator (`engine/curator.ts`)**
- Final taste pass after rank+shuffle: Claude re-ranks the top ≤24 rule-validated candidates into 10 picks, may veto 0–4, writes a one-line `stylistNote` per pick (locale-aware vi/en). References candidates by index only — cannot invent items/combos.
- Model `claude-haiku-4-5` (~$0.0055/batch), override via `CURATOR_MODEL` secret; structured outputs (`output_config.format` json_schema); 3.5s timeout, 0 retries; any failure → silent fallback to rule order. Skipped entirely when `ANTHROPIC_API_KEY` secret is unset.
- API: request body adds `locale?: 'vi'|'en'` and `curate?: boolean` (client gates by tier); response adds `curated: boolean`; `ScoredOutfit` gains `stylistNote?` (server + client types).
- UI follow-up: feed card should render `stylistNote`; client may prefetch the next batch around card ~6 to hide curator latency.

**Ops**
- To enable curation: `supabase secrets set ANTHROPIC_API_KEY=sk-ant-...` (function works without it — rule order, no notes).

---

## 2026-06-11 — Engine taste layer, weather wiring, curator gating, legacy cleanup

**Engine (`supabase/functions/generate-outfits/`)**
- **Claude path fully separated**: `curatorEnabled()` checks `ANTHROPIC_API_KEY` up front in `index.ts` — when unset, the curation branch is skipped entirely (no prompt building, no SDK call) and the rule-engine order returns directly.
- **Taste layer** (`scoreTasteAdjustment` in scoring.ts): flat bonus for ~17 classic core combos (shirt+trousers+loafers, tee+jeans+sneakers, …) keyed on new `FitItem.typeName`; multiplicative vetoes for clashing pairs (sandals+trousers, oxfords+shorts, …), all-dark-flat looks, warm/cool undertone fights, ≥3 competing statement pieces. Applied in ranking as `(base + bonus) × multiplier` — one fatal flaw now sinks an outfit instead of being averaged away.
- **Confidence weighting** (ranking.ts): dimensions with no real data (fit without measurements, style without attributes) drop out of the weighted average instead of injecting neutral 0.5s; weights renormalize over valid dims. `fit` weight floors at 0.18 when the user has body measurements.
- **Multi-style filtering** (index.ts): items pass if they fit ANY of the user's selected styles (up to 5), union across configs; scoring weights still from the primary style.
- **Catalog dedupe**: `STYLE_CATALOG` (scoring.ts) is now derived from `STYLE_CONFIGS` (filtering.ts) — single source of truth, no more drift.

**Client**
- **Weather → engine** (fitEngineStore.ts): `weatherContext.temperatureBand` (cold/mild/warm/hot → winter/fall/spring/summer) is sent as `intent.seasonOverride` on every feed fetch — live weather now shapes suggestions end-to-end.
- **Curation gating**: premium (RevenueCat `usePremium`, synced into the store by `useFitFeed`) → every batch curated; free → one curated batch per day (AsyncStorage `last-curated-date`); sends `curate: false` otherwise.
- **Stylist note UI** (app/(tabs)/index.tsx): renders `outfit.stylistNote` above the bottom meta in italic serif; `Outfit` type gains `stylistNote?`.
- **Prefetch**: feed `onEndReachedThreshold` 0.5 → 3 (next batch loads ~3 cards before the end, hiding curator latency).
- **formulas-edit fixed**: was importing the deleted legacy catalog and a store API that no longer existed; now uses server-driven `formulas` catalog (Q44) + restored `formulaPreferences`/`setFormulaPreferences` on the store (persisted via `style_profiles.formula_preferences`, hydrated on launch).
- **Legacy removed**: `src/services/fitEngine/` (15 files + tests) and `src/data/measurements.ts` deleted — edge function is verified as the only engine.

**Still open (needs decisions/schema)**: ingest-time AI enrichment columns on `clothing_items`; DRESS as one-piece composition (Q29); behavior-event logging (Q18); catalogs → DB tables; blind model eval once `ANTHROPIC_API_KEY` is set.

---

## 2026-06-11 (2) — Ingest enrichment, one-piece support, behavior events, interaction-service repair

**Ingest-time enrichment (engine reads stored attributes)**
- The extraction prompt already returned `pattern` + `warmthSeason` and `clothing_items` already had the columns — but the client `ExtractedItem` dropped both fields between extraction and save. Chain now complete: `ExtractedItem` carries them → `confirmItems` passes to `AddItemInput` → `wardrobeService` persists (text column, comma-joined) → engine selects `pattern, warmth_season` and prefers stored values over name-keyword inference (`resolvePattern`, `applyStoredWarmth` in enrichment.ts; stored warmth maps to fabricWeight + season).

**One-piece composition (Q29)**
- New `ItemCategory 'onepiece'`; DRESS/JUMPSUIT/OVERALLS/GOWN map to it. Generation emits onepiece+shoes (+outerwear) candidates where the one-piece fills both top and bottom slots with the same id; `slotsToIds` (server + client) dedupes so the garment is scored/rendered once. Fit uses TOP_MAPPINGS; proportion counts it as both halves; curator describes it as `one-piece:`.

**Behavior events (Q18) + curator measurement**
- Migration `fix_outfit_interactions_for_events`: added `outfit_data jsonb`, widened type check to include `'impression'`, added the unique `(user_id, outfit_id, type)` that upserts required.
- `logImpressions()` records every outfit the feed shows with `{curated, formula, position}`; wired into both fetch paths (fire-and-forget). Save-rate by curated flag is now queryable: `select outfit_data->>'curated', count(*) ... join saved`.

**outfitInteractionService repair (schema drift — service had never written a row: 0 rows in prod)**
- `'save'` → `'saved'` (DB check constraint), `scheduled_date` → `scheduled_for` (actual column), snake_case → camelCase mapping in `fetchInteractions` (`outfitId` was undefined before), `types/outfit.ts` + appStore hydration updated to match.

**Deployed**: engine re-deployed and boot-verified. Client compiles (remaining tsc errors are pre-existing: expo-file-system EncodingType, help.tsx icon prop, untyped params in outfit/[id].tsx).

---

## 2026-06-17 — Account type discriminator + store-verified premium sync

**Schema**: `profiles.account_type text not null default 'free' check in ('free','premium','demo','admin')` (migration `20260616000001_profiles_account_type.sql`, applied to live DB). Previously account class was only known at runtime (RevenueCat) / by hardcoded demo credentials — now it is queryable and server-gateable.

**Source of truth — store payment only**: `account_type` is written *exclusively* by completed Google Play / App Store purchases, never set manually. Sync is server-authoritative via a new RevenueCat webhook:
- **`supabase/functions/revenuecat-webhook/index.ts`** (NEW): authenticates RevenueCat's configured shared secret (`REVENUECAT_WEBHOOK_SECRET`, NOT a Supabase JWT → must deploy `--no-verify-jwt`), maps `event.app_user_id` → `profiles.id`, and flips `account_type`. GRANT set (INITIAL_PURCHASE/RENEWAL/PRODUCT_CHANGE/UNCANCELLATION/NON_RENEWING_PURCHASE/SUBSCRIPTION_EXTENDED/TEMPORARY_ENTITLEMENT_GRANT) → `premium`; REVOKE set (EXPIRATION/SUBSCRIPTION_PAUSED) → `free`. CANCELLATION/BILLING_ISSUE are no-ops (access kept until expiry). TRANSFER moves entitlement between ids. Only the `premium` entitlement is acted on; updates guard `account_type in ('free','premium')` so `demo`/`admin` are never clobbered; anonymous/non-UUID `app_user_id`s ignored.
- **`app/_layout.tsx`** (MODIFIED): RevenueCat init now calls `Purchases.logIn(supabaseUserId)` after `configure()` so `app_user_id` equals the Supabase `user.id` — the webhook's only way to resolve the event back to a profile. (T079 had specified this but the code only called `configure`.)

**First reader of `account_type` — AI import gate**: `useItemExtraction.startExtraction` now treats a user as premium if EITHER the live RevenueCat entitlement is active OR `profiles.account_type ∈ {premium, admin}` (new `hasPremiumAccountType()` / `fetchMyAccountType()` in `profileService.ts`). This lets a store-verified upgrade unlock unlimited AI import even where RevenueCat is absent (Expo Go) or hasn't synced. `incrementCredit` still runs but the count no longer gates premium accounts.

**Still not wired (open)**: `usePremium` itself still derives `isPremium` only from RevenueCat — so cloud photo storage (`addWardrobeItem` tier) and the generate-outfits curation gate do NOT yet read `account_type`. Webhook is written but not deployed; needs `supabase functions deploy revenuecat-webhook --no-verify-jwt`, `supabase secrets set REVENUECAT_WEBHOOK_SECRET=…`, and the matching URL+Authorization header configured in the RevenueCat dashboard.

---

## 2026-06-20 — AI item extraction (006) + on-device "Extract by item" (007)

**006 (deployed):** `generate-item-image` Edge Function (Gemini detect with controlled-vocab validate/snap + measurement estimates + logo + nano banana 2 isolated images, injection-safe note steering + content-safety). Client: `imageGenerationService`, `wardrobeService` now persists real `type/fit/m_*/brand/source_url/graphics` + `source`. Added `clothing_items.graphics jsonb` (migration `20260620000001`). Add-to-Wardrobe wizard under `src/features/wardrobe-add/`. Removed dead Claude `extract-garments` path.

**007 (JS done; native scaffolded):** on-device "Extract by item" method — free, offline, no `ai_extraction` credit. Native Expo module `modules/expo-item-extract` (iOS Vision / Android ML Kit: subject mask → transparent PNG, image labels, OCR). `extractByItemService` snaps colour (LAB ΔE → 37 via `colorMatch`), type (`itemTypeMap`, blank on low-confidence), pattern (solid), logo (OCR → `graphics`), measurement defaults. Requires an **EAS dev client** (not Expo Go); ML Kit/Vision do not run on the iOS simulator. Type is required before save (`clothing_items.type` is NOT NULL).

**AI image → transparent cut-out (refinement):** the AI method returns the item on a **white background**; the on-device ML segmenter is reused purely to turn that into a transparent cut-out. New `cutoutOnDevice(uri)` in `extractByItemService` wraps the native `extractItem` and keeps ONLY the cut-out (AI metadata stays authoritative); it is a **no-op that returns the white-bg image unchanged when the native module is absent** (Expo Go / simulator) and never throws. Wired into `useAddWizard`'s AI branch (`refineAiCutout`): each AI result is refined and the replaced white-bg file deleted (best-effort). Source-selection strategy is unchanged — "Extract by item" → on-device, "Extract by AI" → AI; this only post-processes the AI image when native ML is available. Try On's auto-selection is left as-is (its AI branch only runs when native is absent, so there is nothing to refine there).
---

## 2026-06-21 — Home-feed curator moved from Claude Haiku → Gemini

**`generate-outfits/engine/curator.ts`** rewritten to run on **Gemini** instead of the Anthropic SDK. Interface (`CuratorInput`/`CuratorResult`), the system prompt, and `assemble()` (index validation, veto application, rule-order backfill to 10) are unchanged — only the model call and the gate changed, so `index.ts` integration is untouched apart from a comment.
- Gate is now **`GOOGLE_API_KEY`** (the same secret `generate-item-image`/`evaluate-item` already use) — `curatorEnabled()` checks it; one secret powers all AI paths. The old `ANTHROPIC_API_KEY` is no longer read anywhere.
- Default model **`gemini-2.5-flash`** (override via `CURATOR_MODEL`). Call is plain REST `generateContent` (no SDK dep) with **structured JSON output** (`responseMimeType: 'application/json'` + `responseSchema`, Gemini's uppercase-type OpenAPI subset) replacing Claude tool-calling. `temperature: 0.4`, `maxOutputTokens: 2048`.
- Reliability unchanged in spirit: single attempt, hard **5s** `AbortController` timeout (was 3.5s on the SDK), any failure → silent fallback to rule order; the feed never blocks on this layer.
- **To enable curation:** `supabase secrets set GOOGLE_API_KEY=…` (already set for item extraction → curation is now on by default). `ANTHROPIC_API_KEY` can be removed.

**Curation now actually reachable — `account_type` wired into the premium gate**
- `usePremium` (`src/features/monetization/usePremium.ts`) previously derived `isPremium` from RevenueCat ONLY, so the generate-outfits curation gate (`fitEngineStore.resolveCurateFlag` — premium = every batch, free = one batch/day) never saw store-verified or test accounts as premium, especially in Expo Go where `react-native-purchases` doesn't load. It now resolves premium as **(RevenueCat `premium` entitlement active) OR (`hasPremiumAccountType()` → `account_type ∈ {premium, admin}`)**. This closes the gap flagged in the 2026-06-17 entry ("usePremium itself still derives isPremium only from RevenueCat") for the curation + cloud-photo gates.
- Effect: a profile with `account_type = 'premium'` (written only by the RevenueCat webhook on a verified purchase, or manually for test/demo) now gets **every** feed batch curated by Gemini — so the curator is visibly exercised. Test account `khoibuiqn1011@gmail.com` is already `premium` in the live DB; no DB change was needed, only the client wiring.

**Curator was silently never applying — `gemini-2.5-flash` thinking timeout (root cause)**
- Symptom: no `stylistNote` ever appeared; feed was always rule order even for a premium account with `curate:true`. Verified via a throwaway `diag-curator` function (deployed `--no-verify-jwt`, called, then deleted) that ran the exact Gemini call with synthetic candidates and returned raw `finishReason`/`usageMetadata`/timing.
- Root cause: `gemini-2.5-flash` enables **thinking by default**. The curation call spent **~1422 thought tokens and ~9.9s** (finishReason still STOP, JSON valid) — far over the 5s `AbortController` timeout, so every call aborted → `curateOutfits` returned null → silent fallback to rule order. (This was true at 3.5s/4s/5s alike.)
- Fix: `generationConfig.thinkingConfig = { thinkingBudget: 0 }` in `curator.ts`. Measured: same prompt drops to **~1.2s** with valid structured output. Timeout left at 5s for headroom. Redeployed `generate-outfits`.

**Curator now also writes the outfit description (not just the note)**
- The home-feed card shows the curator's `stylistNote` (quoted), but the **detail screen** renders `outfit.longDescription`, which for generated outfits was always `''` (blank). The only "description" was `outfit.description` = joined item names ("White oxford shirt, Navy chinos…").
- Curator schema/prompt extended: each pick now returns `description` (2–3 sentences, ~320 chars, editorial copy about vibe + how pieces work + occasion) alongside `note`, in the user's locale. New `ScoredOutfit.stylistDescription` (server `engine/types.ts` + client `types/fitEngine.ts`) carries it through; `index.ts` is unchanged (passes outfits through). `maxOutputTokens` 2048→4096 to fit 10 picks × (note + description) + vetoes.
- Client: `scoredToOutfit` maps `longDescription = scored.stylistDescription ?? description` — AI description when the batch was curated, item-list fallback otherwise (never blank). Verified end-to-end via the throwaway diag: ~2.5s, valid JSON, Vietnamese note + 2–3 sentence description per pick.

**Outfit description moved OUT of bulk curation → lazy per-outfit `describe-outfit` (supersedes the "curator also writes the description" note above)**
- Why: measured on the REAL payload (24 candidates, 10 picks WITH descriptions), generating all descriptions in one call is **8–11s** (gemini-2.5-flash 11s, flash-lite 8.5s, gemini-2.0-flash retired/404) — output-token bound, no model fits a feed timeout. That made `generate-outfits` abort every time → `curated:false`, no notes, no descriptions (verified via a throwaway token-minting harness that called the deployed function as the real user).
- New split:
  - **Feed curation (`curator.ts`)** reverted to **note + rank only** (reverted schema/prompt/`maxOutputTokens` to 2048; `ScoredOutfit.stylistDescription` removed server + client). Note-only of 24 candidates ≈ 4s; `TIMEOUT_MS` raised 5s→**8s** for headroom so it never intermittently aborts. Verified: `curated:true`, 10/10 notes, ~5.2s end-to-end.
  - **`describe-outfit` Edge Function (NEW)**: Bearer-authed; body `{ items:[{name,type,color,material?,fit?}], styles?, locale?, occasion? }` → ONE 2–3 sentence editorial description (gemini-2.5-flash, thinking off, 8s timeout). Returns `{ description:'' }` (never 500s) on any AI failure so the client falls back. Verified ~3.5s, valid Vietnamese.
  - **Client**: `outfitDescriptionService.describeOutfit()` (in-memory cache by outfit id) + `useOutfitDescription()` hook; `app/outfit/[id].tsx` calls it on open for `gen_…` outfits, starting from the item-list fallback (`Outfit.longDescription` = joined item names) and swapping in the AI text with a dim-while-loading state. Mock/sample outfits keep their authored copy.
- Net: feed stays fast (note only), the detail screen gets a rich AI description on demand (~1–3.5s, cached, with a loader).

## Personal colour — camera path now actually analyses the photo (2026-06-21)

**Problem.** The "SCAN MY COLOURS" path captured a wrist + hair photo but **never
used them** — `scorePersonalColor` ran purely on the 4 manual answers, and the
photos were shown only as reference thumbnails. The intro even claimed it "reads
wrist & hair tone", which was false; no pixel/LAB analysis existed anywhere.

**Fix — real on-device analysis, no remote AI, no native rebuild.**
- New `src/features/personal-color/analyzePhoto.ts`: `expo-image-manipulator`
  downscales the photo to 48×48 JPEG → `jpeg-js` (pure JS, added dep) decodes to
  RGBA → average the central 50% region (trimming near-black shadow < 25 and
  blown-out flash glare > 240) → sRGB→LAB.
  - **Wrist → skin undertone:** nearest of the 3 `SKIN_OPTIONS` swatches in the
    **a/b chroma plane only** (ignoring L) — phone auto-white-balance shifts
    brightness far more than hue, so lightness is dropped for robustness.
  - **Hair → option:** nearest `HAIR_OPTIONS` swatch in **full LAB** (shade +
    warmth both matter).
  - Every step is wrapped → any failure returns null and the quiz stays manual
    (never crashes). Verified the LAB math: all swatches self-classify, and test
    tones map sensibly (golden→warm, rosy→cool, light cool hair→platinum_ash).
- `usePersonalColorDetection`: capturing a photo now runs the matching analyser
  and **pre-fills** `skinUndertone` / `hairKey` (only when still unset, so a manual
  pick is never clobbered), with `analyzing` + `autoSkin`/`autoHair` flags. A manual
  selection clears the auto flag.
- UI (`personal-color-edit`): the reference-photo caption shows "Reading your
  tone…" while analysing and "Auto-detected from your photo — adjust if it looks
  off." once filled, so the pre-selected answer is transparent and editable.
- **Honest now:** because the camera genuinely informs the result, the intro copy
  is accurate. Manual-only path is unchanged. The on-device questionnaire remains
  the final say (user confirms/adjusts every auto-detected answer).
- **Dep note:** added `jpeg-js` (pure JS) — needs a **Metro restart** to bundle,
  but **no native rebuild**. `atob` is available on Hermes/Expo 54.
- (The shared onboarding `personal-color` screen uses the same hook, so the
  pre-fill works there too; only the edit screen got the explicit hint copy.)

**describe-outfit → gemini-2.5-flash-lite**
- Switched `describe-outfit` default model from `gemini-2.5-flash` to **`gemini-2.5-flash-lite`** (override now via its own `DESCRIBE_MODEL` env, decoupled from the curator's `CURATOR_MODEL`). Same-outfit A/B: flash-lite reads more editorial (less item-listing, names the occasion) at equal latency (~1.4–1.9s) and ~3–4× cheaper. Curator/note path unchanged (still `gemini-2.5-flash`).

**Fix: detail-screen description was never fetched — items resolved from mock, not cloud wardrobe**
- Symptom: no AI description on outfit detail. Root cause: `app/outfit/[id].tsx` resolved the outfit's garments via `itemById` (mock `ITEMS` in `src/data`), but generated outfits carry **DB ids** that live in `appStore.wardrobeItems` (cloud), not `appStore.items` (mock+legacy). So `items` came up empty → `useOutfitDescription` hit its `items.length === 0` guard and skipped the call. (The collage already resolves from `wardrobeItems`, which is why images showed but the description didn't.)
- Fix: detail screen now builds `describeItems` from `wardrobeItems` (id → {name,type,color:colors[0]∥primaryColor,material,fit}) with mock `itemById` fallback — same source the collage uses — and passes that to the hook. Fallback text is the resolved item names (cloud-wardrobe outfits have an empty `longDescription`). `useOutfitDescription` deps now include `items.length` so it re-runs if the cloud wardrobe hydrates after mount (cached by id, so no double request). Client-only change; no function redeploy.

---

## Feature 009 — AI Try-On "Wear on you"

Renders the user wearing a chosen outfit (distinct from the feature-008 "should I
buy this?" scan). Entry: outfit detail → **GENERATE ON YOU** → full screen
`app/try-on/wear.tsx`. The previous stub sheet in `outfit/[id].tsx` (hardcoded
178cm/70kg/M, no generation) is removed.

**Flow (state machine in `src/features/try-on/useWearOnYou.ts`):**
`upload → validating → ready → rendering → result` (+ `invalid` / `error`).
1. User takes/chooses a photo (`expo-image-picker`).
2. **Validate** (cheap gate) — `tryon-validate` confirms ONE clear human subject;
   on failure returns a user-facing Vietnamese reason and the user re-picks.
3. **Generate** — `tryon-generate` composites the outfit's garments onto the photo.
4. **Result** — generated image of the user wearing the outfit (no AI scoring).

**Edge functions (Gemini, reuse `GOOGLE_API_KEY` + auth pattern of generate-item-image):**
- `tryon-validate` — `gemini-2.5-flash` vision → `{valid, reason}`. Conservative:
  requires is_person ∧ single_subject ∧ body_visible ∧ quality_ok.
- `tryon-generate` — `gemini-3-pro-image-preview` (nano banana 2) image-out:
  `[user photo, ...garment reference images, prompt]` → one photorealistic image
  preserving the person's identity/pose/background. A detailed **PERSON PROFILE**
  (gender, age, height/weight, body shape, preferred fit, body measurements in cm)
  is passed as TEXT to guide body proportions + garment fit/drape — with an explicit
  guardrail that it must NOT change the face/skin/hair (those come from the photo).
  No scoring call (removed per product decision). Garment images are fetched
  server-side from short-lived **signed URLs**; garments without a remote URL
  (local/asset items) fall back to text descriptors. Max 6 garment images.

**Client:**
- `src/services/tryOnWearService.ts` — `validatePersonPhoto()`, `generateWearOn()`,
  and `buildWearGarments()` (maps outfit items → `{type,name,color,material,fit,imageUrl}`;
  signs cloud `photoPath` via `itemPhotoService.signedUrl`). User photo is downscaled
  (≤1280px JPEG) and sent as a **transient base64 data URI — never uploaded to storage**;
  the generated result is written to `documentDirectory/try-on/`.
- The screen builds a `WearProfile` from `authStore` (gender, age from dob, and all
  `measurements` body_* fields → labelled cm map) so generation gets the fullest body
  info available; the on-screen frame card still shows height/weight.

**Credit gating:** new `try_on` credit type in `usageCreditService` (free 2/month,
premium unlimited — mirrors `ai_extraction`). `credit_type` is an unconstrained
`text` column, so no DB migration needed. A credit is consumed only on a successful
generation (failures are free).

**PRIVACY — must verify before going live:** the user's photo is sent to Gemini.
On the **paid** Gemini tier, prompts/responses are NOT used for training (logged
briefly for abuse/safety only); on the **free** tier they MAY be used for training
+ human review. The `GOOGLE_API_KEY` project MUST be billing-enabled before this
feature ships. Functions deployed but feature should not go live until confirmed.

## Branding — MIEN logo assets (2026-06-28)

Brand logos added under `assets/logo/` (`MIEN-icon-light/dark`, `MIEN-wordmark`,
`MIEN-primary`, `MIEN-inverse`). All render on the canvas cream `#FAF7F2`, matching
`T.color.canvas`.

- **App icon / splash / adaptive icon**: `assets/icon.png`, `splash-icon.png`, and
  `adaptive-icon.png` regenerated (1024×1024 PNG) from `MIEN-icon-light.jpg` via
  `@expo/image-utils` `generateImageAsync` (contain on cream). `app.json` paths
  unchanged; splash `backgroundColor` already `#FAF7F2`.
- **Welcome screen** (`app/(onboarding)/index.tsx`): the "MIEN" wordmark text replaced
  with the `MIEN-wordmark.jpg` image (`Animated.Image`, contain, 220×82). Tagline kept.

## Pose measurement scan — correctness fixes (2026-06-28)

Hardening pass on the on-device body-measurement AI scan (MoveNet → circumferences).

1. **Height now reaches the scanner.** `measurements-scan` reads its scale-reference
   height from `fitEngineStore.bodyMeasurements`, but onboarding keeps the in-progress
   value in `useMeasurements` local state (only flushed to the store on Save) — so the
   scanner always hit `height_required`. Both callers now pass the live value as a
   `?heightCm=` query param (IN→CM converted); the scan screen prefers the param and
   falls back to the store. (Query-string form chosen so it matches the generated
   typed-route template; passing it via `params` on a static route doesn't typecheck.)
2. **Letterbox instead of squash** (`poseEstimate.ts`). The input was resized to
   192×192 forcing both axes → portrait photos were squashed, inflating every
   horizontal width by `origH/origW` (~1.3–1.8×) and degrading MoveNet. Now scaled
   uniformly (long side→192) and zero-padded to the square. Because the scale is
   uniform, x and y keep the same real-world unit, so `landmarksToMeasurements` is
   unchanged (pad offsets cancel in coordinate differences). `estimateKeypoints` now
   takes the source `width/height` (from the picker asset; probed if absent).
3. **All-clamped-out → low confidence.** If every field falls outside its sane range
   (returns `undefined`), the screen now shows the retry/low-confidence state instead
   of flashing "success" with nothing pre-filled.
4. **Frame-fraction guard fixed.** The "person too small" guard was `personUnitH < 0.01`
   — a subject spanning ~1% of the frame still slipped through and produced garbage that
   landed inside the clamps. Raised to `K.minPersonFrameFraction = 0.2` (real full-body
   shots span ~0.8–1.0). Aligns with the existing unit test's documented intent.
5. **Timer leak.** The post-success `setTimeout(router.back, 1200)` is now cleared on
   unmount to avoid a double `back()` if the user closes the screen first.

## Pose measurement scan — accuracy refinements + clothing prompt (2026-06-28, round 2)

Building on the round-1 correctness fixes:

1. **Snug-clothing prompt.** Added a prominent callout on the capture screen
   (`measurementsScan_clothingTip`, EN+VI) telling the user to wear close-fitting
   clothing — loose layers are the single biggest practical error source. Also
   strengthened the existing instruction/guide strings from "fitted" → "snug".
2. **BMI-modulated depth ratios.** `keypointsToMeasurements` now takes an optional
   `weightKg`; depth ratios scale by `1 + bmiDepthGain·(BMI − refBmi)/refBmi`
   (clamped). Average builds (BMI≈22) are unchanged; heavier/leaner builds get a
   rounder/flatter cross-section. Both screens pass the in-progress weight via a
   `?weightKg=` query param alongside `heightCm`. Weight absent → factor 1.
3. **Hip-width correction.** `K.hipWidthCorrection = 1.06` nudges the joint-keypoint
   hip width toward the true widest girth (was biased low).

Both heuristics are CALIBRATION-PENDING (documented in `K` and backlog) — they are
physically-motivated guesses anchored so the average case is unchanged; retune
against real tape measurements. Unit tests cover: weight-absent == unchanged,
higher BMI ⇒ larger circumferences, ranges hold, inseam weight-independent.

## Pose measurement scan — sex + age refinement (2026-06-28, round 3)

`keypointsToMeasurements` signature changed from a positional `weightKg` to an
`EstimateInputs` object: `{ weightKg?, sex?, ageYears? }` (all optional; omitting
all → neutral average model, unchanged behaviour).

- **Sex** (`tunablesFor`): men/women differ systematically in width→girth ratios and
  fat distribution, so sex selects a tuned constant set off the neutral `K` base —
  women get fuller bust depth, rounder/wider hips, waist tracking the hips; men get a
  broader chest, rounder (visceral) waist tracking the upper body. Non-binary / unset
  → neutral.
- **Age**: small visceral-fat correction to **waist depth only** (`K.ageWaist*`),
  +1.5%/decade over 30, capped +6%. Weak signal, kept deliberately small.
- **Wiring**: the scan screen reads `gender` + `dob` from `authStore` (set in the
  onboarding "basics" step, before measurements) — `WOMAN/MAN` → `female/male`, dob
  "DD/MM/YYYY" → age. No new query params (these aren't edited on the form).

Inputs the estimate now uses: **pose + height + weight + sex + age**. Both sex and age
deltas are CALIBRATION-PENDING heuristics anchored so the neutral case is unchanged.
Tests cover: unknown sex == neutral, female hip > male hip, male waist > female waist,
older waist > younger, age touches waist only, ranges hold.

## Pose measurement scan — fill the estimable length fields (2026-06-28, round 4)

`EstimatedMeasurements` extended with three length fields the pose can measure
directly (distance between keypoints × the height scale — no depth guess, so far
more reliable than the girths):

- **body_shoulder_width** — biacromial keypoint span (already computed internally).
- **body_sleeve_length** — shoulder→elbow→wrist along the arm, averaged over whichever
  sides have confident elbow+wrist keypoints; **undefined when arms are occluded**
  (the field is simply left blank — arms are optional, they don't fail the estimate).
- **body_upper_body_length** (torso) — vertical shoulder→hip span × `K.torsoFromShoulderHip`
  (0.85, CALIBRATION-PENDING; neck-base→waist is a bit shorter than shoulder→hip).

All clamped to sane ranges (omit → blank). Wiring:
- These fields had **no UI** anywhere (`MEASUREMENT_FIELDS` was unused). Added SHOULDER /
  SLEEVE / TORSO inputs to the **Settings → Size & measurements** form (`measurements-edit`),
  so the scan-filled values are visible and user-editable there.
- Onboarding fills them too (saved + editable later in Settings) but doesn't render them
  on its lean first-run form.
- Scan's "no usable field" guard now also counts the length fields.

Net coverage: the scan now pre-fills up to **7** of the 13 body measurements
(bust/waist/hip + inseam/shoulder/sleeve/torso). Girths needing a width keypoint we
don't have (upper-arm, neck, thigh) and feet stay manual-only by design.

## Android 16 KB page-size compliance (2026-06-28)

Google Play requires 64-bit native libs aligned to 16 KB; a 16 KB-page emulator
or device also fails to load 4 KB-aligned `.so` at runtime. Diagnosed via ELF
program headers (`scripts/check-16kb.py`): `react-native-fast-tflite@1.6.1` bundled
4 KB-aligned TFLite prebuilts (x86_64 especially) and built its own wrapper
(`libVisionCameraTflite.so`) at 4 KB under NDK 27 (`max-page-size=4096`).

**Fix: upgraded `react-native-fast-tflite` 1.6.1 → 2.0.0.** v2 self-aligns to 16 KB
(`-Wl,-z,max-page-size=16384` + `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` in its
CMake) and pulls LiteRT from Maven (`com.google.ai.edge.litert:litert:1.4.0`, which
ships 16 KB-aligned libs for ALL ABIs incl. x86_64). API unchanged
(`loadTensorflowModel` / `runSync(TypedArray[])` / `inputs[].dataType`) → no code
change in `poseEstimate.ts`; TSC + tests green. Two earlier attempts (NDK-28 bump,
release `abiFilters` x86/x86_64 drop) were REVERTED — the lib upgrade makes them
unnecessary, so it runs on every ABI incl. 16 KB x86_64 emulators and real arm64
16 KB devices. Needs a fresh native build; verify with `scripts/check-16kb.py` on
the rebuilt app's libs.

## Measurement scan — live pose guide, B-lite (2026-06-28)

`measurements-scan.tsx` rewritten from a single still-shot to a LIVE `expo-camera`
preview: polls a frame ~every 1.2 s, runs MoveNet, draws the detected skeleton
overlay coloured by quality, and AUTO-CAPTURES once the pose passes for a couple of
frames — removing the manual retake loop. New pure module `poseQuality.ts`
(`assessPose` + skeleton edges, unit-tested); `estimateKeypoints` now also returns
source-image display coords for the overlay. No new native deps (chosen over the
vision-camera/Skia "B-full" path partly to avoid adding more libs to 16 KB-vet).
Camera flip (front/back) + manual "Capture now" override. NEEDS device testing —
overlay alignment, cadence/battery, and `poseQuality` thresholds need on-device tuning.

## Try-On verdict — partial scoring surfaced + coarse height/weight fit estimate (2026-06-29)

**Problem.** After onboarding, scanning an item could land on a dead-end "Complete
your profile" verdict with no score and no next step. Root cause: the verdict's
five criteria each need profile data to be *available*; `computeVerdict` already
scores partially (renormalising weights over the available criteria) and only
returns `overall_score: null` when ALL five are unavailable. A user who finished
onboarding with just height + weight (no styles/colours, no detailed body girths)
hit that all-unavailable wall unless the scanned item happened to carry a material
(fabric is the only profile-independent criterion).

**Changes.**
- `evaluate-item/scoring.ts` — `scoreMeasurement` now falls back to a COARSE body
  estimate when the user has no detailed girths but does have height + weight.
  `estimateGirths(h, w, gender)` models the torso as a cylinder
  (avg circumference ≈ `143·√(weight/height)`) and splits it into bust/waist/hip by
  gender-typical ratios. The criterion is marked available but **down-weighted**
  (`ESTIMATED_MEASUREMENT_WEIGHT = 0.10` vs the real `0.25`), relabelled
  "Estimated from your height and weight — approximate…", and its "may be tight"
  warnings are suppressed (false precision). `gender` is now threaded from
  `index.ts` into the verdict inputs (estimate-only; scoring stays gender-blind
  otherwise). When the item has no garment measurements, or the user has neither
  detailed girths nor height+weight, the criterion stays unavailable as before.
- Tests: added estimate-fallback cases to `scoring.test.ts` (available + down-weight
  + "Estimated" label; no estimate without both height & weight; height+weight-only
  profile yields a non-null overall score). Existing tests unaffected — they use
  empty `bodyMeasurements` or items without measurements, which never hit the new path.
- Client (UI, see `src/design/try-on/design.md`): the all-unavailable verdict empty
  state is no longer a dead end — `VerdictPanel` shows a softer prompt + a
  `COMPLETE PROFILE →` link (`ResultScreen` routes to the first missing section);
  `ScanScreen`'s pre-scan note now says the user can scan now but the read is
  approximate until they add the missing pieces.

**Deploy.** `evaluate-item` edge function must be redeployed for the scoring change
to take effect (single Supabase env → hits production). Client changes need the next
app reload/build. Tests are Deno (`deno test supabase/functions/evaluate-item/`) —
run them in CI/Deno before relying on the new path (Deno not installed locally).

## Wardrobe Critic — client (feature 010-wardrobe-critic, T020–T031/T040) (2026-07-03)

Server (`supabase/functions/wardrobe-critic/`) was already implemented + deployed in
a prior session; this session wired the CLIENT side only.

**Types + service.** `src/types/wardrobeCritic.ts` — camelCase `WardrobeGapReport` /
`GapRecommendation` / `RedundancyInsight` / `CandidateResult`, plus
`mapWardrobeGapReport()` translating the fn's snake_case contract response.
`src/services/wardrobeCriticService.ts` — `fetchGapReport()` invokes
`wardrobe-critic` with an empty body; throws `WardrobeCriticRateLimitedError` on a
429 `{error:'rate_limited'}` body (detected via `error.context` the same way
`usageCreditService.isCreditExhausted` does) or `WardrobeCriticNetworkError`
otherwise.

**Store.** `src/stores/wardrobeCriticStore.ts` — cache keyed by a sorted-id hash of
`useAppStore.wardrobeItems` (WardrobeItem has no `updatedAt`, so id membership is
the only stable client-side signal; renaming/editing a field does not change the
hash). `fetchReport(force?)` is a no-op when the hash is unchanged and a report
already exists (cache hit); `force:true` (pull-to-refresh) always refetches.
Dismissals (`dismiss(archetypeId)`) persist in `dismissedIds` and are cleared only
when the wardrobe item COUNT changes between fetches (FR-006) — tracked separately
from the hash so in-place edits don't spuriously reset them. `visibleRecommendations()`
is a plain getter (report.recommendations minus dismissed), not a memoized selector —
callers re-derive on every relevant state change. Persisted manually via
AsyncStorage (this repo has no zustand `persist` middleware; follows the
`appStore`/`fitEngineStore` save/hydrate pattern) so the last report reopens
instantly after a restart (SC-004). `hydrate()` wired into `app/_layout.tsx`'s
existing hydrate effect. Also holds the Try-On bridge breadcrumb
(`pendingGapArchetypeId`/`pendingGapLabel`, `setPendingGap`/`clearPendingGap`) —
deliberately kept OUT of `tryOnStore` to avoid touching 008's store logic.
12 jest cases in `src/stores/__tests__/wardrobeCriticStore.test.ts` (cache hit,
force refetch, hash-change refetch, 429/network error mapping, dismiss +
visibleRecommendations filtering, item-count-change dismissal reset, pending-gap
round-trip).

**Screen + entry points.** `app/wardrobe-report.tsx` (new route, registered in
`_layout.tsx`) renders per `report.mode` — `gaps` (context line + `GapCard` stack,
free tier sees rec #1 full + #2/#3 dimmed via `GapCard`'s `locked` prop, redundancy
section premium-gated), `starter` (checklist with owned checkmarks; empty-wardrobe
sub-case redirects to `/add-item`), `complete` (calm empty state, never fabricates
a recommendation per US1-AC3). Loading/429/error states handled; pull-to-refresh
calls `fetchReport(true)`. Screen is render-only — all branching logic reads store
state. `GapCard` (`src/features/wardrobe-critic/components/GapCard.tsx`) reuses
`OutfitItemThumb` (from `components/outfit/Collage.tsx`) for the sample-outfit
thumbnail row so a gap card visually matches an outfit card. Menu entry added to
`MenuSheet` in `app/(tabs)/index.tsx` ("Wardrobe report", `IconBook`). End-of-feed
entry point implemented as a `ListFooterComponent` row (NOT a new swipeable
FlatList page — the feed's `getItemLayout`/`snapToInterval` pagination is tightly
coupled to a homogeneous `Outfit[]` dataset; a footer row was the documented
"least change" alternative in tasks.md T030), shown only when
`visibleRecommendations().length > 0`; Home now also fires a background
(cache-aware, cheap) `fetchReport()` on mount so the footer can appear without the
user visiting the report screen first.

**Try-On bridge.** `GapCard`'s "TRY WHEN SHOPPING →" action (wired in
`wardrobe-report.tsx`) calls `setPendingGap(archetypeId, label)` then
`router.push('/try-on')`. `ResultScreen.tsx` reads `pendingGapArchetypeId`/
`pendingGapLabel` and — purely presentationally, no re-scoring — renders a
"Fills your gap: {label}" line above the Verdict panel when set; cleared via
`clearPendingGap()` in the same unmount effect that already calls `discard()`
(covers back/swipe-back/add). The optional `candidate_item` re-scoring extension
(tasks.md T032) was NOT implemented — out of scope for this session.

**Visual spec.** `src/design/wardrobe-report/design.md`.

**Verify.** `npx tsc --noEmit` clean; `npx jest --silent` 142/142 green (15 suites).
Two `router.push('/wardrobe-report' as any)` casts needed — expo-router's typed
routes aren't regenerated until a dev-server run touches the new file, same
pattern already used elsewhere (`profile.tsx`'s `/profile-edit` cast).
Estimate accuracy is intentionally coarse; revisit if the verdict feels off (backlog #4).

## Server bug fixes — generate-outfits / wardrobe-critic / evaluate-item (2026-07-03, audit follow-up)

Local-only fixes from the 2026-07-03 audit (section F of `backlog.md`); NOT deployed
this session (anh Khôi reviews server-side edge fn changes separately).

- **`generate-outfits/index.ts` + `wardrobe-critic/index.ts` — unchecked `wardrobeRes.error`.**
  Both fetched `clothing_items` without checking `.error`; a transient DB error fell
  through `(wardrobeRes.data ?? [])` and was indistinguishable from a genuinely empty
  wardrobe, so a user with a full wardrobe would see the empty/starter state instead of
  an error. Both now check `wardrobeRes.error` immediately after the fetch and return a
  500 (`{error: 'Failed to load wardrobe'}`) before falling into the empty-wardrobe path.
- **`wardrobe-critic/index.ts` Try-On bridge — `unlock_count` computed on the wrong pool.**
  The bridge ran `unlockCountFor` against the FULL wardrobe (`wardrobeRows.map(toFitItem)`),
  while `analyzeWardrobe` (the main gaps/recommendations path) always runs it against
  `styleFilter(fitItems, selectedStyles)` — the same style-eligible pool the feed itself
  uses. Exported `styleFilter` from `analyze.ts` and applied it in `index.ts` before the
  bridge's `unlockCountFor` call, so the Try-On bridge count now matches "same bar as
  feed" like the rest of the report.
- **`evaluate-item/scoring.ts:194` — `!item.colorProfile.hue` misread `hue === 0` (valid red)
  as missing data.** Changed to `typeof item.colorProfile.hue !== 'number'`.
- **`generate-outfits/index.ts` — unbounded saved/worn interactions query.** The taste-vector
  positives query had no limit while the sibling impressions query already capped at 300;
  added the same `.order('created_at', {ascending:false}).limit(300)` so the payload
  doesn't grow unbounded with account age.
- **`wardrobe-critic` full-pipeline-per-archetype perf (deferred, NOT fixed).** See
  `backlog.md` section F "Perf" — investigated sharing the enriched candidate list across
  the ~16 archetype simulations, but `generateCandidates`/`generateHeroCandidates` consume
  a single seeded `mulberry32` RNG stream whose draw count/order depends on the exact item
  set (color-family pool membership, `shuffle()` lengths, etc.). Adding one hypothetical
  item shifts the RNG sequence for every subsequent draw, so candidates that look
  "unrelated to the new item" are not guaranteed byte-identical to the baseline run —
  reusing cached scores would risk silently changing which outfit variant/accessory a
  candidate resolves to, and therefore the feed's actual ranking. Left unfixed rather than
  risk a correctness regression in exchange for perf; needs a deliberate RNG-stream
  redesign (e.g. per-archetype-branch sub-seeds) before it can be shared safely.

Verify: `deno test supabase/functions/wardrobe-critic/` 9/9 green; `deno test
supabase/functions/generate-outfits/` 114/114 green; `deno test
supabase/functions/evaluate-item/` 20/21 green (1 pre-existing failure — "a perfect-fit
item scores higher composite than a mismatched-fit item" — unrelated to this session's
fix, reproduced with the fix reverted too; see backlog). `deno check` clean on all three
edited `index.ts` files.

## Body shape estimated alongside measurements + persisted to DB (2026-07-05)

Request: khi estimate body measurements thì estimate cả body shape.

- **`app/measurements-edit.tsx`** (the post-onboarding "Size & measurements" screen, where
  "Re-estimate with AI" lives) previously never computed, displayed, or saved body shape.
  Now derives it live from chest/waist/hips via the existing `computeBodyShape()` rule
  (types/measurements.ts) — so both hand-typed and AI-scan-pre-filled numbers produce a
  shape — shows the same BODY SHAPE badge as onboarding, and includes `bodyShape` in the
  `setBodyMeasurements()` save.
- **Persistence bug fixed:** the live DB (verified via information_schema) has a
  `body_shape` column since migration 20260608000002, but `measurementService.ts` never
  mapped it — the shape computed during onboarding was silently dropped on save and never
  hydrated back (try-on's `measurements?.bodyShape` only worked in-session). Added
  `body_shape` to `MeasurementRow`, `rowToBody()`, `bodyToRow()`; added `bodyShape?` to
  the fitEngine `BodyMeasurements` type (re-exported `BodyShape` from types/measurements).
- **`app/(onboarding)/measurements.tsx`:** applying a scan estimate now clears
  `bodyShapeOverride`, so a previously saved shape can't shadow the shape derived from the
  fresh estimate.
- Shape stays a **derived** value (from bust/waist/hip) rather than a second estimator
  output — guarantees badge/save always match the numbers the user actually confirms.

Verify: `npx tsc --noEmit` clean; jest measurements + fitEngineStore suites 44/44 green.

## evaluate-item body-shape bug fix — delta misused as multiplier (2026-07-05)

While answering "body shape chiếm bao nhiêu trọng số?": `evaluate-item/scoring.ts` still
used `bodyShapeMultiplier` under its OLD semantics (`raw * mult`, comment claimed
[0.85, 1.15]), but the 2026-07-03 engine fix changed the function to return an additive
DELTA in [-0.10, +0.10]. Result: whenever the profile has `body_shape`, the fit criterion
collapsed to ~0 regardless of the item (raw × 0.07, or negative). This was ALSO the cause
of the "pre-existing" failing test noted on 2026-07-03 ("a perfect-fit item scores higher
composite than a mismatched-fit item" — fixture has body_shape: 'rectangle', both items'
fit scores collapsed → identical composites). Dormant in prod until now because
body_shape was never persisted (see 2026-07-05 entry above) — the persistence fix would
have armed it.

Fix: `raw = clamp01(raw + delta)`; stand-alone (no preferredFit) case centers on
`0.5 + delta`. Deno tests now 21/21 (previously 20/21). Deployed `evaluate-item` via CLI.

## Body shape: user-editable override (auto-derived default) (2026-07-06)

Decision (anh Khôi): shape is derived from measurements/pose-scan (never self-declared as
the primary input — per research, self-reported shape is unreliable), but the user can
override it manually.

- `useMeasurements`: override initialization fixed — a saved shape now counts as a manual
  override ONLY if it differs from what the saved measurements derive. Previously the
  override was pinned on every load, so editing bust/waist/hip never re-derived the shape.
- `app/measurements-edit.tsx`: new BODY SHAPE section — Tag row `AUTO · <derived>` + 5
  shapes; manual pick saves as override, AUTO saves the derived value; `dirty` accounts
  for override changes; applying a fresh scan estimate resets to AUTO.
- `app/(onboarding)/measurements.tsx`: same Tag row under the existing badge.
- UI spec: `src/design/measurements/design.md`.

Verify: `npx tsc --noEmit` clean; jest measurements suites 38/38.

## Body-shape weighting theo research report — implemented (2026-07-06)

Anh Khôi duyệt đề xuất trong `docs/research/body-shape-importance-FINAL.md`. Thay đổi:

- **`engine/scoring.ts`**: thêm `FIT_SPECIFICITY` (slim 1.0 / regular 0.7 / relaxed 0.4 /
  wide 0.25 / oversized 0.15) và `bodyShapeAdjustment(items, shape)` =
  `bodyShapeMultiplier` (rule thô ±0.10, GIỮ NGUYÊN + tests cũ vẫn valid) × `SHAPE_GAIN
  3.2` × mean-specificity của items (bỏ accessory), clamp ±`SHAPE_ADJ_MAX 0.32`.
  Đây là conditioning theo ViBE (CVPR 2020, Fig. 8): shape chỉ đáng kể với đồ fitted/
  body-specific, ≈0 với đồ oversized/loose.
- **`scoreOutfitFit`** dùng `bodyShapeAdjustment` → ảnh hưởng composite tối đa
  0.32 × fit-weight 0.10 ≈ **±3 điểm/100** (band mục tiêu 2–4; trước: ±1).
- **`evaluate-item/scoring.ts`** dùng `bodyShapeAdjustment([item])` → tối đa
  0.32 × fit-weight 0.25 = **±8 điểm/100** (band 5–8; trước: ±2.5); item oversized chỉ
  ~±1.2. Trần luôn dưới measurement-match (±9.5 / ±25) đúng ràng buộc của report.
- Copy rationale đã rà: không có ngôn ngữ "corrective" (rule đã ghi ở
  `src/design/measurements/design.md`).

Verify: deno test generate-outfits 117/117 (3 test mới cho bodyShapeAdjustment:
clamp ±0.32, fitted-mismatch > loose-mismatch, amplify trên fitted look);
evaluate-item 21/21. Deployed cả 3 fn: generate-outfits, evaluate-item, wardrobe-critic.
Lưu ý: `deno check evaluate-item/index.ts` fail TẠI note.ts:39 (null vs undefined
`pattern`) — pre-existing từ WIP phiên khác, không thuộc thay đổi này (đã xác nhận
bằng stash-check), không chặn deploy.

## Measurement scan — hands-free capture legible từ xa + hẹn giờ 10s (2026-07-06)

Vấn đề anh Khôi báo: tự scan bằng cam trước phải đứng xa 2-3m, không đọc được pill hint
nhỏ, không biết auto-capture tồn tại → đi lại gần bấm "Capture now" thì hỏng frame.

- Viền màn hình đổi màu theo trạng thái pose (xanh = đạt, cam = cần chỉnh) — thấy được từ xa.
- Số đếm ngược KHỔNG LỒ (serif 148pt) giữa màn hình khi pose đạt: `goodFramesToCapture`
  2→3 (~3.6s) để hiện 2…1 trước khi tự chụp.
- Nút HẸN GIỜ 10S: bấm gần máy → lùi ra → hết giờ tự chụp frame pose mới nhất (không có
  pose nào → phase 'error'). Đếm bằng ref, không side-effect trong state updater.
- Hint pill 12→15pt; liveIntro (en+vi) nói rõ máy TỰ chụp + gợi ý hẹn giờ.
- `assessPose` trả thêm `present` (số keypoint đạt minScore); __DEV__ hiển thị dòng chẩn
  đoán `kp X/7 · fill Y` để debug vụ "luôn cannot detect" trên thiết bị thật.

Verify: tsc clean, jest measurements 38/38. LƯU Ý: cần thử trên thiết bị thật — backlog B
vốn đã ghi EXIF fix + MoveNet dtype CHƯA verify trên device; nếu máy anh Khôi "luôn
cannot detect" thì khả năng root cause nằm ở đó, dòng debug mới sẽ chỉ ra gate nào fail.

## Scan "cannot detect" dù skeleton vẫn vẽ — hint show_feet + missing diagnostics (2026-07-06)

anh Khôi test trên iPhone 17: skeleton vẽ lên người bình thường nhưng luôn báo không
detect. Chẩn đoán: vẽ skeleton chỉ cần từng cặp keypoint đủ điểm; còn gate chụp đòi CẢ
7 mốc bắt buộc (mũi, 2 vai, 2 hông, 2 CỔ CHÂN) + fill ≥0.55 + đứng thẳng. Ca selfie
kinh điển: thân trên detect tốt nhưng bàn chân bị crop / cổ chân điểm thấp → fail mãi
với hint chung chung.

- `assessPose`: trả thêm `missing: string[]`; nếu mốc thiếu CHỈ là cổ chân → hint mới
  `show_feet` ("Đưa cả bàn chân vào khung — lùi lại hoặc nghiêng máy xuống") thay vì
  "move_into_frame" chung chung. i18n en+vi. Tests 40/40 (2 test mới).
- Dòng debug __DEV__ giờ liệt kê đích danh mốc thiếu: `kp 5/7 · missing leftAnkle,rightAnkle · fill 0.00`.
- Cần anh Khôi chạy lại dev build trên iPhone và đọc dòng debug để chốt root cause
  (nghi ngờ chính: chân ngoài khung hoặc fill < 0.55 do đứng xa).

## Measurement scan v2 — silhouette segmentation cho bề rộng thật (2026-07-06)

Yêu cầu anh Khôi sau ca "shoulder 33cm / người 1m76-76kg": dùng ML đo chính xác hơn.
Root cause: mọi bề rộng suy từ KHOẢNG CÁCH KHỚP XƯƠNG (nằm trong đường viền cơ thể) —
vai keypoint hẹp hơn vai may đo ~25%, eo thì không có keypoint, phải blend vai+hông.

Giải pháp: model on-device thứ 2 — MediaPipe Selfie Segmenter (float16, ~250KB,
`assets/models/selfie-segmenter.tflite`), fusion với pose:
- `silhouetteMath.ts` (pure, jest-tested): `runWidthAt` đo BỀ RỘNG RUN CHỨA CENTERLINE
  (loại cánh tay tách rời khỏi bề rộng thân); `bandExtremeWidth` quét dải; `extractWidths`
  đặt dải theo keypoint: shoulder = row rộng nhất quanh đường vai, chest = row ở 25% span
  vai→hông, waist = row HẸP NHẤT dải 45-85% (đúng định nghĩa natural waist), hip = row
  RỘNG NHẤT dải mông. Hằng số trong `S` — CALIBRATION-PENDING.
- `silhouette.ts`: inference (letterbox 256 cùng convention với poseEstimate nên
  normalized coords dùng chung được); fail bất kỳ → null → fallback heuristic cũ.
- `landmarksToMeasurements`: `EstimateInputs.silhouette` — contour widths THAY THẾ
  heuristic per-field (shoulder × `contourShoulderInset 0.96` vì vai may đo nằm trong
  viền delta; hip contour bỏ hệ số 1.06 vì đã là viền ngoài). Ellipse depth model giữ nguyên.
- `measurements-scan.tsx`: giữ lại đúng 1 frame mới nhất CÓ pose (frame không pose xoá
  ngay), finish() chạy segmentation trên frame đó rồi xoá — privacy contract cập nhật
  trong header. Copy hướng dẫn (en+vi) thêm "tay dang nhẹ khỏi người" (A-pose) vì tay
  ép sát thân sẽ dính vào run của eo.

Verify: tsc clean; jest measurements 50/50 (10 test mới: silhouetteMath synthetic masks
+ 3 test silhouette-override trong landmarksToMeasurements). PHẢI test trên thiết bị
thật: chất lượng mask ở 2-3m, arms-merged case, và calibrate S/contourShoulderInset vs
thước dây (anh Khôi sẽ gửi số thật).

## Personal color — result-first camera flow + sturdier detection (2026-07-06)

Phản hồi từ anh Khôi: sau khi scan xong, RESULT phải hiện NGAY — 4 câu hỏi chỉ nên là
tinh chỉnh phụ, không bắt user đi qua hết. Detection cũ cũng thô (average cả ảnh rồi
so nearest-1-swatch, không phân biệt da/nền/highlight).

**Flow đổi (camera path):** `intro → wrist-scan → hair-scan → [skin? nếu wrist-scan
không detect được] → [hair? nếu hair-scan không detect được] → result`. Không còn 4
câu hỏi bắt buộc sau khi scan — result screen giờ có sẵn 2 khối:
- **YOUR ANSWERS / DETECTED FROM YOUR SCAN**: skin undertone (3 chip) + hair colour
  (8 chip nhỏ), editable ngay tại chỗ, tag "AUTO" khi lấy từ ảnh, caption "Low light?
  double-check this one." khi detection tự báo confident=false.
- **REFINE — OPTIONAL**: eye colour (4 chip) + metal (3 chip) — hoàn toàn optional,
  chỉ tinh chỉnh season nếu user muốn.
Season được tính LẠI SỐNG (`useMemo`) mỗi khi đổi bất kỳ câu trả lời nào trên result
screen — không còn tính 1 lần rồi đóng băng ở `next()`.
Manual path (không camera) giữ nguyên: `intro → skin → hair → eye → metal → result`,
4 câu hỏi tuần tự như cũ, dots hiện như cũ. Dots CHỈ hiện ở manual path — camera-path
fallback questions (nếu có) không hiện dots.

**Detection nâng cấp** (`src/features/personal-color/colorMath.ts` — file mới, pure,
jest-tested):
- Wrist → skin undertone: lọc pixel theo skin-gamut LAB (`isSkinPixelLab`, generous,
  CALIBRATION-PENDING) thay vì trung bình cả ảnh; nếu ≥30 pixel da, phân loại undertone
  bằng HUE ANGLE trên mặt phẳng a/b (`classifyUndertone`, ngưỡng 47°/57°,
  CALIBRATION-PENDING) thay vì nearest-1-swatch; nếu <30 pixel da (khung/ánh sáng xấu)
  → fallback về hành vi cũ (nearest SKIN_OPTIONS trên mặt phẳng a/b, average thô,
  confident=false).
- Hair → cluster trên 40% pixel TỐI NHẤT (`darkestFraction`) vì UI đã hướng dẫn cầm
  tóc trước nền sáng, nên tóc chính là cụm tối; nearest swatch full-LAB
  (`nearestSwatch`) kèm confidence margin (1 − d1/d2, cao = rõ ràng).
- Confidence flags (`skinConfident`/`hairConfident`) mới trong hook — mặc định true,
  false khi detection tự báo yếu; reset về true khi user chọn tay (chọn tay = không
  cần double-check nữa).

**Partial scoring**: `PersonalColorAnswers.hairKey/eyeKey/metalKey` giờ optional (chỉ
`skinUndertone` bắt buộc); `scorePersonalColor` bỏ qua scoring function của câu trả
lời còn thiếu thay vì crash/NaN. Hook's derived `result` vẫn đòi cả skin lẫn hair mới
tính (đúng luồng: hair luôn được điền — auto hoặc qua câu hỏi bù — trước khi tới step
`result`), nhưng hàm `scorePersonalColor` tự nó hỗ trợ skin-only cho test/API dùng lại.

`usePersonalColorDetection.ts` đổi sang step-graph động (không còn mảng CAMERA_STEPS
cố định) — thêm `history: DetectionStep[]` (stack các step đã qua) để `back()` retrace
đúng nhánh fallback thay vì cần mảng tĩnh biết trước toàn bộ path.

Ngưỡng hue 47°/57° và skin gamut LAB đều là **CALIBRATION-PENDING** — ước lượng từ vài
mẫu tham chiếu, chưa test với ảnh wrist thật. Xem mục backlog tương ứng.

Verify: `tsc --noEmit` sạch; `jest src/features/personal-color` 14/14 mới (colorMath +
colorSeasonData, không import analyzePhoto/hook vì có native deps); `jest
src/features/measurements` vẫn 50/50 (không đổi gì ngoài phạm vi personal-color).

## Engine — tone12 quality bonus trong color scoring (2026-07-06)

`profiles.color_tone12` (12-tone: light_/true_/bright_/soft_/deep_ + season) refines
the existing 4-way `color_season` với một trục QUALITY độc lập với undertone. Palette
12-tone vốn đã chảy vào `colorPreferences` từ trước (personal_palette); cái mới ở đây
là engine tự đọc `color_tone12` để áp thêm một bonus riêng cho "chất màu" (sáng/tối/
rực/trầm) — thứ mà undertone-based `seasonCompatibilityBonus` không cover.

**tone12 fetch ở 3 function**: `generate-outfits/index.ts`, `evaluate-item/index.ts`,
`wardrobe-critic/index.ts` đều thêm `color_tone12` vào `profiles` select, lowercase +
`|| undefined`, và truyền xuống `EngineContext.colorTone12` (generate-outfits,
wardrobe-critic) hoặc `ProfileInputs.colorTone12` (evaluate-item, qua scoring.ts).

**`tone12QualityBonus(profiles, tone12)`** (generate-outfits/engine/scoring.ts) — parse
prefix trước dấu `_` đầu tiên: `light`/`deep`/`bright`/`soft` thưởng/phạt theo `lum`
(light/deep) hoặc `sat` (bright/soft) của item, normalize về [-1,1] rồi trung bình các
item giống `weatherSeasonColorBonus` (khác: KHÔNG lọc bỏ item neutral-undertone — đen/
trắng vẫn đọc rõ deep/light bất kể undertone). `true_*` và prefix lạ → 0 (undertone đã
được `seasonCompatibilityBonus` xử lý riêng). Biên độ `TONE12_QUALITY_MAX = 0.08` —
CALIBRATION-PENDING, cố tình bằng `WEATHER_COLOR_MAX` (weatherSeasonColorBonus) và dưới
`seasonCompatibilityBonus` (±0.10) để giữ `weatherSeasonColorBonus` đúng vai "seasonal
lens" phía server (weather-driven), còn tone12 là "user quality lens" (profile-driven)
— cả hai bonus phụ đều nhỏ hơn tín hiệu palette chính.

`scoreColorHarmony` thêm param `colorTone12?: string` Ở CUỐI CÙNG (sau `formula`) —
không chèn giữa vì `formula` đã được gọi positional ở nhiều test (formula-contracts.test.ts,
season-color.test.ts) nên chèn giữa sẽ âm thầm làm sai nghĩa các lời gọi đó.
`ranking.ts` truyền `ctx.colorTone12`; `evaluate-item/scoring.ts` truyền
`profile.colorTone12` (formula để `undefined`).

Curator prompt (generate-outfits/index.ts) nối tone12 vào dòng personal-color khi có:
`Personal color season: autumn (12-tone: deep_autumn; undertone: warm).` — giữ nguyên
format cũ khi không có tone12.

Tests mới (`season-color.test.ts`): bright_winter > soft_summer trên item bão hòa;
light_spring > deep_autumn trên item sáng, đảo ngược trên item tối; `true_*` = no-op
(bonus 0, khớp hệt điểm không-tone12); prefix lạ/rỗng cũng no-op; magnitude luôn nằm
trong ±0.08.

Verify: `deno test supabase/functions/generate-outfits/` 122/122 (117 cũ + 5 mới);
`deno test supabase/functions/evaluate-item/` 21/21; `deno test
supabase/functions/wardrobe-critic/` 9/9. Deploy cả 3 function (generate-outfits,
evaluate-item, wardrobe-critic) qua `npx supabase functions deploy <name>`, không
`--no-verify-jwt`.

Lưu ý ngoài phạm vi: `deno check supabase/functions/evaluate-item/index.ts` báo 1 lỗi
type tiền-tồn tại (không do đổi lần này) — `note.ts`'s `buildNoteContext` khai báo
`pattern?: string` nhưng `ClothingItemRow.pattern` là `string | null | undefined`; xác
nhận bằng `git stash` (lỗi biến mất khi bỏ hết đổi của session, tức thuộc code AI-fit-note
đã có sẵn trước task này). Không chặn `deno test` (không type-check) hay
`supabase functions deploy` (không hard-fail). Ghi backlog để fix riêng.

## Measured-hex color layer + vocabulary +11 (2026-07-06)

Hai việc gộp chung một phiên: (1) mở rộng vocabulary `PrimaryColor` +11 màu (kích hoạt
entry chết trong `SEASON_FLATTERING`/`TONE12_AVOID`), (2) thêm tầng đo màu chủ đạo bằng
pixel thật (`primary_hex`/`secondary_hex`) thay vì chỉ dựa vào tên màu do Gemini gán.

**Migration**: `20260706000002_add_color_hex.sql` — `clothing_items.primary_hex` +
`secondary_hex` (`text`, check `^#[0-9A-Fa-f]{6}$`). Cột đã tồn tại LIVE (anh Khôi tự apply
trước) — verify bằng `information_schema.columns` qua Supabase MCP; KHÔNG chạy
`supabase db push` (dự án này có schema drift đã biết — xem memory `project_schema_drift`
— push mù có thể đụng migration khác đã áp bằng tay ngoài thứ tự).

**Vocabulary +11**: `PrimaryColor` (`generate-outfits/engine/types.ts`) thêm `mustard, rust,
coral, mint, lavender, sage, terracotta, mauve, wine, fuchsia, denim`. `COLOR_MAP`
(`enrichment.ts`) — 5 tên đã tồn tại (`Mustard/Rust/Terracotta/Wine/Sage`) trước đây collapse
vào bucket khác (`yellow/orange/orange/burgundy/green`) giờ trỏ về đúng primaryColor riêng
với hue/sat/lum theo canonical table (comment trong `types.ts`); 6 tên mới (`Coral, Mint,
Lavender, Mauve, Fuchsia, Denim`) là entry hoàn toàn mới. Không có `Record<PrimaryColor, …>`
exhaustive nào trong engine (`palette()` trong `filtering.ts` và `COLOR_FORMALITY_SHIFT` đều
`Partial`) nên không cần điền thêm gì để compile sạch — verify bằng `deno check`.

`SEASON_FLATTERING.avoid` (scoring.ts) đã sẵn có `mustard/rust` (summer) và `fuchsia`
(autumn/fall) từ trước — dead code vì union chưa có các tên này; giờ tự fire, không cần sửa
gì thêm (đã backlog đánh dấu `[x]`). `TONE12_AVOID` (scoring.ts, engine) được bổ sung để khớp
đúng bản client đã curate sẵn (`src/features/personal-color/tone12.ts`):
`light_summer`/`true_summer` +`rust,mustard`; `soft_summer` +`rust,fuchsia`;
`soft_autumn`/`true_autumn`/`deep_autumn` +`fuchsia`; `bright_winter`/`true_winter`/
`deep_winter` +`mustard`. Client `tone12.ts`: `ENGINE_PRIMARY_COLORS` +11 tên (data
`TONE12_AVOID_RAW` đã có sẵn rust/mustard/fuchsia từ trước, chỉ bị filter rớt vì set cũ chưa
biết tên — giờ pass through); sửa nốt lỗi chính tả `'grey'` → `'gray'` ở `deep_autumn`.

Gemini extraction enum (`generate-item-image/prompt.ts` `COLORS`) thêm 6 tên mới (Coral,
Mint, Lavender, Mauve, Fuchsia, Denim) — 5 tên còn lại đã có sẵn trong enum trước đó.

**colorCluster.ts (mới, `generate-outfits/engine/`)** — `dominantHexes(pixels, width,
height, opts?)`: thuần, không I/O, unit-test được với mảng RGBA giả. Sample tối đa ~4000px,
loại pixel nền/bóng (alpha<200, gần trắng min>238, gần đen max<18), quantize 16 bucket/kênh
→ histogram → trung bình pixel thật trong ngưỡng ΔRGB≤32 quanh bucket đông nhất = primary;
lặp lại trên phần còn lại cho secondary (chỉ báo nếu cụm ≥15% sample giữ lại). <50 sample →
cả hai null. Mọi ngưỡng đánh dấu CALIBRATION-PENDING. 6 test Deno
(`colorCluster.test.ts`): navy đặc → primary đúng/secondary null; 70/30 hai màu → cả hai
đúng theo tỉ lệ; toàn trắng/toàn trong suốt → null; cụm phụ <15% bị bỏ; ảnh 0×0 không throw.

**Hook vào `generate-item-image/index.ts` (ADDITIVE — tôn trọng WIP timeout-fix chưa commit
của phiên khác, chỉ thêm code, không sửa/gỡ gì có sẵn)**: sau `keyChroma()` (ảnh isolated
CUỐI CÙNG, đã key nền khi có thể), decode lại bằng `imagescript` (đã import sẵn trong file)
rồi gọi `dominantHexes` → gắn `primary_hex`/`secondary_hex` vào object `metadata` trả về
(field mới, optional, trong `GarmentMetadata` ở `prompt.ts`). Bọc try/catch riêng — lỗi
decode không làm hỏng cả request, chỉ để hex null.

Về "extract-by-item" (feature 007): đã verify đây là on-device (native module
`expo-item-extract`, KHÔNG gọi `generate-item-image`/Gemini) — không có hook Deno nào để
gắn `colorCluster` vào; item tạo qua đường này chỉ có hex khi `backfill-item-metadata` chạy
qua sau (đọc lại ảnh đã lưu, không quan tâm nguồn gốc ingest).

**Quan trọng — generate-item-image KHÔNG tự ghi `clothing_items`** (client
`wardrobeService.addItem()` mới là nơi insert, sau khi review). Theo đúng precedent đã có sẵn
cho `print_scale`/`drape`/`visual_interest`/`can_layer` (cũng được server trả về trong
metadata nhưng `useAddWizard.toExtractedItem`/`AddItemInput` KHÔNG map — chỉ tự có sau khi
backfill chạy), item mới thêm qua AI method sẽ CHƯA có hex ngay lúc lưu, chỉ có sau backfill.
Đã ghi backlog mục A để anh Khôi quyết có muốn thread `metadata.primary_hex/secondary_hex`
(và tiện thể 4 field kia) qua `useAddWizard`/`AddItemInput` luôn không.

**`backfill-item-metadata`** — thêm `primary_hex`/`secondary_hex` vào `ItemRow`/`SELECT_COLS`
và `.or(...)` filter (item chỉ thiếu hex — mọi field khác đã đầy — giờ vẫn được chọn quét).
`processItem` tách `needsGemini` (đúng như cũ, chỉ gọi Gemini khi ≥1 cột Gemini-derived còn
NULL) khỏi pass đo hex (thuần pixel, KHÔNG cần Gemini — chạy độc lập bất cứ khi nào 1 trong 2
cột hex còn NULL, kể cả khi Gemini detect ra 0 kết quả). `dry_run` semantics giữ nguyên.
CHƯA CHẠY trên prod — cần `BACKFILL_ADMIN_SECRET` (chỉ anh Khôi có), `dry_run: true` trước
(xem backlog mục A).

**Engine tiêu thụ hex** — `ClothingItemRow`/`FitItem` (types.ts) không đổi field mới ngoài
`primary_hex?`/`secondary_hex?` trên `ClothingItemRow`. `enrichment.ts`:
- `hexToHsl(hex)` — RGB→HSL chuẩn, hue 0-360, sat/lum 0-100 (cùng scale `ColorEntry`/
  `DB_COLORS`).
- `undertoneFromHue(hue)` — heuristic hue-band CALIBRATION-PENDING: `[330,360)∪[0,70)` warm,
  `[70,170)` neutral, `[170,330)` cool — chỉ dùng làm fallback khi không có tên COLOR_MAP
  khớp (không re-derive các ngoại lệ đã curate tay như Olive warm/Sage neutral/Forest cool).
- `colorProfileOf(colorName)` — nếu input khớp regex hex (`^#[0-9A-Fa-f]{6}$`) thì tính
  hue/sat/lum ĐO ĐƯỢC + tìm tên COLOR_MAP gần nhất (`nearestNamedColor`, khoảng cách có trọng
  số ưu tiên hue) để gán `primaryColor`/`colorLightness`/`colorSaturation`. Sửa một gap có sẵn
  từ trước: `colorPreferences` (generate-outfits/evaluate-item/wardrobe-critic index.ts) merge
  `style_profiles.color_preferences` (tên màu) với `profiles.personal_palette` (HEX từ
  `TONE12_PALETTES` — xem `tone12.ts`) rồi gọi thẳng `colorProfileOf()` trên cả hai loại; hex
  trước đây fail lookup âm thầm và rơi về default `natural`/neutral — giờ nearest-match đúng
  tên (bao gồm cả 11 tên mới).
- `toFitItem`: khi `item.primary_hex` hợp lệ → ghi đè `hue/sat/lum/undertone/colorLightness/
  colorSaturation` của `colorProfile` bằng giá trị ĐO ĐƯỢC (không phải giá trị coarse theo
  tên); `primaryColor` GIỮ NGUYÊN từ `color` (avoid-list/style palette vẫn match theo tên,
  không theo hue đo được) — không có primary_hex hợp lệ thì đi nguyên path cũ, byte-for-byte.

**Client (minimal, đúng section 6 — chỉ read-mapping, KHÔNG đổi UI)**: `WardrobeItem`
(`src/types/fitEngine.ts`) thêm `primaryHex: string | null; secondaryHex: string | null`
(required, không optional — không có literal `WardrobeItem` nào khác ngoài `rowToItem` nên an
toàn). `wardrobeService.ts`: `ClothingItemRow` (interface nội bộ) + `rowToItem()` map 2 cột
mới qua (`.select('*')` sẵn lấy hết, không cần đổi query). KHÔNG đổi `AddItemInput`/insert
(xem backlog mục A về gap ingest-time).

**Verify**: `deno test supabase/functions/generate-outfits/` 132/132 (126 cũ + 6
`colorCluster.test.ts` mới); `deno test supabase/functions/evaluate-item/` 21/21; `deno test
supabase/functions/wardrobe-critic/` 9/9; `deno check` sạch trên mọi file đã sửa (2 lỗi
type-check tiền-tồn tại KHÔNG do phiên này — 3 lỗi `MinimalClient` trong
`generate-item-image/index.ts` xác nhận có từ WIP timeout-fix của phiên khác qua `git stash`
so sánh committed-vs-WIP, và 1 lỗi `pattern` trong `evaluate-item/note.ts` đã backlog từ
phiên tone12 trước — không chặn `deno test`/deploy). `npx tsc --noEmit` sạch toàn repo. `npx
jest` 193/193 xanh.

**Deploy**: `npx supabase functions deploy` cho `generate-outfits`, `evaluate-item`,
`wardrobe-critic`, `generate-item-image`, `backfill-item-metadata` — không `--no-verify-jwt`.
Deploy `generate-item-image` NGHĨA LÀ ship luôn fix timeout Gemini (uncommitted, phiên khác,
đã xong trước khi phiên này bắt đầu) — CHỦ ĐÍCH, không tách riêng được vì cùng file.

**Backfill CHƯA chạy trên prod** — chờ anh Khôi chạy `backfill-item-metadata` với
`BACKFILL_ADMIN_SECRET`, `dry_run: true` trước, để điền `primary_hex`/`secondary_hex` (và
metadata còn thiếu) cho ~70 item cũ (xem backlog mục A).

### Follow-up cùng ngày — hex NGAY LÚC INGEST cho mọi đường add (client-only)

Yêu cầu gốc "khi user extract by item thì cũng có thể có được colour" — bản đầu chỉ có hex
qua backfill; follow-up này đưa hex vào NGAY lúc lưu item, cho CẢ BA đường ingest.
Client-only, không deploy lại edge function nào.

**Client port của colorCluster**: `src/features/wardrobe-add/colorCluster.ts` — port
TypeScript thuần của bản Deno (CÙNG thuật toán/ngưỡng, duplicate có chủ đích như
TONE12_AVOID — hai bên không import được của nhau, sync tay; cả 2 file đều có header note
trỏ sang nhau). Không import native/Expo → jest test được. Wrapper
`src/features/wardrobe-add/colorClusterUri.ts` (file riêng để phần pure sạch Jest):
`dominantHexesFromUri(uri)` — expo-image-manipulator downscale 64px (giữ aspect) → base64
JPEG → jpeg-js decode (copy pattern decode của `analyzePhoto.ts`) → `dominantHexes`. JPEG
không có alpha nên nền transparent bị flatten thành fill đặc — filter near-white/near-black
trong thuật toán là thứ loại nó (cùng lý do bản server sống được với ảnh nền trắng chưa
key). Không bao giờ throw — mọi lỗi resolve về nulls, add không bao giờ bị chặn. Jest
`src/features/wardrobe-add/__tests__/colorCluster.test.ts` — 6 case synthetic-pixel port
nguyên từ suite Deno (hai bản phải cùng pass cùng case).

**Đường 1 — extract-by-item (on-device, 007)**: `extractByItemService.extractItemOnDevice`
gọi `dominantHexesFromUri(res.cutoutUri)` trên cut-out transparent → gắn
`primaryHex`/`secondaryHex` vào metadata trả về.

**Đường 2 — AI add-wizard**: `imageGenerationService` — `RawMetadata` +`primary_hex`/
`secondary_hex`, `GarmentMetadata` (client) +`primaryHex?`/`secondaryHex?` (optional để các
literal cũ — try-on fixtures — không vỡ), `toDomain` map qua. `ExtractedItem`
(wardrobe-add/types.ts) +2 field; `useAddWizard.toExtractedItem` map; `confirm()` đưa vào
`AddItemInput`.

**Hex-hygiene cho ảnh AI `keyed:false`** (phát hiện khi làm follow-up): server tính hex trên
ảnh keyed CUỐI — khi key THẤT BẠI thì nền chroma magenta/green vẫn nằm trong pixel và có
thể thắng histogram → hex server không tin được. `useAddWizard.refineAiCutout` (và nhánh
tương ứng trong `tryOnStore.scan`): `keyed:false` + refine on-device thành công → tính lại
hex từ cut-out mới; refine không được (Expo Go/lỗi) → null hex ra (backfill điền sau).
`keyed:true` → tin hex server nguyên vẹn.

**Đường 3 — Try-On addToWardrobe**: metadata scan đã mang hex (đường AI + hygiene trên);
`addToWardrobe` map `meta.primaryHex/secondaryHex` vào `AddItemInput`; `pinWardrobeItem`
carry hex đã lưu của item qua metadata cho consumer downstream.

**Insert**: `AddItemInput` +`primaryHex?`/`secondaryHex?`; `wardrobeService.addItem` ghi
`primary_hex`/`secondary_hex` (null khi thiếu — check constraint DB chỉ nhận `#RRGGBB` hoặc
NULL, giá trị từ `toHex` luôn hợp lệ). `UpdateItemInput` KHÔNG đổi — edit không bao giờ ghi
lại hex đo được; `app/item-edit.tsx` `toEditable` carry hex read-only (toPatch bỏ qua).

Verify follow-up: `npx tsc --noEmit` sạch; `npx jest` 199/199 (20 suite — 193 cũ + 6
colorCluster client mới). Precedent gap của `print_scale`/`drape`/`visual_interest` (server
trả mà ingest không map) GIỮ NGUYÊN không đụng — backlog mục A ghi lại câu hỏi phạm vi đó.

## Measurement accuracy — multi-frame median aggregation (2026-07-06)

Variance-reduction-only improvement to the on-device body-scan pipeline (no bias
shift): a single polled frame carries whatever detector jitter/micro-sway happened
on that tick; taking the MEDIAN across several independent good-pose frames cancels
that noise without moving the expected value (median of samples centered on the
true pose still centers on the true pose — it just narrows the spread). Median (not
mean) chosen specifically so one bad frame can't drag the result.

**New pure module `src/features/measurements/aggregateFrames.ts`** (no native/Expo
imports, jest-testable): `medianKeypoints(frames)` — per-name, per-axis (x/y/score)
median over the frames where that keypoint clears `minScore` (default 0.3); a
keypoint that never clears the threshold falls back to the median over ALL frames
(never dropped). `medianWidths(widths)` — per-field (`shoulderU/chestU/waistU/hipU`)
median over the non-null present values; a field absent everywhere is omitted.
`scaleAgreement(frames)` — coefficient of variation (stddev/mean) of each frame's
nose→avg-ankle vertical span; an HONEST measurement-STABILITY signal, distinct from
the existing per-frame `confidence` (min keypoint score), which only reflects
detector certainty, not whether repeated frames agree on the same scale. Returns 0
for <2 frames. `rejectOutlierFrames(frames, maxCV=0.08)` — drops frames whose span
deviates >maxCV (relative) from the median span, always keeping at least the
closest-to-median frame; `maxCV` is CALIBRATION-PENDING. 13 new unit tests.

**Wired into `app/measurements-scan.tsx`**: the single `lastKpRef`/`lastFrameRef`
retention became a ring buffer (`frameBufferRef`, `BUFFER_SIZE = 3`) of `{keypoints,
uri}` for the last up-to-3 good-pose polls; oldest evicted (and its temp file
deleted) once it exceeds capacity. Pose-lost / unmount now clear the WHOLE buffer
(deleting every uri), not just one file — same privacy contract, extended. `finish()`
was refactored to take NO argument — it reads the ring buffer internally — so all
three capture paths (auto-capture after 3 consecutive good frames, "Capture now",
the 10 s self-timer) share identical multi-frame handling with no special-casing.
Inside `finish()`: `rejectOutlierFrames` → `medianKeypoints` → run
`estimateSilhouette`/`extractWidths` on EACH buffered frame's uri against the
aggregated keypoints (band placement) → `medianWidths` across the per-frame results
→ `keypointsToMeasurements` on the aggregated keypoints/widths, same as before.
Segmentation now runs up to 3× per capture (was 1×) — behind the existing
'processing' veil. Dev fixture export now receives the aggregated keypoints/widths
(what was actually measured), not one frame's raw keypoints.

**Honest confidence — threaded, not just logged.** `EstimatedMeasurements` gained an
additive optional `stability?: number` (the `scaleAgreement` CV), set in `finish()`
alongside the existing `confidence` when calling `setPendingEstimate`. This threaded
cleanly — every consumer (`measurements-edit.tsx`, `(onboarding)/measurements.tsx`,
`fitEngineStore`) reads specific named fields, so an added optional field is inert
for them. `confidence` (per-frame min keypoint score) is unchanged/kept. The dev
debug line also appends `agree X.X%` (the same CV) after capture, and the debug text
now also renders during the `processing` phase (was `scanning`-only) so it's visible
while the up-to-3x segmentation pass runs; a matching `console.log` line covers the
same info for Metro log tailing.

Needs on-device verification before shipping further (flagged in backlog B): latency
of the 3× segmentation pass at capture time (was 1×), and confirming the buffer's
privacy cleanup (all 3 temp uris actually deleted) on a real device build — this
environment cannot run the camera/TF Lite/segmenter pipeline.

Verify: `npx tsc --noEmit` clean; `npx jest` 216/216 (22 suites — all prior suites
unchanged, `src/features/measurements` now 67/67 = 54 prior + 13 new).

## Body-neutral styling toggle (2026-07-07)

Recommendation #6 of `docs/research/body-shape-importance-FINAL.md`: a user-facing
opt-in that removes ALL body-shape influence from outfit scoring, purchase
evaluation, and the shown rationale, for users who don't want shape-based
suggestions. Mirrors the existing `genderAwareStyling` flag end-to-end.

**Client**: `appStore.ts` gained `bodyNeutralMode: boolean` (default false),
`setBodyNeutralMode`, persisted in `save()`/hydrate exactly like
`genderAwareStyling` (additive — `data.bodyNeutralMode ?? false` on restore, so
older persisted blobs default to off). Sent as `body_neutral: true` (omitted when
off) in all three outfit-engine request bodies in `fitEngineStore.ts`
(`fetchOutfits`, `fetchMixMatchOutfits`, `fetchMoreOutfits` — the third wasn't
named in the original ask but mirrors `gender_aware` there too, so pagination
doesn't silently drop the flag), in `tryOnService.evaluateItem`'s request body,
and in `wardrobeCriticService.fetchGapReport`'s request body.

**Server — the clean lever**: each edge function (`generate-outfits`,
`evaluate-item`, `wardrobe-critic`) already threads `bodyMeasurements.body_shape`
into the shared engine, and every consumer already no-ops on its absence
(`scoreOutfitFit`'s `if (!body.body_shape) return base`, `evaluate-item`
`scoring.ts`'s fit criterion `if (bodyShape)` delta + `fitExplanation`'s
conditional shape clause, and the curator prompt's `bodyMeasurements.body_shape ?
'Body shape: …' : ''` line). So the entire feature is: read `body.body_neutral
=== true` into a local bool, and when true, `bodyMeasurements.body_shape =
undefined` right after `bodyMeasurements` is assembled from the DB row — before
it reaches any consumer. This removes the scoring delta AND the rationale text
in one move, with zero changes to the engine itself. A `console.log(...
body-neutral: body_shape suppressed)` line was added to each function, matching
the `gender_aware` logging style.

**Settings UI**: new row in `app/settings.tsx`'s Preferences section, right after
"Tailor to gender" — `settings_bodyNeutral` / `settings_bodyNeutralDesc` in
en.json/vi.json (key-synced, verified with a script diffing both key sets).

**Tests**: new Deno test in `generate-outfits/engine/season-color.test.ts` proves
the engine-level invariant the suppression relies on: for a shape-sensitive
outfit, two different body shapes (`inverted_triangle` vs `apple`) score
differently when `body_shape` is present, but IDENTICALLY once `body_shape` is
stripped — and that stripped score matches the plain no-shape baseline. The
index.ts-level plumbing (`body.body_neutral` → suppress) is a thin, directly
readable conditional not separately unit-tested; the engine invariant it depends
on is what's proven.

Also updated `src/services/__tests__/tryOnService.test.ts` to mock `../../stores/
appStore` (same stub pattern already used by `fitEngineStore`'s tests) — importing
`useAppStore` into `tryOnService.ts` pulled the full `appStore.ts` module graph
(NetInfo et al.) into that test's transform graph, which jest can't parse without
the mock.

Verify: `deno test` green across all three functions (133 + 21 + 9 = 163 passed,
0 failed, including the new test); `npx tsc --noEmit` clean; `npx jest` 216/216
(22 suites); locale key-sync diff empty both directions (982 keys each). Deployed
`generate-outfits`, `evaluate-item`, `wardrobe-critic` via Supabase CLI (JWT
verification left ON, no `--no-verify-jwt`).

## Try-on Your Frame — detail measurements display + add-measurements CTA (2026-07-07)

Client-only change to `app/try-on/wear.tsx`'s "Your Frame" card (no engine/service/
payload changes — `buildPayload`/`profile.measurementsCm` already sent every
detail measurement to the generator; only the on-screen display was thin).

- Below the existing height/weight/items row, a wrapped grid now shows every
  detail measurement present on `useAuthStore().measurements` (chest, waist,
  hips, shoulder, sleeve, torso, upper arm, neck, inseam, thigh, rise, foot
  length, foot width) — only fields with a value >0 render; absent ones are
  skipped rather than showing "—". `bodyShape` and `preferredFit`, when set,
  append as two more entries in the same grid, reusing the same label/value
  keys as `measurements-edit.tsx` (`SHAPE_LABEL_KEYS`/`FIT_LABEL_KEYS`, kept as
  a local const in `wear.tsx` since there's no shared export for them).
- **Sparse detection**: when `body_bust`, `body_waist`, AND `body_hip` are all
  missing/0 — the three girths that drive garment drape most — the grid is
  replaced by a subtle caption + `SecondaryButton` ("ADD MEASUREMENTS") routing
  to `/measurements-edit`. Computed inline via `useMemo`, no store/type changes.
- **Soft nudge**: when not sparse but some detail fields are still missing, a
  low-emphasis `TextLink` ("Update measurements") appears under the grid,
  routing to the same screen. Kept intentionally subtle per spec guidance to
  avoid clutter once the user already has some data.
- All new label lookups reused existing i18n keys (`onboarding_measurements_
  chestLabel`/`waistLabel`/`hipsLabel`/`inseamLabel`/`thighLabel`/`riseLabel`,
  `measurements_shoulderLabel`/`sleeveLabel`/`upperBodyLabel`/`upperArmLabel`/
  `neckLabel`/`footLengthLabel`/`footWidthLabel`/`bodyShapeLabel`/`shape*`,
  `measurementsEdit_preferredFitLabel`/`fit*`). Only 3 new keys added (both
  locales): `wearOnYou_framePartialCta`, `wearOnYou_frameAddButton`,
  `wearOnYou_frameUpdateLink`.

Verify: `npx tsc --noEmit` clean; locale key-sync diff empty both directions;
`npx jest` 216/216 (22 suites, unchanged — UI-only change, no new tests added).

## Try-on generation — studio background + exact-frame proportions (2026-07-07)

`supabase/functions/tryon-generate/index.ts`, prompt-only change (`buildGenPrompt`),
no payload/client change.

- **Background swap**: previously `- Keep the original background and framing.`
  told Gemini to preserve the selfie's original (often busy/random) background.
  Replaced with an explicit STUDIO-backdrop directive — clean, seamless
  warm-neutral/off-white/stone-grey wall, evenly lit, editorial-luxury tone —
  plus a companion line reaffirming the person (pose/body/face/skin/hair/
  identity) is preserved exactly while only the environment is relit/replaced,
  with realistic contact shadows. The outfit-context caveat was reworded so it
  no longer forbids changing the background (intentional now) but still bars
  added props/people/text/scenery beyond the studio backdrop. Header comment
  updated to match (no longer claims background is preserved).
- **Exact-frame proportions**: the STATURE requirement was tightened to
  explicitly bind the render to the PERSON PROFILE's height, weight, body
  shape, AND every listed body measurement (chest/waist/hip/shoulder/inseam/
  etc.), not just height/build/leg-length — explicitly rejecting an "idealised
  or average fashion-model body." `profileLines`, the payload, and the BMI/
  leg-proportion derived cues are unchanged.
- Verify: `deno check` on the file passes with the same 3 pre-existing
  `MinimalClient`/`SupabaseClient` TS2345 errors (gateCredit/refundCredit,
  lines ~364/378/384) that exist independent of this prompt edit — confirmed
  by isolating the file to its last-committed state, which type-checks clean;
  the errors come from other pre-existing uncommitted WIP in this file, not
  from this change. Deployed via `npx supabase functions deploy tryon-generate`.

## Try-on generation — height-flattering editorial framing (2026-07-07)

`buildGenPrompt`, prompt-only change, follow-up to the studio-background/
exact-frame edit above. Renders were reading "short/stumpy" — diagnosed as a
framing/camera problem (foreshortened by looking-down camera angles / tight
crops), not a body-proportion problem, so the fix adds camera/composition
guidance rather than touching the body-measurement directives.

- Added a new **FRAMING & CAMERA** requirement line (placed right after
  STATURE/PROPORTIONS): full-length head-to-toe composition (whole body + both
  feet, slight headroom), camera at waist-to-eye level shooting straight-on or
  slightly LOW (never looking down, which foreshortens/shortens), upright
  elegant posture with an elongated leg line and editorial vertical
  proportions — reads tall/statuesque.
- Reconciled with the exact-frame requirement: appended "...present that real
  frame with the flattering editorial framing described below" to the
  STATURE/PROPORTIONS line, so truthful body girths/proportions from the
  PERSON PROFILE and flattering camera/pose explicitly coexist — this is a
  presentation change only, not a body-distortion change.
- Verify: `deno check` — identical 3 pre-existing `MinimalClient` TS2345
  errors (gateCredit/refundCredit), now at lines ~365/379/385 (shifted by the
  one added line); no new errors introduced. Deployed via
  `npx supabase functions deploy tryon-generate` (JWT verification unchanged).

## Try-on generation — face-identity lock, softened reframe (2026-07-07)

Critical regression from the two edits above: telling Gemini to both swap the
whole background AND re-angle the camera (shoot from a slightly LOW angle) +
recompose full-length forced it to regenerate the whole person from scratch —
face identity was the first thing lost, so generated images showed a
different face than the uploaded selfie. `buildGenPrompt`, prompt-only fix:

- Face is now the dominant, first-listed "Strict requirements" bullet,
  worded as absolute ("FACE IDENTITY IS THE #1 PRIORITY") and stating that if
  it conflicts with any other instruction (framing/angle/proportions/
  background), preserving the face wins.
- Removed the camera-angle instruction that was destroying identity (the
  "shoot from a slightly LOW angle" / never-look-down camera re-angling)
  from the FRAMING line, renamed FRAMING & CAMERA → FRAMING & COMPOSITION,
  and added an explicit "keep the head/face at the same angle, orientation
  and rendering as the source photo — no turning, tilting, re-posing, or
  re-lighting the face" clause.
- Height flattering is kept via body posture and full-length framing only
  (upright elongated posture, long clean leg line, whole body + both feet
  visible) — never by altering the face or head/camera angle.
- Studio-background bullet gained a reaffirming clause that only the
  environment changes; face and head stay exactly as in the source photo.
- Priority order is now unambiguous end-to-end: (1) face/identity, (2)
  faithful garments, (3) truthful body proportions from PERSON PROFILE, (4)
  full-length flattering posture/framing, (5) studio background.
- Verify: `deno check` — isolated the prompt-only edit (reverted just this
  hunk, re-checked, reapplied) and confirmed byte-identical 3 pre-existing
  `MinimalClient` TS2345 errors at lines 365/379/385 before and after; no new
  errors introduced. Deployed via `npx supabase functions deploy
  tryon-generate` (JWT verification unchanged, no `--no-verify-jwt`).

## Try-on generation — face-safe height elongation (2026-07-07)

Removing the low-camera-angle trick (previous entry) fixed face identity but
brought back short-reading renders. Instead of touching the camera or head
again, `buildGenPrompt`'s "FRAMING & COMPOSITION" bullet was rewritten to gain
perceived height entirely through BODY composition — levers that are
structurally far from the face:

- Tall vertical/portrait full-length framing (not square/waist-up), feet
  at/near the bottom edge, minimal headroom, body fills the frame.
- A long, elongated leg line as the dominant vertical element (high-fashion
  editorial stature-stretching), upright/stretched posture (long spine,
  shoulders back, no slouch, no leg-shortening bent knees).
- Explicit ban on foreshortening/vertical compression and on any high/
  downward viewpoint on the body.
- An explicit reconciliation clause: elongation applies to body/legs/
  posture/framing ONLY — head/face stay at the exact source angle/
  orientation, no re-angling, and the face rule (still bullet #1) wins on
  any conflict.
- Truthful proportions preserved: this flatters height/leg length, it does
  not turn a heavier or shorter build into a thin one.
- The face-identity bullet (`#1 PRIORITY — ABSOLUTE`, first in the list) was
  NOT touched — verified byte-identical before/after this edit.
- Verify: `deno check supabase/functions/tryon-generate/index.ts` — same 3
  pre-existing `MinimalClient` TS2345 errors (lines 365/379/385 before and
  after; the edit only shifts line numbers within the prompt-block, no new
  errors). Deployed via `npx supabase functions deploy tryon-generate` (JWT
  verification unchanged, no `--no-verify-jwt`). No client/UI change;
  server-side prompt only.

## Try-on face compositing — paste real face onto generated image (2026-07-07)

The prompt-side face-identity lock (two entries above) reduces drift but can't
*guarantee* identity — Gemini is still free-hand rendering the face. Added a
second, deterministic layer on top, entirely client-side: after
`tryon-generate` returns, paste the user's REAL face (from their already-
validated source photo) onto the generated studio image.

- **`src/features/try-on/faceDetect.ts`** — on-device BlazeFace (MediaPipe
  short-range, `assets/models/face-detector.tflite`, 128×128 input) via
  `react-native-fast-tflite`, mirroring the lazy-load/letterbox/jpeg-decode
  pattern in `poseEstimate.ts`/`silhouette.ts` exactly. Manually decodes the
  SSD output (896 anchors: 16×16×2 @stride8 + 8×8×6 @stride16) — sigmoid the
  classificator score, take the single highest-scoring anchor (no NMS needed
  for a single-subject photo), derive eyes/nose/mouth keypoints from the
  regressor offsets. Returns 4 landmarks in source-image normalised coords,
  or null on any failure/no-detect.
- **`src/features/try-on/faceCompositeMath.ts`** — pure geometry/color math
  (no native imports, jest-testable): closed-form least-squares similarity
  (scale+rotation+translation, no shear) fit from 4 point correspondences,
  its inverse, a plausibility gate (rejects >3x/<0.3x scale or >35° rotation
  mismatches), a feathered-ellipse alpha mask, and per-channel color-transfer
  (mean/std restyling) + bilinear sampling for the paste.
- **`src/features/try-on/faceComposite.ts`** — orchestrator: detects both
  faces, decodes both images to RGBA (downscaled to a 1024px working
  resolution), fits + gates the alignment, builds a feathered inner-face
  ellipse mask centred on the GENERATED face, color-matches the source face's
  tone to the generated lighting (stats over the mask's core, excluding the
  feather ring), and alpha-blends the inverse-mapped source pixels in. A
  small in-file `Buffer.from` shim lets `jpeg-js`'s encoder run under Hermes
  (which has no Buffer global) without adding a new dependency; the encoded
  bytes are base64'd by hand and written under `cacheDirectory`. Every step
  is wrapped in one try/catch — returns null on any failure (no face
  detected, implausible alignment, decode/encode error).
- **Wired into `useWearOnYou.generate()`**: after `generateWearOn` resolves,
  calls `compositeFace(photoUri, out.localImageUri)`. Success → the
  composite uri becomes `result.localImageUri` (what's displayed) and the
  now-superseded raw generated file is deleted so generations don't leak a
  duplicate file each time. Failure/null → the raw generated image is used
  unchanged (pre-existing behaviour) — the call is wrapped so it can never
  throw into/block the result flow. `__DEV__`-only console logs report
  applied vs. fell-back (with reason where cheap to include).
- Verify: `npx tsc --noEmit` clean; `npx jest` 231/231 green (216 pre-existing
  + 15 new `faceCompositeMath` tests covering the similarity fit/inverse/
  extraction/plausibility gate, ellipse alpha, color transfer, and bilinear
  sampling). `assets/models/face-detector.tflite` confirmed a valid TFL3
  flatbuffer, required the same way as the other two on-device models — no
  on-device smoke test was run this session (no Metro/device available).
- **CALIBRATION-PENDING (needs on-device tuning — see backlog.md B)**:
  BlazeFace float32 input normalisation ([0,1] vs [-1,1]), the alignment
  plausibility thresholds (scale/rotation bounds), and the mask ellipse
  size/feather + color-match strength. None of these can be validated
  without running the model on a real device against real photos.

## Preference screens — fix hydrate-race data loss + add None option (2026-07-07)

**Bug (confirmed, client-only — DB persistence itself was fine)**: `useFitEngineStore`
hydrates asynchronously (`hydrate()` fetches style/colour/formula preferences from
Supabase on app start, and re-runs off the `onAuthStateChange` listener). But
`colors-edit.tsx`, `styles-edit.tsx`, and `formulas-edit.tsx` all seeded their local edit
state with a **one-time** `useState(() => [...storeValue])` snapshot at mount, with no
re-sync. If a screen was opened before hydrate populated the store (a real race, not just
theoretical — cold start, fast account switch), it rendered empty, which looked like "no
saved preferences" but was actually a stale snapshot; hitting Save then persisted that
empty array over the user's real DB row — genuine data loss.

**Fix (same shape in all three screens)**: subscribe to the store's `hydrated: boolean`
flag and to the relevant store value reactively (not destructured-once). A `useEffect`
re-anchors the local state from the store value whenever the store value changes AND the
local selection is still "untouched" (equals the last-synced store snapshot, tracked via a
ref) — so a late hydrate refreshes an unedited screen, but never clobbers an edit already
in progress. The `dirty`-check baseline (`initial*Ref`) is re-anchored alongside it so
`dirty` keeps comparing against the right baseline after a resync.
- `colors-edit.tsx`: `initialColorsRef` + `lastStoreRef` track `colorPreferences`.
- `styles-edit.tsx`: same pattern duplicated for both `selected` (top-level styles) and
  `niches` (`initialSelectedRef`/`initialNichesRef`, `lastStoredRef` on the combined
  `styleProfile.selectedStyles` array) — resync only fires when *both* arrays are
  untouched, so a niche-only edit doesn't get silently reset by a top-level style resync
  or vice versa.
- `formulas-edit.tsx`: same pattern for `formulaPreferences` (it had the identical
  snapshot-without-resync bug).

**Save-guard**: all three screens now also gate the Save action on `hydrated` — while the
store hasn't finished its initial fetch, the Save button is disabled and shows
`common_loadingPreferences` ("LOADING PREFERENCES…") instead of the normal
save/no-changes label, so a user can't submit an un-hydrated (possibly still-empty)
snapshot over their real data even by rushing the tap.

**Feature — explicit "None" control**: the engine already treats empty
`colorPreferences`/`selectedStyles` as "no preference" (empty palette → neutral
`paletteAlignment` 0.5; empty styles → no style filter applied), so "None" is just
"clear everything and save empty" — but with no selections, the screen previously just
looked blank/unfinished. Added a first-class NONE row to both `colors-edit.tsx` and
`styles-edit.tsx`:
- A bordered row above the swatch/style grid, labelled via new i18n keys
  (`colorsEdit_noneOption`/`colorsEdit_noneHint`, `stylesEdit_noneOption`/
  `stylesEdit_noneHint`). Tapping it clears the current selection
  (`setSelected([])` for colours; both `setSelected([])` and `setNiches([])` for styles).
  When nothing is selected, the row renders in its active/selected state (filled
  background + check circle) so "None" reads as a deliberate choice, not an empty screen.
  Picking any real item deactivates it automatically (`isNoneActive = selected.length===0`,
  resp. `selected.length===0 && niches.length===0`).
- Saving with NONE active persists an empty array via the existing
  `setColorPreferences([])`/`setStyleProfile({ selectedStyles: [] })` setters — verified
  these and the engine already default gracefully on empty (no change needed there).
- `formulas-edit.tsx` was **not** given a NONE control — out of scope for this pass; it
  already shows a `formulasEdit_noneSelectedHint` message when nothing is selected, which
  covers the same "this is intentional" concern for that screen.

**Sanity-checked but not fixed this pass** (see backlog.md section A for the punch list):
- `measurements-edit.tsx` has the **same** snapshot-without-resync pattern
  (`useState(() => ({ height: cmStr(bm.body_height), ... }))`), so it's affected in
  principle — lower risk than colours/styles/formulas (measurements are required fields,
  validation blocks most all-empty submits, and the screen is usually reached after
  `authStore`/`fitEngineStore` are already warm) but the underlying race is identical.
  Left unfixed pending a decision on scope.
- `personal-color-edit.tsx` was checked and is **not** affected — it doesn't snapshot
  existing preferences into edit state at all; it re-runs the full scan/quiz flow from
  scratch each time it's opened, and only displays the existing season via a reactive
  selector (`useAuthStore(s => s.colorSeason)`), not a one-time snapshot.

New i18n keys (both `en.json`/`vi.json`, key-synced): `colorsEdit_noneOption`,
`colorsEdit_noneHint`, `stylesEdit_noneOption`, `stylesEdit_noneHint`,
`common_loadingPreferences`.

Verify: `npx tsc --noEmit` clean; key-sync script (en/vi key sets) empty diff both ways;
`npx jest` 231/231 green (no new tests added — fix is a client-only race/UX change with no
new pure logic to unit-test; verification here is type-safety + full regression pass).
No server/edge-function changes; nothing deployed.

## Silhouette-first resolution — generate-outfits engine (2026-07-12)

Added a **silhouette-first resolution** step to the outfit engine: a TARGET SILHOUETTE
(preferred top/bottom volume relationship, e.g. "fitted top over a wide bottom") is
resolved once BEFORE composition and threaded into generation + ranking as a **bias +
scoring term** — it never adds a new hard filter/veto, and it never eliminates an item.

**New module `supabase/functions/generate-outfits/engine/silhouette.ts`**:
- `resolveTargetSilhouette(ctx, items)` — override cascade: explicit intent
  (`ctx.intent.proportionRule`, then `ctx.intent.bodyGoal`) > style silhouette attribute
  (`ctx.styleProfile.computedAttributes?.silhouette`) > `ctx.bodyMeasurements.body_shape`
  flattering default > neutral fallback. Each level derives 2–4 `(topVol, bottomVol)`
  target pairs on the existing VOLUME scale (scoring.ts, slim=1…oversized=5) — no new
  volume scale was introduced. The `body_shape` defaults were derived by reading
  `bodyShapeMultiplier` (scoring.ts) first and pointing the same direction it rewards
  (e.g. triangle → wider bottom, since that function gives +0.07 to a wide/relaxed
  bottom and -0.07 to a slim one; inverted_triangle → fitted top + wider bottom;
  hourglass → tailored/low-volume both halves; apple → looser top).
- `pairSilhouetteMatch(top, bottom, target)` — best (max) match of a specific pair
  against the target's candidate volume pairs, distance-based, [0,1].
- `silhouetteAffinity(item, target)` — per-item [0,1] fit to the nearer side of the
  target (reserved for future anchor-biasing use beyond what generation.ts already
  covers via measurementPriorityBoost).
- `measurementPriorityBoost(item)` — small non-negative nudge: `+0.06` when
  `garmentMeasurements` is populated, `+0.03` when `provenance.fit === true` with no
  measurements, `0` when the fit is purely guessed. Reuses the existing
  `provenance`/`garmentMeasurements` confidence signals — no parallel confidence system.
- `confidence` (0..1): computed from how many of the wardrobe's top/bottom items carry
  real fit data (`provenance.fit === true` OR non-empty `garmentMeasurements`) —
  `measured / (measured + 3)`, so it's exactly 0 for a fully-guessed wardrobe and
  saturates toward 1 as measured coverage grows. This is the **degradable** knob: every
  consumer below gates its effect on `confidence`, so a fully-guessed wardrobe sees
  byte-identical behaviour to before this feature (verified by a dedicated compose test).

**Wiring (degradable everywhere — gated on `target.confidence > 0`)**:
- `engine/types.ts`: new `TargetSilhouette` interface + optional `EngineContext.targetSilhouette`.
- `engine/scoring.ts`: exported the (previously module-local) `VOLUME` map as the single
  source of truth; added `scoreTargetSilhouette(items, target)` — outfit-level version of
  the same distance match, folded into the proportion dimension by ranking.ts.
- `engine/generation.ts`: `pairAffinity` gained optional `(target, targetConfidence)`
  params — the existing `proportion` term becomes
  `(1-conf)*genericProportion + conf*pairSilhouetteMatch(top,bottom,target)`, applied only
  when the pair actually contains one top-like and one bottom-like item (shoe pairs are
  untouched). `generateFromPool` adds `measurementPriorityBoost` as a small nudge to
  anchor ranking and counterpart selection (small enough to never override "loudest piece
  leads" — compose.test.ts's existing assertion still passes unchanged).
  `generateCandidates`/`generateHeroCandidates`/`generatePinnedCandidates` all gained an
  optional trailing `target?: TargetSilhouette` param — omitted, all three are
  byte-identical to before (verified: full existing suite unchanged).
- `engine/ranking.ts`: `proportionBalance` blends `scoreProportionBalance` with
  `scoreTargetSilhouette` by `target.confidence`, still under the existing
  `proportionHasData` gate and `wProportion` weight (no new weight, no restructuring).
- `index.ts`: `ctx.targetSilhouette = resolveTargetSilhouette(ctx, filteredItems)` is
  computed once, right after the style filter finalizes `filteredItems` and before
  candidate generation, then threaded into all three generation calls.

**Tests**: `engine/silhouette.test.ts` (16 new — per-body_shape direction, override
cascade, confidence monotonicity, `measurementPriorityBoost` ordering, `pairSilhouetteMatch`
monotonicity + best-match + determinism). `engine/compose.test.ts` (+4): a measured
wide-leg bottom beats an equally color-harmonious guessed slim bottom once a target
favours it; a `confidence: 0` target is a byte-identical no-op vs. no target at all; a
badly-mismatching guessed item is still used (never filtered) in a sparse wardrobe.

**Left out of this pass** (see backlog.md): threading `target` into
`buildAroundFixed`'s brute-force enumeration itself (pinned/hero paths only get a
lighter touch — measurement-priority ordering of the id pools, or a hero-ranking boost
— not a full pairAffinity-style blend); an upward floor on `wProportion` mirroring the
existing `wFit` 0.18 floor when measured coverage is high (spec called both out as
optional "if practical"/"only if it doesn't destabilize existing tests" — skipped to
keep the change surface minimal and risk low).

Verify: `deno test supabase/functions/generate-outfits/` 133/133 baseline → 153/153 after
(133 baseline + 16 new `silhouette.test.ts` + 4 new cases in `compose.test.ts`), 0
failures. `deno check` clean across all engine files + `index.ts`, no `any`.
`deno test supabase/functions/evaluate-item/` 21/21 and
`deno test supabase/functions/wardrobe-critic/` 9/9 unaffected (both import this engine;
re-run as a cross-feature regression check for 010-wardrobe-critic).
