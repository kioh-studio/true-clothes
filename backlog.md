# Backlog — review later

Deferred items flagged during development. Each has enough context to pick up cold.
Dọn 2026-07-03 theo yêu cầu anh Khôi: mọi mục đã implement bị XÓA (lịch sử đầy đủ nằm
trong plan.md changelog); còn lại phân nhóm theo lý do chưa làm.

---

## A. Chờ anh Khôi duyệt — trade-off lớn (chi phí / UX / phạm vi)

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
- [ ] **Đồng bộ ingest-threading cho `print_scale`/`drape`/`visual_interest`** (2026-07-06):
  3 field này server vẫn trả về trong extraction nhưng `useAddWizard`/`AddItemInput` KHÔNG
  map vào insert (chỉ tự có sau khi `backfill-item-metadata` chạy) — precedent cũ còn
  nguyên. Hex ĐÃ được thread (mục trên); nếu muốn 3 field kia cũng có ngay lúc lưu thì làm
  tương tự (client `GarmentMetadata`/`ExtractedItem`/`AddItemInput`/insert). Chờ anh Khôi
  duyệt phạm vi.
- [ ] **Wardrobe critic — Try-On candidate re-scoring (T032, optional).** Server +
  client core DONE 2026-07-03 (xem `plan.md` changelog "Wardrobe Critic — client").
  Còn thiếu: gọi lại `wardrobe-critic` với `candidate_item` từ Try-On result để hiện
  unlock-count THẬT của món vừa scan (hiện chỉ có dòng "Fills your gap: {label}" thuần
  trình bày, không chấm lại). Không nằm trong phạm vi task được giao phiên này.
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
- [ ] **`measurements-edit.tsx` có cùng bug hydrate-race đã fix ở colors-edit/styles-edit/
  formulas-edit (2026-07-07)**: `useState(() => ({ height: cmStr(bm.body_height), ... }))`
  snapshot `bodyMeasurements` một lần lúc mount, không re-sync khi `useFitEngineStore`
  hydrate xong (async, có thể trễ). Nếu mở trước khi hydrate xong → form hiện trống, Save
  ghi đè DB bằng số đo rỗng — RỦI RO THẤP hơn colors/styles (số đo là required field, thường
  đã có sẵn trong `authStore` khi vào Settings, và validate chặn most-empty submits) nhưng
  cơ chế bug giống hệt. CHƯA fix — cần cùng pattern resync-if-untouched + `hydrated` guard
  trên Save. `personal-color-edit.tsx` đã kiểm tra: KHÔNG dính bug này — nó chạy lại toàn bộ
  quiz/scan từ đầu mỗi lần mở (không snapshot dữ liệu cũ vào state để chỉnh sửa), chỉ hiển
  thị `existingSeason` qua selector reactive (`useAuthStore(s => s.colorSeason)`), không qua
  snapshot một lần.

## B. Cần thiết bị thật / dữ liệu thật (không verify được từ máy dev)

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
- [ ] **`pose_estimated` + `measurements_consent` chưa được map trong measurementService**
  (2026-07-05, phát hiện khi fix `body_shape` mapping): cột có sẵn trong DB, onboarding
  gửi `measurementsConsent`/`poseEstimated` nhưng `bodyToRow()` drop lặng lẽ → consent
  chưa bao giờ ghi xuống DB (privacy-relevant). Cần quyết semantics trước khi map (consent
  false có nghĩa là phải xoá số đo?) nên chưa fix cùng đợt.
- [ ] **Xoá bust/waist/hip không clear `body_shape` cũ trong DB** (2026-07-05): cả
  useMeasurements lẫn measurements-edit đều save `bodyShape ?? undefined` → thiếu số đo
  thì giữ shape cũ (stale) thay vì ghi null. Đổi thành ghi null nếu muốn shape luôn
  consistent với số đo hiện có.
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
- [ ] **`useAddWizard`/`tryOnStore` chưa guard double-submit UI (double-tap nút).** Token đã
  chặn được phần leak/race dữ liệu ở tầng store; vẫn nên thêm disable-while-pending ở nút
  Scan/Add-to-Wardrobe cho double-tap UI nếu muốn chặt hơn.

- [ ] **`app/measurements-scan.tsx` imports `'expo-file-system'` (new API), not
  `'expo-file-system/legacy'`** (phát hiện 2026-07-06, phiên measure-eval harness — không
  thuộc phạm vi task đó nên không tự sửa): mọi file khác trong repo dùng
  `documentDirectory`/`deleteAsync`/`writeAsStringAsync` đều import từ
  `'expo-file-system/legacy'` (`itemPhotoService.ts`, `tryOnWearService.ts`,
  `seedLocalPhotos.dev.ts`, ...) vì API top-level mới của package chỉ còn shim
  deprecated cho các hàm này — theo `node_modules/expo-file-system/build/legacyWarnings.d.ts`,
  các shim đó **throw at runtime**. `measurements-scan.tsx` gọi
  `FileSystem.deleteAsync(...)` 5 chỗ (cleanup file tạm, kể cả comment "PRIVACY: ... deleted")
  nhưng tất cả đều bọc `.catch(() => {})` nên lỗi bị nuốt im lặng — nghĩa là **frame tạm
  của camera scan có thể KHÔNG BAO GIỜ thực sự bị xoá** trên build đang chạy package
  version này (privacy-relevant, cần verify trên máy thật). Fix: đổi import sang
  `'expo-file-system/legacy'` giống các file khác, rồi verify file tạm thật sự biến mất.

**Crash / hang (Medium):**
- [ ] Loạt màn onboarding gọi async không try/catch (`account.tsx`, `basics.tsx`,
  `location.tsx`, `styles.tsx`, `colors.tsx`, `complete.tsx`, `wardrobe-intro.tsx`) — mất
  mạng giữa lúc bấm Continue/Save làm nút loading kẹt mãi, không báo lỗi.
  `fitEngineStore` write actions (`setBodyMeasurements`, `setStyleProfile`,
  `setColorPreferences`, ...) cũng không tự bắt lỗi, và các trang edit
  (`measurements-edit.tsx`, `styles-edit.tsx`, `colors-edit.tsx`, `formulas-edit.tsx`) gọi
  chúng cũng không catch — Supabase upsert fail thì local state đã lỡ update lạc quan,
  client/server lệch nhau âm thầm.
- [ ] `personal-color.tsx` — `cameraRef.current.takePictureAsync(...)` (2 chỗ) không có
  try/catch; camera bận/app bị background → unhandled rejection, bước scan kẹt im lặng.
- [ ] `app/try-on/wear.tsx:51` — `JSON.parse(data)` từ nav param không try/catch (khác
  `app/outfit/[id].tsx` đã guard); param hỏng/bị cắt → crash màn hình.
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
- [ ] **MoveNet Thunder (256px) thay Lightning** (2026-07-06, tùy chọn): keypoint chính
  xác hơn ~vài %, model ~7MB (vs 2.9MB), chậm hơn ~2-3x mỗi frame poll. Chỉ đáng làm nếu
  sau calibration silhouette mà lengths (inseam/torso) vẫn nhiễu.
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
