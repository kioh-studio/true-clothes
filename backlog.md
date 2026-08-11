## AB. Phát hiện phiên 2026-08-10 (review toàn app + khảo sát engine)

- [x] 🔴 **`app/build.tsx` "Build an Outfit" chạy hoàn toàn trên MOCK** (2026-08-10) —
  `build.tsx:398` lấy `const { items, ... } = useAppStore()`, chỉ `items` chứ KHÔNG lấy
  `wardrobeItems`. Mà `appStore.items` khởi tạo = `ITEMS` (32 món demo hardcoded trong
  `src/data/index.ts`). So sánh: `app/(tabs)/index.tsx:104` lấy CẢ `items` lẫn
  `wardrobeItems`. Nghĩa là một mục chính trong Options Menu đang cho user phối quần áo
  KHÔNG PHẢI của họ — mọi pool/anchor/bước gợi ý đều chạy trên catalogue demo. Đây là
  bug user thấy được ngay. Chưa sửa (ngoài phạm vi phiên phát hiện ra nó).
  RESOLVED 2026-08-10 (cùng ngày, task riêng "build.tsx + Collage layering"): new
  `src/features/wardrobe-build/` (`toBuilderItem.ts` pure adapter + `useBuilderItems`
  hook) maps `wardrobeItems` (real `WardrobeItem[]`) into a builder-local `BuilderItem`
  shape (`type` nullable→category fallback via `collageLayout.ts`'s `CATEGORY_TYPE`,
  `name` falls back to brand→title-cased type, `color` = `primaryColor ?? colors[0]`).
  `build.tsx` now reads `useBuilderItems()` instead of `useAppStore().items` (ITEMS is
  untouched — still used by other screens per constraint), tiles/anchors resolve photos
  via the existing `useItemPhoto` hook (no new image-resolution path), and a dedicated
  empty-wardrobe state (title + caption + "ADD YOUR FIRST ITEM" CTA → `/add-item`)
  replaces the picker area when `wardrobeItems.length === 0` — no mock fallback. Bucket
  assignment now uses a new total `assignBucketKey()` helper (falls back to `BAGS`) so an
  item whose type can't be inferred into any `BUILDER_BUCKETS` entry (e.g. `headwear`,
  which none of TOPS/BOTTOMS/DRESS/OUTERWEAR/SHOES/BAGS actually covers) still shows up
  instead of silently vanishing — see follow-up note below on that fallback's label
  mismatch. Tests: `src/features/wardrobe-build/__tests__/toBuilderItem.test.ts`.

- [x] **`assignBucketKey`'s catch-all lands unclassifiable items (e.g. headwear) in the
  "BAGS" strip** (2026-08-10, judgment call made while resolving the item above — see
  `src/features/wardrobe-build/toBuilderItem.ts`). `BUILDER_BUCKETS` in `app/build.tsx`
  has no bucket for `headwear`/generic accessories (only `BAGS: ['BAG']`) — it was
  authored only for what the 32-item mock catalog ever had. Rather than invent a new
  bucket (a UI/design change out of scope for this task) or let such an item disappear
  from the builder with no trace, it now falls into the BAGS bucket's rendered list —
  visible and pickable, but the strip header still reads "BAGS" even if the tile shown is
  a hat. Cosmetic mismatch, not a data-loss bug. If real `headwear`/non-bag-accessory
  wardrobe items turn out to be common, consider a proper `ACCESSORIES` bucket (new
  `BUILDER_BUCKETS` entry + `build_bucketAccessories` i18n key) instead of the fallback.
  RESOLVED 2026-08-11 (same session as "Style grid 'Show all' truncation + builder
  ACCESSORIES bucket rename", see `plan.md`) — the suggested fix shipped for real:
  `src/features/wardrobe-build/buckets.ts` renamed the catch-all bucket itself to
  `ACCESSORIES` (`BUILDER_FALLBACK_BUCKET = 'ACCESSORIES'`, label key
  `build_bucketAccessories`), not just its label, so headwear/unclassifiable items now
  land in a bucket whose header honestly reads "ACCESSORIES" instead of "BAGS". Covered
  by `src/features/wardrobe-build/__tests__/buckets.test.ts` (e.g. `CAP`/`HAT` →
  `ACCESSORIES`, real `BAG` items still resolve there via their listed type too).

- [x] **Engine KHÔNG sinh được outfit layer blazer-chồng-hoodie** (2026-08-10, phát
  hiện khi anh Khôi đưa ảnh K-fashion thật để khảo sát). RESOLVED 2026-08-10 (cùng
  session, option (b) đã chốt) — thêm slot `mid?: string` vào `OutfitSlots`
  (`engine/types.ts`), resolved bằng `fabric.layerRole` (không dùng CATEGORY_MAP thủ
  công) trong `generation.ts`'s `generateFromPool`: một biến thể mới `{ outwear:
  <true outer>, mid: <layerRole 'mid' item> }` khi core's `top` là true base
  (`layerRole:'base'`) và pool có true outer. Quy tắc vật lý: mid+outer chỉ hợp lệ
  khi `mid.fabric.fabricWeight !== 'heavy'` (banned outright, CALIBRATION-PENDING),
  enforced ở cả generation.ts (không sinh) và ranking.ts (defense-in-depth, loại bỏ
  candidate nếu lọt qua). Dual-role giữ nguyên: mid-role item (hoodie/kimono) vẫn
  chiếm được slot `outwear` một mình khi không có true outer (hành vi cũ không đổi).
  `resultingBodySilhouette` (silhouette.ts) CỐ Ý không tính mid vào volume — lý do
  ghi trong comment ngay tại hàm đó. Client (`fitEngineStore.ts` outfitKey,
  `useFitFeed.ts` slotsToIds/fullKey, `MatchFeedCard.tsx` pieceIds,
  `types/fitEngine.ts` OutfitSlots) đã thêm `mid` vào full-slot key/id list. Tests
  mới: `engine/mid-layer.test.ts`. Chưa deploy (chủ dự án tự deploy sau khi review).

- [ ] **Personal colour: KHÔNG có telemetry chẩn đoán nào** (2026-08-10) — `hueDeg`,
  `ITA°`, `snrOk`, `scleraCorrected`, các cờ confidence đều được tính rồi bay hơi: không
  log, không render, không lưu (verify: không một `console.log` nào trong
  `src/features/personal-color/`; các field đó không xuất hiện ở `ResultView`). Chỉ
  `season`/`palette`/`tone12` tới được Supabase. Hệ quả: KHÔNG đo được độ chính xác —
  cầm máy chụp 15 lần cũng chỉ đọc được `tone12`/`season` từ màn kết quả, không biết
  hue bao nhiêu độ hay SNR có đạt không. Chặn thẳng Tier 1 của
  `docs/personal-color-device-test-protocol.md`. Doc đã ghi rõ chỗ chèn `console.log`
  tạm trong `analyzeFace` (instrumentation vứt đi, không ship).

- [x] **`takePictureAsync` không try/catch** (2026-08-10) — FIXED 2026-08-11: cả 4 chỗ gọi
  (`FaceScanStep`/`WristScanStep` trong `app/(onboarding)/personal-color.tsx` VÀ
  `app/personal-color-edit.tsx`) giờ có try/catch — reject thì phục hồi state (drop
  flash/dim overlay, bật lại torch) rồi `Alert.alert(t('personalColor_captureFailedTitle'),
  t('personalColor_captureFailedMessage'))` (2 key i18n mới, en/vi) thay vì màn hình treo
  im lặng. Xem thêm mục trùng lặp ở section E "Crash/hang (Medium)" bên dưới (cùng bug,
  cùng fix).
  ✅ Tin tốt từ cùng lần smoke-test: nhánh FALLBACK chạy đúng — face-scan → wrist-scan →
  câu hỏi fallback → result `TRUE SPRING` → save thành công, không crash, sạch trong ~25k
  dòng logcat. Ghi chú: deep link `mien://onboarding/personal-color` KHÔNG hoạt động
  (route group không nằm trong URL), phải dùng `mien://personal-color`.

- [ ] **Sentry: cần DSN + cân nhắc thêm lại Gradle plugin** (2026-08-10) —
  `EXPO_PUBLIC_SENTRY_DSN` đang RỖNG ở `.env` + cả 3 profile `eas.json`; code guard sẵn
  nên chạy im lặng, nhưng chưa thu được crash nào cho tới khi anh Khôi tạo project Sentry
  và dán DSN. `expo install` tự thêm config plugin vào `app.json` và agent đã GỠ RA có
  chủ đích: plugin đó chain `sentry-cli` upload vào Android release bundle và FAIL nếu
  thiếu `SENTRY_AUTH_TOKEN` → sẽ làm gãy pipeline Gradle release local (dự án không dùng
  EAS build cho Android). Thêm lại khi đã có project + token, nếu muốn source map.
  Có `app/dev-sentry-test.tsx` (dev-only, đã `.easignore`) để tự bắn lỗi thử.
  Analytics (khác crash reporting) vẫn CHƯA có gì — cố ý hoãn sang sau.

- [x] **Deploy 3 edge function** — XONG 2026-08-10: `generate-outfits` (v51),
  `evaluate-item` (v20), `wardrobe-critic` (v10), tất cả ACTIVE và `verify_jwt = true`
  (đã verify qua Management API sau khi deploy). Deploy bằng CLI, KHÔNG dùng
  `--no-verify-jwt`. Trước khi deploy đã verify sạch: `tsc` clean, jest 34 suites/501
  tests, deno 252 + 37 + 11.

## AA. Suggestion toggles — follow-ups (2026-08-10)

- [ ] **No client-visible hint when a toggle is suppressing a dimension** — unlike the
  wardrobe-affinity `style_fallback` envelope (surfaced as a quiet feed hint, see git log
  2026-08-08), turning off `suggest_by_style`/`suggest_by_personal_color`/
  `suggest_by_formula`/`suggest_by_measurements` currently has zero client-visible signal
  beyond the Settings switch itself and a server console log
  (`[generate-outfits] suggestion toggles off: …`, same in `evaluate-item`/
  `wardrobe-critic`). Not requested by the chốt design, but worth considering later: a
  small "not scoring by X today" note somewhere in the feed/verdict/critic UI, so a user
  who toggled something off months ago and forgot isn't confused by shifted suggestions.
- [x] **`evaluate-item`'s AI fit-note context (`note.ts` `buildNoteContext`) still passes
  the user's full `selectedStyles` list even when `suggest_by_style=false`** — FIXED
  2026-08-11 (2026-08-11 batch, confirmed defect #4): `evaluate-item/index.ts` now passes
  `styles: suggestByStyle ? selectedStyles : []`, reusing the same `suggestByStyle`
  accessor already read earlier in the handler — no second source of truth. Was defense-
  in-depth as described (not user-visible before the fix either), now closed.
- [ ] **`wardrobe-critic`/`evaluate-item` response schemas don't surface which toggles
  were off for that call** — `generate-outfits` doesn't either (this was intentionally
  out of scope per the chốt design — DB-only toggles, no request/response wiring). If a
  future debugging need arises (e.g. support ticket "why did my gaps report change"),
  consider echoing the four booleans back in the response for traceability.

---

# Backlog — review later

Deferred items flagged during development. Each has enough context to pick up cold.
Dọn 2026-07-03 theo yêu cầu anh Khôi: mọi mục đã implement bị XÓA (lịch sử đầy đủ nằm
trong plan.md changelog); còn lại phân nhóm theo lý do chưa làm.

---

## Z. Wardrobe photos — dangling `photo_storage='local'` refs (2026-08-08)

- [ ] **3 demo-wardrobe items có ảnh gãy (broken image placeholder)** — phát hiện
  2026-08-08. Trong DB live (user `19595dec-bad6-48e7-a859-fbabee490b7d`), 3/35
  `clothing_items` có `photo_storage='local'` + `photo_url='wardrobe-photos/<uuid>.png'`:
  - `Navy blue crew neck t-shirt` → `eabb3870-7ffb-4d2a-9e72-c8b7eea14bab.png`
  - `Black fitness tracker` → `54731323-45ef-4e06-9895-79bbcb6a57fc.png`
  - `Small silver stud earring` → `b2d81d1a-d953-4a3b-b291-91c8c672ceb6.png`

  3 uuid này KHÔNG tồn tại ở đâu khác: không có trong bucket `wardrobe-photos`
  (32 object, tất cả đều được reference, không orphan), không có trong
  `seedLocalPhotos.dev.ts`, không có trong `assets/items/`. Tức là ảnh chỉ từng
  nằm trong app sandbox của đúng cái máy đã thêm item → cài lại app / đổi máy là
  mất vĩnh viễn. `resolveItemPhotoSource` (`src/features/wardrobe-photos/useItemPhoto.ts:46`)
  trả `status:'missing'` → UI hiện placeholder. Code đúng theo FR-009, lỗi nằm ở data.
  Cần chốt: chụp/gán lại ảnh cho 3 item, hay set `photo_url=NULL, photo_storage='none'`
  để về empty-state sạch. `/dev-seed` KHÔNG fix được (3 id này không nằm trong seed list).

- [ ] **Free tier: ảnh item không có bản cloud → mất khi cài lại app** — `storePhoto()`
  (`src/services/wardrobeService.ts:261`) chỉ upload cloud khi `tier==='premium'`;
  free tier dừng ở `writeDeviceCopy` → `photo_storage='local'`. Đây là nguyên nhân gốc
  của mục trên. Có `promoteToCloud()` nhưng nó cần file trên máy còn sống, nên không cứu
  được sau khi mất. Cân nhắc: cảnh báo user free rằng ảnh chỉ nằm trên máy, hoặc chạy
  promote khi user nâng cấp premium (trước khi file kịp bị reclaim).

---

## G. Responsive layout (iPad) follow-ups (2026-07-22)

- [ ] **iPad landscape orientation** — currently portrait-locked
  (`app.json` `orientation: "portrait"`); unlock + audit all screens for
  landscape/multitasking widths (deferred, out of current scope — this
  session only shipped portrait-only responsive support per plan.md
  changelog "Responsive layout — phone to iPad Pro 13\" (2026-07-22)").
- [ ] **Font-scaling caps** — no `allowFontScaling`/`maxFontSizeMultiplier`
  anywhere; tight fixed `lineHeight`s + `numberOfLines` truncation risk
  clipping text at large accessibility text sizes. Add a shared `Text`
  primitive with a cap (deferred).
- [ ] **iPad has no camera torch — personal-color wrist scan degraded**
  — `app/(onboarding)/personal-color.tsx` WristScanStep uses `facing="back"`
  + `enableTorch` dual-flash (torch on/off) to cancel ambient light for skin
  undertone detection. No iPad model has an LED camera flash/torch, so
  `enableTorch` is a no-op on iPad → the two captures are effectively
  identical and undertone results are unreliable. Detect iPad (or no-torch
  device) and either hide/skip the wrist-flash step or fall back to a
  single-shot ambient path with a warning. Discovered 2026-07-22 while
  auditing iOS feature parity after enabling `supportsTablet`. STILL NOT
  SOLVED for the wrist step — but as of Personal Colour v3 Phase A
  (2026-08-04) the wrist is now only the SECONDARY undertone site: the new
  `FaceScanStep`'s screen-flash technique (full-screen white overlay +
  `expo-brightness` pushed to max, standing in for a torch on the front
  camera) works on any device with a screen, iPad included — so the PRIMARY
  face read is unaffected by this gap. Fixing the wrist step itself is still
  open, just lower priority now that it's not the primary signal.
- [x] **Share sheet not anchored on iPad** — FIXED 2026-08-11: both call sites now pass a
  `findNodeHandle()` anchor. `app/(tabs)/index.tsx`'s `ActionBtn` converted to
  `React.forwardRef` so the feed card's share button exposes a ref (`shareBtnRef`); the
  share `onPress` passes `{ anchor }` (only when the handle resolves — falls back to no
  anchor otherwise). `app/outfit/[id].tsx` gets its own `shareBtnRef` on the detail
  screen's share icon the same way. See `src/design/feed/design.md`. (2026-07-22)

## A. Chờ anh Khôi duyệt — trade-off lớn (chi phí / UX / phạm vi)

- [x] **Định vị body-shape: "flattering" cổ điển vs. cho user chọn dáng đích** — CHỐT
  hướng (B), IMPLEMENT 2026-08-10 (feature "shape goal"). Anh Khôi duyệt hướng cho user
  tự chọn dáng đích thay vì ngầm kéo mọi dáng về hourglass. Đã làm: cột
  `style_profiles.shape_goal` (nullable text + check constraint, null = auto); bậc mới
  trong `resolveTargetSilhouette` cascade (`intent > shapeGoal > style silhouette >
  body_shape > neutral`) — `'auto'`/undefined là no-op tuyệt đối (giữ nguyên hành vi cũ,
  có test khoá); `'natural'` = không sửa dáng; dáng cụ thể gọi
  `targetsForDesiredShape`; `shapeGoalDelta` (ranking.ts, ±0.08/−0.05, cùng band với
  `genderDelta`/`houseDelta`) thưởng outfit có `resultingBodySilhouette` thực tế khớp
  goal. Màn hình `app/shape-goal-edit.tsx`, entry từ `profile.tsx`. Chi tiết đầy đủ:
  `plan.md` mục "Shape goal (010-wardrobe-critic follow-up, 2026-08-10)". Vẫn còn treo:
  chưa nối `shapeGoal` vào `evaluate-item`/`wardrobe-critic` (ngoài phạm vi task này —
  xem mục riêng bên dưới); nghiên cứu body-shape dở dang (9/15) resume bằng
  `scripts/research/body-shape-verify-continue.workflow.js` vẫn chưa dùng tới.

- [x] **`resultingBodySilhouette:319` `if (base.rounded) return 'oval'` khoá cứng —
  apple mặc blazer chiết eo vẫn ra oval, engine chưa biết "chiết eo"** — FIXED
  2026-08-10 cùng session "shape goal" trên. Hàm mới `outfitWaistDefinition(items)`
  (silhouette.ts) đọc tín hiệu chiết eo THẬT từ chính outfit — thắt lưng, món kết cấu
  (`CORSET`/`BLAZER`/`VEST`, fit không oversized/wide), hoặc top+bottom fitted +
  `drape==='structured'` — và cho outfit-made waist THẮNG `base.rounded`/thiếu
  `base.waist`. Kết quả: apple/triangle/rectangle/inverted_triangle mặc đồ chiết eo
  đúng giờ ra `hourglass`, điều trước đây bất khả thi trừ phi body_shape vốn đã là
  hourglass. Test mới: `silhouette.test.ts` (apple+blazer→hourglass,
  rectangle+belt→hourglass, + case âm giữ nguyên hành vi cũ khi không có tín hiệu eo).

- [ ] **`resultingBodySilhouette` vẫn chỉ đọc ~2.5 biến (volume top/bottom + 1 cờ nhị
  phân "có eo do outfit tạo hay không")** (2026-08-10, còn treo sau fix trên) — mô hình
  vẫn bỏ qua các đòn bẩy stylist kinh điển khác: vị trí eo cụ thể (cạp cao/thấp), đường
  vai/vai độn, độ dài áo (crop vs tunic), cổ áo (V vs thuyền), khối màu dọc/monochrome,
  mức độ "chiết eo" (nhị phân có/không, không có thang độ). Hai thứ rẻ nhất để thêm
  trước vì dữ liệu ĐÃ có: vị trí eo (formula `rule_of_thirds` đã tồn tại nhưng chưa nối
  vào shape read) và monochrome (formula đã có, cũng chưa nối). Vai/cổ cần thêm trường
  vào wardrobe item → đắt hơn, làm sau.

- [ ] **`WAIST_DEFINING_TYPES` chỉ có CORSET/BLAZER/VEST — DRESS và COAT/OVERCOAT/JACKET
  bị loại có chủ đích** (2026-08-10, CALIBRATION-PENDING) — `typeName` không phân biệt
  được kiểu dáng cắt may (wrap dress chiết eo vs shift dress thẳng thùng; trench coat có
  đai vs coat suông) vì wardrobe item chưa có trường "silhouette cut". `DRESS` bị loại
  hoàn toàn khỏi tín hiệu chiết eo dù nhiều wrap/fit-and-flare dress chiết eo rất rõ; một
  trench có đai vẫn được nhận diện NHƯNG chỉ qua tín hiệu (a) thắt lưng phụ kiện, không
  qua chính type COAT. Muốn làm đúng cần thêm trường silhouette-cut vào extract-garments
  hoặc backfill-item-metadata.

- [ ] **`shapeGoal` chưa nối vào `evaluate-item`/`wardrobe-critic`** (2026-08-10) — task
  "shape goal" chỉ định rõ phạm vi `generate-outfits`, không như phiên "4 suggestion
  toggles" (2026-08-10, mục dưới) vốn yêu cầu áp dụng cả 3 function. Cả hai function vẫn
  compile/pass bình thường (field optional, no-op khi absent), nhưng verdict của
  `evaluate-item` và report của `wardrobe-critic` hiện KHÔNG biết tới dáng đích user đã
  chọn. Cần quyết định có đáng làm không trước khi tự ý mở rộng phạm vi.

- [ ] **`targetsForDesiredShape('rectangle', 'apple')` không thể đạt được về mặt toán học**
  (2026-08-10, giới hạn đã biết, KHÔNG sửa trong task này) — baseline `apple` có
  `rounded: true`, luôn thắng nhánh "cân bằng" bất cứ khi nào `avg < 5` trong
  `resultingBodySilhouette` — nên user apple chọn goal `rectangle` hoặc `triangle` không
  bao giờ nhận đúng nhãn đó (ra `oval` khi avg thấp, ra `hourglass` nếu outfit có tín
  hiệu chiết eo). `shapeGoalDelta` vẫn sẽ trừ điểm những outfit này dù engine đã cố hết
  sức — trade-off cần anh Khôi cân nhắc: có nên sửa `base.rounded` logic hay chấp nhận
  giới hạn này.

- [x] **Personal Colour v3 Phase A — face scan + calibrated colour math** — DONE 2026-08-04
  (implemented this session per `docs/personal-color-v3-phase-a-instruction.md`, scope
  approved by anh Khôi: full face-path). Face selfie (screen-flash dual capture) is now the
  primary skin/hair sample site, sclera white-reference + PLOS-ONE flash/ambient subtraction
  calibrate the read, value axis anchors on ITA° bands, 12-tone classification now surfaces
  a "leaning {neighbour}" secondary + high/medium/low confidence. Details: plan.md changelog
  "Personal Colour v3 — Phase A: face scan + calibrated colour math (2026-08-04)". Original
  full proposal at `docs/personal-color-v3-research.md`. Phase B and Phase C (below) remain
  queued — Phase A was capture/math hardening only.

- [x] **Personal Colour v3 Phase B — draping UX rebuild** — DONE 2026-08-04 (implemented this
  session per `docs/personal-color-v3-phase-b-instruction.md`). `DrapeSession.tsx` rebuilt on
  the professional methodology: 5 comparative rounds (`drapeRounds.ts` — tomato/cherry red,
  mustard/lemon, light ivory/deep charcoal, clear bright/soft mauve, gold/silver lamé) with
  judge-prompts teaching the analyst's actual criteria (under-eye shadows, jawline definition,
  brightening-without-washing-out, eye brightness, skin glow) instead of "which looks better";
  the gold/silver round both nudges warmth AND sets `metalKey` (guarded — never clobbers an
  existing manual answer, new `usePersonalColorDetection.applyDrapeMetal`). New "SEE ALL 12
  TONES" phase: 3×4 grid of every tone's signature drape colour (`TONE12_DRAPE_HEX`, tone12.ts)
  behind the same selfie, tap-to-compare against the current tone, picking a challenger calls
  the new pure `nudgeTowardTone` (tone12.ts, `TONE12_AXIS_SIGNATURE` canonical sign table) —
  one grid tap = exactly one drape-round-strength nudge, never a teleport. Entry points: a text
  link on the last drape round, and a new "SEE ALL 12 TONES" secondary button on the result
  screen (runs the selfie capture, then jumps straight to the grid). Both onboarding + edit
  screens updated in lockstep. All hexes/signature table CALIBRATION-PENDING per usual. Details:
  plan.md changelog "Personal Colour v3 — Phase B: draping UX rebuild (2026-08-04)".

- [x] **Personal Colour v3 Phase C — beauty-scope deliverables** — DONE (client scope)
  2026-08-04, per `docs/personal-color-v3-phase-c-instruction.md`. New pure module
  `tone12Beauty.ts` (`TONE12_BEAUTY`: 4 hand-picked wow colours per tone, metal rule
  springs/autumns→gold, summers/winters→silver, soft_summer/soft_autumn→both, makeup
  lip/cheek/eye swatch families per season anchor shifted by tone modifier, hair + glasses
  direction i18n keys) + shared `BeyondTheWardrobeSection` component rendered on both result
  screens after "BETTER TO SKIP". All hexes CALIBRATION-PENDING. Details: plan.md changelog
  "Personal Colour v3 — Phase C (2026-08-04)". Two sub-items were split out below.

- [ ] **Engine metal wiring** (2026-08-04, deferred out of Phase C by design decision —
  plan.md Phase C entry has the rationale). Scoring gold-vs-silver accessories needs:
  (1) item-metadata metal vocabulary (`gold`/`silver` — engine PrimaryColor only has
  'metallic') + backfill of existing accessories, (2) a clean `supabase/functions` tree
  (currently carries uncommitted wardrobe-critic work; single production env — deploying
  now would ship unfinished code). Do after wardrobe-critic lands.

- [ ] **ColorChecker validation fixture** (2026-08-04, blocked on anh Khôi's purchase
  decision — Classic Mini ~$50–60). Capture the physical card through the app's own flow,
  assert recovered LAB within published bands, retiring the `CALIBRATION-PENDING` markers
  on the colour-math constants for real. Needs the physical card + a real device.

- [x] **Guess-widening (`GUESS_WIDENING=0.4`) regresses 2/5 acceptance criteria** (2026-08-03,
  opened in session "Guess-widening replaces half-strength shift for guessed fit labels").
  RESOLVED 2026-08-03 (session "girth-floor safety clamp + bottoms fixture pass") by option
  **(c)**: `shiftThresholds()` now clamps a GIRTH key's `ok[0]` to never fall below its
  ORIGINAL (un-shifted) `FIT_THRESHOLDS` value, applied AFTER guess-widening so a guessed
  label can't use the wider band to sneak under the floor either (see plan.md changelog
  "Girth-floor safety clamp + bottoms fixture consistency pass (2026-08-03)"). E2 (slim tee
  ease −4) is back to floor-0 + warns, verified under both real and guessed labels — new deno
  tests added in `engine/season-color.test.ts`. `wide_leg_trousers`/`relaxed_chinos` were
  additionally re-authored (their waist/hip ease didn't scale with the declared fit at all —
  a separate, pre-existing fixture defect, not the widening mechanism) and now land inside
  their fit's ideal window on both labels.
  - Residual, NOT covered by this fix (new item below): the guess-widening mechanism still
    structurally allows guessed-fit score > real-fit score on the LOOSE side (widening
    `ok[1]` can only raise a "too roomy" point's score, never lower it) — this is untouched
    by the girth-floor clamp (floor-only) and shows up as a small residual gap on
    `oversized_hoodie`/`oversized_knit`/`structured_slim_blazer`/`relaxed_overshirt` (largest:
    `oversized_hoodie` guessed 0.943 vs real 0.910). See new item below.

- [x] **Guess-widening still lets a guessed-fit score exceed its real-fit counterpart on the
  LOOSE side** (2026-08-03, discovered while resolving the item above). RESOLVED 2026-08-11
  (session "scoreOutfitFit soft-knee + guess-widening loose-side ceiling clamp") by option (a),
  with a nuance: `shiftThresholds` now records `shiftedOk1` (the GIRTH key's `ok[1]` right after
  the declared-fit shift but BEFORE guess-widening — i.e. the ceiling a REAL label on the same
  garment/fit would have) and clamps the widened `ok[1]` to it, mirroring the tight-side floor's
  placement (same `GIRTH_KEYS` block, applied after widening). NOT a clamp to the raw unshifted
  `FIT_THRESHOLDS` table constant — that would have also capped every REAL relaxed/wide/oversized
  garment's `ok[1]` back to the flat regular ceiling, regressing the base per-fit shift itself,
  which is exactly the "loose-side ceiling legitimately DOES need to move outward" objection
  recorded below. Clamping to `shiftedOk1` is a no-op for real items (their `ok[1]` already
  equals it) and only engages for guessed items, restoring `guessed <= real` on the loose side
  without touching declared-fit windows. 3 new deno tests in `season-color.test.ts` (direct
  before/after case at ease=27 on an oversized top: real floors ~0.2, guessed also now floors
  ~0.2 instead of ~0.82; a sweep across relaxed/wide/oversized past each fit's own shifted
  `ideal[1]` proving the invariant; a regression guard that a REAL oversized top still scores
  > 0.9, i.e. the base shift is untouched). Measured against the offline eval harness (3
  fixtures): 0 observed movement — investigated and found structural, not a defect: all 73
  fixture wardrobe items across all 3 profiles declare an explicit `fit:` string, so
  `deriveFitWithProvenance` resolves every one to `provenance.fit = true` (REAL) — this fix
  only ever changes GUESSED-label behaviour, so it is invisible to this fully-labelled offline
  fixture data by construction; correctness is demonstrated by the new unit tests instead. See
  `plan.md` changelog "`scoreOutfitFit` soft-knee output shaping + guess-widening loose-side
  ceiling clamp (2026-08-11)" for the full writeup and the pre-existing tight-side asymmetry
  this fix deliberately did NOT touch (separate, already-accepted, out of scope).

- [x] **Side-photo depth capture** — DONE 2026-07-12 (implemented this session, anh Khôi
  đã duyệt trade-off): thêm bước chụp nghiêng 90° (turn interstitial + side scanning
  sub-phase, SKIP → front-only fallback) để ĐO độ dày thân thay vì đoán từ BMI — thay thế
  `chestDepthRatio`/`waistDepthRatio`/`hipDepthRatio` guessed-depth path bằng
  `sideDepthsCm` measured path per-field (fallback về guessed path nếu ratio depth/width
  ngoài `sideDepthWidthRatioMin`/`Max`). Xem `plan.md` changelog "Side-view (profile)
  depth capture — replaces BMI-guessed depth (2026-07-12)" cho toàn bộ chi tiết (row-
  fraction cross-view registration, hand erasure, per-view scale via
  `estimatePersonUnitH`, superellipse shape knob, fixture v2). Verify: `tsc`/`jest`
  325/325 xanh từ máy dev — CHƯA smoke-test trên thiết bị thật (xem mục device-verify
  mới trong §I bên dưới).
  *Bằng chứng (research 2026-07-12)*: MeasureNet (Amazon Halo, npj Digit. Med. 2023) ablation
  front-only → front+side giảm MAE eo 2.33→1.75cm (nam) / 2.89→2.40cm (nữ) — đòn bẩy đơn lẻ
  lớn nhất đã được kiểm chứng; front+side cũng là capture pattern cả ngành hội tụ (3DLOOK,
  Bodygram, Size Stream, Esenca). Mốc thực tế: front-only+height ≈ 3–4cm MAE,
  front+side+H/W ≈ 1.5–2.5cm MAE (BMnet arXiv:2210.05667; PMC9177647).
- [ ] **Chạy backfill hex + metadata trên prod** (2026-07-06, phiên measured-hex color
  layer): `backfill-item-metadata` giờ cũng điền `primary_hex`/`secondary_hex` cho item cũ
  (pixel algorithm thuần, không tốn Gemini call nếu metadata khác đã đủ). Cần
  `BACKFILL_ADMIN_SECRET` (chỉ anh Khôi có) — chạy `dry_run: true` trước để xem
  `filled: [...]` hợp lý rồi mới chạy thật. Đã deploy function; CHƯA chạy thật trên ~70 item
  cũ thiếu hex.
- [x] **Thread `primary_hex`/`secondary_hex` qua ingest client** — DONE 2026-07-06 (follow-up
  cùng phiên measured-hex, theo yêu cầu gốc "extract by item cũng có colour"): cả 3 đường
  ingest giờ có hex ngay lúc lưu — (1) extract-by-item on-device tự đo bằng client port
  `src/features/wardrobe-add/colorCluster.ts` (+ wrapper `colorClusterUri.ts`); (2) AI
  add-wizard thread hex server trả về qua `ExtractedItem` → `AddItemInput` → insert; (3)
  Try-On addToWardrobe tương tự. Kèm hex-hygiene: ảnh AI `keyed:false` (nền chroma còn
  nguyên trong pixel) thì hex server KHÔNG tin được → tính lại từ cut-out on-device nếu
  refine được, không thì để null (backfill điền sau). Xem plan.md changelog cùng ngày.
- [x] **Đồng bộ ingest-threading cho `print_scale`/`drape`/`visual_interest`** (2026-07-06) —
  RESOLVED 2026-08-11: cả 3 field + `can_layer` giờ thread hết qua cả 3 đường ingest
  (`imageGenerationService.ts` → `useAddWizard` → `AddItemInput` → insert; on-device
  extract-by-item để null vì không có nguồn phán đoán thị giác; Try-On `addToWardrobe` —
  đường này còn thiếu cả `distressed` vốn tưởng đã xong, fix luôn). Bonus fix: `canLayer`
  bị hardcode `null` ở `toExtractedItem` (comment cũ nói "not extracted" — sai từ khi
  server thêm `can_layer` 2026-07-03) khiến ước lượng của AI luôn bị vứt bỏ dù đã sửa các
  chỗ khác. Xem `plan.md` changelog cùng ngày.
- [x] **Wardrobe critic — Try-On candidate re-scoring (T032, optional).** ĐÃ LÀM
  2026-08-11: `ResultScreen.tsx` giờ gọi `wardrobe-critic` với `candidate_item`
  (`useCandidateUnlock` hook, `wardrobeCriticService.fetchGapReport`'s mới nhận optional
  `candidateItem`) đúng lúc banner "Fills your gap: {label}" hiện ra (`pendingGapArchetypeId`
  set), và hiện thêm dòng unlock-count THẬT (`resultScreen_fillsGapUnlocks`, i18n en/vi)
  bên dưới label cũ. Fail-soft: lỗi/chậm không đụng tới dòng label-only, không chặn verdict,
  không spinner. Xem `plan.md` changelog cùng ngày.
- [ ] **Wardrobe critic — chưa smoke-test trên thiết bị thật.** Chỉ verify được
  `tsc --noEmit` + `jest` từ máy dev (không có Metro/thiết bị trong phiên này). Cần chạy
  qua Menu → Wardrobe Report (3 mode: gaps/starter/complete), free vs premium gating,
  end-of-feed card, và Try-On bridge line trên thiết bị/emulator thật trước khi coi là
  xong hẳn.
- [ ] **Curator → multimodal (PAID feed).** Gửi thumbnail item thật cho Gemini khi curate
  24 candidates — tầng taste nhìn bằng mắt thay vì đọc label. Trade-off: chi phí Gemini
  mỗi lần kéo feed (paid tier) + latency. Vẫn là lever lớn nhất cho "đẹp thật".
- [x] **Ingest-time visual enrichment (đợt 2) — DONE 2026-07-03** (plan.md changelog).
  3 field mới `print_scale`/`drape`/`visual_interest` (cột + extraction schema + backfill fn
  + engine tiêu thụ: statementStrength/heroScore/housePOV). Suite 113/113, generate-outfits +
  backfill-item-metadata đã deploy. CÒN LẠI MỘT ACTION: **chạy lại backfill trên prod** để
  điền field mới cho ~69 item cũ — cần `BACKFILL_ADMIN_SECRET` (chỉ anh Khôi có); chạy
  dry_run trước như lần 30/06. Item mới thêm sẽ tự có field khi generate-item-image được
  deploy (fn đó đang giữ WIP phiên khác nên đợt này không deploy).
- [ ] **Gemini judge cho eval harness.** `scripts/eval-feed/judge.ts` sẵn sàng nhưng máy dev
  không có GOOGLE_API_KEY (secret chỉ nằm trên Supabase). Cần anh Khôi set key local hoặc
  đưa vào CI để có blind A/B judge thật; hiện các vòng đo đều chấm tay theo rubric.
- [x] **`measurements-edit.tsx` có cùng bug hydrate-race đã fix ở colors-edit/styles-edit/
  formulas-edit (2026-07-07)** — FIXED 2026-08-11: same resync-if-untouched pattern.
  `buildValues(bm)` helper shared by the initial `useState` and a new resync `useEffect`
  (`lastBmRef`/`initialRef` track "did the store just change" vs "did we just re-render",
  only re-adopts a late store value while the form is still untouched), plus a `hydrated`
  guard on Save. **Extra bug found and fixed while doing this**: the Discard button reset
  the numeric fields but never reset a manual `shapeOverride` — discarding left a manual
  body-shape override in place. Now resets both. `personal-color-edit.tsx` đã kiểm tra: KHÔNG
  dính bug này — nó chạy lại toàn bộ quiz/scan từ đầu mỗi lần mở (không snapshot dữ liệu cũ
  vào state để chỉnh sửa), chỉ hiển thị `existingSeason` qua selector reactive
  (`useAuthStore(s => s.colorSeason)`), không qua snapshot một lần.

## B. Cần thiết bị thật / dữ liệu thật (không verify được từ máy dev)

- [ ] **Try-on face composite — `faceDetect.ts`'s `NORMALIZE_TO_UNIT` vẫn chưa calibrate
  trên thiết bị thật** (2026-08-07, đợt edit-in-place + composite diagnostics). Chưa biết
  BlazeFace short-range cần input [0,1] hay [-1,1] — diagnostics mới thêm ở
  `compositeFace()`/`faceCompositeStats.ts` (`CompositeReason` + `byReason` tally, caption
  `__DEV__` trên `wear.tsx`) sẽ giúp XÁC ĐỊNH thay vì đoán mù (nếu `no_face_source`/
  `no_face_generated` chiếm phần lớn `byReason`, gần như chắc chắn normalisation sai — lúc
  đó mới flip flag, không đoán trước).
- [ ] **Try-on face composite — hằng số `faceMaskRadii()` cần tune trên thiết bị thật**
  (2026-08-07): 0.62 (ear-span → rx), clamp 1.4x/2.6x inter-eye, fallback 1.9x, tỉ lệ
  ry/rx 1.28 — toàn bộ CALIBRATION-PENDING, chưa chạy qua ảnh thật lần nào. Cần verify mask
  rộng hơn (tới jaw/hairline/tai) có làm seam lộ rõ hơn không, và ear-span guard (reject nếu
  < inter-eye hoặc > inter-eye×6) có đúng ngưỡng không.
- [ ] **Try-on — cân nhắc thêm lựa chọn "studio backdrop" làm optional cho user** (2026-08-07):
  đợt edit-in-place bỏ hẳn nền studio/editorial framing (chủ đích, để fix mặt bị đổi thành
  người khác). Look đó (nền sạch, khung người mẫu cao) có giá trị thẩm mỹ riêng — có thể sau
  này thêm như 1 lựa chọn user tự bật (trade-off rõ: nhận nền đẹp hơn, đổi lại rủi ro mặt lệch
  quay lại). Chưa duyệt, chỉ ghi nhận ý tưởng.
- [ ] **Personal color v2 — device verify + curation** (2026-07-06): drape colours & 12
  palette (draft) cần design review trên máy thật; dual-flash timing 350ms cần thử
  iOS/Android. (countryCode ĐÃ wire qua `authStore.locationCountryCode` — chỉ còn verify
  trên máy thật rằng seasonal edit đổi hemisphere đúng với profile có country code phía nam.)
  — Nối thêm (2026-07-06): boards 26 màu/tone (8 neutrals + 12 core + 6 accents) và
  `TONE12_AVOID` skip-lists cũng là draft-curated bởi design lead, CHƯA qua design review
  trực quan trên máy thật. (Cập nhật cùng ngày, phiên measured-hex: 4 tên màu rust/mustard/
  fuchsia/grey KHÔNG còn bị loại — `PrimaryColor` union đã mở rộng +11 và `grey`→`gray` đã
  sửa, nên `soft_summer`/`deep_autumn` giờ fire đủ danh sách draft gốc. Design review trực
  quan trên máy thật vẫn CHƯA làm — vẫn cần design lead xác nhận bảng màu/skip-list nhìn có
  đúng ý không.) `TONE12_AVOID_MAX = 0.06` cũng CALIBRATION-PENDING, chưa tune với feedback thật.
- [ ] **Personal Colour v3 Phase A — chưa test trên thiết bị thật** (2026-08-04, session
  implement Phase A). Toàn bộ pipeline face-scan (screen-flash dual capture, BlazeFace box
  decode mới thêm ở `faceDetect.ts`, sclera white-reference correction, ambient subtraction,
  ITA°-anchored value axis) là code-complete + unit-tested (pure math) nhưng CHƯA chạy qua
  camera thật lần nào. Cần verify trên máy thật: (1) `expo-brightness` setBrightnessAsync/
  getBrightnessAsync hoạt động đúng trên cả iOS/Android không cần permission thêm; (2) box
  regression decode (channel 0-3 của BlazeFace SSD output) cho ra bounding box hợp lý — nếu
  sai thứ tự channel, `hairBand` region sẽ lệch; (3) SNR threshold 0.015 và sclera gain range
  [0.6, 1.6] có phù hợp ánh sáng thật không; (4) FACE_WORKING_WIDTH=192 có đủ pixel cho vùng
  má/trán sau khi co theo aspect ratio của các máy khác nhau không.
- [ ] **Personal Colour UX-simplify — chưa test trên thiết bị thật** (2026-08-06, xem
  `docs/personal-color-ux-simplify-instruction.md` + plan.md changelog cùng ngày). Rebuild
  UX shell (intro → prepare → face 1/2 → wrist 2/2 → result; AxisMeters; ResultView dùng
  chung cho onboarding + edit; collapsible FULL PALETTE/BEYOND THE WARDROBE/ADJUST THE
  RESULT; failure-state copy cho permission-denied/photo-fallback/save-error) là code-
  complete + `tsc`/`jest` xanh nhưng CHƯA chạy qua thiết bị thật lần nào — cần verify:
  (1) `LayoutAnimation` mượt trên Android thật (New Arch); (2) prepare→face-scan tap
  chuyển step đúng, back() từ face-scan quay lại đúng prepare (không nhảy thẳng về intro);
  (3) bố cục AxisMeters (dot vị trí theo axis) không bị lệch trên các kích thước màn hình
  khác nhau; (4) toàn bộ acceptance checklist trong instruction doc (5 taps camera happy
  path, zero jargon labels, v.v.) trên máy thật, không chỉ đọc code.
- [ ] **AxisMeters — highlight trục thấp nhất khi confidence thấp** (2026-08-06, đề xuất
  trong instruction doc §10 nhưng chưa duyệt implement): khi `result.confidence === 'low'`,
  khoanh một vòng tròn quanh dot của trục có margin thấp nhất (`classifyTone12`'s weakest
  axis) trên `AxisMeters.tsx` để chỉ rõ "đây là trục không chắc chắn" thay vì chỉ có caption
  chung "A quick drape session will sharpen this." bên dưới. Cần chốt UX với anh Khôi trước
  (thêm state/prop mới cho AxisMeters) nên để lại backlog thay vì tự quyết trong session này.
- [ ] **Persist `secondaryTone12`/`confidence` vào `profiles`** (deferred từ Phase A,
  2026-08-04) — theo đúng hợp đồng A5.5, hai field này hiện chỉ session-local (tính lại mỗi
  lần result screen mount, không lưu qua `savePersonalColor`). Nếu muốn hiển thị "leaning
  {tone}" ở profile/feed sau khi rời màn hình kết quả thì cần thêm cột + migration + thread
  qua `savePersonalColor` payload — ngoài phạm vi Phase A (hard constraint: không đổi DB
  schema/payload trong phase này).
- [ ] **Camera scan — EXIF fix efficacy**: xác nhận trên Android thật rằng bỏ
  `skipProcessing` cho pixel đứng thẳng và MoveNet detect được pose.
- [ ] **Camera scan — overlay/preview alignment**: skeleton SVG có thể lệch khi aspect
  still ≠ preview (cover-crop). Cosmetic, không ảnh hưởng số đo. Cần aspect ratio runtime.
- [ ] **Camera scan — surface estimate confidence**: `EstimatedMeasurements.confidence`
  tính rồi nhưng chưa hiển thị; cân nhắc badge/warning trên success veil. (Không làm trong
  đợt quét 2026-07-03 vì `measurements-scan.tsx` đang là WIP của phiên khác — tránh conflict.)
- [ ] **MoveNet dtype/dequant trên build thật**: nhánh float32 vs uint8 trong
  `poseEstimate.ts`, letterbox đen vs mid-grey, và retune `K` heuristics vs thước dây thật.
  **Tool đã sẵn sàng (2026-07-06)**: `scripts/measure-eval` (xem plan.md changelog
  cùng ngày) — capture scan qua `app/measurements-scan.tsx` (`__DEV__`, dòng log
  `[MEASURE_EVAL_JSON]`), điền tape-measure thật vào `groundTruth`, thả vào
  `scripts/measure-eval/fixtures/`, chạy `npm run measure-eval -- --calibrate` ra bias/
  MAE/RMSE per-field + tunables đề xuất — không cần quét lại. Blocker: cần capture ≥3
  subject thật (1 subject dễ overfit MAE về ~0, không đáng tin).
- [ ] **Try-On verdict — retune `GIRTH_K`/`GIRTH_RATIOS`** vs số đo thật; cân nhắc badge
  "estimated" trực quan trên client (hiện chỉ đổi copy).
- [ ] **Android 16 KB page-size**: `react-native-fast-tflite@2.0.0` đã fix trên giấy —
  phải rebuild + chạy `python scripts/check-16kb.py` + launch trên emulator 16 KB.
- [ ] **Splash Android 12+**: wordmark ngang có thể bị shrink/crop trên OS splash một số
  máy; nếu xấu → dùng M mark cho OS splash, wordmark chỉ ở JS splash.
- [ ] **Launcher icon — ACTION để thấy được**: rebuild + reinstall native (`npx expo
  run:android` / EAS); Android có thể cache icon cũ → uninstall trước. Sau đó commit
  `android/.../mipmap-*` + splash + manifest đã regenerate (chờ anh Khôi gật commit).
- [ ] **Pose accuracy — ý tưởng cần device tuning**: perspective/camera-tilt correction;
  ~~temporal averaging nhiều frame lấy median~~ [x] implemented 2026-07-06 (xem plan.md
  changelog "Measurement accuracy — multi-frame median aggregation" +
  `src/features/measurements/aggregateFrames.ts`) — còn lại: cross-check
  `noseAnkleHeightFraction` bằng eye/ear midpoint. Upper-arm/neck/thigh/foot vẫn
  manual-only (pose không với tới).
- [ ] **Multi-frame aggregation — device verify** (2026-07-06, xem plan.md changelog
  cùng tên): (1) latency của segmentation chạy 3× thay vì 1× tại thời điểm capture —
  đo trên máy thật xem 'processing' veil có đứng lâu khó chịu không, cân nhắc chạy
  song song (`Promise.all`) hoặc giảm `BUFFER_SIZE` nếu chậm; (2) xác nhận ring buffer
  (`frameBufferRef` trong `measurements-scan.tsx`) dọn sạch cả 3 file tạm — không leak
  ảnh nào qua khỏi phiên scan (privacy contract) — kiểm tra document directory trên máy
  thật sau vài lần scan liên tiếp (auto-capture, Capture-now, self-timer, và pose-lost
  giữa chừng).

- [ ] **Personal color — calibrate hue-angle thresholds (47°/57°) + skin gamut với ảnh cổ
  tay thật** (2026-07-06): ngưỡng hiện tại là ước lượng; cần vài ảnh wrist thật (flash bật/
  tắt) để tune. Cũng verify darkest-cluster tóc với tóc nhuộm/nền tối.

- [ ] **Try-on face compositing — device tuning** (2026-07-07, feature 010: xem plan.md
  changelog "Try-on face compositing — paste real face onto generated image" +
  `src/features/try-on/{faceDetect,faceCompositeMath,faceComposite}.ts`). Chưa smoke-test
  trên thiết bị/emulator thật (chỉ verify `tsc`/`jest` từ máy dev). Các tham số
  CALIBRATION-PENDING cần tune bằng ảnh thật:
  - BlazeFace input normalization: đang thử `[0,1]` trước (`NORMALIZE_TO_UNIT = true` trong
    `faceDetect.ts`); nếu model không detect được face nào trên thiết bị thật, đổi sang
    `[-1,1]` (`pixel/127.5 - 1`, đã có sẵn nhánh code, chỉ cần flip constant).
  - Feather radius + mask ellipse size (`MASK_RX_FACTOR`/`MASK_RY_FACTOR`/`MASK_FEATHER` trong
    `faceComposite.ts`) — hiện là bội số ước lượng của khoảng cách hai mắt, chưa test trực
    quan xem có che đúng vùng mặt (không dính tóc/tai/quai hàm) không.
  - Color-match strength (`colorTransfer` mean/std transfer trong `faceCompositeMath.ts`) —
    chưa biết paste vào có nhìn "dán" hay tự nhiên trên ảnh generated thật.
  - Alignment plausibility gate (`MIN/MAX_PLAUSIBLE_SCALE`, `MAX_PLAUSIBLE_ROT_DEG` trong
    `faceCompositeMath.ts`) — ngưỡng ước lượng, chưa biết bao nhiêu % ảnh thật bị reject/
    fallback do lệch góc/scale.
  - **Giới hạn đã biết trước (không phải bug)**: khi góc đầu giữa ảnh gốc và ảnh generated
    lệch quá nhiều (ví dụ ảnh gốc chụp nghiêng nhưng model generate ra mặt thẳng), gate sẽ
    reject và fallback về ảnh generated gốc (không ghép mặt) — chấp nhận được vì ghép mặt
    lệch góc quá sẽ bị méo, nhưng cần biết đây là behavior có chủ đích khi debug "sao không
    thấy mặt thật".

## C. Hoãn có chủ đích (đã quyết không làm bây giờ)

- [ ] **Live weather/temperature API**: season theo ngày+bán cầu đã đủ tốt; nhiệt độ thật
  là tier chính xác kế tiếp. Tiền đề: lưu GPS lat/lng (mục dưới). Hook sẵn: `EngineContext`
  đã có `weatherSeason`, fetch sẽ nằm ở generate-outfits + evaluate-item index.
- [ ] **Persist GPS lat/lng**: chính xác hemisphere cho nước xích đạo + unblock weather API.
  Cột mới + capture trong `locationService` (đã có GPS fix trong tay). Làm cùng weather API.
- [ ] **Slot mid-layer thứ 6** (look 3 lớp thật: base+mid+outer): đụng OutfitSlots/canvas/
  Collage/outfit-key/paging; user base VN ít cần — chờ nhu cầu thị trường lạnh.
- [ ] **B-full — vision-camera realtime overlay** (~15fps): 4 native deps mới + rủi ro
  16 KB alignment; chỉ làm nếu B-lite (~1.2s poll) lag thật ngoài đời.
- [ ] **Branding 0b**: `MIEN-icon-dark` làm iOS dark/tinted icon; wordmark trên header
  Home/Profile. Cosmetic, làm khi polish branding.
- [ ] **Splash tone-shift**: splash bg #F2ECE0 ấm hơn canvas #FAF7F2 một chút tại handoff —
  để nguyên; muốn hết thì recolor png về #FAF7F2 hoặc để transparent.
- [ ] **Weather filter trên feed (nếu muốn quay lại)**: giờ mỗi outfit đã có `weatherBand`
  thật (2026-07-03) nên filter/auto-bias theo band đã khả thi — làm khi có nhu cầu UX.
- [x] **`pose_estimated` + `measurements_consent` chưa được map trong measurementService**
  (2026-07-05, phát hiện khi fix `body_shape` mapping) — FIXED 2026-08-11: root cause hoá
  ra là 2 interface `BodyMeasurements` khác nhau tồn tại song song (`src/types/fitEngine.ts`
  và `src/types/measurements.ts`) — `measurementService.ts` import nhầm bản THIẾU 2 field
  này. Giờ map cả hai chiều (`rowToBody`/`bodyToRow`); cả 2 cột đều `NOT NULL DEFAULT false`
  trên live schema (verify qua Management API) nên chỉ ghi khi caller thực sự set giá trị,
  không bao giờ ghi `null`. **CÒN TREO**: map xong không có nghĩa app đã THỰC SỰ set
  `poseEstimated` từ một flow đo-bằng-pose thật nào — xem mục mới trong section AE bên dưới.
- [x] **Xoá bust/waist/hip không clear `body_shape` cũ trong DB** (2026-07-05) — FIXED
  2026-08-11: cả `useMeasurements.save()` lẫn `measurements-edit.tsx`'s `handleSave` giờ
  ghi `bodyShape` (giá trị `BodyShape | null`) thẳng xuyên qua thay vì `bodyShape ?? undefined`
  — `null` giờ tới được `measurementService.bodyToRow()` như một lệnh xoá tường minh thay vì
  bị `undefined` làm upsert bỏ qua cột. `wear.tsx`'s read (`measurements?.bodyShape ??
  undefined`) và `types/fitEngine.ts`/`types/measurements.ts`'s doc comment cũng cập nhật
  theo ngữ nghĩa 3 trạng thái (set | clear | để nguyên) này.
- [ ] **Dịch data-catalog content (2026-07-06, từ i18n sweep)**: `src/data/index.ts`'s
  demo style/color/occasion display names (`'OLD MONEY'`, `'CASUAL FRIDAY'`, `'STREETWEAR'`…),
  `build.tsx`'s synthetic `style`/`context` fallback (`'CUSTOM'`, `'CASUAL'`), và server-side
  `FormulaCatalogItem.name`/`.description` (đã có field `nameVi` sẵn nhưng CHƯA ai đọc nó) đều
  là nội dung dữ liệu, không phải UI chrome — vẫn tiếng Anh bất kể ngôn ngữ app đang chọn.
  Cần một bilingual data layer (migration thêm cột `*_vi`, hoặc join catalogue theo locale)
  chứ không sửa được bằng key i18n phía client — hoãn lại như content work riêng.
- [ ] **Spot-check UI cả 2 ngôn ngữ trên thiết bị thật (2026-07-06, từ i18n sweep)**: sau khi
  externalize toàn bộ ~38 screens (5 batch + đợt hoàn thiện outfit/[id].tsx + error strings
  trong store/service), 980 keys en/vi đã sync và tsc/jest xanh — nhưng chưa chạy trên máy
  thật để kiểm tra layout/truncation khi tiếng Việt dài hơn tiếng Anh (dấu, độ dài chuỗi khác
  nhau có thể vỡ layout ở nút bấm ALL-CAPS hẹp, banner lỗi, v.v.).

## E. Bảo mật & crash risk — audit toàn app 2026-07-03 (4-agent review)

Đã fix ngay trong phiên này: 2 nút "Sign out" không gọi `authStore.logout()`
(`app/(tabs)/index.tsx`, `app/(tabs)/profile.tsx` — session/state cũ không bị xoá) +
bug URI `content://` Android khiến Try-On Scan và Add-to-Wardrobe AI-extract crash khi
chọn ảnh thư viện (`tryOnStore.ts` + `useAddWizard.ts` toDataUri, giờ đi qua
`manipulateAsync` như `tryOnWearService` đã làm).

**Bảo mật (edge functions) — cả 3 xử lý xong 2026-07-03 (phiên engine):**
- [x] **SSRF trong `backfill-item-metadata`** — FIXED: thêm `isAllowedImageUrl` (chỉ
  Supabase Storage host + optional env `BACKFILL_IMAGE_HOSTS`), fallback URL tuyệt đối
  giờ throw nếu ngoài allowlist, fetch dùng `redirect:'error'`. Đã deploy.
- [x] **Rate-limit curation trong `generate-outfits`** — FIXED: `consume_rate_limit`
  bucket `curate_feed` 30/giờ trước bước Gemini; quá ngưỡng thì degrade êm về rule order
  (feed không bao giờ bị chặn), RPC lỗi fail-open. Đã deploy.
- [x] **RLS `clothing_items` — VERIFIED trên live DB**: 4 policy (select/insert/update/
  delete) đều join qua `wardrobes.user_id = auth.uid()` — đúng chuẩn, migration files chỉ
  là drift. Một quirk ghi nhận: policy SELECT cho phép đọc row `wardrobe_id IS NULL`
  (thiết kế cho seed dùng chung?); hiện 0 row như vậy → vô hại, nhưng nếu sau này có
  cơ chế insert row không wardrobe thì cần xem lại nhánh này.

**Crash / hang (Critical–High) — đã fix 2026-07-03:**
- [x] **`hydrate()` không có timeout — treo màn hình vô hạn khi mạng chập chờn.** Fix:
  `src/utils/withTimeout.ts` (mới) race Supabase call trong `authStore.hydrate()` +
  `appStore.hydrate()` với `HYDRATE_TIMEOUT_MS=15s`; timeout → fallback null/undefined
  (coi như không có session, giống hành vi lỗi thật đã có sẵn), lỗi thật vẫn propagate
  bình thường để catch-block console.warn như cũ.
- [x] **Try-On: back cứng (hardware back/swipe) bỏ qua `discard()`** → leak file tạm. Fix:
  `ResultScreen.tsx` thêm `useEffect` cleanup-on-unmount gọi `discard()` (idempotent, an
  toàn khi đã discard rồi qua handleBack/handleViewWardrobe; Stack push Mix&Match không
  unmount màn này nên không bị gọi nhầm). Đồng thời `tryOnStore.scan()` giờ có generation
  token: `reset()`/`pinWardrobeItem()`/mỗi `scan()` mới bump token; scan() dở dang bị huỷ
  (back X trong lúc scanning giờ gọi `reset()`) sẽ tự dọn file vừa tạo và không ghi đè state
  khi resolve trễ — sửa luôn race "stale scan tự nhảy vào Result sau khi đã cancel".
- [x] **`useAddWizard`/`tryOnStore` chưa guard double-submit UI (double-tap nút).** PARTIALLY
  FIXED 2026-08-11: `src/features/try-on/components/ScanScreen.tsx` đóng khoảng hở thật —
  `tryOnStore`'s `status` chỉ chuyển `'scanning'` SAU KHI permission request + native picker
  UI đã resolve, nên double-tap nhanh vào "Take photo"/"Choose from library" có thể mở picker
  gốc 2 lần đồng thời. `pickerBusy` state mới disable cả 2 nút cho toàn bộ handler (không chỉ
  đoạn gọi `scan()` sau picker). Nút Add-to-Wardrobe (wardrobe-add wizard) đã được guard riêng
  từ trước, KHÔNG đụng tới trong đợt này.

- [x] **`app/measurements-scan.tsx` imports `'expo-file-system'` (new API), not
  `'expo-file-system/legacy'`** (phát hiện 2026-07-06) — **MỤC NÀY ĐÃ LỖI THỜI, KHÔNG CẦN
  SỬA**: kiểm tra lại 2026-08-11, `app/measurements-scan.tsx:43` đã import đúng
  `'expo-file-system/legacy'` từ trước — không rõ đã được sửa ở phiên nào giữa 2026-07-06 và
  hôm nay, nhưng hiện trạng đã đúng. Không có thay đổi nào được thực hiện trong đợt dọn
  backlog 2026-08-11 vì không có gì để sửa.

**Crash / hang (Medium):**
- [x] Loạt màn onboarding gọi async không try/catch (`account.tsx`, `basics.tsx`,
  `location.tsx`, `styles.tsx`, `colors.tsx`, `complete.tsx`, `wardrobe-intro.tsx`) — mất
  mạng giữa lúc bấm Continue/Save làm nút loading kẹt mãi, không báo lỗi.
  `fitEngineStore` write actions (`setBodyMeasurements`, `setStyleProfile`,
  `setColorPreferences`, ...) cũng không tự bắt lỗi, và các trang edit
  (`measurements-edit.tsx`, `styles-edit.tsx`, `colors-edit.tsx`, `formulas-edit.tsx`) gọi
  chúng cũng không catch — Supabase upsert fail thì local state đã lỡ update lạc quan,
  client/server lệch nhau âm thầm. FIXED 2026-08-11: cả 7 màn onboarding giờ có
  try/catch/finally + busy-flag chặn double-tap + `Alert.alert`/inline error khi fail.
  8 write action của `fitEngineStore` (`setFormulaPreferences`, `setSuggestionToggles`,
  `setShapeGoal`, `setBodyMeasurements`, `setStyleProfile`, `setColorPreferences`,
  `addSelectedStyle`, `removeSelectedStyle`) giờ `throw` khi `upsertMy*()` trả `{ ok: false }`
  thay vì đọc-rồi-bỏ-qua kết quả (local optimistic update CỐ Ý không rollback — xem
  plan.md). Cùng fix áp cho `authStore.saveMeasurements` — việc này còn làm SỐNG LẠI một
  nhánh catch chết từ trước: `useMeasurements.save()` đã có try/catch quanh
  `saveMeasurements()` nhưng vì store chưa từng throw nên catch đó chưa bao giờ chạy được.
  4 màn edit (`colors-edit`/`formulas-edit`/`styles-edit`/`measurements-edit`) đều thêm
  `saving` busy-flag + `saveError` hiển thị trên sticky save bar + try/catch/finally quanh
  `handleSave`. i18n key mới `fitEngineStore_syncFailed` (en/vi). Chi tiết đầy đủ:
  `plan.md` "Backlog-clearing session (010-wardrobe-critic follow-up, 2026-08-11)".
- [x] `personal-color.tsx` — `cameraRef.current.takePictureAsync(...)` (2 chỗ) không có
  try/catch; camera bận/app bị background → unhandled rejection, bước scan kẹt im lặng.
  FIXED 2026-08-11 — xem mục đã đánh dấu ở section AB phía trên (cùng fix, áp cho cả
  `personal-color.tsx` lẫn `personal-color-edit.tsx`, 4 điểm gọi tổng cộng).
- [x] `app/try-on/wear.tsx:51` — `JSON.parse(data)` từ nav param không try/catch (khác
  `app/outfit/[id].tsx` đã guard); param hỏng/bị cắt → crash màn hình. FIXED 2026-08-11:
  bọc try/catch, fallback về `OUTFITS.find(...)` giống `app/outfit/[id].tsx` khi parse lỗi.
- [x] `usageCreditService.checkCredit()` fail-open — FIXED 2026-07-03: check `error`, trả
  hết credit (fail-closed) khi query lỗi thay vì coi như `used:0`.
- [x] Try-On `evaluate-item/scoring.ts:194` — FIXED 2026-07-03: đổi `!item.colorProfile.hue`
  thành `typeof item.colorProfile.hue !== 'number'`.
- [x] **MỚI phát hiện khi fix mục trên** — `evaluate-item/scoring.test.ts:212` "perfect-fit
  scores higher composite" — FIXED 2026-07-05: root cause là `evaluate-item/scoring.ts`
  vẫn dùng `bodyShapeMultiplier` theo semantics CŨ (`raw * mult`), trong khi engine đã
  đổi sang additive delta [-0.10, +0.10] ngày 2026-07-03 → hễ profile có body_shape thì
  fit score sập về ~0 với mọi item (fixture test có body_shape: 'rectangle' nên 2 item
  cùng ra 71). Sửa thành `clamp01(raw + delta)`; 21/21 green; đã deploy evaluate-item.
- [x] Debounce double-tap — FIXED 2026-07-03: `openOutfit` có in-flight ref guard (chặn
  push trùng route trong ~400ms); `appStore.addWardrobeItem` có in-flight-promise guard.
- [ ] Onboarding bỏ dở giữa chừng (VD: sau location, trước measurements) rồi mở lại app →
  luôn bắt lại từ email/OTP (`(onboarding)/index.tsx` không resume đúng bước), không mất
  dữ liệu nhưng trải nghiệm giật cục.

**Crash / hang (Low, latent):**
- [x] `app/styles-edit.tsx:125` non-null assertion — FIXED 2026-07-03 (cùng đợt fix styles
  catalog): thay bằng guard an toàn, bỏ qua phần tử không tìm thấy thay vì crash.
- [x] `appStore.ts`/`authStore.hydrate()` thiếu in-flight guard — FIXED 2026-07-03: cả 2 giờ
  có in-flight-promise guard, lần gọi thứ 2 khi đang chạy sẽ reuse promise thay vì đua nhau.

## D. Tuning nhỏ — phát hiện 2026-07-03 (từ fixture streetwear)

- [ ] **Pattern-mix ×0.85 cộng dồn với flat-look ×0.85.** Với look streetwear 2 pattern
  toàn đồ tối, hai multiplier nhân nhau (0.7225) → combo 2-pattern tốt nhất đạt 0.865,
  hụt cutoff top-24 (~0.872) dù mọi chiều khác gần tối đa. Đúng thiết kế "single-pattern
  nhỉnh hơn mặc định" nhưng độ cộng dồn hơi gắt cho chính style profile được phép mix.
  Cân nhắc: miễn flat-look multiplier khi đã ăn pattern-mix multiplier (một tội không
  phạt hai lần), hoặc nới pattern-mix lên 0.9 cho pattern-friendly styles. Đo lại bằng
  `run.ts --profile streetwear` sau khi chỉnh.

## F. Audit toàn repo 2026-07-03 (đợt 2, 6-agent Fable) — fix đợt lớn 2026-07-03

Trùng với section E thì không lặp lại. `tsc --noEmit` sạch toàn repo (142/142 jest pass).
Toàn bộ finding dưới đây đã được xác nhận (top 5 verify kỹ + live DB trước khi fix) rồi
fix song song bằng 10 agent + 4 việc Critical tự làm (migration DB + edge fn bảo mật).
Còn lại CHƯA fix: wardrobe-critic perf 16×/request (rủi ro correctness, xem note trong mục
Perf) và fix triệt để RC TRANSFER (cần gọi RC REST API, quyết định phạm vi mới). CHƯA deploy
edge functions / chưa chạy eas build — chờ anh Khôi duyệt riêng.

**Security (Critical–High) — tất cả FIXED 2026-07-03 (áp dụng qua Supabase MCP `apply_migration`, deploy edge fn CHỜ anh Khôi duyệt riêng):**
- [x] **`profiles.account_type` tự-set được qua PostgREST** — FIXED: migration
  `20260703000001_protect_account_type.sql` — trigger `protect_account_type` chặn mọi
  UPDATE đổi `account_type` trừ khi `current_user = 'service_role'` (column-level REVOKE
  riêng không đủ vì Postgres vẫn ưu tiên table-level GRANT có sẵn — đã thử và verify KHÔNG
  đủ trước khi chọn trigger). Verified LIVE bằng transaction rollback test (role
  `authenticated` + JWT giả lập qua `request.jwt.claims`): update bị chặn đúng như thiết kế,
  không có dữ liệu nào bị đổi.
- [x] **Ai cũng xoá vĩnh viễn được demo account** — FIXED: `delete-user/index.ts` giờ lookup
  `account_type` trước, trả 403 nếu `demo`/`admin`.
- [x] `delete-user` (a)(b)(c) — FIXED: purge cả bucket `avatars` lẫn `wardrobe-photos`,
  `listAllPaths()` paginate qua hết object (không giới hạn 100), lỗi storage được log rõ
  (không nuốt) nhưng không chặn xoá auth user (right-to-delete ưu tiên hơn best-effort
  cleanup — orphan storage hiếm, có thể sweep sau).
- [x] `tryon-validate/index.ts` rate-limit — FIXED: `consume_rate_limit` bucket
  `tryon_validate` 30/giờ, vượt ngưỡng trả 429 (khác `curate_feed` fallback êm — validate
  không có fallback rẻ hơn nên chặn cứng). RPC lỗi fail-open.
- [x] `backfill-item-metadata` — FIXED: `secretMatches()` digest-compare constant-time
  (copy từ revenuecat-webhook), `limit` cap còn 150 (`MAX_LIMIT`, default 100), thêm
  `AbortController` 20s cho Gemini fetch.

**Webhook RevenueCat (Medium) — tất cả FIXED 2026-07-03:**
- [x] DB update fail giờ trả **500** thay vì 200 (cả nhánh grant/revoke thường lẫn TRANSFER)
  — RC sẽ retry đúng theo cơ chế của họ.
- [x] Idempotency/out-of-order — FIXED: migration `20260703000002_profiles_rc_last_event_ms.sql`
  thêm cột `profiles.rc_last_event_ms`; `setType()` chỉ UPDATE khi
  `rc_last_event_ms IS NULL OR rc_last_event_ms < event_timestamp_ms` (atomic trong WHERE
  clause, không cần SELECT-then-UPDATE riêng).
- [x] TRANSFER — FIXED MỘT PHẦN (best-effort): nếu event có `expiration_at_ms` và đã qua hạn
  thì không grant premium cho `transferred_to`. RC KHÔNG đảm bảo field này có mặt trên mọi
  TRANSFER payload — khi thiếu, fallback về hành vi cũ (grant vô điều kiện). Fix triệt để cần
  gọi RC subscriber REST API để check entitlement thật — đó là quyết định phạm vi/chi phí
  mới (thêm secret + network call), CHƯA làm, để anh Khôi quyết định có cần không.

**Data-corruption (High):**
- [x] **Toggle CM/IN, KG/LB ở onboarding measurements chỉ đổi nhãn** — FIXED 2026-07-03:
  `useMeasurements.ts.save()` nhận thêm `overrides` param (tránh race setState-async);
  `measurements.tsx.handleContinue` tính cm/kg từ unit hiện tại (×2.54/×0.453592, cùng công
  thức nhánh AI-capture) rồi truyền vào `save(overrides)`.
- [x] **Onboarding styles catalog chết do query sai cột** (2026-07-03, fixed) — root cause
  thật sự khác mô tả gốc: `stylesCatalogService.ts` select `slug/name_vi/related_slugs/
  display_order` — các cột KHÔNG TỒN TẠI trên `public.styles` live (id đã là slug rồi,
  không có cột slug riêng). Query luôn throw, bị `fitEngineStore.loadCatalogs()` nuốt lỗi
  → catalog luôn rỗng → app luôn fallback STYLES tĩnh, không hiển thị lỗi nhưng catalog
  DB chết hoàn toàn. Đã sửa: interface `StyleCatalogItem` khớp schema thật (id/name/
  description/image_url/popularity/neighbors/niches), `styles.tsx` tính related từ
  `neighbors` (top-N theo weight) thay vì `relatedSlugs`, fallback ảnh/mô tả về STYLES
  tĩnh khi null, `styles-edit.tsx:125` bỏ non-null assertion.
- [x] **Tab wardrobe còn AddItemSheet mock** — FIXED 2026-07-03: gỡ hẳn `AddItemSheet`/
  `SIMULATED_ATTRS`/`saveImageLocally`/`mapTypeToCategory` (dead code), nút "+" và "ADD
  FIRST ITEM" giờ đi `/add-item` thật giống FAB.
- [x] `measurements-edit.tsx` isFinite guard — FIXED 2026-07-03: thêm `numOrUndef()` helper
  chạy `isFinite()` cho mọi field đo trước khi ghi.
- [x] `basics.tsx` DOB zero-pad — FIXED 2026-07-03: `buildDob()` helper zero-pad + validate
  qua `Date` round-trip (chặn 31/02) + range năm, hiện Alert lỗi thay vì âm thầm clear DOB.

**Bug logic (High–Medium):**
- [x] `build.tsx:556-574`: `createCollection` không throw; fail → `collections[0]` là
  collection CŨ → items bị append vào sai collection rồi đóng sheet. Cho createCollection
  trả về collection tạo được / abort khi `collectionsError`. — FIXED 2026-07-03:
  `appStore.createCollection` giờ trả `Collection | null` (null khi fail); `addItemToCollection`/
  `updateCollection`/`deleteCollection`/`removeItemFromCollection` trả `boolean` thay vì nuốt lỗi.
  `build.tsx` dùng collection trả về trực tiếp, không đọc `collections[0]` nữa, và abort loop +
  giữ sheet mở khi bất kỳ bước nào fail.
- [x] `measurements-scan.tsx` `busyRef` không reset — FIXED 2026-07-03: `finish()` giờ luôn
  set `busyRef.current = false` cùng `scanningRef.current = false`, kể cả nhánh lỗi.
- [x] **Generated outfits (`gen_…`) vỡ ngoài feed**: saved.tsx:18 chỉ filter `OUTFITS`
  (outfit generated đã save không bao giờ hiện); schedule.tsx:231 + history.tsx:83 push
  `/outfit/{id}` không kèm `data` → "Outfit not found". Pattern đúng có sẵn ở
  history.tsx:33 (`[...OUTFITS, ...generatedOutfits]`). — FIXED 2026-07-03: saved.tsx giờ merge
  `[...OUTFITS, ...generatedOutfits]` (useFitFeed) + push kèm `data`; history.tsx push kèm `data`;
  schedule.tsx `onOpen` resolve outfit đầy đủ qua `outfitMap` (session-local generated outfits)
  và đính `data` khi có, fallback route không data cho outfit tĩnh/đã hết hạn.
- [x] `outfit/[id].tsx:36-38`: list "ITEMS IN THIS OUTFIT" chỉ tra `itemById` (demo
  catalogue) → outfit từ cloud wardrobe hiện 0 item (description path đã fix, list chưa). —
  FIXED 2026-07-03: thêm `ItemDisplay` view-model resolve từ `wardrobeItems` (cloud) trước, fallback
  `itemById` (demo), cùng pattern với `describeItems` đã có sẵn trong file.
- [x] `useAddWizard.confirm()` — FIXED 2026-07-03: track `savedIds`, chỉ clear error 1 lần
  đầu batch (không xoá dấu vết lỗi item trước), retry skip item đã lưu (hết duplicate).
  402 mid-batch giờ dừng cả batch + báo lỗi rõ (resolve TODO có sẵn).
- [x] **tryOnStore race** — FIXED 2026-07-03: `evaluate`/`fetchMixMatch`/`prefetchMixMatch`
  CAPTURE `scanGeneration` lúc bắt đầu (không tự bump — 2 action chạy đồng thời hợp lệ cho
  cùng item, tự bump sẽ tự huỷ lẫn nhau), so sánh trước khi `set()`. `ScanScreen.tsx` thêm
  `pushedForThisScanRef` chặn push `/try-on/result` trùng lần 2.
- [x] `useWearOnYou.generate()` in-flight guard — FIXED 2026-07-03: ref `generating` check
  NGAY ĐẦU hàm (trước cả check premium/credit), release trong `finally`.
- [x] `profile-edit.tsx` stale closure — FIXED 2026-07-03: `useProfileEdit.save()` trả
  `Promise<boolean>`, `profile-edit.tsx` dùng giá trị trả về trực tiếp thay vì đọc lại state
  `error` sau await (pattern giống `personal-color-edit.tsx`).
- [x] `authStore.verifyOtp` phone bị xoá — FIXED 2026-07-03: omit hẳn field `phone` khi
  `pendingAuthMethod === 'email'`.
- [x] `hydrateProfile` transient error — FIXED 2026-07-03: đổi sang query trực tiếp phân biệt
  `error` (giữ nguyên state cũ, không kết luận "chưa onboard") vs "no row" thật (no-op như cũ).
- [x] `completeOnboarding` fail bị bỏ qua — FIXED 2026-07-03: cả 4 call site
  (`complete.tsx` ENTER + "Add items to wardrobe first", `wardrobe-intro.tsx` "ADD FIRST
  ITEM" + "Skip for now") giờ check `res.ok`, hiện `Alert` và KHÔNG navigate khi fail.
- [x] **Cross-account leak khi sign-out** — FIXED 2026-07-03: `fitEngineStore.reset()` giờ
  clear `outfits`/`shownOutfitIds`/`sessionFormulaId`/`premium` + xoá `SHOWN_IDS_KEY`;
  `wardrobeCriticStore` giờ tự đăng ký `onAuthStateChange` (pattern giống fitEngineStore),
  reset toàn bộ report/AsyncStorage khi đổi user (có guard tránh wipe report vừa load ở lần
  `INITIAL_SESSION` đầu tiên cùng user).
- [x] `authStore` onAuthStateChange deadlock + dedupe — FIXED 2026-07-03: đổi sang
  fire-and-forget (giống appStore/fitEngineStore), thêm `lastAuthedUid` dedupe.
- [x] **Timezone UTC+7** — FIXED 2026-07-03: helper `localDateKey()`/`localDateStr()` local
  (device timezone) thay `toISOString().split('T')[0]` — áp dụng cho `toggleSchedule`/
  `markWorn` (thực ra nằm ở `appStore.ts`, không phải `fitEngineStore.ts` như mô tả gốc),
  `resolveCurateFlag`, và `usageCreditService.getPeriodStart`.
- [x] `rowToItem` photoUrl null → collections không ảnh — FIXED 2026-07-03: thêm
  `CollectionGridThumb`/`PickerCard` dùng `useItemPhoto` (resolver đúng, giống
  `WardrobeItemCard`) thay vì đọc thẳng `item.photoUrl`; sửa cả grid chính lẫn Add-items
  picker trong `collections/[id].tsx` (bug giống hệt cũng nằm ở `resolveItemIds`).
- [x] `fetchMoreOutfits` bỏ error + duplicate key — FIXED 2026-07-03: check `error` từ
  `sb.functions.invoke`, merge outfit batch mới vào `outfits` theo `outfitKey` (Map) thay vì
  append thẳng — hết duplicate React key khi `shownOutfitIds` reset.
- [x] `wardrobeService.updateItem`/`deleteItem` — FIXED 2026-07-03: thêm
  `measurementColumnsForUpdate()` cho phép ghi `null` tường minh khi field bị xoá trên UI;
  `deleteItem` đảo thứ tự — xoá DB row trước, ảnh sau (row fail thì dừng, không đụng storage).
- [x] `useFormulaSelector.ts` field sai — FIXED 2026-07-03: đổi sang đọc
  `fitEngineStore.formulaPreferences[0]`, bỏ field `activeFormulaId` không tồn tại.
- [x] generate-outfits + wardrobe-critic: `wardrobeRes.error` không check — FIXED 2026-07-03:
  cả 2 fn giờ check `.error` ngay sau fetch, trả 500 thay vì rơi vào nhánh empty-wardrobe.
- [x] wardrobe-critic bridge tính `unlock_count` trên wardrobe CHƯA qua styleFilter — FIXED
  2026-07-03: export `styleFilter` từ `analyze.ts`, áp dụng trong `index.ts` trước khi gọi
  `unlockCountFor` cho candidate bridge.
- [x] tryon-generate: field `context` (title/style/occasion) parse rồi **không dùng** trong
  prompt — wire vào `buildGenPrompt` hoặc bỏ khỏi contract. Kèm `person_uri` không cap
  size/mime (garment cap 8MB rồi); `fetchImagePart` thiếu `redirect:'error'` (curator có).
  (2026-07-03: wired context → buildGenPrompt; person_uri capped 8MB + image/* mime check
  via parseDataUri; fetchImagePart now uses redirect:'error'.)
- [x] `personal-color-edit.tsx` camera-denied ordering — FIXED 2026-07-03: bỏ
  `startManualPath()` chạy vô điều kiện trước alert, giờ chỉ chạy khi user bấm nút xác nhận.
- [x] `usePremium.purchase()`/`paywall.tsx` — FIXED 2026-07-03: `purchase()` trả
  `'success'|'cancelled'|'error'` (check `err.userCancelled`), `cancelled` im lặng không hiện
  lỗi. `paywall.tsx` setTimeout auto-dismiss giờ track qua ref + clear đúng lúc.
- [x] Collection flows: error banner render TRONG sheet nhưng sheet đóng vô điều kiện →
  không bao giờ thấy; outfit/[id] hiện "ADDED ✓" cả khi add fail toàn bộ; `handleAddItems`
  await tuần tự từng item + không disable nút (double-tap re-run). — FIXED 2026-07-03:
  `collections/[id].tsx` `handleSaveEdit`/`handleAddItems` chỉ đóng sheet khi thành công
  (dùng boolean trả về từ store), thêm `addingItems` in-flight guard disable nút + hiện
  `collectionsError` trong Add Items sheet; `outfit/[id].tsx` chỉ set "ADDED ✓" khi mọi item
  add thành công, thêm `addingToCollection` guard + error banner trong collection picker.
  NOTE: `app/collections/index.tsx` `handleCreate` (dòng ~21-27) có CÙNG bug (đóng sheet vô
  điều kiện sau `createCollection`, dùng `Promise<void>` cũ) nhưng KHÔNG nằm trong phạm vi
  fix lần này (chỉ định rõ 3 file: build.tsx, collections/[id].tsx, outfit/[id].tsx) — cần
  áp dụng cùng pattern (check giá trị trả về, chỉ `sheet.close()` khi thành công) ở lần sau.
- [x] `item/[id].tsx` Alert confirm + season thật — FIXED 2026-07-03: "Remove from wardrobe"
  giờ có `Alert.alert` confirm; SEASON đọc `warmthSeason` thật khi item có data, fallback
  placeholder cũ chỉ khi thiếu.
- [x] `settings.tsx`/`help.tsx` thiếu catch — FIXED 2026-07-03: cả 2 giờ có `.catch` (Alert
  fallback cho `help.tsx` khi máy không có mail client).

**Perf:**
- [x] `useFitFeed.ts`/`useProfileEdit.ts`/`useMeasurements.ts` full-store subscribe — FIXED
  2026-07-03: cả 3 đổi sang per-field Zustand selector.
- [x] `app/(tabs)/index.tsx` `openOutfit`/`onAddItems` không useCallback — FIXED 2026-07-03:
  bọc `useCallback`; kèm thêm in-flight ref guard chặn double-tap push trùng route (mục Low
  bên dưới, section E dòng ~140).
- [x] `app/(tabs)/wardrobe.tsx` grid `.map` trong ScrollView — FIXED 2026-07-03: đổi sang
  `FlatList` 2-cột.
- [ ] **wardrobe-critic chạy full pipeline tới ~16× / request — ĐÃ ĐIỀU TRA 2026-07-03,
  CHƯA FIX (rủi ro correctness).** baseline + mỗi archetype thiếu (~16 archetype) đều gọi
  lại `generateFormulaPools`/`generateCandidates`/`generateHeroCandidates` full trên
  `[...filtered, hypoItem]` rồi `rankCandidates` (tới ~500 formula + ~144 hero candidate
  mỗi lần) — risk CPU ceiling 546 với wardrobe lớn. Định làm "tính candidate list đã
  enrich 1 lần rồi share giữa archetype", nhưng `generateCandidates`/
  `generateHeroCandidates` (`generate-outfits/engine/generation.ts`) dùng CHUNG một
  `mulberry32` RNG stream theo seed cố định; số lượng/thứ tự `rand()` được rút phụ thuộc
  vào chính bộ item đưa vào (số color-family phát hiện được ở `poolMonochrome`/
  `poolTonalGradient`, độ dài mảng đưa vào `shuffle()`, v.v.). Thêm 1 hypo item vào bộ
  item làm lệch toàn bộ chuỗi rand() cho MỌI candidate sau đó — kể cả candidate không
  chứa hypo item — nên không đảm bảo các candidate "không liên quan tới hypo item" giống
  hệt byte-for-byte giữa lần chạy baseline và lần chạy archetype. Share/cache điểm số cũ
  có rủi ro âm thầm đổi kết quả xếp hạng thật (variant/accessory nào được chọn), không chỉ
  đổi hiệu năng. DỪNG LẠI theo yêu cầu — cần redesign RNG stream (VD: sub-seed riêng theo
  archetype/branch) trước khi có thể share an toàn. Xem `plan.md` mục "Server bug fixes"
  2026-07-03 để có phân tích đầy đủ.
- [x] generate-outfits:120: query saved/worn interactions **không limit** — FIXED 2026-07-03:
  thêm `.order('created_at', {ascending:false}).limit(300)` giống query impressions cạnh nó.
- [x] Gemini fetch trong generate-item-image/backfill/map-measurements **không có
  AbortController timeout** (note.ts có 8s) — hang upstream đốt wall-clock, nhánh extract
  có thể mất credit không refund (platform kill trước khi refund chạy).
  (2026-07-03: added to generate-item-image [geminiDetect 15s, geminiIsolate 30s] và
  map-measurements [geminiMapText 8s]. backfill-item-metadata thuộc phạm vi agent khác,
  chưa đụng tới ở đây.)
- [x] Cold start double-fetch — FIXED 2026-07-03: `authStore`/`appStore` `hydrate()` giờ có
  in-flight-promise guard; listener `INITIAL_SESSION` seed sẵn `lastAuthedUid` từ uid
  `hydrate()` vừa resolve nên không fetch profile đôi cho cùng session.
- [x] `resolveCurateFlag` ghi key trước khi fetch — FIXED 2026-07-03: tách thành
  `shouldCurateToday()` (đọc, không ghi) + `markCurateUsedToday()` (ghi), chỉ gọi ghi SAU
  KHI server xác nhận `response.curated === true`; key giờ per-user
  (`` `${CURATED_DATE_KEY}:${userId}` ``).
- [x] `Photo.tsx`/`MeasureField` — FIXED 2026-07-03: `Photo.tsx` reset `errored=false` khi
  `src` đổi (`useEffect`); `MeasureField` chỉ commit khi giá trị thực đổi (tap-in-tap-out
  không re-evaluate) + normalize dấu phẩy `,`→`.` trước `parseFloat`.
- [x] `profileService.ts` MIME PNG — KIỂM TRA 2026-07-03: đã là `'image/png'` đúng (forward
  slash) trong code hiện tại, không phải bug thật — không có gì để sửa.
- [x] OTP input thiếu autofill — FIXED 2026-07-03: thêm `autoComplete="one-time-code"` +
  `textContentType="oneTimeCode"`.
- [x] **Research body-shape importance** — DONE 2026-07-06: deep-research hoàn tất (23 claim
  verified: 9 Fable 3-0 + 14 Sonnet 1-0; 2 refuted). Báo cáo cuối:
  `docs/research/body-shape-importance-FINAL.md` (+ INTERIM.md + state JSON cùng thư mục).
  Lần chạy cuối bằng script Sonnet-only `scripts/research/body-shape-verify-continue.workflow.js`
  tốn ~569k token (2 lần chạy Fable trước đó đốt ~1.86M mà không xong — bài học: stage verify
  đông agent phải gán model rẻ).
- [x] **Chốt & implement trọng số body-shape theo report** — DONE 2026-07-06 (anh Khôi duyệt):
  `bodyShapeAdjustment` = rule ±0.10 × gain 3.2 × fit-specificity, clamp ±0.32 → outfit ~±3/100,
  purchase ~±8/100, oversized ≈ 0; deployed generate-outfits + evaluate-item + wardrobe-critic
  (xem plan.md changelog). Còn ý (5) toggle "body-neutral mode" → tách mục riêng dưới.
- [x] **Toggle "body-neutral mode"** — DONE 2026-07-07: `bodyNeutralMode` (appStore,
  persisted, mirrors `genderAwareStyling`) gửi `body_neutral: true` tới cả 3 engine
  (generate-outfits/fetchOutfits+fetchMixMatchOutfits+fetchMoreOutfits, evaluate-item,
  wardrobe-critic). Server: khi `body_neutral` true → null hoá `bodyMeasurements.body_shape`
  TRƯỚC khi vào engine, tái dùng toàn bộ guard `if (!body.body_shape)` sẵn có → xoá cả
  scoring delta lẫn rationale text trong 1 nước. Settings toggle + i18n key-synced. Xem
  plan.md changelog "Body-neutral styling toggle (2026-07-07)".
- [ ] **"Comfort" như một sub-score tường minh trong engine** (2026-07-06, ý tưởng từ
  research body-shape — comfort là tiêu chí mua hàng hàng đầu cùng fit): hiện engine đã có
  các proxy rời rạc (ease số đo garment−body + cảnh báo "may be tight", fit vs preferredFit,
  fabric weight/season). Có thể gộp thành điểm "comfort" hiển thị được cho user ở
  evaluate-item. Chờ duyệt phạm vi.
- [ ] **Silhouette scan v2 — device verification + calibration** (2026-07-06): (1) verify
  selfie-segmenter float16 load được qua react-native-fast-tflite trên iOS/Android thật;
  (2) chất lượng mask khi đứng 2-3m, nền không trơn; (3) tay ép sát thân → run eo dính tay
  (đã đổi copy sang A-pose, cân nhắc thêm pose-gate check tay); (4) calibrate `S` bands +
  `contourShoulderInset` vs số thước dây thật của anh Khôi (shoulder thật, waist thật).
- [x] **MoveNet Thunder (256px) thay Lightning** (2026-07-06, tùy chọn) — DONE 2026-07-12,
  nhưng dưới dạng KHÁC với đề xuất gốc: thay vì thay hẳn Lightning trong live poll loop
  (chậm hơn ~2-3x mỗi frame, không hợp cadence 1.2s), Thunder chạy như **pass 2 refinement**
  tại thời điểm capture — crop quanh người (từ pass-1 Lightning keypoints qua
  `personCropRect`), infer lại trên crop đó, map kết quả về full-square space. Lightning vẫn
  chạy live poll loop y nguyên. Xem `plan.md` changelog "Body-measurement pipeline precision
  overhaul (2026-07-12)" + `src/features/measurements/{cropMath,poseEstimate}.ts`.
- [ ] **`evaluate-item` AI fit-note type mismatch** (2026-07-06, phát hiện khi làm tone12
  quality bonus — không thuộc phạm vi task đó, không do session này gây ra): `deno check
  supabase/functions/evaluate-item/index.ts` báo TS2322 tại lời gọi `buildNoteContext(...)`
  — `note.ts` khai báo tham số `pattern?: string` nhưng `ClothingItemRow.pattern` thực tế là
  `string | null | undefined`. Xác nhận bằng `git stash` (lỗi vẫn còn khi bỏ hết đổi của
  session tone12, tức thuộc code AI-fit-note đã có sẵn từ trước, chưa commit). Không chặn
  `deno test` (không type-check) hay `supabase functions deploy` (không hard-fail trên lỗi
  này), nhưng nên fix cho sạch: đổi `pattern?: string` → `pattern?: string | null` trong
  note.ts, hoặc coalesce `itemRow.pattern ?? undefined` tại call site.
- [x] **SEASON_FLATTERING.avoid có entry chết** — FIXED 2026-07-06 (measured-hex color layer
  session): mở rộng `PrimaryColor` union +11 (`mustard, rust, coral, mint, lavender, sage,
  terracotta, mauve, wine, fuchsia, denim` — xem `plan.md` changelog). `COLOR_MAP` trong
  `enrichment.ts` giờ trỏ Mustard/Rust/Terracotta/Wine/Sage sang đúng primaryColor riêng
  (trước collapse vào yellow/orange/orange/burgundy/green) thay vì mở rộng phạm vi phạt của
  nhóm màu cũ. `SEASON_FLATTERING.avoid` (mustard/rust/fuchsia) và `TONE12_AVOID` (engine +
  client) giờ fire thật.
- [x] **measurements-scan.tsx import `expo-file-system` bare (privacy leak)** — FIXED 2026-07-06:
  file import bare `'expo-file-system'` (SDK54 v19: top-level = File/Directory API mới, KHÔNG có
  `deleteAsync`) → 5 call `FileSystem.deleteAsync` throw, bị `.catch(()=>{})` nuốt → frame camera
  giữ pose KHÔNG bao giờ xoá dù comment "PRIVACY: deleted". Đổi sang `expo-file-system/legacy`
  (đúng như 11 file khác). Phát hiện khi build accuracy harness.

## G. Profile wiring — Subscription/Notifications (2026-07-07)

- [ ] **Push notification DELIVERY infrastructure not implemented** (2026-07-07,
  wiring the Profile "Notifications" row): expo-notifications registration,
  permission request, scheduling, and server-side triggers. The new
  `app/notifications.tsx` screen currently only persists preferences locally
  (`appStore.notificationPrefs`) — toggling a switch there does not cause any
  notification to actually be sent.
- [ ] **Profile rows "Location & weather" and "Connected accounts" are still
  unwired (no route)** (2026-07-07, same session as Subscription/Notifications
  wiring in `app/(tabs)/profile.tsx` SECTIONS) — tapping them still does nothing.

## H. Silhouette-first resolution (2026-07-12)

- [ ] **Port formula system to data-driven executor (compose(spec,pool)+matches(spec,outfit),
  YAML-style constraint specs) — deferred half of Option 2**; current formulas are 10
  hardcoded pool functions in `supabase/functions/generate-outfits/engine/generation.ts`.
  Reason: large/risky refactor, not needed for silhouette-first work.
- [ ] **Thread `targetSilhouette` into `buildAroundFixed`'s brute-force enumeration itself**
  (2026-07-12, silhouette-first resolution session) — the pinned/hero candidate paths
  (`generatePinnedCandidates`/`generateHeroCandidates`) only got a lighter touch (id-pool
  measurement-priority ordering, hero-ranking boost) instead of the full
  `pairAffinity`-style confidence-blend that `generateFromPool` got. Left out to keep the
  change surface small; `buildAroundFixed` operates on id arrays only (not `FitItem`s),
  so wiring this in properly needs a small refactor to pass items through.
- [ ] **Floor `wProportion` upward when measured item count is high**, mirroring the
  existing `wFit` 0.18 floor in `engine/ranking.ts` (2026-07-12) — spec called this out as
  optional ("only if it doesn't destabilize existing tests"); skipped to keep risk low for
  this pass.
- [x] **Dịch ~37 tên màu primaryColor sang vi cho colorTone tag trên feed card** (2026-07-12)
  — tạm hiển thị tên EN viết hoa (không có namespace màu i18n sẵn có để tái dùng, xem
  `app/(tabs)/index.tsx` `colorToneMetaLabel` + `src/design/feed/design.md`).
  RESOLVED 2026-08-11: `PrimaryColor` hiện có 37 giá trị (enum đã +11 ở một phiên trước —
  đếm lại từ chính type, không tin số "~37" cũ). Thêm namespace i18n `colorTone_<value>`
  (37 key, cùng shape với `outfitSilhouette_*`/`outfitShape_*` đã có) vào cả `en.json` và
  `vi.json`. `colorToneMetaLabel` trong `app/(tabs)/index.tsx` giờ nhận thêm `t` và tra
  qua map `COLOR_TONE_I18N_KEYS` rồi `.toUpperCase()` — y hệt cách render cũ cho mọi giá
  trị hiện có, ở cả hai locale. Fail-soft: giá trị chưa có key (PrimaryColor mới thêm sau
  này) rơi về raw `.toUpperCase()` như hành vi cũ, không bao giờ hiện raw i18n key. Grep
  toàn app không thấy call site nào khác render raw `PrimaryColor` viết hoa; chỗ gần giống
  (`app/item/[id].tsx` `colorText`) render `WardrobeItem.colors` (mảng string tự do người
  dùng nhập, không phải enum `PrimaryColor`, không viết hoa) — để nguyên, không phải chỗ
  đổi máy móc được. Chi tiết + bảng EN→VI đầy đủ: `src/design/feed/design.md` mục
  "Colour tone i18n (2026-08-11)". Verify: `npx tsc --noEmit` sạch, `npx jest` 39
  suites/561 tests pass, script kiểm tồn tại đủ 37 key ở cả 2 file JSON — pass.

## I. Body-measurement precision overhaul — pending (2026-07-12)

Xem `plan.md` changelog "Body-measurement pipeline precision overhaul (2026-07-12)" +
"BlazePose Heavy + MODNet model upgrade (2026-07-12)" cho toàn bộ thay đổi (refinement
pass, sub-pixel mask edges, mask-extent/heel scale blend, tilt gate, model upgrade,
latency guard, v.v.). Verify chỉ chạy được `tsc --noEmit` + `jest` từ máy dev — CHƯA chạy
trên thiết bị/emulator thật (yêu cầu rõ trong cả hai task: "on-device validation is out
of scope"/"Do NOT run the app").

- [x] ~~Cân nhắc Thunder int8 (~7MB) nếu app size quan trọng~~ — MOOT 2026-07-12: Thunder
  đã bị thay hẳn bằng BlazePose Heavy (33 landmark, xem entry model-upgrade). Câu hỏi
  app-size tương đương giờ áp dụng cho BlazePose Heavy (27.7MB) — xem mục app-size dưới.
- [ ] **Calibrate K constants với fixtures thật (tape measurements) qua scripts/measure-eval
  — chưa có fixture nào.** `CALIBRATABLE_KEYS` giờ có thêm `maskExtentFudge`,
  `shoulderBlendContour`, `kpShoulderFactor` (14 field); bản thân `maskExtentWeight`,
  `heelWeight`, `heightEstimateDisagreementBand`, `noseCrownFraction` (không nằm trong
  danh sách calibratable — xem note trong `landmarksToMeasurements.ts`) đều là số ước
  lượng physically-motivated, chưa test với ảnh thật. Cần capture ≥3 subject thật qua
  `app/measurements-scan.tsx` (`__DEV__`, dòng log `[MEASURE_EVAL_JSON]`) + tape đo thật vào
  `groundTruth` — capture nên có cả feet visible trong khung hình để exercise nhánh heel
  mới (nếu feet bị crop, `hHeel`/heel-based inseam đơn giản không kích hoạt, không lỗi).
- [ ] **Device verify — BlazePose Heavy + MODNet asset/shape thật** (2026-07-12, model
  upgrade session): xác nhận qua log `__DEV__` (`[BLAZEPOSE] inputs=/outputs=`,
  `[MODNET] inputs=/outputs=`) trên thiết bị thật rằng: BlazePose Heavy input đúng
  `[1,256,256,3]` float32 [0,1] và output có đúng 1 tensor length 195 (landmarks) + 1
  tensor length 1 (poseflag); MODNet input đúng `[1,3,512,512]` NCHW float32 [-1,1] và
  output length 1 tensor `[1,1,512,512]`. Nếu shape thực tế khác spec (model card), code
  đã defensive (length-based lookup → null → fallback) nhưng sẽ ÂM THẦM không bao giờ kích
  hoạt refine/matte pass — log là chỗ đầu tiên phải xem nếu nghi ngờ pipeline không chạy.
- [ ] **Device verify — GPU delegate** (2026-07-12): `loadModelWithGpuFallback`
  (modelLoad.ts) thử `'android-gpu'`/`'metal'` trước khi fallback CPU cho cả BlazePose
  Heavy và MODNet — CHƯA verify trên thiết bị thật delegate GPU có load được không (nhiều
  model không support mọi GPU delegate), và nếu load được thì tốc độ cải thiện bao nhiêu
  so với CPU. Log `[BLAZEPOSE] loaded delegate=...` / `[MODNET] loaded delegate=...` (in
  `__DEV__`) cho biết delegate nào thực sự đang chạy.
- [ ] **Device verify — latency guard** (2026-07-12): đo thời gian thực tế 'processing'
  veil với latency guard mới (refine tối đa 3/4 buffered frame, xem
  `MAX_REFINE_FRAMES` trong `measurements-scan.tsx`) — có đủ nhanh không so với bản cũ
  (refine cả 4 frame), và nhánh fallback (<2 refine thành công → full-frame segmentation
  lại TOÀN BỘ buffer) có làm capture chậm hẳn trong trường hợp xấu (refine fail nhiều)
  không. Dev log `[MEASURE_SCAN]` giờ có thêm `refined=X/Y (cap Z)` để debug nhánh nào chạy.
- [ ] **BlazePose z (depth) chưa dùng** (2026-07-12, ghi trong doc comment
  blazePoseDecode.ts/poseEstimate.ts) — model trả về depth tương đối theo hip nhưng hiện
  tại bị bỏ qua hoàn toàn. Future work: có thể dùng để cải thiện ước lượng độ sâu vòng
  ngực/eo/hông thay vì ellipse-perimeter fudge ratios cố định (`chestDepthRatio` etc.) nếu
  z đủ ổn định qua nhiều frame — chưa nghiên cứu.
- [ ] **App-size check: BlazePose Heavy (27.7MB) + MODNet (26MB) = +53.7MB so với Lightning
  + selfie-segmenter riêng** (2026-07-12) — nếu app size là mối lo, cân nhắc bản quantized
  nhẹ hơn của một hoặc cả hai model (nếu tồn tại) — chưa khảo sát.
- [ ] **Device verify — phần còn lại của 2026-07-06/07-12 sessions** (giống pattern các
  session trước — xem section B): tilt threshold `TILT_THRESHOLD_RAD = 0.21` (~12°) có
  hợp lý không (false-positive khi cầm hơi nghiêng tự nhiên?); crop margins
  (`marginTop/Bottom/Side` trong `cropMath.ts`, tuned cho Thunder nhưng giữ nguyên cho
  BlazePose) có đủ không bị cắt đầu/chân/tay trên ảnh thật.
- [ ] **Device verify — side-view (profile) depth capture** (2026-07-12, session mới nhất,
  xem plan.md changelog "Side-view (profile) depth capture — replaces BMI-guessed depth"):
  chỉ verify được `tsc`/`jest` từ máy dev, CHƯA chạy app thật. Cần kiểm tra trên thiết bị:
  - **BlazePose độ tin cậy ở tư thế profile**: model được huấn luyện chủ yếu trên ảnh
    front-facing; chưa rõ `assessSidePose`'s profile check (x-span < 0.10×frameFill) có
    quá chặt/quá lỏng không, và BlazePose Heavy refine có thực sự sharpen được keypoint ở
    góc nghiêng hay không (có thể cần nới/tune `SIDE_PROFILE_SPAN_MAX`).
  - **Bán kính xoá tay (`eraseDisk`, 0.06 × person-unit height)**: chưa biết có che đúng
    hết bàn tay không (quá nhỏ → sót tay dính vào contour hông; quá to → ăn luôn vào hông
    thật) trên ảnh thật với các tư thế tay thả lỏng khác nhau.
  - **Thời lượng turn interstitial (`TURN_INTERSTITIAL_MS = 2500`)**: đủ thời gian để người
    dùng xoay 90° và ổn định tư thế trước khi side loop bắt đầu chấm điểm không.
  - **Row-fraction cross-view registration**: giả định "cùng fraction của shoulder→hip
    span thì cùng hàng giải phẫu dù 2 ảnh khác khoảng cách/crop" — CHƯA kiểm chứng với ảnh
    thật (có thể lệch nếu góc camera/perspective giữa 2 lần chụp khác nhau đáng kể — đây
    cũng là lý do `capturePitchRad` được ghi log làm groundwork, chưa dùng để correct).
  - **Latency 2 lượt scan**: front + side (mỗi bên có refine+segment riêng) tốn bao nhiêu
    thời gian thực tế ở màn 'processing' — "x/y" progress line có giúp bớt cảm giác treo
    máy không, cân nhắc giảm `SIDE_BUFFER_SIZE`/`SIDE_MAX_REFINE_FRAMES` nếu chậm.
  - **`sideDepthWidthRatioMin`/`Max` (0.45/1.35) và `superellipseN` (mặc định 2.0, chưa
    đổi)**: cần ≥3 fixture thật (side.depthsU + tape đo thật vòng ngực/eo/hông) qua
    `scripts/measure-eval` để biết band/exponent này có hợp lý không — hiện chưa có fixture
    v2 nào (chỉ có `example.json` v1).

## H. Settings & monetization follow-ups (2026-07-23)

- [ ] **RevenueCat / IAP go-live** — full step-by-step checklist written in `plan.md`
  ("RevenueCat / In-App Purchase go-live plan — PLAN ONLY, not implemented (2026-07-23)").
  Scaffolding (SDK, `usePremium`, paywall, `revenuecat-webhook` edge fn) already exists;
  blocked on external account setup (App Store Connect + Google Play + RevenueCat dashboard)
  which only anh Khôi can do, plus a public SDK API key. Code+deploy is ~half a day once
  keys/products exist. PLAN ONLY per anh Khôi (2026-07-23) — no code yet.
- [ ] **Notifications row hidden — needs real delivery before re-enabling.** The Profile
  "Notifications" row was commented out (2026-07-23) because `app/notifications.tsx` is
  prefs-only: the 4 switches persist to `appStore` but there is NO delivery infra (no
  `expo-notifications`, no push token, no scheduling). To bring it back, wire real local
  reminders (`expo-notifications`) and/or a push server, then uncomment the `SECTIONS` row.
- [ ] **Profile rows "Location & weather" and "Connected accounts" hidden** (2026-07-23) —
  commented out in `app/(tabs)/profile.tsx` because they had no destination screen. Build
  the screens (or wire existing flows) then re-enable. "Location & weather" overlaps with the
  deferred live-weather/GPS work in section C.
- [x] **Latent: `generate-outfits/index.ts:248` selects a non-existent `formulas.slug`
  column** (spotted 2026-07-23) — FIXED 2026-08-11 (2026-08-11 batch, confirmed defect #1):
  turned out NOT low-priority/not-user-blocking as originally logged — the query always
  errored/returned null, so `resolvedFormulaSlug` was silently NEVER set, which meant a
  user's EXPLICIT formula pick (client already sends the right id) was dead-lettered on
  EVERY call and silently fell through to `formulaPreferences`/undefined instead. Since
  `formulaId` already IS the slug value (same finding as
  `formulasCatalogService.ts`'s existing schema-drift comment), fixed by dropping the DB
  round-trip entirely: `resolvedFormulaSlug = formulaId as FormulaId | undefined`.

## H. App identifier rename follow-ups (2026-07-31)

Rename `com.briank.mien` -> `tech.kioh.mien` done this session (see plan.md changelog
"App identifier rename: com.briank.mien -> tech.kioh.mien (2026-07-31)"). App was never
published so no store-side migration needed, but three things are still open:

- [ ] **Put the new App Store Connect `ascAppId` back into `eas.json`** (2026-07-31) —
  `submit.production.ios.ascAppId` was deleted (the old value `"6782307581"` pointed at
  the ASC app record for the old bundle id `com.briank.mien`, wrong target now). Once a
  new ASC app record exists for `tech.kioh.mien` ("Mien Fashion"), add its numeric Apple ID
  back into that field. Until then, `eas submit -p ios` will just prompt interactively to
  pick/create the app instead of failing outright.
- [ ] **RevenueCat needs a new/updated app entry for `tech.kioh.mien`** (2026-07-31) — the
  existing RevenueCat dashboard app is bound to the old bundle id `com.briank.mien` on both
  iOS and Android. Need: a new (or repointed) RevenueCat app for `tech.kioh.mien` on both
  stores, new public SDK API keys wired into the client (`EXPO_PUBLIC_REVENUECAT_API_KEY` in
  `eas.json`/`.env`), and the in-app-purchase products re-created under the new App Store
  Connect app + new Play Console app (product IDs are per-app on both stores). Purchases will
  not work until this is redone — overlaps with the still-unimplemented RevenueCat go-live
  plan (section A / plan.md "RevenueCat / In-App Purchase go-live plan", 2026-07-23).
- [ ] **Uninstall the old `com.briank.mien` build from any emulator/device** (2026-07-31) —
  since `applicationId` changed, the new `tech.kioh.mien` APK installs side-by-side rather
  than upgrading in place. Any emulator/device that had the old build installed needs it
  manually uninstalled (`adb uninstall com.briank.mien`) to avoid confusion from having both
  apps present.

- [ ] **Supabase free-tier auto-pause.** (2026-08-02) Project `trtjcsxcowqecsebvyme` bi
  pause (INACTIVE) do khong co traffic — toan bo backend offline cho toi khi restore
  thu cong. Can quyet: nang plan Pro hoac dat cron ping giu project active truoc khi
  co user that.

## Body-shape engine — findings tu sim (2026-08-03)

Harness: `scripts/sim/body-shape-sim.ts` (`npm run body-shape-sim`, Deno, offline).

- [x] **`apple` nuot qua nhieu body** (2026-08-03) — FIXED cung ngay: classifier viet lai
  theo FFIT/Simmons (absolute-cm bust/waist/hip diff, bust-vs-hip dominance check TRUOC
  apple/rectangle). Sweep 3000 body sau fix: apple 7.3%, rectangle 7.6% (xem plan.md
  changelog "Body-shape classifier rewrite"). Luu y: dominant label gio la `triangle`
  40.7% (do bust/hip duoc sample DOC LAP tren khoang rong trong harness — xem ghi chu
  "design caveat" trong changelog) — khong dat tieu chi "duoi 38.6%" nhu ky vong ban dau,
  nhung day la he qua truc tiep cua design da chot (bust-hip dominance check truoc), khong
  phai regression tu classifier cu.
- [x] **Boundary `H > B + 5` dung dau strict** (2026-08-03) — FIXED cung ngay: doi thanh
  `bustHip <= -BUST_HIP_DOMINANCE` (`>=5` inclusive) dong bo voi cac nguong khac.
- [x] **Classifier nhay khong deu** (2026-08-03) — FIXED cung ngay: them `stabilizeBodyShape`
  (hysteresis, `src/types/measurements.ts`) — giu `prev` khi mot probe ±2cm tren
  bust/waist/hip van ra `prev`. Wired vao `useMeasurements.ts`'s `bodyShape` useMemo (nhanh
  manual-override khong doi).
- [x] **Rule shape chi bat o fit cuc doan, `regular` vo hinh** (2026-08-03) — FIXED cung
  ngay: `bodyShapeMultiplier` viet lai thanh volume-distance dua tren `SHAPE_VOLUME_TARGETS`
  (scoring.ts) thay vi so khop chuoi fit — `regular`/`wide` gio deu co volume so sanh duoc,
  khong con "vo hinh". Xem Section C truoc/sau trong plan.md changelog.
- [x] **`scoreOutfitFit` bi clamp o 1.0** (2026-08-03) — hourglass + all-slim tailored:
  base 0.823 + delta 0.224 = 1.047 -> clamp 1.0, mat separation o dau tren dung cai ma
  comment trong `scoring.ts` noi la da tranh khi doi tu multiplier sang delta. RESOLVED
  2026-08-11 (session "scoreOutfitFit soft-knee + guess-widening loose-side ceiling clamp"):
  hard `Math.max(0, Math.min(1, ...))` thay bang `softKnee()` (helper moi, xuat tu
  `scoring.ts`) — identity tren [0.1, 0.9], nen mem (exponential decay) tu K=0.9, S=0.1 ra
  ngoai hai dau, dao ham=1 tai knee (khong gay khuc), strictly monotone toan mien (kiem chung
  bang test sweep [-1.5, 2.5]). softKnee(1.047)≈0.977, softKnee(1.44 — max ly thuyet)≈0.9995,
  softKnee(0.5)=0.5 dung y. Do bang eval harness that (3 fixture): chi smartcasual co chuyen
  dong (fixture duy nhat co garmentMeasurements) — rank1 fitScore 1.000000->0.984329, rank9
  (0.853, duoi knee) khong doi byte-for-byte, dung nhu thiet ke "confined blast radius";
  streetwear/resort khong chuyen dong vi ca hai fixture khong co `measurements:` nao (base
  luon =0.5, raw toi da 0.82, khong bao gio vuot knee 0.9) — da dieu tra ro nguyen nhan, khong
  phai fix khong hoat dong. Xem `plan.md` changelog cung ten cho chi tiet + bang do day du.
- [x] **Mau thuan huong giua `bodyShapeMultiplier` va `fromBodyShape`** (2026-08-03) — FIXED
  cung ngay: ca hai gio doc chung `SHAPE_VOLUME_TARGETS` (scoring.ts) — `silhouette.ts`'s
  `fromBodyShape` khong con literal rieng. Sim Section D "Direction contradictions": 1 -> 0.
- [x] **`FIT_THRESHOLDS` khong fit-aware** (2026-08-03) — FIXED cung ngay: ease window gio
  SLIDE theo `FIT_EASE_PCT[item.fit]` (ti le theo body measurement qua `KEY_EASE_WEIGHT`, khong
  phai flat cm), `regular` la anchor 0-shift, guessed fit (`provenance.fit !== true`) chi ap
  nua strength. Them `preferredFitDelta` (engine/scoring.ts, ±0.12) neo feed theo `preferredFit`
  cua user vi sau fix nay outfit oversized dung kieu se khong con tu dong thua diem thap nua.
  `oversized_hoodie` fixture: 0.293 -> 0.532 (guessed)/0.410 (real, provenance.fit=true) — xem
  plan.md changelog "Fit-relative ease windows + preferred-fit anchor (2026-08-03)" cho chi
  tiet + finding "khong hoan toan monotonic" (vai fixture Section C thap hon voi real-fit vi
  du lieu fixture goc khong proportionally-consistent per-point). `scoreOutfitFit` clamp-at-1.0
  RESOLVED 2026-08-11 — xem muc rieng ben tren.
- [x] **`app/measurements-edit.tsx` chua duoc wire vao hysteresis/legacy-override-check moi**
  (2026-08-03, phat hien khi lam classifier rewrite) — FIXED cung ngay 2026-08-03: `derivedShape`
  gio goi `stabilizeBodyShape(bm.bodyShape ?? null, {...})` thay vi goi `computeBodyShape` truc
  tiep; `shapeOverride` init check ca `computeBodyShape(bm)` lan `computeBodyShapeLegacy(bm)`
  truoc khi coi la manual override, dong bo voi `useMeasurements.ts`. `npx tsc --noEmit` sach,
  `npx jest src/features/measurements` 187/187 pass.

- [ ] **App Store screenshots upscale tu ban da bi nen** (2026-08-03) — 9 anh trong
  `submit-assets/` la screenshot iPhone 17 THAT (anh Khoi xac nhan; 942x2048 = ti le 0.4600,
  dung bang native iPhone 17 / 6.3" = 1206x2622), NHUNG da bi ha xuong 2048px chieu cao trung
  gian (nen khi gui qua chat / Google Photos). Da resize sang `submit-assets/appstore-1284x2778/`
  (1284x2778, size Apple chap nhan cho 6.5"/6.7") — upscale x1.36 tu ban nen nen chu hoi mem.
  Neu lay lai duoc ban goc 1206x2622 (AirDrop / export full-res tu Photos) thi resize lai chi
  upscale x1.06, net hon han. Luu y: 1206x2622 KHONG nam trong danh sach size Apple nhan, nen
  du co ban goc van phai resize sang 1284x2778 — huong xu ly khong doi.
- [ ] **Trung anh trong submit-assets** (2026-08-03) — `e7c22fc4-...(1).jpg` va
  `e7c22fc4-....jpg` identical (cung MD5); cap `00a71162-...(1).jpg` (1284x2791) va
  `00a71162-....jpg` (942x2048) cung 1 screenshot khac scale. Chon 1 ban khi upload.

- [x] **Deploy lai edge functions sau khi doi engine scoring** (2026-08-03) — DONE 2026-08-04
  sau khi anh Khoi resume project Supabase. Ngay 2026-08-03 da sua `engine/scoring.ts`
  (fit-relative ease, girth floor, preferredFitDelta, SHAPE_VOLUME_TARGETS) va
  `engine/silhouette.ts`.
  **Danh sach deploy la 3 fn, khong phai 2 nhu entry goc ghi** — dependency trace 2026-08-04:
  `wardrobe-critic` cung an thay doi nay qua `ranking.ts` (import `scoring.ts`) va
  `generation.ts` (import `silhouette.ts`), nen neu chi deploy 2 fn thi khuyen nghi mua do se
  cham theo scoring CU trong khi feed cham theo scoring MOI. `backfill-item-metadata` va
  `generate-item-image` chi import `colorCluster.ts` (khong doi) -> dung deploy.
  Da chay: `npx supabase functions deploy {generate-outfits,evaluate-item,wardrobe-critic}`
  (KHONG dung --no-verify-jwt). Deno test truoc khi deploy: engine 192/192, evaluate-item
  21/21, wardrobe-critic 9/9 — tat ca xanh. Van CHUA kiem chung tren du lieu tu do that,
  moi chay tren fixture cua sim.

- [ ] **Paywall gay trong build submit (khong co `react-native-purchases`)** (2026-08-04, phat hien
  khi soan khai bao App Store) — `package.json` KHONG co dependency `react-native-purchases`, nen
  `usePremium.ts` require() that bai -> `Purchases = null` -> `app/paywall.tsx` luon hien fallback
  "unavailable" va nut Upgrade bi `disabled`. Entry point lai rat de cham: Profile tab ->
  "Subscription" (`app/(tabs)/profile.tsx:26`), ScanScreen, UploadStep. Rui ro Apple reject
  Guideline 2.1 (tinh nang khong hoat dong). Huong xu ly cho ban 1.0.0: an muc Subscription +
  cac CTA tro toi /paywall, HOAC set `account_type='premium'` cho demo account de reviewer khong
  gap paywall. Ban sau: cai that RevenueCat SDK + tao IAP product tren ASC.
  **Bo sung 2026-08-04 (neu chon duong lam IAP that):** `app/paywall.tsx` hien KHONG co bat ky
  disclosure nao ma Apple Guideline 3.1.2 bat buoc voi auto-renewable subscription — thieu ca
  5 thu: ten subscription, do dai chu ky, gia moi chu ky, cau "tu dong gia han tru khi huy",
  va 2 link Terms(EULA) + Privacy Policy ngay tren man paywall canh nut mua. Grep toan repo chi
  thay dong text thuan `onboarding_account_terms` trong en.json (khong phai link). Ngoai ra
  con phai dien 2 field trong App Store Connect: License Agreement (dung duoc ban chuan cua
  Apple) va Privacy Policy URL (**phai tu host — Apple khong cap, va bat buoc voi MOI app ke ca
  ban free/khong IAP**). Thieu -> reject 3.1.2.
  **Trang thai da verify 2026-08-04 (goi y do kho hon plan.md ghi):** `revenuecat-webhook` DA
  deploy (ACTIVE v3, verify_jwt=false — dung); `app/_layout.tsx` DA wire `Purchases.configure()`
  + `Purchases.logIn(userId)` dung chuan. Con thieu phia minh: dependency
  `react-native-purchases`, `EXPO_PUBLIC_REVENUECAT_API_KEY` trong eas.json, va secret
  `REVENUECAT_WEBHOOK_SECRET` (chua co trong `supabase secrets list`).
  **Cap nhat 2026-08-04**: anh Khoi DA chay install — `react-native-purchases@^10.6.0` +
  `react-native-purchases-ui@^10.6.0` gio co trong `package.json` va `node_modules`. Con lai
  la 2 key + setup Apple/RevenueCat dashboard.
  **Cap nhat 2026-08-04 (Test Store key)**: da wire `EXPO_PUBLIC_REVENUECAT_API_KEY` (Test Store
  key `test_…`, KHONG phai key that) vao `.env` + `eas.json` `build.development.env` — chi de
  test paywall local qua dev-client, khong dung duoc cho build submit (Test Store key lam SDK
  crash tren release build). Van con thieu key that (`appl_…`/`goog_…`) truoc khi build store.
  **Cap nhat 2026-08-05 (disclosure code-side DA XONG)**: `app/paywall.tsx` gio co du 4/5 thu code
  lam duoc — ten plan, gia, cau auto-renew/24h, 2 link Terms+Privacy (xem `plan.md` "Paywall:
  dynamic package list + Apple 3.1.2 disclosures"). Con lai la phan KHONG lam bang code duoc:
  Privacy Policy URL van la placeholder chua host that (xem item rieng phia tren), va 2 field
  trong App Store Connect (License Agreement, Privacy Policy URL) van chua dien — do chi lam
  duoc trong dashboard ASC.

## J. Kinh te don vi / chi phi bien — audit 2026-08-04 (truoc khi dinh gia subscription)

- [x] **PREMIUM KHONG CO QUOTA cho 2 action dat nhat — rui ro chi phi khong tran** (2026-08-04,
  audit truoc khi chot gia; FIXED 2026-08-05). `gateCredit()` trong `generate-item-image/index.ts`
  va `tryon-generate/index.ts` deu `return` som khi `account_type` la `premium`/`demo`,
  BO QUA hoan toan `consume_usage_credit`. Ca hai action nay goi
  `gemini-3-pro-image-preview` (~$0.13/anh). `FREE_LIMITS` chi la
  `{ ai_extraction: 2, try_on: 2 }`/thang cho free — premium thi vo han.
  Nghiem trong hon: **`tryon-generate` khong he co `consume_rate_limit`** (chi
  `tryon-validate` co, 30/gio). Nghia la 1 tai khoan premium co the goi image-gen
  lien tuc; tran ly thuyet ~30 lan/gio (bi chan giay to boi validate) = ~21.600 lan/thang
  = **~$2.800/thang cho MOT user**. Phai dat quota premium truoc khi ban.
  → Da them `PREMIUM_LIMITS = { try_on: 15, ai_extraction: 10 }`/thang; `gateCredit()` gio
  consume RPC voi limit theo tier thay vi bypass. `demo` van vo han (tai khoan reviewer App
  Store, co ghi chu trong code). `admin` gio bi tinh nhu premium co quota (truoc day
  server chi check `premium`/`demo`, khong check `admin` — da thong nhat). Xem
  `plan.md` "Premium usage quota" (2026-08-05) va `src/services/usageCreditService.ts`.
  `tryon-generate` van chua co `consume_rate_limit` rieng — quota thang moi la chan chinh,
  van con lo hong burst-trong-thang (chua xu ly, ngoai scope task nay).
  **CẬP NHẬT 2026-08-11 (security audit — ghi chú "demo vẫn vô hạn" ở trên nay đã LỖI THỜI)**:
  demo KHÔNG còn vô hạn — password demo public trong JS bundle nên bị coi là threat model
  khác (ai cũng đăng nhập được), giờ metered qua `DEMO_LIMITS = { ai_extraction: 50, try_on:
  50 }`/tháng, cùng RPC `consume_usage_credit`. Nghiêm trọng hơn: audit còn phát hiện RPC
  `consume_usage_credit` LUÔN LỖI (thiếu `period_end`) nên fail-open khiến CẢ 3 tier (free/
  premium/demo) đều KHÔNG bị trừ credit thật trong production cho tới hôm nay — xem mục mới
  trong section AE bên dưới.
- [x] **`ai_extraction` tinh 1 credit/ANH nhung fan-out N lan image-gen** (2026-08-04,
  PARTIALLY ADDRESSED 2026-08-05) — `generate-item-image/index.ts` chay `Promise.all` mot lan
  image-gen cho MOI mon do detect duoc trong anh, khong co cap. Anh 4 mon = 1 credit nhung
  ~4 x $0.13 = $0.52. → Da them `MAX_GARMENTS_PER_PHOTO = 3` de chan so mon fan-out ra
  image-gen (co log khi truncate). Van CHUA giai quyet triet de: 1 credit van co the kich
  hoat toi 3 lan generation tra tien (~3 x $0.13 = $0.39), tuc credit KHONG con ty le 1:1
  voi so anh sinh ra — can quyet dinh tiep: tinh credit theo so mon thuc te, hay chap nhan
  cap 3 la du re de bo qua.
- [x] **Thong nhat MOI ten model qua env override (chuan bi cho deadline 16/10)** (2026-08-05)
  — FIXED 2026-08-11: het ca 6 cho con lai (`backfill-item-metadata`, `generate-item-image`
  VISION_MODEL + IMAGE_GEN_MODEL, `tryon-generate` VERIFY_MODEL, `tryon-validate`,
  `map-measurements`, `generate-outfits/engine/curator.ts` da co CURATOR_MODEL rieng nhung
  gio fallback tiep sang biến chung) gio doc `GEMINI_FLASH_MODEL`/`GEMINI_FLASH_LITE_MODEL`/
  `GEMINI_IMAGE_MODEL` (biến CHUNG theo tier, lồng DƯỚI biến call-site cũ nếu có nên prod
  đang set gì vẫn không vỡ). Đổi model từ giờ chỉ cần `supabase secrets set`, không cần
  deploy code. Xem `plan.md` "Gemini model migration" (2026-08-11).

- [ ] **Deadline cung: `gemini-2.5-*` bi Google tat 16/10/2026** (2026-08-04) — PARTIALLY
  ADDRESSED 2026-08-11: toàn bộ 9 chỗ gọi Gemini giờ đọc `GEMINI_FLASH_MODEL` qua env override
  (xem mục ngay trên), nên đổi model thật sau này chỉ là 1 lần `supabase secrets set`, không
  cần deploy code. NHƯNG default hardcoded VẪN CỐ Ý giữ `gemini-2.5-flash` (anh Khôi quyết
  định cost-first — xem mục mới trong section AE bên dưới: `gemini-3.6-flash` đắt 5x input/3x
  output, hoặc `gemini-3.5-flash-lite` cost-neutral nhưng vision yếu hơn). Deadline 16/10/2026
  VẪN CÒN TREO, chưa migrate thật. **Phát hiện thêm ngoài phạm vi mục này, ĐÃ FIX thật**:
  `gemini-3-pro-image-preview` (image-gen tier) hoá ra ĐÃ bị tắt từ 2026-06-25 (đã qua), không
  phải deadline tương lai — production đã gọi model đã retired suốt từ đó tới hôm nay. Đổi
  sang `gemini-3-pro-image` (GA), giá không đổi (~$0.134/ảnh).
- [ ] **Don bay giam gia von lon nhat: doi model image-gen** (2026-08-04) — **VẪN CHƯA LÀM**,
  đừng nhầm với fix 2026-08-11 ở trên (2 việc khác nhau): fix hôm đó chỉ SỬA model đã bị
  Google retired (`gemini-3-pro-image-preview` → `gemini-3-pro-image`, GIÁ KHÔNG ĐỔI, cùng
  ~$0.134/ảnh) — KHÔNG phải đòn bẩy giảm giá vốn này (đổi sang Flash Image/Imagen rẻ hơn
  ~50-85%). Vẫn cần A/B chất lượng ảnh trước khi đổi. `GEMINI_IMAGE_MODEL` env override
  (mới, 2026-08-11) giờ làm việc thử-rồi-rollback này rẻ hơn nhiều — chỉ cần đổi secret,
  không cần deploy.
- [x] **VERIFY LIVE DB: `usage_credits` co cot `credits_used`/`credits_limit` khong?** — DONE
  2026-08-05, KET QUA: **live DB dung ten MOI, khop voi RPC va client.** Probe qua PostgREST
  bang anon key:
  `GET /rest/v1/usage_credits?select=credits_used,credits_limit&limit=1` -> **200** (tra `[]`
  do RLS, nhung cot ton tai);
  `GET /rest/v1/usage_credits?select=used,free_limit&limit=1` -> **400
  `column usage_credits.used does not exist`**.
  Ket luan: schema drift chi nam o FILE migration `20260608000007_usage_credits.sql`, khong
  phai o live DB. `consume_usage_credit` chay dung -> quota premium se duoc thuc thi that,
  khong bi fail-open. (Con lai chua verify truc tiep: check constraint tren `credit_type` —
  migration cu ghi `in ('worn_outfit_scan')`. Kha nang cao da duoc sua tren live vi free-tier
  credit `ai_extraction`/`try_on` van dang chay binh thuong tren production; neu constraint
  con chan thi RPC da fail-open tu lau va free user cung se khong bi tru credit.)

- [ ] **VERIFY LIVE DB (cu, da thay the bang muc tren): `usage_credits` cot**
  (2026-08-04, **NANG MUC DO UU TIEN 2026-08-05 — gio anh huong ca revenue correctness,
  khong chi free-tier enforcement**) — migration `20260608000007_usage_credits.sql:4-11` tao
  cot `used`/`free_limit` VA constraint `credit_type in ('worn_outfit_scan')` (khong co
  `ai_extraction`/`try_on`), nhung RPC `consume_usage_credit` (`20260625000002_...sql:39-47`)
  va `usageCreditService.ts` deu doc/ghi `credits_used`/`credits_limit` va dung credit_type
  `ai_extraction`/`try_on`. Khong co migration nao trong repo sua cot hay constraint nay —
  drift chua xac minh duoc voi live DB (KHONG duoc tu y query DB trong task nay). Neu live DB
  con theo migration cu, RPC loi -> `gateCredit` FAIL OPEN (khong doi voi task 2026-08-05:
  hanh vi fail-open nay duoc GIU NGUYEN co chu dinh) -> **CA free lan premium deu khong bi tru
  credit** — tuc quota premium 15 try-on + 10 ai_extraction vua them (2026-08-05) se KHONG
  duoc enforce thuc te, khong chi anh huong free tier nhu truoc. Phai query live DB xac nhan
  TRUOC KHI tin tuong credit gate co hieu luc that (ca free va premium).
- [x] **Marketing copy con noi "unlimited" sau khi premium co quota** (2026-08-05, phat sinh
  tu task them premium quota) — **FIXED 2026-08-05**: `paywall_subtitle`, `paywall_benefit1`,
  `paywall_benefit2`, va `premium_upgradeSubtitle` trong `en.json`/`vi.json` da bo het claim
  "unlimited"/"khong gioi han". `paywall_subtitle`/`benefit1`/`benefit2` gio hien so quota that
  qua interpolation param `{{extraction}}`/`{{tryOn}}` (khong hardcode 15/10 trong string —
  lay tu `PREMIUM_LIMITS` trong `usageCreditService.ts`, wired o `app/paywall.tsx`).
  `premium_upgradeSubtitle` hien khong con call site nao render no, nen chi bo claim
  "unlimited" ma khong can so (headline chung chung).
  **SUPERSEDED 2026-08-08**: theo yeu cau anh Khoi, paywall bo han con so quota — xoa
  `paywall_benefit1/2/3` + benefit list, `paywall_subtitle` gio la MOT cau khong co
  interpolation ("Tang gioi han su dung AI de bo sung trang phuc vao tu do va thu do
  truoc khi mua"), `app/paywall.tsx` khong con import `PREMIUM_LIMITS`. Rang buoc "khong
  duoc noi unlimited" van giu nguyen. Xem `src/design/paywall/design.md` "Value copy
  (2026-08-08)".

- [x] **Khong co noi nao hien "con lai bao nhieu luot" cho user** (2026-08-05, phat sinh tu
  task sua marketing copy "unlimited") — `usageCreditService.checkCredit()` da tra ve
  `{ used, limit, remaining }` nhung khong man hinh nao hien thi con lai bao nhieu (try-on /
  ai_extraction). User trả phí hiện chỉ biết mình hết quota khi đâm thẳng vào cap — đúng lúc
  tệ nhất (giữa flow, sau khi đã trả tiền). Nên hiển thị remaining count ở các entry point
  chính: try-on (trước khi bấm generate) và add-item / wardrobe scan (UploadStep, cạnh
  `uploadStep_upgradeText`). Chưa làm trong task này — task này chỉ sửa copy, không đổi
  UI/logic ngoài phạm vi paywall params.
  **NANG MUC DO 2026-08-08**: paywall vua bo het con so quota (xem muc tren), nen gio
  KHONG CON CHO NAO trong app hien limit/remaining cho user — truoc do it nhat paywall
  con noi "15 luot thu / 10 luot quet". Item nay tu "nice to have" thanh can lam truoc
  khi ban premium rong rai.
  **DONE 2026-08-08** (cung session): them `useCreditQuota` +
  `CreditQuotaNote`, hien 1 dong caption tertiary ngay tren nut hanh dong o 2 cho —
  try-on (`ready` truoc WEAR ON, `result`/`error` truoc REGENERATE) va add-item
  UploadStep (tren nut ANALYSE). `CreditStatus` them 2 field display-only
  (`accountType`, `degraded`) de counter AN DI khi khong co so dang tin (query loi
  fail-closed remaining:0, hoac account demo khong bi meter) thay vi bao user "con 0".
  Gate khong doi hanh vi. Xem `plan.md` "Paywall copy: drop the quota numbers".

- [x] **`paywall.tsx` chi render MOT package -> khoa cung viec them goi ve sau** (2026-08-04,
  phat sinh khi anh Khoi hoi co nen them goi yearly). `app/paywall.tsx:48` doc
  `offerings?.current?.availablePackages?.[0]` — chi lay phan tu DAU TIEN. Hau qua: du
  RevenueCat co bao nhieu package trong offering, user van chi thay 1 goi, va goi nao duoc
  hien phu thuoc thu tu RevenueCat tra ve (khong kiem soat duoc tu client).
  **Nen sua thanh render DONG toan bo `availablePackages` NGAY TU 1.0.0**, ke ca khi hien tai
  moi co mot goi monthly. Ly do: neu 1.0 hardcode `[0]`, sau nay them goi yearly phai sua code
  + build lai + cho Apple review lai. Neu render dong ngay tu dau thi them goi chi can bat tren
  RevenueCat dashboard, co hieu luc ngay khong can update app — dung dung tinh than "dynamic
  paywall" ma RevenueCat thiet ke. Kem theo can UI chon goi (2 the/segmented) + hien
  `priceString` cua tung goi.
  **FIXED 2026-08-05** — `app/paywall.tsx` gio render dong toan bo `availablePackages`, co the
  chon (selected border `T.color.primary`, unselected hairline nhu cu), badge tiet kiem khi co
  ca MONTHLY va ANNUAL, va them day du disclosure Apple 3.1.2 (xem `plan.md` "Paywall: dynamic
  package list + Apple 3.1.2 disclosures (2026-08-05)"). Item moi phat sinh tu phase nay: xem
  `PRIVACY_URL` placeholder ben duoi.

- [ ] **`src/config/legal.ts` `PRIVACY_URL` la PLACEHOLDER, chua phai link that** (2026-08-05,
  phat sinh khi lam disclosure Apple 3.1.2 cho paywall). Gia tri hien tai la
  `https://mien.app/privacy` — domain chua host trang nao. Phai thay bang link that, cong khai
  truy cap duoc, truoc khi submit App Store: Apple reject app neu Privacy Policy URL gay loi
  hoac khong ton tai, va app nay thu thap ca body measurements lan anh (face selfie cho personal
  color, anh tu do/try-on) nen reviewer se doc ky trang nay. Can lam ca 2 viec: (1) host mot
  trang privacy policy that mo ta dung du lieu dang thu thap, (2) dien URL do vao ca
  `src/config/legal.ts` lan truong "Privacy Policy URL" trong App Store Connect.

- [x] **User dang co goi thang KHONG the nang len goi nam — nut bi disable cung**
  (2026-08-05, phat hien khi anh Khoi hoi "user da mua goi thang thi vao thay gi").
  `app/paywall.tsx:309` co `disabled={busy || !selectedPkg || isPremium}` — he premium la
  chan MOI giao dich, ke ca doi sang goi khac. Hau qua: paywall van hien goi nam, van cho
  tap chon, nhung bam mua thi khong duoc — vua mat doanh thu (monthly->annual la luong
  upgrade gia tri nhat, tang LTV + giam churn) vua la UX kho hieu.
  Apple DA ho tro san: hai goi trong CUNG mot subscription group thi mua goi kia = upgrade,
  Apple tu prorate phan con lai va doi ngay. Khong can code xu ly thanh toan gi them.
  **Cach sua**: `usePremium` hien chi tra `isPremium: boolean` — can mo rong de tra ve
  product identifier dang active (`customerInfo.entitlements.active['premium']
  .productIdentifier`). Sau do trong paywall: goi TRUNG voi goi dang dung -> disable + gan
  nhan "goi hien tai"; goi KHAC -> cho mua binh thuong. Phai lam TRUOC hoac CUNG luc voi
  viec them goi nam, neu khong goi nam gan nhu khong ban duoc cho user hien huu.
  **FIXED 2026-08-05** — `usePremium` tra them `activeProductId`; `app/paywall.tsx` gio phan
  loai `planRelation` (current/upgrade/downgrade/switch) va chi disable nut khi goi chon
  TRUNG goi dang dung; upgrade/downgrade/switch deu goi lai `handlePurchase` binh thuong,
  Apple tu prorate. Xem `plan.md` "Paywall: plan switching (upgrade/downgrade) + manage
  subscription (2026-08-05)".

- [x] **Thieu duong huy / quan ly goi dang ky trong app** (2026-08-05, cung phat hien).
  Khi `isPremium`, paywall chi hien dong chu "You already have Premium. Enjoy."
  (`paywall.tsx:296-299`) va khong co gi khac. Nen them nut mo thang trang quan ly
  subscription cua iOS: `Linking.openURL('itms-apps://apps.apple.com/account/subscriptions')`.
  Apple khong bat buoc, nhung user khong tim duoc cho huy thuong di thang toi 1-sao review
  hoac yeu cau hoan tien qua Apple — ca hai deu ton hai hon nhieu so voi viec de ho tu huy.
  **FIXED 2026-08-05** — them `TextLink` (`paywall_manageSubscription`) trong block
  `alreadyPremium`, mo `itms-apps://apps.apple.com/account/subscriptions` qua
  `Linking.openURL(...).catch()`. Xem `plan.md` cung entry o tren.

- [ ] **Plan switching moi wire cho iOS, chua xu ly Android** (2026-08-05, phat sinh tu viec
  fix hai item tren). Luong upgrade/downgrade goi trong `handlePurchase` -> `purchase(pkg)`
  -> `Purchases.purchasePackage(pkg)` khong truyen them tham so gi, dua vao viec Apple tu
  prorate cho hai goi CUNG mot subscription group (dung tren iOS). Google Play KHONG lam vay
  tu dong — doi/nang cap goi tren Android can truyen ro `oldProductId` +
  `googleProductChangeInfo`/proration mode (`purchasePackage` co tham so rieng cho viec nay
  tren RevenueCat SDK). Truoc khi ra ban Android, phai quay lai `handlePurchase` trong
  `app/paywall.tsx` va them nhanh xu ly rieng cho `Platform.OS === 'android'` khi
  `planRelation` la 'upgrade'/'downgrade'/'switch', neu khong upgrade/downgrade tren Android
  se fail hoac tao subscription thu hai thay vi thay the.

- [ ] **Edge case da biet (chap nhan duoc, KHONG phai bug): premium qua `account_type` nhung
  khong co RevenueCat entitlement -> nut hien "CHUYEN SANG ..." thay vi "GOI HIEN TAI"**
  (2026-08-05, ghi lai khi review ban plan-switching de session sau khong tuong la loi).
  `planRelation` trong `app/paywall.tsx` tra `'switch'` khi `currentPkg` la null. `currentPkg`
  duoc suy ra tu `activeProductId` = `entitlements.active['premium'].productIdentifier`, nen
  no null khi user la premium theo DB (`account_type` = premium/admin, VD set tay qua
  service_role, hoac tai khoan admin) chu khong phai qua giao dich RevenueCat.
  Hau qua: nut bam duoc, nhung KHONG mat tien oan — Apple chan mua trung cung product va bao
  "already subscribed". Rui ro thap, tan suat thap. Neu muon sach hon thi khi `isPremium &&
  !currentPkg` co the disable nut kem nhan trung tinh.

- [ ] **Quyet dinh: giu paywall tu code hay chuyen sang RevenueCat Paywall Builder?**
  (2026-08-04, phat sinh khi anh Khoi hoi ve o "Custom URL Scheme" tren RC dashboard).
  `react-native-purchases-ui@^10.6.0` DA cai nhung CHUA duoc import o bat ky dau
  (grep `src/` + `app/`: 0 hit) — app dang dung `app/paywall.tsx` tu code theo design
  luxury-minimalism rieng. Hai duong: (a) giu paywall tu code -> co the go
  `react-native-purchases-ui` cho nhe bundle, va o "Custom URL Scheme" tren dashboard
  khong can dien (no chi phuc vu Paywall Preview cua Paywall Builder); (b) chuyen sang
  Paywall Builder -> doi duoc paywall tu dashboard khong can update app, nhung bi gioi han
  trong template cua RevenueCat nen kho khop design system MIEN. Scheme cua app da co san
  la `mien` (`app.json:11`) neu chon (b). Chua chot — can anh Khoi quyet.

- [ ] **`_layout.tsx` chi doc MOT bien RevenueCat key -> chi chay duoc 1 platform** (2026-08-04,
  phat hien khi huong dan dan key). `app/_layout.tsx:81` doc duy nhat
  `process.env['EXPO_PUBLIC_REVENUECAT_API_KEY']`, nhung RevenueCat cap key RIENG cho tung store
  (`appl_…` cho iOS, `goog_…` cho Android) — khong dung chung duoc. iOS-first thi khong sao,
  nhung khi len Google Play phai sua thanh chon key theo `Platform.OS` (VD 2 bien
  `..._IOS` / `..._ANDROID`, hoac giu 1 bien cho iOS va them bien thu 2). Neu quen, ban Android
  se configure bang key iOS -> SDK loi hoac khong tra ve offering nao.
  **XAC NHAN BANG RUNTIME 2026-08-10** (logcat, bản debug trên emulator Android):
  `[RevenueCat] The specified API Key is not recognized. Ensure that you are using the public
  app-specific API key, which should look like 'goog_1a2b3c4d5e6f7h'...` — đúng như dự đoán,
  `eas.json:14,29,41` đang đặt `appl_llObneTbxssMfXnooijYjkTNzKD` cho CẢ 3 profile, nên bản
  Android configure bằng key iOS. Đây là lỗi THẬT của bản Android production, không phải hạn
  chế emulator (lỗi `BILLING_UNAVAILABLE` đi kèm mới là do emulator không có Play Billing).
  → Phải sửa trước khi phát hành Play: tách key theo `Platform.OS` ở `app/_layout.tsx:81`.
- [x] **Bucket `avatars` dang public** (2026-08-04) — **PREMISE CỦA MỤC NÀY SAI**: audit
  2026-08-11 xác nhận bucket `avatars` **đã LUÔN LÀ PRIVATE**, không phải public như mục này
  ghi. Bug THẬT khác với mô tả gốc: `profileService.uploadAvatar` gọi `.getPublicUrl()` trên
  một bucket private → URL trả về LUÔN 400 cho mọi người, nghĩa là avatar KHÔNG BAO GIỜ hiện
  lên được (không phải rủi ro "URL đoán được" như mục gốc lo ngại — ngược lại, hoàn toàn
  không dùng được). FIXED 2026-08-11 theo đúng hướng mục này đề xuất (private + signed URL,
  dù lý do khác): `uploadAvatar`/`deleteAvatar` giờ chỉ đọc/ghi `profiles.avatar_path` (path
  trong storage), không bao giờ ghi URL. `avatar_url` bị retired khỏi `ProfileRow`/
  `AuthState`/`UserProfile` và khỏi mọi SELECT. `avatarSignedUrl(path)` mới trong
  `profileService.ts` (mirror `itemPhotoService.signedUrl()`, TTL 1h) + hook
  `useAvatarUri(avatarPath)` mới (`src/features/profile/useAvatarUri.ts`) resolve URL tại
  thời điểm render. Xem `plan.md` "Avatar rendering" (2026-08-11).
- [ ] **Chu bi cat ky tu cuoi do letterSpacing (Android)** (2026-08-04) — token `type.ui` /
  `type.micro` co `letterSpacing` 1.5/1.8; Android lam tron chieu rong text xuong nen glyph cuoi
  bi clip ("BEGIN" -> "BEGI"). Da vá `PrimaryButton`, `SecondaryButton`, `TextLink` bang
  `paddingHorizontal: 2`. Cac cho khac dung cung token van chua vá: `Tag.tsx`, `Segmented.tsx`,
  `Field.tsx` (label + TextInput), `Photo.tsx`, `OfflineBanner.tsx`, va cac style inline
  `...type.ui` trong app/*. Can ra soat tren may Android that roi vá dong loat (hoac them padding
  ngay trong token, tru cho TextInput).

## K. Review 3 engine (suggest / rating / try-on) — 2026-08-06 (đề xuất, chưa duyệt)

Phát hiện từ đợt review Fable + 3 Explore agent. Các mục dưới đây CHƯA có trong backlog
trước đó (những mục đã có — rate-limit tryon, model hardcode, gemini-2.5-flash kill date
16/10/2026, hiển thị credit, device-test face composite, wardrobe-critic RNG — giữ nguyên
ở các section cũ).

### Bug thật / code chết (sửa rẻ, ăn ngay)
- [x] ĐÃ FIX 2026-08-06 (toBodyMeasurements mapper + regression test) — **`preferredFitDelta` (±0.12) luôn = 0 trong feed** — `generate-outfits/index.ts:151`
  gán raw DB row (snake_case `preferred_fit`) thẳng vào `BodyMeasurements` (camelCase
  `preferredFit`) không map → scorer đọc undefined. `evaluate-item` không bị vì nhận
  profile đã map từ client. (2026-08-06)
- [x] ĐÃ FIX 2026-08-06 (computedAttributes set trước resolveTargetSilhouette) — **Cascade silhouette theo style chết** — `silhouette.ts:224` đọc
  `ctx.styleProfile.computedAttributes?.silhouette` nhưng index.ts không bao giờ set,
  `applyIntent` còn null nó → target silhouette luôn rơi xuống body_shape/fallback;
  "tailored" của minimalist / "oversized" của streetwear không bao giờ lái generation. (2026-08-06)
- [x] ĐÃ FIX 2026-08-06 (SELECT + mapper generate-outfits; wardrobe-critic mapper hoàn thiện Phase 2) — **`primary_hex`/`secondary_hex`/`graphics` backfill xong không ai đọc** — engine select
  (generate-outfits/index.ts:137, wardrobe-critic, evaluate-item) đều bỏ qua; lớp
  measured-color refinement trong `enrichment.ts:674-683` chết; graphics đoán từ TÊN item
  bằng keyword thay vì đọc cột jsonb có sẵn. (2026-08-06)
- [x] ĐÃ AUDIT + XỬ LÝ 2026-08-11 (xem plan.md "Dead-vocabulary cleanup" cùng ngày) —
  **`StyleConfig.overrides` + `FitItem.warmth`** — audit read-only xác nhận cả hai thật sự
  chết (0 reader ngoài declaration/fixture, grep lại toàn repo) → đã xoá field +
  `deriveWarmth()`/`MATERIAL_WARMTH`/`CATEGORY_WARMTH` + 32 khai báo `overrides` trong
  `filtering.ts` + 17 fixture `warmth: 2,`. **`silhouetteAffinity()`** — giữ nguyên, xác
  nhận là dead-BY-DESIGN (plan.md 2026-07-12 "reserved for future anchor-biasing use"),
  đã thêm comment tại chỗ định nghĩa để audit sau không phải điều tra lại. **Claim cũ về
  `StyleConfig.neighbors` SAI** — engine không đọc nhưng data được 3 migration copy tay
  vào `public.styles.neighbors`, nuôi sống chip "You might also like" ở
  `app/(onboarding)/styles.tsx:112-125` qua `stylesCatalogService.ts` — KHÔNG xoá, đã thêm
  comment display-only tại field declaration. (2026-08-06, audit 2026-08-11)
- [ ] **`neighbors` hand-sync giữa `filtering.ts` và migration `public.styles` là rủi ro
  còn treo** — `STYLE_CONFIGS[].neighbors` trong engine là nguồn tác giả thật, nhưng
  `public.styles.neighbors` (thứ client thật sự đọc) là bản copy tay qua migration, đã
  từng lệch một lần (`bohemian → y2k` chỉ một chiều, xem mục ~1771). Thêm style mới hoặc
  sửa trọng số neighbor ở `filtering.ts` mà quên đồng bộ migration sẽ không có lỗi biên
  dịch/test nào báo — nên cân nhắc generate migration từ mảng này thay vì copy tay.
  (2026-08-11, phát hiện trong lúc audit dead code ở trên)
- [x] ĐÃ FIX 2026-08-06 (missingItem check thêm !provenance.fit → criterion unavailable thay vì chấm đoán) — **evaluate-item bỏ qua provenance** — fit đoán từ `TYPE_DEFAULT_FIT` vẫn được chấm
  tự tin (hoodie không nhãn → "oversized" → 10/100 cho user thích slim, kèm copy khẳng
  định); feed thì có gate provenance (`ranking.ts:268-288`) — cần đồng bộ. (2026-08-06)
- [x] ĐÃ FIX 2026-08-06 (templates en/vi theo locale; wardrobeFit → i18n keys client) — **Copy giải thích 5 criterion của verdict hard-code tiếng Anh** (`evaluate-item/
  scoring.ts:72-148`) dù contract hứa theo locale; `wardrobeFit.ts:52-68` cũng EN-only.
  User VN nhận verdict tiếng Anh + AI note tiếng Việt lẫn lộn. (2026-08-06)

### Chất lượng chấm điểm
- [x] ĐÃ FIX 2026-08-06 (scoreSingleItemColor/Fabric — full range, giữ nguyên bonus magnitude) — **Single-item degeneracy trong evaluate-item** — chấm 1 món bằng scorer outfit làm
  5/7 sub-term màu thành hằng số → điểm màu bó trong ~70–91 trước bonus; fabric kẹp
  [32,92]. Cần biến thể single-item của scorer màu/fabric. (2026-08-06)
- [ ] **Verdict và feed dùng 2 định nghĩa "đẹp" khác nhau** — verdict không có proportion/
  formality/anchor/taste; item 88 "Great pick" vẫn có thể "A bit of a stretch" với tủ đồ,
  2 con số hiện cạnh nhau không hoà giải. (2026-08-06)
- [ ] **`confidence` từ extraction bị bỏ** — không scale trọng số; đoán 0.3 nặng ngang
  0.95. (2026-08-06; scoring, chưa đụng tới — ngoài phạm vi phiên ingest-threading
  2026-08-11 bên dưới, ĐỪNG lẫn với mục đó.)
  - [x] Phần "Client còn drop `print_scale`/`drape`/`visual_interest`/`can_layer`/
    `color_hex` khi map (`imageGenerationService.ts:42-68`) → backfill phải re-derive"
    RESOLVED 2026-08-11 cho 4/5 field (`print_scale`/`drape`/`visual_interest`/
    `can_layer` — xem entry phía trên + `plan.md` changelog cùng ngày). `color_hex`
    KHÔNG có cột trên `clothing_items` (chỉ có migration
    `20260706000002_add_color_hex.sql` thêm `primary_hex`/`secondary_hex` — khác
    field, ĐÃ thread xong từ trước) — `color_hex` model-guess chỉ dùng server-side để
    seed bảng `colors`, không có đích để lưu per-item; thêm cột là quyết định
    schema/design, không tự làm trong phiên plumbing-only này.
- [ ] **Giày/phụ kiện không bao giờ được chấm measurement** (0.25 weight rơi) — (2026-08-06;
  scoring, ngoài phạm vi, chưa đụng tới).
  - [x] Phần "`m_skirt_length`/`m_shoe_size` extract xong bị drop ở request boundary"
    ĐÃ TRA LẠI 2026-08-11 — note SAI/CŨ, không đổi code: cả 2 key đã có trong `MKey`
    (`src/types/fitEngine.ts`) và `wardrobeService.ts`'s `M_KEYS` từ trước, insert
    (`measurementColumns`) spread nguyên `M_KEYS` nên không key nào bị lọc. Ở request
    boundary tới engine (`tryOnService.evaluateItem`, `fitEngineStore.
    fetchMixMatchOutfits`'s `pin_item`) client gửi NGUYÊN object `measurements`, không
    enumerate từng key, nên không có chỗ nào drop 2 field này. Xem `plan.md`
    changelog cùng ngày.
  - [ ] **Phát hiện mới (KHÔNG sửa, khác feature):** `map-measurements` (feature 009,
    "paste shop sizes") có `TARGET_KEYS`/`relevantKeys('bottom')` riêng
    (`supabase/functions/map-measurements/prompt.ts:11-15,44-55`) THIẾU
    `m_skirt_length` hẳn — Gemini map từ text shop nhưng `sanitizeMapResult` lọc theo
    `keys` nên skirt length luôn bị vứt dù model có đoán ra. `m_shoe_size` ở feature
    này thì ĐÃ đủ. Cần thêm `m_skirt_length` vào `TARGET_KEYS` + `relevantKeys('bottom')`
    + 1 dòng keyDef/synonym/SANE_BAND trong `prompt.ts` — là quyết định thiết kế nhỏ
    (chọn band cm hợp lý, câu synonym VN/EN) nên để anh Khôi duyệt trước khi làm.
    (2026-08-11)

### Vòng lặp dữ liệu (ROI cao nhất, quyết định thay cho câu hỏi "cần LLM?")
- [x] ĐÃ LÀM 2026-08-07 (viewed + swipe-left dismissed, taste 2 chiều bounded) — **Không có negative feedback** — `outfit_interactions` chỉ có saved/worn/scheduled/
  impression, KHÔNG có skip/dismiss; prod 1016 impressions / 0 saved → taste vector ngủ
  đông. Cần event skip (swipe-away / dwell-time) trước mọi nâng cấp ranking. (2026-08-06)
- [ ] **Occasion/mood wired server-side nhưng client không bao giờ gửi** — intent duy nhất
  client gửi là seasonOverride từ 4-band nhiệt độ; `times_worn`/`worn_cooldown_ids` cũng
  không ai gửi → không có rotation/novelty. (2026-08-06)
- [ ] **Try-on là ngõ cụt dữ liệu — MỘT PHẦN đã fix 2026-08-11.** ĐÃ LÀM: Flow B
  ("Wear on you", `app/try-on/wear.tsx`) giờ ghi interaction `tried_on` sau khi generate
  thành công (`logTriedOn`, `outfitInteractionService.ts`), taste vector server-side đã đọc
  type này với trọng số `TRIED_ON_WEIGHT=1.5` (giữa saved và worn — xem `engine/taste.ts`,
  CALIBRATION-PENDING). Flow A ("Scan") vẫn KHÔNG ghi (đúng, vì item chưa có
  `clothing_items.id` thật — xem `plan.md` changelog cùng ngày). File leak của render
  (documentDirectory/cacheDirectory) cũng đã fix (`useWearOnYou.ts`: xoá khi regenerate,
  pickAnother, và rời màn hình). CÒN THIẾU (chưa nằm trong phạm vi lần này, vẫn là quyết
  định sản phẩm mở): chưa có nơi PERSIST cái render đã tạo (chưa upload Supabase Storage,
  chưa có bề mặt "Saved" nào cho nó) — người dùng vẫn không "save được look" theo nghĩa xem
  lại sau; nó chỉ tồn tại trong phiên xem hiện tại rồi bị xoá. Cần quyết định trước khi làm:
  có đáng lưu render AI (chi phí storage + rủi ro privacy ảnh người dùng) hay không.
  (2026-08-06, cập nhật 2026-08-11)

### Try-on riêng
- [x] ĐÃ FIX 2026-08-06 (copy en/vi disclosure Google AI + latency claim; Privacy Policy doc vẫn cần rà) — **Privacy copy thiếu disclosure** — "Your photo is never stored on our servers" đúng
  về storage nhưng im lặng việc ảnh đi qua Google Gemini (2 lần); cần sửa copy + Privacy
  Policy trước khi App Store review soi. (2026-08-06)
- [x] ĐÃ FIX 2026-08-06 (verify pass fail-open + refund + quality_warning) — **Không có output-quality check sau generate** — anatomy lỗi/sai áo vẫn tính $0.13
  và hiện lên màn; pattern validate bằng flash rẻ đã có sẵn (tryon-validate), thêm 1 pass
  verify sau generate. (2026-08-06)
- [x] ĐÃ FIX 2026-08-06 (2-pass detect + faceApplied + counter local; device-test vẫn pending) — **Mâu thuẫn kiến trúc face-composite** — prompt ép khung full-body (mặt ~5-8% chiều
  cao ảnh) nhưng BlazeFace short-range detect ở 128×128 → mặt ~8-10px, dò biên; cần
  crop-vùng-mặt rồi detect lại (2-pass) ở cả ảnh gốc lẫn ảnh gen. Kèm: composite fail
  chỉ log __DEV__, không telemetry — không biết tính năng có chạy thật không. (2026-08-06)

### K-bis. Phát sinh từ đợt fix 2026-08-06 (nhỏ, chưa làm)
- [x] `pinItemToRow` (Mix & Match item scan transient, generate-outfits/index.ts ~690) chưa
  mang `primary_hex`/`secondary_hex`/`graphics` — item pin chưa hưởng measured-color. (2026-08-06)
  FIXED 2026-08-11 (2026-08-11 batch, confirmed defect #5): thêm cả 3 field, VÀ thêm luôn
  `distressed` (feature mới cùng đợt). Fix server một mình sẽ VÔ TÁC DỤNG nếu thiếu fix client
  đi kèm — `fitEngineStore.fetchMixMatchOutfits`'s request builder cũng được sửa để thực sự
  GỬI 3 field đó lên (test mới trong `fitEngineStore.mixmatch.test.ts`).
- [x] `wardrobe-critic/analyze.ts` build styleProfile không có computedAttributes giống bug cũ
  của generate-outfits — hiện VÔ HẠI vì analyze không gọi resolveTargetSilhouette; chỉ cần nhớ
  nếu wardrobe-critic sau này dùng silhouette-first. (2026-08-06) FIXED (defensive parity)
  2026-08-11 (2026-08-11 batch, confirmed defect #6): `styleProfile.computedAttributes` giờ
  được set, vẫn VÔ HẠI hôm nay (đúng như ghi chú gốc) nhưng chặn được landmine nếu
  wardrobe-critic sau này gọi `resolveTargetSilhouette`.
- [x] `tryon-generate` deno check còn 4 lỗi TS2345 MinimalClient-vs-SupabaseClient — PRE-EXISTING
  (verify bằng stash), dọn khi nào rảnh cho `deno check` sạch. (2026-08-06) FIXED 2026-08-11
  (2026-08-11 batch, confirmed defect #3): root cause là `MinimalClient`'s `.single()`/`.rpc()`
  khai `Promise<...>` nhưng supabase-js's `PostgrestBuilder` chỉ thenable (có `.then()`, thiếu
  `catch`/`finally`/`[Symbol.toStringTag]`) — không structurally assignable. Đổi cả 2 chữ ký
  sang `PromiseLike<...>` (pure type fix, `await` chấp nhận mọi thenable, không đổi runtime).
  CÙNG fix áp dụng cho `generate-item-image/index.ts`'s `MinimalClient` (cùng vấn đề, tự phát
  hiện thêm khi sửa).
- [ ] Caption "đã hoàn credit" của quality_warning hơi lệch với account demo (không trừ credit
  nên không hoàn) — chỉ gặp ở account reviewer, ưu tiên thấp. (2026-08-06) LƯU Ý 2026-08-11:
  demo giờ CÓ trừ credit thật (xem section J, "demo vẫn vô hạn... nay đã LỖI THỜI") nên tiền
  đề của mục này ("demo không trừ credit nên không hoàn") cũng đã thay đổi — demo giờ hoàn
  credit như mọi tier khác, caption không còn lệch. Coi như hết hiệu lực, không cần sửa gì
  thêm.
- [x] `evaluate-item/index.ts:199` lỗi type PRE-EXISTING (`pattern: string|null|undefined` vào
  `buildNoteContext` expect `string|undefined`) — fix 1 dòng `?? undefined` khi nào tiện.
  (2026-08-06) FIXED 2026-08-11 (2026-08-11 batch, confirmed defect #2): đúng 1 dòng
  `pattern: itemRow.pattern ?? undefined` như dự đoán.

## L. Gemini prepay credits CẠN — phát hiện 2026-08-07 khi debug try-on
- [ ] **NGUYÊN NHÂN try-on "Không kiểm tra được ảnh": Google API key hết prepay credits**
  (2026-08-07). Log function: Gemini 429 RESOURCE_EXHAUSTED "Your prepayment credits are
  depleted" → tryon-validate trả 502 → client hiện copy "kiểm tra kết nối" (gây hiểu nhầm).
  CHỈ anh Khôi nạp được: https://ai.studio/projects. Ảnh hưởng MỌI tính năng Gemini:
  tryon-validate/generate, generate-item-image (scan), evaluate-item note, curator
  (curator fail-open nên feed vẫn chạy, chỉ mất curated).
- [x] Client map lỗi 502 của tryon-validate thành copy "kiểm tra kết nối" — misleading;
  nên phân biệt lỗi dịch vụ AI ("Dịch vụ AI đang gián đoạn — thử lại sau") vs lỗi mạng
  thật. Tương tự cho generateWearOn. (2026-08-07)
  RESOLVED 2026-08-11 — new `classifyTryOnFailure()` in
  `src/services/tryOnWearService.ts` reads the `.name` supabase-js's
  `functions.invoke()` throws (`FunctionsFetchError` = fetch never reached the
  server = genuine network failure; `FunctionsHttpError`/`FunctionsRelayError` =
  a response DID come back with a non-2xx status = server-side/AI failure,
  covers tryon-validate/tryon-generate's 500/502/503) and buckets it
  'network' | 'service' | 'unknown'. `src/features/try-on/useWearOnYou.ts`'s
  `runValidation` and `generate` catches now branch on this instead of always
  showing the network copy. New i18n keys (both `en.json`/`vi.json`):
  `wearOnYou_serviceUnavailable` (shared by both paths — "The AI service is
  temporarily unavailable. Please try again later." /
  "Dịch vụ AI đang gián đoạn — thử lại sau.") and
  `wearOnYou_generationNetworkFailed` (generate path's network case, mirrors
  the existing `wearOnYou_validationFailed` phrasing). Tests:
  `src/services/__tests__/tryOnWearService.classify.test.ts`.
- [x] Verify constraint live `outfit_interactions.type` (2026-08-07, qua Management API
  /database/query): CHECK in ('saved','worn','scheduled','impression') — migration files
  thiếu 'impression' (drift xác nhận). Muốn thêm 'viewed'/'dismissed' phải ALTER constraint
  trên live + tạo migration đồng bộ.

## M. Try-on full-body hard gate — theo dõi sau khi deploy (2026-08-08)
- [ ] **`full_body_visible` gate ở tryon-validate có thể reject nhầm ảnh thật của user** —
  Vietnamese trong nhà thường chụp thiếu chân/bị gương/kệ che phần dưới; nếu tỉ lệ reject
  cao gây khó chịu, cân nhắc nút "Dùng ảnh này luôn" (bỏ qua gate, chấp nhận rủi ro
  proportion/crop không hoàn hảo) thay vì chặn cứng 100%. Cần xem log/feedback thật sau khi
  deploy rồi mới quyết — chưa deploy đợt này. (2026-08-08)
- [ ] **`identity_ok`/`body_ok` verify field mới có thể gây hoàn credit oan (false refund)** —
  2 field này chưa có dữ liệu thực tế nào để biết gemini-2.5-flash so sánh 2 ảnh (gốc vs
  edit) có hay bị false-negative không (vd: ánh sáng/crop khác nhẹ do nén ảnh cũng có thể bị
  chấm `body_ok:false` dù thực ra đúng). Hậu quả nếu sai chỉ là hoàn nhầm credit (rẻ, không
  hại user) nhưng vẫn nên theo dõi tỉ lệ `quality_warning` sau khi deploy, so với baseline
  trước khi thêm 2 field này. (2026-08-08)

## N. APK size & emulator storage (2026-08-09)
- [x] **App treo ở splash trên emulator — KHÔNG phải lỗi code** (2026-08-09). Triệu chứng:
  `expo run:android` cài xong, app đứng ở splash vô hạn. Bằng chứng loại trừ: Metro serve
  `/index.bundle` 12.4 MB HTTP 200 trong 14s, app đã kéo được bundle (thread OkHttp tới
  `10.0.2.2:8081`), `authStore.hydrate`/`appStore.hydrate` đều có `withTimeout` +
  `set({hydrated:true})` trong `finally` nên không thể treo vĩnh viễn.
  Nguyên nhân thật, đọc từ logcat:
  `Verification of ReconnectingWebSocket$$ExternalSyntheticLambda0.<init> took 20.071s
  (0.30 bytecodes/s)` — ART verify dex bò vì emulator đói tài nguyên. Bối cảnh: `hw.ramSize`
  chỉ 2048, `/data` đầy 89%, VÀ lúc đó Gradle release build đang chiếm CPU.
  FIX: `~/.android/avd/Medium_Phone.avd/config.ini` → `hw.ramSize` 2048→**4096**,
  `vm.heapSize` 228→512, `hw.cpu.ncore` 4→6, rồi cold boot (`-no-snapshot-load`).
  Kết quả đo: `am start` từ >60s xuống **0.6s**.
  CẢNH BÁO (đã sửa lại chẩn đoán): emulator chết sau vài phút KHÔNG phải do thiếu RAM host
  — lần chết thứ hai host còn 19.8 GB trống mà vẫn chết. Nguyên nhân thật: emulator được
  spawn từ tool call của Claude thì bị giết theo process tree của lệnh đó khi lệnh kết thúc.
  → **Emulator phải do anh Khôi tự mở** (Android Studio / terminal riêng), Claude chỉ
  `adb` vào máy ảo đã có sẵn. Cùng bản chất với bẫy Metro đã ghi ở
  [project_metro_run_android_gotcha].
  BÀI HỌC: đừng chạy Gradle build song song với việc mở app trên emulator — nó vừa đói CPU
  vừa giết Metro watcher.
- [ ] **Emulator `Medium_Phone` sắp hết đĩa** — data partition chỉ 6G, system image
  google_apis_playstore_ps16k đã ăn 4.9G, còn ~700M. Install APK debug 174M (4 ABI) fail
  `INSTALL_FAILED_INSUFFICIENT_STORAGE`. Workaround đang dùng: build 1 ABI
  (`./gradlew assembleDebug -PreactNativeArchitectures=x86_64` → 102.5M, cài OK).
  Fix dứt điểm: sửa `disk.dataPartition.size` lên 16G trong
  `~/.android/avd/Medium_Phone.avd/config.ini` — CHƯA làm vì có rủi ro phải wipe data
  (mất state login/wardrobe trên máy ảo). (2026-08-09)
- [ ] **`expo run:android` build đủ 4 ABI → APK 170M → `INSTALL_FAILED_INSUFFICIENT_STORAGE`**
  CHƯA có cách tự động. Đã THỬ VÀ THẤT BẠI 2026-08-10: đặt `ndk { abiFilters }` trong
  buildType `debug` của `android/app/build.gradle` → APK **phình lên 265 MB và vẫn đủ 4
  ABI**; `abiFilters.clear()` không lọc được mà còn phá khâu strip symbol (libs vào APK ở
  dạng chưa strip). Đã revert.
  Cách DUY NHẤT đang chắc chắn chạy: `./gradlew assembleDebug -PreactNativeArchitectures=x86_64`
  (→ ~102 MB), nhưng `expo run:android` không truyền được property này.
  Các hướng chưa thử: (a) đặt `reactNativeArchitectures=x86_64` trong
  `~/.gradle/gradle.properties` — user-level đè project-level, EAS không bị ảnh hưởng,
  NHƯNG nguy hiểm vì anh Khôi build AAB release cục bộ → có thể vô tình ship AAB thiếu
  arm64 lên Play; (b) tăng data partition emulator để 170 MB vừa thoải mái. (2026-08-10)
- [ ] **ML Kit chiếm ~28M native + 4M assets trong APK, có thể có phần thừa** — breakdown
  lib/x86_64 (71.5M tổng): `libmlkitcommonpipeline` 11.6M, `libmlkit_google_ocr_pipeline`
  11.1M, `libbarhopper_v3` (barcode) 5.6M. Assets bundle 4M thì 100% là model ML Kit
  (`mlkit_label_default_model` 1.95M, `mlkit-google-ocr-models` 1.22M,
  `mlkit_barcode_models` 0.84M) — không có asset nào của MIEN.
  Nguồn: `modules/expo-item-extract/android/build.gradle:75` khai `text-recognition:16.0.1`
  (OCR ~11M — kiểm tra xem code có thật sự gọi không, nếu không thì bỏ);
  `node_modules/expo-camera/android/build.gradle:31` kéo `barcode-scanning:17.3.0`
  transitive (~6M — có thể exclude nếu app không dùng scanner). Chưa đụng vì cần verify
  call-site trước. (2026-08-09)

## O. Production readiness — phát hiện khi review build (2026-08-09)
- [x] **`.easignore` KHÔNG loại thư mục build native → EAS upload thừa ~2 GB** — ĐÃ VÁ
  2026-08-09 (`.easignore:15-25`): thêm `android/build/`, `android/app/build/`,
  `android/app/.cxx/`, `android/.gradle/`, `modules/*/android/{build,.cxx}/`,
  `ios/{build,Pods}/`. Lý do phải lặp lại dù `.gitignore` đã có: khi tồn tại `.easignore`,
  EAS dùng nó THAY cho `.gitignore`.
- [x] **Bật R8/minify cho release** — ĐÃ BẬT 2026-08-09
  (`android/gradle.properties:28-35` → `android.enableMinifyInReleaseBuilds=true`).
  `shrinkResources` CỐ Ý để tắt: nó xoá resource chỉ tham chiếu theo tên lúc runtime, mà
  `res/` chỉ ~2 MB → đánh đổi không đáng.
  `android/app/proguard-rules.pro` viết lại: chỉ bù cho thư viện KHÔNG tự ship consumer
  rules (JNI native methods, `com.tflite.**`, `com.revenuecat.purchases.**`,
  `-dontwarn com.google.mlkit.vision.barcode.**`). RN / expo-modules-core / react-native-svg
  đã tự lo qua `consumerProguardFiles`. Xoá 2 rule `reanimated` chết (package không cài).
- [ ] **BẮT BUỘC QA bản release trên máy thật trước khi upload store** — R8 build PASS
  không chứng minh app chạy đúng; lỗi minify lộ ở runtime (`ClassNotFoundException`,
  deserialize sai field name). Phải đi hết: đăng nhập → wardrobe add/extract (ML Kit
  segmentation + OCR) → generate outfit → try-on → **paywall/restore purchase**
  (RevenueCat là chỗ rủi ro nhất vì deserialize theo tên field). Nếu gãy, cách lùi nhanh:
  đặt `android.enableMinifyInReleaseBuilds=false`. (2026-08-09)
  LƯU Ý: **không QA được RevenueCat trên emulator** — xác nhận 2026-08-09 qua logcat:
  `PurchasesError(code=PurchaseNotAllowedError, ... BILLING_UNAVAILABLE ... Billing service
  unavailable on device)`. Phải test paywall trên máy thật có Play Store + tài khoản
  license tester. Đây cũng đúng là nhánh code R8 dễ gãy nhất → không thể bỏ qua bước này.
- [x] **Metro crash `ENOENT ... watch` khi build Gradle song song với `expo start`** —
  FIX 2026-08-09 (`metro.config.js`): thêm `resolver.blockList` chặn
  `android/**/build/`, `android/**/.cxx/`, `ios/build/`, `ios/Pods/`. Nguyên nhân: Gradle
  tạo/xoá thư mục trong `node_modules/*/android/build/intermediates/`, Metro watcher crawl
  trúng lúc thư mục biến mất → chết cả dev server. Regex đã test bằng
  scratchpad/check-metro.js (bản đầu sót `android/app/build` vì thiếu segment module).
- [ ] **AAB release: 54.8 MB / ~94 MB là model TFLite nhúng cứng** — ĐO THẬT 2026-08-09 từ
  `app-release.aab` (108.35 MB, trừ 13.61 MB BUNDLE-METADATA không giao cho user →
  **~94 MB tải về cho máy arm64**). Cơ cấu: `res/raw` **54.8 MB**
  (blazepose-heavy 24.97 + modnet 22.88 + movenet-lightning 2.2 + selfie-segmenter/
  face-detector), `lib/arm64-v8a` 16.02, `drawable-mdpi` 9.43, `dex` 8.15, `assets` 4.66.
  → **Model chiếm hơn nửa app, không phải ML Kit/RN như phán đoán ban đầu.**
  Hướng giảm (chưa làm, cần anh Khôi quyết): (a) tải model theo yêu cầu lần đầu dùng thay
  vì nhúng — KHÔNG vi phạm ràng buộc "body data on-device only" vì đó là tải model xuống,
  không phải gửi ảnh đi; (b) đổi BlazePose Heavy → Full/Lite; (c) quantize fp16→int8.
  Bị `require()` tĩnh ở `poseEstimate.ts:129,154`, `silhouette.ts:70,91`,
  `faceDetect.ts:48` nên Metro luôn nhúng. (2026-08-09)
- [ ] **9.43 MB ảnh demo wardrobe (`drawable-mdpi`, 97 file) nằm trong bản production** —
  `src/data/index.ts:51+` `require()` tĩnh toàn bộ `assets/items/*.png` (nặng nhất:
  jacket-ma1-navy 1.09 MB, jacket-utility-olive 1.01 MB…). Đây là code production, KHÔNG
  bị `.easignore` loại (chỉ `seedLocalPhotos.dev.ts` bị loại). Cần xác định: dữ liệu demo
  này có thật sự cần ship cho user thật không, hay chỉ phục vụ dev/onboarding — nếu không
  cần thì cắt gần 10 MB. (2026-08-09)
  **Update 2026-08-11:** đã tái nén 43 file trong `assets/items/` (palette PNG quantization
  + max deflate, giữ nguyên alpha, downscale cạnh dài >1600px xuống ~1200×1600) —
  18.40 MB → 8.25 MB trên đĩa (**-55.2%**), không đổi cách hiển thị (verify: alpha/aspect
  ratio giữ nguyên trên cả 43 file, kiểm tra mắt 3 file nén nhiều nhất không banding/viền
  cứng). Ước tính phần `drawable-mdpi` trong AAB co theo tỷ lệ tương tự, còn khoảng ~4-5 MB
  thay vì 9.43 MB — **chưa đo lại AAB thật** (cần build release để xác nhận số chính xác).
  Chi tiết: `plan.md` changelog 2026-08-11.
  **Đồng thời: đảo ngược một phần tiền đề của mục này.** Data demo này KHÔNG phải rác chờ
  xoá — nó có tải trọng sản phẩm thật: `app/(tabs)/index.tsx:160` set
  `isDemo = wardrobeItems.length === 0`, nghĩa là MỌI user thật mới (tủ đồ rỗng) đang xem
  chính feed demo này (đây là bản chất của T022 "demo feed cho user mới"), và `OUTFITS`
  cũng là fallback khi generation chưa ra kết quả. Xoá thẳng bộ demo = xoá luôn empty-state
  cho user mới — đây là quyết định sản phẩm cần anh Khôi chốt, không phải việc dọn dẹp kỹ
  thuật đơn thuần. Đòn bẩy còn lại an toàn hơn: **chỉ `OUTFITS.slice(0, 2)`** thực sự được
  dùng cho demo feed rỗng — một lần cắt tỉa sau này (chỉ ship item mà 2 outfit đó tham
  chiếu, không phải toàn bộ 43 file) mới là hướng giảm tiếp mà không đụng sản phẩm.
- [ ] **`com.amazon.device:amazon-appstore-sdk:3.0.5` bị kéo vào build** — phát hiện qua
  R8 warning khi build release. Nhiều khả năng do RevenueCat kéo transitive (hỗ trợ Amazon
  Appstore). MIEN chỉ phát hành Play + App Store → nhiều khả năng loại được để giảm dex.
  Chưa đụng vì chưa verify RevenueCat có gọi tới nó vô điều kiện lúc init không. (2026-08-09)
- [ ] **`EXPO_PUBLIC_DEMO_PASSWORD` nằm trong `eas.json` đã commit** — mọi biến
  `EXPO_PUBLIC_*` đều được nhúng thẳng vào JS bundle, ai tải app về cũng trích ra được.
  Nên coi mật khẩu tài khoản demo là CÔNG KHAI. Cần verify tài khoản demo không có quyền
  ghi/đọc dữ liệu user khác qua RLS. (2026-08-09)
- [x] Verify `react-native-purchases` đã cài thật (2026-08-09): `package.json:42` có
  `^10.6.0`, gradle build có `:react-native-purchases` + `:react-native-purchases-ui` →
  mục "Paywall gãy trong build" coi như đã xử lý ở phần dependency.
- [x] Verify `/dev-seed` không lọt production (2026-08-09): có guard `!__DEV__` ở
  `app/dev-seed.tsx:22` render màn hình trơ, VÀ bị loại qua `.easignore:53-55`. An toàn
  hai lớp.
- [ ] **Style catalog (22 style, 2026-08-10): toàn bộ `image_url` là null, kể cả 14 style
  mới** — DB `public.styles.image_url` null cho cả 22 row (đúng như 8 style cũ trước đây).
  8 style cũ còn có ảnh Unsplash qua fallback tĩnh `src/data/index.ts` `STYLES[].img`; 14
  style mới KHÔNG có ảnh thật nào (client dùng `img: ''` → `Photo` render tile màu +
  label, không phải ảnh thật). Cần ảnh đại diện thật cho `feminine`, `officechic`,
  `parisian`, `coquette`, `cleangirl`, `darkacademia`, `cottagecore`, `grunge`, `athflow`,
  `elegant`, `kfashion`, `vintage`, `resort`, `artsy` — cả ở DB (`image_url`) lẫn client
  fallback. (2026-08-10)
- [ ] **Tên/mô tả style KHÔNG có đường dịch tiếng Việt** — xác nhận trước khi làm gì
  (2026-08-10): style name/description luôn đến từ `public.styles` (tiếng Anh) hoặc
  fallback tĩnh `src/data/index.ts` `STYLES` (cũng tiếng Anh); `src/i18n/locales/
  {en,vi}.json` không có key nào cho tên style — kể cả 8 style cũ. Giữ nguyên cơ chế này
  cho 14 style mới (không tự chế hệ dịch mới), nhưng đây là gap có thật nếu app cần hiển
  thị tên style bằng tiếng Việt.
- [x] **`wardrobe-critic/archetypes.ts`'s `ALL_STYLES` chưa có 14 style mới** — FIXED
  2026-08-11: `ALL_STYLES` giờ derive từ `STYLE_CONFIGS.map(c => c.id)` thay vì hardcode —
  tự động phủ hết mọi style hiện có VÀ mọi style thêm sau này, không thể drift lại nữa.
  `analyze.test.ts`'s hardcoded `STYLE_IDS` (dùng validate archetype catalog) bị stale y hệt,
  sửa cùng cách.
- [x] **`PATTERN_FRIENDLY_STYLES` (ranking.ts) / `HOUSE_OPPOSED_STYLES` (scoring.ts)
  chưa có style mới** — anh Khôi đã duyệt, FIXED 2026-08-11: `PATTERN_FRIENDLY_STYLES` thêm
  `grunge`/`artsy`/`cottagecore`/`vintage`/`coquette`/`darkacademia`/`preppy`/`resort`/`pinup`
  (verify từng style qua `STYLE_CONFIGS`); `HOUSE_OPPOSED_STYLES` thêm `artsy`/`retro70s`/
  `resort`/`mobwife`. Đo được kết quả cụ thể qua eval harness: fixture `resort` mới (20 món,
  `scripts/eval-feed/fixture.ts`) sinh ĐƯỢC 0 outfit hợp lệ trước fix (mọi combo 2-pattern-đậm
  bị hard-ban), sinh được một số sau fix. Chi tiết: `plan.md` "Style catalog consistency"
  (2026-08-11).
- [ ] **Neighbor một chiều CÓ SẴN TỪ TRƯỚC: `bohemian → y2k` (0.3) và
  `bohemian → athleisure` (0.2) không được đáp lại** — phát hiện khi viết test
  bidirectionality cho việc mở catalog (2026-08-10), nhưng đây là bug có sẵn trong 8
  style gốc, không phải do lần mở catalog này gây ra. Không sửa vì ngoài scope (chỉ được
  phép "thêm neighbors hai chiều" cho style MỚI, không phải sửa quan hệ cũ-cũ). Sửa thì
  cần thêm `bohemian` vào neighbors của `y2k` và `athleisure` ở cả `filtering.ts` lẫn
  `public.styles`.
- [ ] **`mobwife` (Mob Wife) — style bị DỪNG, chưa ship, thiếu vocabulary "fur"** —
  yêu cầu đợt 2 (22→33) có `mobwife`, nhưng vật liệu định danh của style này là lông thú
  ("lông thú, da, vàng kim"). `FabricName` (`supabase/functions/generate-outfits/engine/
  types.ts`) không có entry fur/faux-fur nào, và không có fabric nào trong union hiện tại
  đóng vai trò xấp xỉ hợp lý (khác với `glam`'s sequin/satin, vốn map được vào `silk`/
  `velvet` đã có). Cần anh Khôi quyết: (a) thêm `FabricName` value mới cho fur (có ripple
  sang ingestion/enrichment, cần đánh giá riêng), hoặc (b) chấp nhận xấp xỉ mất mát (leather
  + `metallic` color + textureRichness cao — nhưng lúc đó không còn là "mob wife" thật, chỉ
  là bản sao khác tên của elegant/gothic). Chưa thêm vào `STYLE_CONFIGS` hay `public.styles`.
  (2026-08-10)
- [ ] **`modest` — style bị DỪNG, chưa ship, thiếu attribute "độ phủ da"** — yêu cầu đợt 2
  có `modest`, nhưng ràng buộc định danh của style này (tay/chân dài, cổ kín) không có trục
  nào trong `StyleConfig`/`FitItem` diễn tả được. `filterByStyle` chỉ kiểm 5 trục: màu,
  fabric, fit, formality, banned features — không trục nào liên quan tới độ dài tay áo/gấu
  quần/cổ áo. `GarmentMeasurements` có số đo (`sleeves`, `body_length`...) nhưng không có
  ngưỡng tối thiểu nào gắn với style, và không có field categorial nào cho "độ phủ da". Cần
  anh Khôi quyết: thêm attribute coverage mới vào `FitItem`/`StyleConfig` (thiết kế mới, có
  ripple sang enrichment/ingestion) trước khi style này diễn tả được đúng nghĩa — không tự
  chế bằng cách cấm `bodycon` (vừa thừa vừa thiếu: cấm nhiều đồ bodycon vẫn kín, lọt nhiều
  đồ relaxed nhưng hở). Chưa thêm vào `STYLE_CONFIGS` hay `public.styles`. (2026-08-10)
- [x] **UX đề xuất: 31 style tile là dài — cân nhắc "show more" hoặc gom nhóm** — sau đợt 2
  (22→31), `styles.tsx`/`styles-edit.tsx` vẫn là một `flexWrap` grid không giới hạn trong
  `ScrollView`, không vỡ layout nhưng cuộn dài hơn hẳn (~16 hàng so với ~11 hàng ở 22 style).
  Đề xuất (chưa làm — xem `src/design/style-catalog/design.md` mục "Catalog size: 22 → 31"):
  (a) hiện 8–10 tile đầu (đã sort theo gender-match + popularity) rồi "Show all 31 styles"
  dạng text link, diff nhỏ, không cần taxonomy mới; (b) gom theo nhóm chủ đề (Refined /
  Casual & Athletic / Romantic & Feminine / Dark & Alternative / Vintage) — đúng tinh thần
  stylist hơn nhưng cần gán taxonomy mới cho từng style + sửa layout cả hai màn, nặng hơn.
  Nghiêng về (a). Cần anh Khôi quyết trước khi implement (đợt này chỉ được sửa layout nhỏ,
  không được tự ý làm thay đổi lớn). (2026-08-10) DONE 2026-08-11: implemented option (a) —
  `getInitialVisibleStyles`/`STYLE_CATALOG_INITIAL_VISIBLE` (=10) trong
  `src/services/stylesCatalogService.ts`, "Show all N" `TextLink` ở cả hai màn, style đã
  chọn luôn hiển thị kể cả ngoài 10 tile đầu. Xem plan.md "Style grid 'Show all' truncation
  + builder ACCESSORIES bucket rename" cùng ngày.
- [x] **`wardrobe-critic/archetypes.ts`'s `ALL_STYLES`, `ranking.ts`'s
  `PATTERN_FRIENDLY_STYLES`, `scoring.ts`'s `HOUSE_OPPOSED_STYLES` vẫn chưa có 9 style đợt
  2** — cùng gap đã log cho đợt 1 (22 style), giờ càng rộng hơn ở 31 style. FIXED 2026-08-11,
  cùng đợt sửa với mục ở section AC phía trên: `ALL_STYLES` giờ derive tự động từ
  `STYLE_CONFIGS` (phủ hết, kể cả style thêm sau); `PATTERN_FRIENDLY_STYLES`/
  `HOUSE_OPPOSED_STYLES` được duyệt mở rộng thêm 9+4 style tương ứng. (2026-08-10)

## AC. Style filtering tightening — `BannedFeature` + `typesBanned` (2026-08-10)

Phát hiện khi siết `filterByStyle` theo 2 trục mới (xem `plan.md` "Style filtering:
`BannedFeature` vocabulary + `typesBanned`" cùng ngày). Giữ nguyên toàn bộ diff đã ship —
các mục dưới đây là những gì CHƯA làm, cố ý dừng để báo cáo thay vì tự mở rộng.

- [x] 🔴 **`'distressed'` trong `BannedFeature` là dead vocabulary — khai báo nhưng chưa
  bao giờ được enforce.** anh Khôi đã quyết (2026-08-11): thêm field thật thay vì bỏ vocabulary.
  FIXED 2026-08-11: cột mới `clothing_items.distressed boolean` nullable
  (`supabase/migrations/20260811000002_clothing_items_distressed.sql`), `FabricProfile.
  distressed?: boolean` trên `FitItem` (populate trong `toFitItem`/`enrichment.ts`),
  `featuresPasses` check mới — FAIL-OPEN (chỉ reject khi `=== true`, `null`/`undefined` = chưa
  đánh giá thì luôn pass, không mass-fail ~70 item cũ). Restore lại đúng 14 style đã bị strip
  sáng nay (commit 240a5b1). Threaded xuyên suốt: prompt/schema extraction
  (`generate-item-image/prompt.ts`, `snapDistressed()`), `backfill-item-metadata` (SELECT +
  staleness check + patch-fill), `evaluate-item`, select/mapper của cả 3 engine function, và
  toàn bộ client ingest chain (`imageGenerationService`/`wardrobeService`/`wardrobe-add`).
  Test mới trong `filtering-extensions.test.ts` khoá chặt guarantee fail-open. **CÒN TREO**:
  ~70 item cũ vẫn `NULL` — cần chạy `backfill-item-metadata` (owner giữ
  `BACKFILL_ADMIN_SECRET`), xem mục mới trong section AE. Chi tiết: `plan.md` "`distressed`:
  re-added as a real, enforced signal" (2026-08-11).
- [ ] **`sheer`/`cutout`/`sequin`/`animal_print` — CHƯA thêm vào `BannedFeature`** — đúng
  theo nguyên tắc "chỉ thêm feature có tín hiệu suy được": rà `FitItem` (colorProfile,
  graphics, fabric.pattern) không có field nào carry được 4 tín hiệu này. Cần sửa pipeline
  extraction (ingest-time AI/manual) trước — thêm attribute mới vào `ClothingItemRow`/
  `FitItem`, có ripple sang `generate-item-image`/`backfill-item-metadata`. Việc riêng,
  ngoài scope task này. **CẬP NHẬT 2026-08-11**: giờ đã có tiền lệ đầy đủ để copy —
  `distressed` (mục ngay trên) đi đúng con đường này (cột DB nullable + field trên
  `FitItem`/`FabricProfile` + enforcement fail-open trong `featuresPasses` + backfill sau) và
  đã chứng minh chạy được end-to-end. Làm 4 feature này chỉ là lặp lại đúng pattern đó 4 lần,
  không cần thiết kế lại từ đầu.
- [ ] **`abstract_print` được implement (vào `BannedFeature` + `featuresPasses`) nhưng
  KHÔNG gán cho style nào** — bucket `abstract` gộp chung `print`/`abstract`/`camo`/
  `polka dot` (`enrichment.ts` `STORED_PATTERN_MAP`) quá dị biệt để có case "chắc chắn":
  một style có thể muốn cấm camo nhưng giữ polka dot (VD pinup) — cấm cả bucket sẽ sai một
  nửa. Sẵn sàng dùng khi có style cụ thể cần, nhưng không tự gán để tránh siết nhầm.

## AD. Womenswear demo data — fetch-item session (2026-08-11)

Thêm 10 món nữ + 2 outfit demo (`o7`/`o8`) vào `src/data/index.ts`. Xem `plan.md`
"Womenswear demo data — 10 items + 2 outfits" cùng ngày để biết chi tiết nguồn/sourcing.
Các mục dưới đây là việc chưa làm/chưa hoàn hảo, cố ý dừng để báo cáo.

- [ ] **`skirt-pleated-beige` không thực sự là màu be** — không tìm được colorway be/camel
  thật trong 3 SKU chân váy pleated đã thử trên Uniqlo VN/US (E470922, E479916, E467640) —
  chỉ có xám/đen/olive/pastel. Dùng tạm màu "Stone" (xám ấm nhạt, tone 1) từ E470922 màu
  51 — đủ gần để hợp category nhưng KHÔNG phải be thật. Nếu cần be chuẩn, thử thêm nguồn
  khác (Zara/Mango/ASOS) hoặc đổi tên hiển thị màu.
- [ ] **`camisole-blush` không phải lụa** — brief gốc xin "áo hai dây lụa" (`camisole-silk`)
  nhưng Uniqlo AIRism Bra Camisole (E465707) là polyester/cupro/spandex, không phải lụa.
  Đổi slug thành `camisole-blush`, material ghi `Polyester` thay vì bịa `Silk`. Nếu cần một
  món cami lụa thật, phải tìm ở brand khác (Everlane/COS thường có silk cami nhưng hầu hết
  ảnh sản phẩm của họ là người mẫu, không có ảnh flat/ghost sạch — chưa tìm được nguồn đạt).
- [ ] **`price`/`size`/`measurements` bỏ trống cho cả 10 món nữ** — Uniqlo và Charles &
  Keith render giá/size qua client-side JS, không có trong static HTML fetch được qua
  `curl`. Nếu cần điền, phải dùng trình duyệt thật (Chrome tool) để đọc DOM sau khi JS
  chạy, hoặc tìm API endpoint JSON của từng site.
- [x] **`rembg i <in> <out>` với `in == out` sẽ tự xoá sạch input** — gặp phải khi làm theo
  đúng ví dụ trong skill `fetch-item` (`rembg i assets/items/<slug>.png
  assets/items/<slug>.png`), làm 10 ảnh gốc vừa tải về bị ghi đè thành file 0 byte trước
  khi rembg kịp đọc xong. Phải tải lại rồi chạy với output path khác + `mv` sau. FIXED
  2026-08-11: `.claude/skills/fetch-items/SKILL.md` bước 3 giờ ghi ra `<slug>-cut.png` rồi
  `mv` đè lên, kèm cảnh báo rõ lý do; đồng thời bước 4 mới bổ sung tiêu chí nghiệm thu bắt
  buộc (Read tool xem lại ảnh, không được dính người) và danh sách `type` được bổ sung đủ
  đồ nữ.
- [ ] **Kiến trúc lọc còn thiếu 2 kiểu ràng buộc** — nhận ra khi thiết kế `typesBanned`
  (chỉ thêm được "cấm loại đồ X"), nhưng `filterByStyle` chưa có cơ chế cho:
  (a) **"bắt buộc phải có"** — VD style X yêu cầu ít nhất 1 món trong nhóm Y mới coi là
  outfit hợp lệ (khác cơ chế `hasOutfitCoverage`/an toàn hiện tại, vốn chỉ đảm bảo top+
  bottom+shoes tồn tại, không đảm bảo ĐÚNG style-defining piece nào có mặt — VD "Business
  Formal" nên bắt buộc có BLAZER/TROUSERS chứ không chỉ bất kỳ top/bottom nào pass filter);
  (b) **"cấm theo tổ hợp"** — VD "không được mặc SNEAKERS cùng SUIT" là ràng buộc giữa 2
  món trong cùng outfit, không phải ràng buộc trên 1 món đơn lẻ như 6 trục hiện tại
  (`palette`/`fabricsAllowed`/`fabricsBanned`/`allowedFits`/`formalityRange`/
  `bannedFeatures`/`typesBanned`) đều đang làm việc theo item, không theo cặp/outfit. Cả
  hai là thiết kế mới (ripple sang `generation.ts`/`filtering.ts`), cần anh Khôi quyết
  trước khi làm — không tự chế trong task này.
- [ ] **`modest` style vẫn còn treo** — lý do stop giống hệt lần trước (batch 2, 2026-08-10):
  đặc trưng của nó là độ che phủ da (tay áo/gấu váy/cổ áo), nhưng `FitItem`/
  `GarmentMeasurements` (`types.ts`) không có tín hiệu nào cho việc này, và
  `filterByStyle` chỉ có 6 trục hiện có (màu/vải/fit/formality/banned features/type) —
  không trục nào đo được độ che phủ. Cần quyết định thiết kế mới (thêm attribute
  coverage vào `FitItem`/ingest, hoặc chấp nhận xấp xỉ có mất mát qua silhouette) trước
  khi làm — chưa authorize trong task 2026-08-11 (unlock `mobwife`).
- [ ] **2 bảng fabric-keyed chưa điền cho `fur`** (2026-08-11, cân nhắc khi unlock
  `mobwife`): `enrichment.ts`'s `MATERIAL_STYLE_BOOSTS` (map material → style id) và
  `scoring.ts`'s `NATURAL_FABRICS` ("đọc sang/đắt tiền" bonus set). Cố ý bỏ qua:
  `MATERIAL_STYLE_BOOSTS` là bảng cũ chưa từng được điền cho bất kỳ style nào trong 23
  style mở rộng gần đây (chỉ có 8 style gốc) — điền riêng cho fur/mobwife sẽ lệch pha
  với tiền lệ. `NATURAL_FABRICS` thì mơ hồ hơn: lông thật đọc sang, lông giả thì không,
  và `FitItem` không phân biệt được hai loại (đúng lý do 'fur' gộp chung real+faux) —
  thêm vào có thể thưởng sai cho lông giả. Cần anh Khôi quyết trước khi làm.
- [x] **`blazer_margeaux_blk` đã fetch** (2026-08-11) — J.Crew Margeaux Blazer, `fit: 'regular'`,
  chiết eo rõ, để kích hoạt `outfitWaistDefinition`. Ghi chú cho lần `/fetch-item` sau: fitted
  blazer nữ RẤT khó tìm ảnh flat lay/ghost mannequin sạch — kiểm tra 9 nguồn (Uniqlo, H&M,
  Everlane, Ann Taylor, Massimo Dutti, COS, Zara, Mango, Amazon/Zappos) đều chỉ có ảnh mặc trên
  người dù mô tả xác nhận đúng "fitted"/"slim fit"/"nipped waist"; J.Crew là nguồn hiếm hoi có
  ảnh product-only thật cho một số SKU — nhưng chỉ ở ảnh THUMBNAIL trang search/category, không
  phải ảnh hero trên trang chi tiết sản phẩm (PDP hero luôn là model). URL pattern nhận diện:
  Scene7 `s7-img-facade/<CODE>_<COLOR>` (KHÔNG có hậu tố `_m`/`_d1`/`_d2`/`_d3` — các hậu tố đó
  là biến thể mặc trên người).

## AE. Backlog-clearing session — new follow-ups (2026-08-11)

Việc mới phát sinh/còn treo từ đợt dọn backlog lớn hôm nay (nhiều agent song song). Các mục
đã RESOLVE được đánh dấu `[x]` ngay tại vị trí gốc của chúng ở các section phía trên — đây là
những gì đợt này phát hiện thêm mà CHƯA làm.

- [ ] **`poseEstimated` chưa từng được SET ở bất kỳ đâu trong app, dù plumbing đã tồn tại**
  (2026-08-11) — `measurementService.ts` giờ map `pose_estimated`/`measurements_consent` xuyên
  qua `bodyToRow()`/`rowToBody()` (xem section E, mục đã đánh dấu `[x]` ở trên), nhưng đó chỉ
  là sửa đường ống — không có màn hình/flow nào trong app thực sự set `poseEstimated: true`.
  Field này có nghĩa "số đo này có phải suy ra từ AI pose estimation không" nhưng app hiện tại
  chỉ có nhập tay + AI-scan-từ-ảnh (khác pose estimation thật) — nên có thể field này ĐÚNG RA
  luôn là `false`/absent với luồng hiện tại, hoặc cần một call site set nó khi flow pose-
  estimate (`src/features/measurements/` pose pipeline, xem memory `project_pose_measure_
  pipeline`) thực sự chạy. Cần rà lại toàn bộ call site `setBodyMeasurements`/
  `saveMeasurements` xem có nên set `poseEstimated` ở đâu không trước khi coi plumbing này là
  "xong".
- [ ] **Onboarding resume chỉ best-effort — nút Skip không để lại dấu vết** (2026-08-11) —
  `src/features/onboarding/resumeRoute.ts` (mới) tự ghi rõ trong comment: KHÔNG có cột/bảng
  `onboarding_step` checkpoint thật, resume signal tái dùng dữ liệu mỗi bước đã lưu khi bấm
  Continue. Một bước bị bấm "Skip" (VD measurements' skip button) không ghi sentinel phân biệt
  "đã ghé qua và bỏ qua" với "chưa bao giờ ghé qua" — nên resume sẽ đưa user quay lại đúng bước
  đó dù họ đã cố ý skip trước đây (tệ nhất chỉ là bấm Skip lại 1 lần, không mất dữ liệu). Muốn
  chính xác tuyệt đối cần thêm checkpoint thật (cột/bảng mới) — chưa authorize, chỉ ghi nhận.
- [ ] **`distressed` cần chạy lại backfill cho ~70 item cũ** (2026-08-11) — cột
  `clothing_items.distressed` mới thêm là `NULL` cho mọi item có sẵn trước hôm nay (fail-open
  nên KHÔNG mass-fail wardrobe thật, nhưng những item đó vẫn chưa được style nào có
  `bannedFeatures: ['distressed']` thực sự đánh giá đúng). Cần chạy `backfill-item-metadata`
  admin function (dry_run trước, giống các lần backfill trước) — chỉ anh Khôi có
  `BACKFILL_ADMIN_SECRET`. Item mới thêm từ giờ sẽ tự có field qua `generate-item-image`
  extraction, không cần backfill.
- [ ] **`sheer`/`cutout`/`sequin`/`animal_print` giờ có tiền lệ đầy đủ để làm theo** — xem mục
  đã cập nhật ở section AC phía trên: `distressed` hôm nay đã đi trọn vẹn con đường "cột DB
  nullable + field trên `FitItem` + enforcement fail-open + backfill sau" — 4 feature này chỉ
  cần lặp lại đúng pattern đó, không cần thiết kế mới. Vẫn cần anh Khôi duyệt trước khi làm
  (đổi vocabulary + ripple sang ingestion, giống mọi lần trước).
- [ ] **Theo dõi xáo trộn thứ hạng feed sau khi deploy `ranking.ts`'s re-sort** (2026-08-11) —
  đo bằng eval harness (before/after engine copy diff): outfit SET không đổi, nhưng với
  `streetwear` fixture, 23/24 outfit chung đổi vị trí và top-10 hiển thị turn-over 40% (4
  outfit vào/ra khỏi top-10). Đây là thay đổi CHỦ Ý (owner đã duyệt hướng "penalty phải ảnh
  hưởng thứ tự thật"), nhưng biên độ xáo trộn lớn hơn dự kiến ban đầu — nên theo dõi phản hồi
  người dùng thật (feed có "nhảy" bất thường không) sau khi deploy `generate-outfits`.
- [ ] **Quyết định gemini-2.5-flash-lite cần xem lại NGAY khi Google công bố shutdown date**
  (2026-08-11) — quyết định "ở lại lite tier" (section J, mục model env override) là cost-first
  VÀ có điều kiện: hiện KHÔNG có deadline nào cho `gemini-2.5-flash-lite` (khác hẳn 2.5-flash/
  -pro đã có 16/10/2026). `GEMINI_FLASH_LITE_MODEL` env override đã tồn tại nên khi cần đổi chỉ
  là đổi secret — nhưng cần AI Khôi/agent nào đó chủ động theo dõi trang deprecations của Google
  định kỳ, vì không có cơ chế tự động cảnh báo. 2 đường nâng cấp đã định giá sẵn trong code
  comment (`describe-outfit/index.ts`, `evaluate-item/note.ts`): `gemini-3.1-flash-lite`
  ($0.25/M in, $1.50/M out, tự nó cũng shutdown 2027-05-07) hoặc `gemini-3.5-flash-lite`
  ($0.30/M in, $2.50/M out, chưa công bố shutdown).
- [ ] **Flash-tier migration ĐẾN HẠN trước 16/10/2026 — chỉ còn cách 1 Supabase secret**
  (2026-08-11) — anh Khôi quyết định GIỮ default `gemini-2.5-flash` (không đổi sang
  `gemini-3.6-flash` như một session trước từng làm rồi bị revert) vì `GEMINI_FLASH_MODEL`
  override đã tồn tại ở mọi call site (`generate-item-image`, `backfill-item-metadata`,
  `map-measurements`, `tryon-validate`, `tryon-generate`'s `TRYON_VERIFY_MODEL`,
  `generate-outfits/engine/curator.ts`, `scripts/eval-feed/judge.ts`) nên migrate thật sau
  này chỉ là 1 lần `supabase secrets set GEMINI_FLASH_MODEL=...`, không cần deploy code. 2
  đường nâng cấp đã định giá sẵn: (1) `gemini-3.6-flash` — $1.50/M in + $7.50/M out, đắt hơn
  5x input / 3x output so với `gemini-2.5-flash` hôm nay ($0.30/$2.50); (2)
  `gemini-3.5-flash-lite` — cost-neutral ($0.30/$2.50, chưa công bố shutdown) nhưng tier lite
  yếu hơn ở vision so với flash hiện tại. Ai nhặt việc này lên cần cân nhắc giá vs chất lượng
  vision trước 16/10/2026 — xem `generate-item-image/index.ts`'s VISION_MODEL comment để có
  lý do đầy đủ.
- [x] **Danh sách edge function CẦN DEPLOY sau đợt dọn backlog hôm nay** — ĐÃ DEPLOY XONG
  2026-08-11 (cùng session, theo yêu cầu anh Khôi). 9 function, deploy TỪNG CÁI một bằng
  Supabase CLI (`npx supabase functions deploy <name> --project-ref trtjcsxcowqecsebvyme`),
  KHÔNG dùng MCP — xem memory `feedback_deploy_edge_cli`. Tất cả ACTIVE, version +1:
  `backfill-item-metadata` 8→9, `describe-outfit` 7→8, `evaluate-item` 24→25,
  `generate-item-image` 19→20, `generate-outfits` 55→56, `map-measurements` 6→7,
  `tryon-generate` 13→14, `tryon-validate` 4→5, `wardrobe-critic` 14→15.
  **`verify_jwt` giữ NGUYÊN bit-for-bit** (verify qua Management API trước VÀ sau deploy):
  8 function = `true` (deploy KHÔNG truyền flag), riêng `backfill-item-metadata` = `false`
  từ trước (auth bằng `BACKFILL_ADMIN_SECRET` chứ không bằng JWT user) nên PHẢI truyền
  `--no-verify-jwt` để GIỮ nguyên — đây là ngoại lệ "bảo toàn trạng thái", không phải tắt
  JWT mới; nếu bỏ flag thì endpoint admin sẽ gãy. `config.toml` không khai `verify_jwt`
  cho function nào nên CLI luôn áp mặc định → mọi lần deploy sau CŨNG phải kiểm tra trước.
  `delete-user` (v5) và `revenuecat-webhook` (v5) KHÔNG đụng tới, đã verify không đổi.
  **DB migrations: ĐÃ APPLY RỒI, không cần làm gì thêm** — verify trực tiếp qua Management API
  ngay khi viết mục này (2026-08-11): `clothing_items.distressed` (boolean) đã tồn tại live;
  `consume_usage_credit()` live đã có `v_period_end`/`set_config('app.credit_write_allowed',
  'on', true)` đúng như migration `20260811000004`; trigger `usage_credits_protect_credits`
  đã gắn trên `public.usage_credits`; `refund_usage_credit()` đã tồn tại. Cả 3 file migration
  (`20260811000002`/`3`/`4`) coi như đã chạy trên live DB dù chưa commit vào git — chỉ còn
  thiếu bước `git add`/commit migration files cho khớp trạng thái live (không phải deploy).
  Verify code sau khi deploy function: `tsc`/`jest`/`deno test` đã chạy sạch trong session này
  (38 suites/556 tests jest; 284+37+11 deno, 0 fail) — xem `plan.md` phần "Verify" cuối mục
  "Backlog-clearing session".
